#!/usr/bin/env node
/**
 * 本機 ffmpeg 壓縮 — 把大檔 wav / mp4 / mov 壓成 < 24MB 的 mp3
 * 跑 ffmpeg-static(本機 binary,不靠 Zeabur 容器)
 *
 * 跑法:
 *   node scripts/compress-for-whisper.mjs
 *
 * 預設掃 ~/Downloads/訓練資料/ 全部 audio/video > 24MB,壓成 mp3 16kHz mono 32kbps
 * 輸出進 ~/Downloads/訓練資料/_compressed/{原檔名}.mp3
 *
 * 壓完拖到 admin UI 走 fast path 即可,沒 Zeabur ffmpeg 卡點
 */

import fs from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";

const SOURCE_ROOT = "C:/Users/USER/Downloads/訓練資料";
const OUTPUT_DIR = path.join(SOURCE_ROOT, "_compressed");
const SIZE_THRESHOLD_MB = 24;
const SKIP_DIRS = ["HR資料", "_unzipped", "_compressed"];

const AUDIO_VIDEO_EXTS = [".wav", ".mp3", ".m4a", ".mp4", ".mov", ".webm"];

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function walkSource(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (SKIP_DIRS.some(s => item.name === s)) continue;
      walkSource(full, results);
    } else {
      const ext = path.extname(item.name).toLowerCase();
      if (AUDIO_VIDEO_EXTS.includes(ext)) {
        const size = fs.statSync(full).size;
        if (size > SIZE_THRESHOLD_MB * 1024 * 1024) {
          results.push({ path: full, size });
        }
      }
    }
  }
  return results;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", d => (stderr += d.toString()));
    proc.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-300)}`));
    });
  });
}

async function main() {
  console.log(`🔍 掃 ${SOURCE_ROOT} 找 > ${SIZE_THRESHOLD_MB}MB 的 audio/video…\n`);
  const files = walkSource(SOURCE_ROOT);

  if (files.length === 0) {
    console.log("✅ 沒檔案需要壓縮(全 < 24MB)");
    return;
  }

  // 去重複(同檔可能在多目錄)
  const seen = new Set();
  const unique = files.filter(f => {
    const key = `${path.basename(f.path)}-${f.size}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`找到 ${unique.length} 個大檔(去重複後):\n`);
  unique.forEach(f => {
    console.log(`  ${(f.size / 1024 / 1024).toFixed(1)}MB · ${path.basename(f.path)}`);
  });
  console.log();

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < unique.length; i++) {
    const { path: src, size } = unique[i];
    const filename = path.basename(src, path.extname(src));
    const outPath = path.join(OUTPUT_DIR, `${filename}.mp3`);

    if (fs.existsSync(outPath)) {
      const outSize = fs.statSync(outPath).size;
      if (outSize > 0 && outSize < SIZE_THRESHOLD_MB * 1024 * 1024) {
        console.log(`[${i + 1}/${unique.length}] ⏭️ skip(已壓過):${path.basename(outPath)}(${(outSize / 1024 / 1024).toFixed(1)}MB)`);
        ok++;
        continue;
      }
    }

    console.log(`[${i + 1}/${unique.length}] ▶ 壓縮 ${path.basename(src)}(${(size / 1024 / 1024).toFixed(1)}MB)…`);
    try {
      // 24kbps mono 16kHz mp3 + 切段 90 min(對 2h+ 銷售錄影一定 < 24MB / 段)
      // 1h ~ 10MB · 2h → 2 段(16+5MB)· 3h → 2 段(16+16)· 4h → 3 段
      const segPattern = path.join(OUTPUT_DIR, `${filename}_part%03d.mp3`);
      await runFfmpeg([
        "-y", "-i", src,
        "-vn", "-ac", "1", "-ar", "16000", "-b:a", "24k",
        "-f", "segment", "-segment_time", "5400", // 90 min
        "-reset_timestamps", "1",
        segPattern,
      ]);

      // 列出產生的 segments
      const parts = fs.readdirSync(OUTPUT_DIR)
        .filter(f => f.startsWith(`${filename}_part`) && f.endsWith(".mp3"))
        .sort();

      const totalSize = parts.reduce((acc, p) => acc + fs.statSync(path.join(OUTPUT_DIR, p)).size, 0);
      console.log(`           ✅ → ${parts.length} 段:${parts.map(p => {
        const s = fs.statSync(path.join(OUTPUT_DIR, p)).size / 1024 / 1024;
        return `${p}(${s.toFixed(1)}MB)`;
      }).join(", ")}`);
      ok++;
    } catch (e) {
      console.log(`           ❌ ${e.message}`);
      failed++;
    }
  }

  console.log(`\n=== 總結 ===`);
  console.log(`✅ 成功:${ok}/${unique.length}`);
  if (failed > 0) console.log(`❌ 失敗:${failed}`);

  const allOutputs = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith(".mp3"));
  console.log(`📦 輸出 ${allOutputs.length} 個 .mp3 段`);
  console.log(`📁 位置:${OUTPUT_DIR}`);
  console.log(`📤 拖全部 .mp3 到 https://moyusales.zeabur.app/admin/claude/knowledge 走 fast path`);
  console.log(`💡 同檔分段(如 _part001.mp3 / _part002.mp3)獨立進 RAG 各一筆 chunk,語意搜尋反而更精準`);
}

main().catch(e => {
  console.error("💥 Fatal:", e);
  process.exit(1);
});
