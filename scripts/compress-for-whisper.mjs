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
      // 16kHz mono 32kbps mp3 = 約 4 KB/s,1 小時 ~14MB,絕對 < 24MB
      // 如果原檔超長(>1.5h),再降到 24kbps:
      const bitrate = size > 100 * 1024 * 1024 ? "24k" : "32k";
      await runFfmpeg([
        "-y", "-i", src,
        "-vn", "-ac", "1", "-ar", "16000", "-b:a", bitrate,
        outPath,
      ]);
      const outSize = fs.statSync(outPath).size;
      console.log(`           ✅ → ${path.basename(outPath)}(${(outSize / 1024 / 1024).toFixed(1)}MB)`);
      ok++;
    } catch (e) {
      console.log(`           ❌ ${e.message}`);
      failed++;
    }
  }

  console.log(`\n=== 總結 ===`);
  console.log(`✅ 成功:${ok}/${unique.length}`);
  if (failed > 0) console.log(`❌ 失敗:${failed}`);
  console.log(`\n📁 壓縮檔在:${OUTPUT_DIR}`);
  console.log(`📤 拖到 https://moyusales.zeabur.app/admin/claude/knowledge 走 fast path 即可`);
}

main().catch(e => {
  console.error("💥 Fatal:", e);
  process.exit(1);
});
