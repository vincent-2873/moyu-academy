"use client";

import { useState } from "react";

interface FileResult {
  filename: string;
  ok: boolean;
  brand?: string;
  segments?: number;
  transcript_chars?: number;
  chunk_id?: string;
  action?: string;
  error?: string;
}

interface BatchResult {
  total: number;
  success: number;
  failed: number;
  results: FileResult[];
}

const BRAND_OPTIONS = [
  { value: "",         label: "🤖 自動推斷(從檔名)" },
  { value: "nschool",  label: "📈 nSchool 財經學院" },
  { value: "xuemi",    label: "🎓 學米 XUEMI" },
  { value: "ooschool", label: "♾️ 無限學院 OOschool" },
  { value: "aischool", label: "🚀 AI 未來學院" },
  { value: "xlab",     label: "🧪 X LAB AI 實驗室" },
];

const CHUNK_SIZE = 1024 * 1024; // 1 MB per chunk(避免 platform body limit)

/**
 * Whisper 批次上傳 v2(chunked upload + ffmpeg + Whisper)
 *
 * 對齊 Vincent 鐵則 + 紅線 1:
 *   - 0 個 client-side secret 要 paste
 *   - 完整 server-side 處理(用 Zeabur env 既有 GROQ_API_KEY)
 *   - 任何大小 / 錄影 / 音檔都吃(ffmpeg 自動 extract + 切片)
 *   - bypass platform body size limit(每 POST 1MB chunk)
 */
export default function WhisperBatchUploader() {
  const [files, setFiles] = useState<File[]>([]);
  const [brand, setBrand] = useState("");
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [progress, setProgress] = useState<{ fileIdx: number; total: number; chunk?: number; chunkTotal?: number } | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);

  const totalSizeMB = (files.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(1);

  const uploadOneFile = async (file: File, fileIdx: number, total: number): Promise<FileResult> => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // 1) init
    setStage("初始化");
    const initRes = await fetch("/api/admin/rag/whisper-upload/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        size: file.size,
        mime_type: file.type,
        total_chunks: totalChunks,
        brand: brand || undefined,
      }),
    });
    const initJson = await initRes.json();
    if (!initJson.ok) {
      return { filename: file.name, ok: false, error: `init: ${initJson.error}` };
    }
    const uploadId = initJson.upload_id as string;

    // 2) sequential chunk upload
    setStage("上傳中");
    for (let i = 0; i < totalChunks; i++) {
      setProgress({ fileIdx, total, chunk: i + 1, chunkTotal: totalChunks });
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);

      const fd = new FormData();
      fd.append("upload_id", uploadId);
      fd.append("chunk_index", String(i));
      fd.append("chunk", blob);

      const chunkRes = await fetch("/api/admin/rag/whisper-upload/chunk", {
        method: "POST",
        body: fd,
      });
      const chunkJson = await chunkRes.json();
      if (!chunkJson.ok) {
        return { filename: file.name, ok: false, error: `chunk ${i}: ${chunkJson.error}` };
      }
    }

    // 3) finalize(server 跑 ffmpeg + Whisper + INSERT)
    setStage("處理 ffmpeg + Whisper");
    setProgress({ fileIdx, total });
    const finRes = await fetch("/api/admin/rag/whisper-upload/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upload_id: uploadId }),
    });
    const finJson = await finRes.json();
    if (!finJson.ok) {
      return { filename: file.name, ok: false, error: `finalize: ${finJson.error}` };
    }

    return {
      filename: file.name,
      ok: true,
      brand: finJson.brand,
      segments: finJson.segments,
      transcript_chars: finJson.transcript_chars,
      chunk_id: finJson.chunk_id,
      action: finJson.action,
    };
  };

  const trigger = async () => {
    if (!files.length || running) return;
    setRunning(true);
    setResult(null);
    setStage("");

    const results: FileResult[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const r = await uploadOneFile(files[i], i + 1, files.length);
        results.push(r);
      } catch (e) {
        results.push({ filename: files[i].name, ok: false, error: (e as Error).message });
      }
    }

    const okCount = results.filter(r => r.ok).length;
    setResult({
      total: results.length,
      success: okCount,
      failed: results.length - okCount,
      results,
    });
    setStage("");
    setProgress(null);
    setRunning(false);
    if (okCount > 0) setFiles([]);
  };

  return (
    <div style={{
      background: "var(--ink-paper, #FAFAF7)",
      border: "1px solid var(--ink-line, #E5E2DA)",
      borderRadius: 10, padding: 18,
    }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
          🎤 Whisper 批次上傳 → RAG(全品牌業務開發 Call · 任意大小 / 錄影 / 音檔)
        </div>
        <div style={{ fontSize: 12, color: "var(--text2, #666)", lineHeight: 1.6 }}>
          選 .wav / .mp3 / .mp4 / .mov / .m4a 多檔 → server 端 ffmpeg 自動切片 + 提取音訊 → Groq Whisper Large v3 → <code>knowledge_chunks</code>
          <br />
          <strong>沒有檔案大小限制</strong>(chunked upload 1MB / chunk),錄影自動 extract audio,大檔自動切段並行轉錄。
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, color: "var(--text3, #888)", fontWeight: 600, marginBottom: 4 }}>
            指定品牌
          </label>
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            style={{
              padding: "7px 10px",
              border: "1px solid var(--ink-line, #E5E2DA)",
              borderRadius: 6, fontSize: 13, background: "#fff",
              fontFamily: "inherit",
            }}
          >
            {BRAND_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: 280 }}>
          <label style={{ display: "block", fontSize: 11, color: "var(--text3, #888)", fontWeight: 600, marginBottom: 4 }}>
            選擇 .wav / .mp3 / .mp4 / .mov / .m4a 檔案(可多選)
          </label>
          <input
            type="file"
            accept="audio/*,video/*,.wav,.mp3,.m4a,.mp4,.mov,.webm"
            multiple
            onChange={(e) => {
              setFiles(Array.from(e.target.files ?? []));
              setResult(null); // 清掉上次殘留 error
            }}
            style={{ fontSize: 12, fontFamily: "inherit" }}
          />
        </div>

        <button
          onClick={trigger}
          disabled={!files.length || running}
          style={{
            padding: "10px 22px",
            background: !files.length || running ? "var(--ink-line, #ccc)" : "var(--ink-deep, #2A2622)",
            color: "#fff", border: "none", borderRadius: 6,
            fontSize: 13, fontWeight: 700,
            cursor: !files.length || running ? "wait" : "pointer",
            fontFamily: "inherit", whiteSpace: "nowrap",
          }}
        >
          {running
            ? `⏳ 處理中…`
            : `🚀 上傳 ${files.length} 檔(${totalSizeMB} MB)`}
        </button>
      </div>

      {/* 即時 progress(running 時) */}
      {running && progress && (
        <div style={{
          padding: 12, marginBottom: 12,
          background: "var(--ink-mist, #F0EFEA)",
          borderRadius: 6, fontSize: 12,
          color: "var(--text2, #555)",
        }}>
          📦 檔案 {progress.fileIdx}/{progress.total} · {stage}
          {progress.chunk !== undefined && progress.chunkTotal !== undefined && (
            <> · chunk {progress.chunk}/{progress.chunkTotal}</>
          )}
        </div>
      )}

      {files.length > 0 && !running && !result && (
        <div style={{ fontSize: 11, color: "var(--text3, #888)" }}>
          選了 {files.length} 檔:{files.map((f) => `${f.name}(${(f.size / 1024 / 1024).toFixed(1)}MB)`).join(" · ")}
        </div>
      )}

      {result && (
        <div style={{
          marginTop: 14, padding: 12,
          background: "var(--ink-mist, #F0EFEA)",
          border: "1px solid var(--ink-line, #E5E2DA)",
          borderRadius: 6, fontSize: 12,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 10, marginBottom: 10 }}>
            <Stat label="總計" value={result.total} />
            <Stat label="成功" value={result.success} accent="#6B7A5A" />
            <Stat label="失敗" value={result.failed} accent="#B8474A" />
          </div>
          <div style={{ borderTop: "1px solid var(--ink-line, #E5E2DA)", paddingTop: 8, maxHeight: 280, overflowY: "auto" }}>
            {result.results.map((r, i) => (
              <div key={i} style={{
                fontSize: 11, padding: "4px 0",
                color: r.ok ? "var(--text2, #555)" : "#B8474A",
                lineHeight: 1.6,
              }}>
                {r.ok ? "✅" : "❌"} <strong>{r.filename}</strong>
                {r.brand && ` · brand=${r.brand}`}
                {r.segments && ` · ${r.segments} 段`}
                {r.transcript_chars && ` · ${r.transcript_chars} chars`}
                {r.action && r.action !== "inserted" && ` · ${r.action}`}
                {r.error && ` · ${r.error}`}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--text3, #888)" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent ?? "var(--text, #2A2622)" }}>{value}</div>
    </div>
  );
}
