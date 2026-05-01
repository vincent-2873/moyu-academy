import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import Groq from "groq-sdk";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/admin/rag/whisper-upload/finalize
 *
 * 第 3 步 chunked upload:全 chunks 收齊後處理:
 *   1. 拼接 chunks → 完整 file
 *   2. ffmpeg-static extract audio + 切片(每段 600s)
 *   3. 並行 Groq Whisper Large v3
 *   4. 拼接 transcript
 *   5. INSERT knowledge_chunks
 *   6. cleanup temp
 *
 * Body: { upload_id }
 */

function inferBrand(filename: string): string {
  if (/lance_call|xuemi|學米/i.test(filename)) return "xuemi";
  if (/xlab|automation|陳冠亨|俊由|鎮宇|宣妤/i.test(filename)) return "xlab";
  if (/ooschool|無限|張0001|張0002/i.test(filename)) return "ooschool";
  if (/博宇|嘉賢|昱賢|婉婷|aischool|未來|劉依玲|胡彩渝|許姿儀/i.test(filename)) return "aischool";
  if (/銷售簡報.*v.?2/i.test(filename)) return "sales-deck-v2";
  return "nschool";
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-300)}`));
    });
  });
}

export async function POST(req: NextRequest) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json({ ok: false, error: "GROQ_API_KEY missing in env" }, { status: 503 });
  }

  let body: { upload_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "json parse error" }, { status: 400 });
  }

  const uploadId = String(body.upload_id ?? "");
  if (!uploadId) {
    return NextResponse.json({ ok: false, error: "upload_id required" }, { status: 400 });
  }

  const tempDir = path.join(os.tmpdir(), "moyu-whisper-uploads", uploadId);
  if (!fs.existsSync(tempDir)) {
    return NextResponse.json({ ok: false, error: "upload_id not found / expired" }, { status: 404 });
  }

  const manifestPath = path.join(tempDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const { filename, total_chunks: totalChunks, brand: brandHint, speaker: speakerHint } = manifest;

  // 確認所有 chunks 收齊
  const received = (manifest.chunks_received as number[]).sort((a, b) => a - b);
  if (received.length !== totalChunks) {
    return NextResponse.json({
      ok: false,
      error: `chunks 不完整:收到 ${received.length}/${totalChunks}`,
    }, { status: 400 });
  }

  const brand = brandHint || inferBrand(filename);
  const groq = new Groq({ apiKey: groqKey });
  const sb = getSupabaseAdmin();

  try {
    // 1. 拼接 chunks → 完整 file
    const fullPath = path.join(tempDir, `_full_${filename}`);
    const writeStream = fs.createWriteStream(fullPath);
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(tempDir, `chunk_${String(i).padStart(6, "0")}`);
      const data = fs.readFileSync(chunkPath);
      writeStream.write(data);
    }
    await new Promise<void>((res) => writeStream.end(res));

    // 2. ffmpeg extract audio + 切片(mp3 16kHz mono 32kbps,每段 600s)
    const segPattern = path.join(tempDir, `seg_%03d.mp3`);
    await runFfmpeg([
      "-y",
      "-i", fullPath,
      "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k",
      "-f", "segment", "-segment_time", "600",
      segPattern,
    ]);
    const segments = fs.readdirSync(tempDir)
      .filter(f => f.startsWith("seg_") && f.endsWith(".mp3"))
      .sort()
      .map(f => path.join(tempDir, f));

    if (segments.length === 0) {
      throw new Error("ffmpeg 沒產生切片(可能不是 audio/video)");
    }

    // 3. 並行 Whisper(throttle 3 concurrent)
    const transcripts: string[] = new Array(segments.length);
    const CONCURRENCY = 3;
    let nextIdx = 0;
    async function worker() {
      while (true) {
        const i = nextIdx++;
        if (i >= segments.length) break;
        try {
          const stream = fs.createReadStream(segments[i]);
          const r = await groq.audio.transcriptions.create({
            file: stream,
            model: "whisper-large-v3",
            response_format: "verbose_json",
            language: "zh",
          });
          transcripts[i] = (r as { text?: string }).text || "";
        } catch (e) {
          transcripts[i] = `[段 ${i + 1} 轉錄失敗:${(e as Error).message}]`;
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    const transcript = transcripts.join("\n\n").trim();
    if (transcript.length < 30) {
      throw new Error(`transcript too short (${transcript.length} chars)`);
    }

    // 4. INSERT knowledge_chunks
    const sourceId = `recording/${brand}/${filename}`;
    const contentHash = crypto.createHash("sha256").update(transcript).digest("hex");
    const { data: existing } = await sb.from("knowledge_chunks")
      .select("id, content_hash")
      .eq("source_type", "recording_transcript")
      .eq("source_id", sourceId)
      .maybeSingle();

    const payload = {
      source_type: "recording_transcript" as const,
      source_id: sourceId,
      title: `${brand} 業務開發 Call — ${speakerHint || filename.replace(/\.[^.]+$/, "")}`,
      brand,
      path_type: "business" as const,
      pillar: "sales" as const,
      content: transcript.slice(0, 50000),
      content_hash: contentHash,
      metadata: {
        source_brand: brand,
        source_filename: filename,
        speaker: speakerHint,
        segments: segments.length,
        transcribed_via: "groq-whisper-large-v3",
        transcribed_at: new Date().toISOString(),
        upload_via: "chunked-upload",
      },
      token_count: Math.ceil(transcript.length / 2.5),
    };

    let chunkId: string;
    let action: "inserted" | "updated" | "skipped" = "inserted";
    if (existing) {
      if (existing.content_hash === contentHash) {
        chunkId = existing.id;
        action = "skipped";
      } else {
        const { error } = await sb.from("knowledge_chunks").update(payload).eq("id", existing.id);
        if (error) throw error;
        chunkId = existing.id;
        action = "updated";
      }
    } else {
      const { data, error } = await sb.from("knowledge_chunks").insert(payload).select("id").single();
      if (error) throw error;
      chunkId = data.id;
    }

    // 5. cleanup temp
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}

    return NextResponse.json({
      ok: true,
      action,
      chunk_id: chunkId,
      brand,
      filename,
      segments: segments.length,
      transcript_chars: transcript.length,
    });
  } catch (e) {
    // cleanup on failure
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
