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
export const maxDuration = 60; // 立即回 job_id,不等處理(處理交給 background)

/**
 * POST /api/admin/rag/whisper-upload/finalize
 *
 * 第 3 步 chunked upload(非同步 v3):
 *   - 立即 INSERT whisper_jobs(status=pending)→ 回 { job_id }
 *   - Background process(不 await)做 ffmpeg + Whisper + INSERT
 *   - Client polling /status?job_id=xxx 看完成沒
 *
 * 解決:Zeabur platform proxy timeout(~60-120s)< 大檔處理時間(3-5min)
 *
 * Body: { upload_id }
 * Resp: { ok, job_id, status: 'pending' }
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

/**
 * Background processing — 不阻塞 endpoint return
 * 直接寫進 whisper_jobs status 讓 client polling
 */
async function processInBackground(jobId: string, uploadId: string) {
  const sb = getSupabaseAdmin();
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
  const tempDir = path.join(os.tmpdir(), "moyu-whisper-uploads", uploadId);

  const updateJob = async (patch: Record<string, unknown>) => {
    await sb.from("whisper_jobs").update(patch).eq("id", jobId);
  };

  try {
    await updateJob({ status: "processing", started_at: new Date().toISOString(), stage: "ffmpeg_split" });

    if (!fs.existsSync(tempDir)) throw new Error(`temp dir 不存在:${tempDir}`);

    const manifestPath = path.join(tempDir, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const { filename, total_chunks: totalChunks, brand: brandHint, speaker: speakerHint } = manifest;
    const brand = brandHint || inferBrand(filename);

    // 1. 拼接 chunks → full file
    const fullPath = path.join(tempDir, `_full_${filename}`);
    const writeStream = fs.createWriteStream(fullPath);
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(tempDir, `chunk_${String(i).padStart(6, "0")}`);
      writeStream.write(fs.readFileSync(chunkPath));
    }
    await new Promise<void>((res) => writeStream.end(res));

    // 2. ffmpeg 切片
    const segPattern = path.join(tempDir, `seg_%03d.mp3`);
    await runFfmpeg([
      "-y", "-i", fullPath,
      "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k",
      "-f", "segment", "-segment_time", "600",
      segPattern,
    ]);
    const segments = fs.readdirSync(tempDir)
      .filter(f => f.startsWith("seg_") && f.endsWith(".mp3"))
      .sort()
      .map(f => path.join(tempDir, f));

    if (segments.length === 0) throw new Error("ffmpeg 沒產生切片(可能不是 audio/video)");

    await updateJob({ stage: "whisper_transcribe", segments_total: segments.length, segments_done: 0 });

    // 3. 並行 Whisper(throttle 3 + 即時更新進度)
    const transcripts: string[] = new Array(segments.length);
    const CONCURRENCY = 3;
    let nextIdx = 0;
    let doneCount = 0;
    async function worker() {
      while (true) {
        const i = nextIdx++;
        if (i >= segments.length) break;
        try {
          const stream = fs.createReadStream(segments[i]);
          const r = await groq.audio.transcriptions.create({
            file: stream, model: "whisper-large-v3",
            response_format: "verbose_json", language: "zh",
          });
          transcripts[i] = (r as { text?: string }).text || "";
        } catch (e) {
          transcripts[i] = `[段 ${i + 1} 轉錄失敗:${(e as Error).message}]`;
        }
        doneCount++;
        if (doneCount % 1 === 0) await updateJob({ segments_done: doneCount });
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    const transcript = transcripts.join("\n\n").trim();
    if (transcript.length < 30) throw new Error(`transcript too short (${transcript.length} chars)`);

    // 4. INSERT knowledge_chunks
    await updateJob({ stage: "db_insert" });
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
        source_brand: brand, source_filename: filename, speaker: speakerHint,
        segments: segments.length, transcribed_via: "groq-whisper-large-v3",
        transcribed_at: new Date().toISOString(), upload_via: "chunked-upload-async",
        job_id: jobId,
      },
      token_count: Math.ceil(transcript.length / 2.5),
    };

    let chunkId: string;
    if (existing) {
      const { error } = await sb.from("knowledge_chunks").update(payload).eq("id", existing.id);
      if (error) throw error;
      chunkId = existing.id;
    } else {
      const { data, error } = await sb.from("knowledge_chunks").insert(payload).select("id").single();
      if (error) throw error;
      chunkId = data.id;
    }

    // 5. 標記 done + cleanup
    await updateJob({
      status: "done", stage: null,
      transcript_chars: transcript.length,
      chunk_id: chunkId,
      finished_at: new Date().toISOString(),
    });
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  } catch (e) {
    await updateJob({
      status: "failed",
      error: (e as Error).message,
      finished_at: new Date().toISOString(),
    });
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ ok: false, error: "GROQ_API_KEY missing" }, { status: 503 });
  }

  let body: { upload_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "json parse error" }, { status: 400 });
  }

  const uploadId = String(body.upload_id ?? "");
  if (!uploadId) return NextResponse.json({ ok: false, error: "upload_id required" }, { status: 400 });

  const tempDir = path.join(os.tmpdir(), "moyu-whisper-uploads", uploadId);
  if (!fs.existsSync(tempDir)) return NextResponse.json({ ok: false, error: "upload_id not found / expired" }, { status: 404 });

  // 讀 manifest 拿 metadata
  const manifest = JSON.parse(fs.readFileSync(path.join(tempDir, "manifest.json"), "utf8"));
  const { filename, size, brand: brandHint, speaker } = manifest;
  const brand = brandHint || inferBrand(filename);

  // INSERT whisper_jobs(status=pending)
  const sb = getSupabaseAdmin();
  const { data: job, error: jobErr } = await sb.from("whisper_jobs")
    .insert({
      upload_id: uploadId,
      filename,
      file_size: size,
      brand,
      pillar: "sales",
      speaker: speaker || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    return NextResponse.json({
      ok: false,
      error: `INSERT whisper_jobs failed: ${jobErr?.message ?? "unknown"}`,
      hint: "若 'relation does not exist',D27 SQL 還沒 apply",
    }, { status: 500 });
  }

  // 立刻回 job_id,background 開跑(不 await)
  processInBackground(job.id, uploadId).catch(e => {
    console.error("[whisper-bg]", e);
  });

  return NextResponse.json({
    ok: true,
    job_id: job.id,
    status: "pending",
    upload_id: uploadId,
  });
}
