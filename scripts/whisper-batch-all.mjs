#!/usr/bin/env node
/**
 * 一次處理全品牌全 wav + mp4(本機跑,bypass platform body size limit)
 *
 * 對齊 Vincent 鐵則:
 *   - 不只 nSchool,5 品牌全處理
 *   - 大檔自動切片(Groq Whisper 25MB 限)
 *   - 錄影 mp4/mov 自動提取 audio
 *   - 並行 Groq Whisper 加速
 *   - 直接 INSERT supabase(service_role bypass auth)
 *
 * 使用:
 *   1. cp .env.local.template .env.local
 *   2. paste GROQ_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 進 .env.local
 *   3. node scripts/whisper-batch-all.mjs
 *
 * 預期執行 ~10-30 分鐘(視檔案數 + Groq API 速度)
 */

import fs from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";
import ffmpegPath from "ffmpeg-static";

// ─── env 讀取 ──────────────────────────────────────────────────────────
function loadEnv() {
  const envFile = ".env.local";
  if (!fs.existsSync(envFile)) {
    console.error(`❌ 找不到 ${envFile}。請先 cp .env.local.template .env.local 填入 key`);
    process.exit(1);
  }
  const content = fs.readFileSync(envFile, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) {
      const [, key, val] = m;
      const stripped = val.trim().replace(/^["']|["']$/g, "");
      if (stripped) process.env[key] = stripped;
    }
  }
}
loadEnv();

const GROQ_KEY = process.env.GROQ_API_KEY;
const SB_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!GROQ_KEY || !SB_URL || !SB_KEY) {
  console.error("❌ .env.local 缺 key:");
  console.error(`   GROQ_API_KEY: ${GROQ_KEY ? "✓" : "✗"}`);
  console.error(`   SUPABASE_URL: ${SB_URL ? "✓" : "✗"}`);
  console.error(`   SUPABASE_SERVICE_ROLE_KEY: ${SB_KEY ? "✓" : "✗"}`);
  process.exit(1);
}

const groq = new Groq({ apiKey: GROQ_KEY });
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

// ─── 來源檔案盤點(全品牌)────────────────────────────────────────────
const SOURCE_ROOT = "C:/Users/USER/Downloads/訓練資料";
const TEMP_DIR = path.join(os.tmpdir(), `moyu-whisper-${Date.now()}`);
fs.mkdirSync(TEMP_DIR, { recursive: true });

const AUDIO_EXTS = [".wav", ".mp3", ".m4a"];
const VIDEO_EXTS = [".mp4", ".mov", ".webm"];
const SKIP_DIRS = ["HR資料", "_unzipped"]; // HR 不用 + _unzipped 是 zip 解壓重複

function walkSource(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (SKIP_DIRS.some(s => item.name === s)) continue;
      walkSource(full, results);
    } else {
      const ext = path.extname(item.name).toLowerCase();
      if (AUDIO_EXTS.includes(ext) || VIDEO_EXTS.includes(ext)) {
        results.push(full);
      }
    }
  }
  return results;
}

function inferBrand(filepath) {
  const lower = filepath.toLowerCase().replace(/\\/g, "/");
  if (/lance_call|xuemi|學米/i.test(filepath)) return "xuemi";
  if (/xlab|automation|陳冠亨|俊由|鎮宇|宣妤/i.test(filepath)) return "xlab";
  if (/ooschool|無限|張0001|張0002/i.test(filepath)) return "ooschool";
  if (/博宇|嘉賢|昱賢|婉婷|aischool|未來|劉依玲|胡彩渝|許姿儀/i.test(filepath)) return "aischool";
  if (/nschool|jobvexp|stvexp|ns_/i.test(lower)) return "nschool";
  if (/銷售簡報.*v.?2/i.test(filepath)) return "sales-deck-v2";
  return "nschool"; // 預設
}

// ─── ffmpeg helpers ────────────────────────────────────────────────────
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function extractAndSplit(input, baseId) {
  // 任何 audio/video → mp3 16kHz mono 32kbps + 切片(每段 600s ≈ 2.4MB,< Groq 25MB)
  // 切片用 segment muxer(-f segment),每段命名 baseId_000.mp3 / 001.mp3 ...
  const outPattern = path.join(TEMP_DIR, `${baseId}_%03d.mp3`);
  await runFfmpeg([
    "-y",
    "-i", input,
    "-vn",                // 去掉 video stream
    "-ac", "1",            // mono
    "-ar", "16000",        // 16kHz(Whisper 最佳)
    "-b:a", "32k",         // 32kbps voice 足夠清楚
    "-f", "segment",
    "-segment_time", "600", // 每段 10 分鐘
    outPattern,
  ]);
  // 列出所有切片
  return fs.readdirSync(TEMP_DIR)
    .filter(f => f.startsWith(`${baseId}_`) && f.endsWith(".mp3"))
    .sort()
    .map(f => path.join(TEMP_DIR, f));
}

// ─── Whisper(並行 throttle) ────────────────────────────────────────
async function transcribeChunk(chunkPath) {
  const stream = fs.createReadStream(chunkPath);
  const result = await groq.audio.transcriptions.create({
    file: stream,
    model: "whisper-large-v3",
    response_format: "verbose_json",
    language: "zh",
  });
  return result.text || "";
}

async function transcribeAllChunks(chunks, fname) {
  const results = new Array(chunks.length);
  const CONCURRENCY = 3;
  let idx = 0;
  async function worker(workerId) {
    while (true) {
      const i = idx++;
      if (i >= chunks.length) break;
      try {
        process.stdout.write(`   [worker-${workerId}] 段 ${i + 1}/${chunks.length}…`);
        const text = await transcribeChunk(chunks[i]);
        results[i] = text;
        process.stdout.write(` ✓ (${text.length} chars)\n`);
      } catch (e) {
        process.stdout.write(` ✗ ${e.message}\n`);
        results[i] = `[轉錄失敗:${e.message}]`;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));
  return results.join("\n\n").trim();
}

// ─── INSERT supabase ─────────────────────────────────────────────────
async function ingestChunk({ filepath, brand, transcript }) {
  if (!transcript || transcript.length < 50) {
    return { skipped: true, reason: "transcript < 50 chars" };
  }
  const filename = path.basename(filepath);
  const sourceId = `recording/${brand}/${filename}`;
  const contentHash = crypto.createHash("sha256").update(transcript).digest("hex");

  const { data: existing } = await sb.from("knowledge_chunks")
    .select("id, content_hash")
    .eq("source_type", "recording_transcript")
    .eq("source_id", sourceId)
    .maybeSingle();

  const payload = {
    source_type: "recording_transcript",
    source_id: sourceId,
    title: `${brand} 業務開發 Call — ${filename.replace(/\.(wav|mp3|mp4|mov|m4a|webm)$/i, "")}`,
    brand,
    path_type: "business",
    pillar: "sales",
    content: transcript.slice(0, 50000),
    content_hash: contentHash,
    metadata: {
      source_brand: brand,
      source_filename: filename,
      source_path: filepath.replace(/^.*訓練資料/, "訓練資料"),
      transcribed_via: "groq-whisper-large-v3",
      transcribed_at: new Date().toISOString(),
    },
    token_count: Math.ceil(transcript.length / 2.5),
  };

  if (existing) {
    if (existing.content_hash === contentHash) {
      return { skipped: true, reason: "already ingested (hash match)" };
    }
    const { error } = await sb.from("knowledge_chunks").update(payload).eq("id", existing.id);
    if (error) throw error;
    return { updated: true, chunk_id: existing.id };
  } else {
    const { data, error } = await sb.from("knowledge_chunks").insert(payload).select("id").single();
    if (error) throw error;
    return { inserted: true, chunk_id: data.id };
  }
}

// ─── 主流程 ────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Whisper Batch All — 全品牌處理 ===\n");
  const files = walkSource(SOURCE_ROOT);
  console.log(`找到 ${files.length} 個 audio/video 檔(已排除 HR + _unzipped 重複):`);

  // 去重複(同檔可能在多品牌資料夾出現,看 size + filename 為依據)
  const seen = new Set();
  const dedup = files.filter(f => {
    const key = `${path.basename(f)}-${fs.statSync(f).size}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`去重複後 ${dedup.length} 個獨立檔案\n`);

  const summary = { ok: 0, skipped: 0, failed: 0, total_chars: 0 };
  for (let i = 0; i < dedup.length; i++) {
    const filepath = dedup[i];
    const filename = path.basename(filepath);
    const brand = inferBrand(filepath);
    const sizeMB = (fs.statSync(filepath).size / 1024 / 1024).toFixed(1);
    console.log(`\n[${i + 1}/${dedup.length}] ${filename}(${sizeMB}MB · brand=${brand})`);

    const baseId = `t${Date.now()}_${i}`;
    try {
      // 1. ffmpeg 提取 audio + 切片
      console.log(`   ▶ ffmpeg extract + split…`);
      const chunks = await extractAndSplit(filepath, baseId);
      console.log(`   ▶ 切成 ${chunks.length} 段 mp3(16kHz mono 32kbps)`);

      // 2. 並行 Whisper
      const transcript = await transcribeAllChunks(chunks, filename);

      // 3. INSERT supabase
      const result = await ingestChunk({ filepath, brand, transcript });
      if (result.skipped) {
        console.log(`   ▶ ⏭️ skipped: ${result.reason}`);
        summary.skipped++;
      } else if (result.inserted) {
        console.log(`   ▶ ✅ inserted chunk ${result.chunk_id}(${transcript.length} chars)`);
        summary.ok++;
        summary.total_chars += transcript.length;
      } else if (result.updated) {
        console.log(`   ▶ 🔄 updated chunk ${result.chunk_id}(${transcript.length} chars)`);
        summary.ok++;
        summary.total_chars += transcript.length;
      }

      // 4. cleanup chunks
      for (const c of chunks) fs.unlinkSync(c);
    } catch (e) {
      console.log(`   ▶ ❌ ${e.message}`);
      summary.failed++;
    }
  }

  // cleanup temp
  try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }); } catch {}

  console.log(`\n=== 總結 ===`);
  console.log(`✅ 成功:${summary.ok}`);
  console.log(`⏭️ 跳過:${summary.skipped}(已 ingest 過)`);
  console.log(`❌ 失敗:${summary.failed}`);
  console.log(`📝 總 transcript 字數:${summary.total_chars.toLocaleString()}`);
  console.log(`\n進 https://moyusales.zeabur.app/admin/claude/knowledge 看 KNOWLEDGE 數字。`);
}

main().catch(e => {
  console.error(`\n💥 Fatal:`, e);
  process.exit(1);
});
