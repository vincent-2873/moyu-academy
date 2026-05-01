import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import Groq from "groq-sdk";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 分鐘(Whisper 多檔處理會長)

/**
 * POST /api/admin/rag/whisper-batch
 * 接 multipart/form-data,多檔 .wav/.mp3 → Groq Whisper Large v3 → INSERT knowledge_chunks
 *
 * 對齊 Vincent 鐵則「不只 nSchool」+ system-tree v2 §RAG 知識庫:
 *   - audio source 是業務開發 Call 訓練核心
 *   - 5 品牌 + nSchool 8 通 + XLAB 6 通 + 學米 2 通 + AI 未來 3 通
 *   - 轉成文字進 knowledge_chunks(pillar='sales', brand 從檔名/欄位推斷)
 *
 * brand 推斷規則:
 *   1. multipart 帶 `brand` 欄位 → 用該值
 *   2. 否則檔名含品牌 keyword → 推斷
 *   3. 預設 nschool
 *
 * Body(multipart):
 *   files[]: .wav / .mp3
 *   brand?: 'nschool' | 'xuemi' | 'ooschool' | 'aischool' | 'xlab'
 *   speaker?: '張三' / '李四'(進 metadata)
 */
export async function POST(req: NextRequest) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json({ ok: false, error: "GROQ_API_KEY missing in env" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e) {
    return NextResponse.json({ ok: false, error: `formData parse error: ${(e as Error).message}` }, { status: 400 });
  }

  const files = formData.getAll("files") as File[];
  const brandHint = (formData.get("brand") as string | null)?.trim() || null;
  const speakerHint = (formData.get("speaker") as string | null)?.trim() || null;

  if (!files.length) {
    return NextResponse.json({ ok: false, error: "files[] is empty" }, { status: 400 });
  }

  const groq = new Groq({ apiKey: groqKey });
  const sb = getSupabaseAdmin();

  const results: Array<{
    filename: string;
    ok: boolean;
    brand?: string;
    chars?: number;
    chunk_id?: string;
    error?: string;
  }> = [];

  for (const file of files) {
    const filename = file.name || "untitled.wav";
    try {
      // 1) brand 推斷
      const brand = brandHint || inferBrand(filename) || "nschool";

      // 2) Whisper 轉錄
      const buf = Buffer.from(await file.arrayBuffer());
      const blobFile = new File([buf], filename, { type: file.type || "audio/wav" });
      const transcription = await groq.audio.transcriptions.create({
        file: blobFile,
        model: "whisper-large-v3",
        response_format: "verbose_json",
        language: "zh",
      });

      const text = (transcription as { text?: string }).text ?? "";
      if (!text || text.length < 30) {
        results.push({ filename, ok: false, error: `Transcript too short (${text.length} chars)` });
        continue;
      }

      // 3) INSERT knowledge_chunks(content_hash 防重)
      const contentHash = crypto.createHash("sha256").update(text).digest("hex");
      const sourceId = `recording/${brand}/${filename}`;

      const { data: existing } = await sb.from("knowledge_chunks")
        .select("id, content_hash")
        .eq("source_type", "recording_transcript")
        .eq("source_id", sourceId)
        .maybeSingle();

      const payload = {
        source_type: "recording_transcript" as const,
        source_id: sourceId,
        title: `${brand} 業務開發 Call — ${speakerHint || filename.replace(/\.(wav|mp3)$/i, "")}`,
        brand,
        path_type: "business" as const,
        pillar: "sales" as const,
        content: text.slice(0, 50000),
        content_hash: contentHash,
        metadata: {
          source_brand: brand,
          source_filename: filename,
          speaker: speakerHint,
          duration_sec: (transcription as { duration?: number }).duration,
          transcribed_via: "groq-whisper-large-v3",
          transcribed_at: new Date().toISOString(),
        },
        token_count: Math.ceil(text.length / 2.5),
      };

      let chunkId: string;
      if (existing) {
        if (existing.content_hash === contentHash) {
          results.push({ filename, ok: true, brand, chars: text.length, chunk_id: existing.id, error: "skip (already ingested)" });
          continue;
        }
        const { data, error } = await sb.from("knowledge_chunks").update(payload).eq("id", existing.id).select("id").single();
        if (error) throw error;
        chunkId = data.id;
      } else {
        const { data, error } = await sb.from("knowledge_chunks").insert(payload).select("id").single();
        if (error) throw error;
        chunkId = data.id;
      }

      results.push({ filename, ok: true, brand, chars: text.length, chunk_id: chunkId });
    } catch (e) {
      results.push({ filename, ok: false, error: (e as Error).message });
    }
  }

  // 寫 ingest log
  const okCount = results.filter(r => r.ok).length;
  await sb.from("knowledge_sources_log").insert({
    source_type: "recording_transcript",
    source_id: "whisper_batch",
    chunks_added: okCount,
    chunks_updated: 0,
    status: okCount === results.length ? "ok" : okCount > 0 ? "partial" : "failed",
    metadata: { files_processed: results.length, brand_hint: brandHint },
  });

  return NextResponse.json({
    ok: true,
    total: results.length,
    success: okCount,
    failed: results.length - okCount,
    results,
  });
}

function inferBrand(filename: string): string | null {
  const lower = filename.toLowerCase();
  if (/lance_call|xuemi|學米/i.test(filename)) return "xuemi";
  if (/xlab|automation|陳冠亨|俊由|鎮宇|宣妤/i.test(filename)) return "xlab";
  if (/ooschool|無限|張0001|張0002/i.test(filename)) return "ooschool";
  if (/博宇|嘉賢|昱賢|婉婷|aischool|未來/i.test(filename)) return "aischool";
  if (/nschool|jobvexp|stvexp|ns_/i.test(lower)) return "nschool";
  return null;
}
