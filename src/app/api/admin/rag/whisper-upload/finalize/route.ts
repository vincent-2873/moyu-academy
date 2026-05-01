import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import Groq from "groq-sdk";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs";
import path from "path";
import os from "os";
import { spawn, execSync } from "child_process";
import crypto from "crypto";

/**
 * 優先用 system ffmpeg(nixpacks.toml apt install)
 * Fallback ffmpeg-static(npm package binary)
 *
 * Zeabur container 加 system ffmpeg 後,這裡會抓 /usr/bin/ffmpeg(穩)
 */
function resolveFfmpegPath(): string | null {
  try {
    // 優先 PATH ffmpeg
    const sysPath = execSync("which ffmpeg", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (sysPath) return sysPath;
  } catch {}
  return ffmpegStatic ?? null;
}
const FFMPEG_PATH = resolveFfmpegPath();

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

function runFfmpeg(args: string[], timeoutMs = 600_000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!FFMPEG_PATH) {
      reject(new Error("ffmpeg 沒安裝(system + ffmpeg-static 都找不到)"));
      return;
    }
    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn(FFMPEG_PATH, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      reject(new Error(`ffmpeg spawn 失敗:${(e as Error).message}`));
      return;
    }
    let stderr = "";
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`ffmpeg timeout ${timeoutMs / 1000}s`));
    }, timeoutMs);
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`ffmpeg subprocess error: ${err.message}`));
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
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
    const { filename, total_chunks: totalChunks, brand: brandHint, speaker: speakerHint, pillar: pillarHint } = manifest;
    const brand = brandHint || inferBrand(filename);
    const pillar: "sales" | "legal" | "common" = pillarHint && ["sales", "legal", "common"].includes(pillarHint) ? pillarHint : "sales";

    // 1. 拼接 chunks → full file
    const fullPath = path.join(tempDir, `_full_${filename}`);
    const writeStream = fs.createWriteStream(fullPath);
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(tempDir, `chunk_${String(i).padStart(6, "0")}`);
      writeStream.write(fs.readFileSync(chunkPath));
    }
    await new Promise<void>((res) => writeStream.end(res));

    // 2. 判斷:小檔(< 24MB)跳 ffmpeg 直送 Whisper / 大檔走 ffmpeg
    // Groq Whisper API 接受 wav/mp3/m4a/mp4/mpeg/mpga/webm 全自動 decode,< 25MB 即可
    const isWhisperSupported = /\.(wav|mp3|m4a|flac|ogg|mp4|mpeg|mpga|webm)$/i.test(filename);
    const sizeMB = fs.statSync(fullPath).size / 1024 / 1024;
    const skipFfmpeg = isWhisperSupported && sizeMB < 24;

    let segments: string[] = [];
    if (skipFfmpeg) {
      // 小 audio 直接當 1 段送 Whisper(避免 ffmpeg-static 在 Zeabur 跑不起來的風險)
      segments = [fullPath];
      await updateJob({ stage: "whisper_transcribe", segments_total: 1, segments_done: 0 });
    } else {
      // 大檔 / 影片 / 其他需要 ffmpeg 提取音訊 + 切片
      // 24kbps mono 16kHz mp3 + 切 90 min 段(對 2h+ 銷售錄影,單段 < 16MB)
      const segPattern = path.join(tempDir, `seg_%03d.mp3`);
      await runFfmpeg([
        "-y", "-i", fullPath,
        "-vn", "-ac", "1", "-ar", "16000", "-b:a", "24k",
        "-f", "segment", "-segment_time", "5400", // 90 min
        "-reset_timestamps", "1",
        segPattern,
      ], 600_000); // 10 min hard timeout(對 4h+ 影片足夠)
      segments = fs.readdirSync(tempDir)
        .filter(f => f.startsWith("seg_") && f.endsWith(".mp3"))
        .sort()
        .map(f => path.join(tempDir, f));

      if (segments.length === 0) throw new Error("ffmpeg 沒產生切片(可能不是 audio/video)");
      await updateJob({ stage: "whisper_transcribe", segments_total: segments.length, segments_done: 0 });
    }

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

    const titlePrefix = pillar === "legal"
      ? `法務 ${speakerHint || ""}`.trim()
      : `${brand} 業務開發 Call`;

    const payload = {
      source_type: "recording_transcript" as const,
      source_id: sourceId,
      title: `${titlePrefix} — ${speakerHint || filename.replace(/\.[^.]+$/, "")}`,
      brand: pillar === "legal" ? null : brand,    // 法務不分品牌
      path_type: pillar === "legal" ? ("legal" as const) : ("business" as const),
      pillar,
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
  const { filename, size, brand: brandHint, speaker, pillar: pillarHint } = manifest;
  const brand = brandHint || inferBrand(filename);
  const pillarValue = pillarHint && ["sales", "legal", "common"].includes(pillarHint) ? pillarHint : "sales";

  const sb = getSupabaseAdmin();

  // idempotent:同 upload_id 已 finalize 過就直接回現有 job_id
  const { data: existing } = await sb.from("whisper_jobs")
    .select("id, status")
    .eq("upload_id", uploadId)
    .maybeSingle();

  if (existing) {
    // done / processing / pending → 直接回現有 job_id,client polling 會看到結果
    if (existing.status === "done" || existing.status === "processing" || existing.status === "pending") {
      return NextResponse.json({
        ok: true,
        job_id: existing.id,
        status: existing.status,
        upload_id: uploadId,
        resumed: true,
      });
    }
    // failed → reset 重跑
    await sb.from("whisper_jobs").update({
      status: "pending",
      stage: null,
      segments_done: 0,
      error: null,
      started_at: null,
      finished_at: null,
    }).eq("id", existing.id);

    processInBackground(existing.id, uploadId).catch(e => console.error("[whisper-bg-retry]", e));

    return NextResponse.json({
      ok: true,
      job_id: existing.id,
      status: "pending",
      upload_id: uploadId,
      retried: true,
    });
  }

  // 全新 INSERT
  const { data: job, error: jobErr } = await sb.from("whisper_jobs")
    .insert({
      upload_id: uploadId,
      filename,
      file_size: size,
      brand: pillarValue === "legal" ? null : brand,
      pillar: pillarValue,
      speaker: speaker || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    return NextResponse.json({
      ok: false,
      error: `INSERT whisper_jobs failed: ${jobErr?.message ?? "unknown"}`,
      hint: "若 'relation does not exist',D27 SQL 還沒 apply。請進 GitHub Actions 跑 Apply Supabase Migration workflow,選 supabase-migration-D27-whisper-jobs.sql",
    }, { status: 500 });
  }

  processInBackground(job.id, uploadId).catch(e => console.error("[whisper-bg]", e));

  return NextResponse.json({
    ok: true,
    job_id: job.id,
    status: "pending",
    upload_id: uploadId,
  });
}
