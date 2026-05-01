"use client";

import { useState } from "react";

interface FileResult {
  filename: string;
  ok: boolean;
  brand?: string;
  chars?: number;
  chunk_id?: string;
  error?: string;
}

interface BatchResult {
  ok: boolean;
  total?: number;
  success?: number;
  failed?: number;
  results?: FileResult[];
  error?: string;
}

const BRAND_OPTIONS = [
  { value: "",         label: "🤖 自動推斷(從檔名)" },
  { value: "nschool",  label: "📈 nSchool 財經學院" },
  { value: "xuemi",    label: "🎓 學米 XUEMI" },
  { value: "ooschool", label: "♾️ 無限學院 OOschool" },
  { value: "aischool", label: "🚀 AI 未來學院" },
  { value: "xlab",     label: "🧪 X LAB AI 實驗室" },
];

/**
 * Whisper 批次上傳(/admin/claude/knowledge)
 * 對齊 system-tree v2 §RAG 知識庫 §audio source
 *
 * Vincent 一次選多 .wav/.mp3 → Groq Whisper Large v3 → INSERT knowledge_chunks
 * 適用:nSchool 8 通 / XLAB 6 通 / 學米 2 通 / AI 未來 3 通 + 散落 wav
 */
export default function WhisperBatchUploader() {
  const [files, setFiles] = useState<File[]>([]);
  const [brand, setBrand] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);

  const trigger = async () => {
    if (!files.length || running) return;
    setRunning(true);
    setResult(null);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      if (brand) fd.append("brand", brand);

      const res = await fetch("/api/admin/rag/whisper-batch", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      setResult(json);
      if (json.ok) {
        setFiles([]); // 清空已處理的
      }
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message });
    } finally {
      setRunning(false);
    }
  };

  const totalSizeMB = (files.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(1);

  return (
    <div style={{
      background: "var(--ink-paper, #FAFAF7)",
      border: "1px solid var(--ink-line, #E5E2DA)",
      borderRadius: 10, padding: 18,
    }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
          🎤 Whisper 批次上傳 → RAG(全品牌業務開發 Call)
        </div>
        <div style={{ fontSize: 12, color: "var(--text2, #666)", lineHeight: 1.6 }}>
          選 .wav / .mp3 多檔 → Groq Whisper Large v3 轉錄 →{" "}
          <code>knowledge_chunks</code>(source_type=recording_transcript)
          <br />
          適用:nSchool 8 通 / XLAB 6 通 / 學米 2 通 / AI 未來 3 通 / 訓練官執行品牌檔案
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
            選擇 .wav / .mp3 檔案(可多選)
          </label>
          <input
            type="file"
            accept="audio/wav,audio/mpeg,audio/mp3,.wav,.mp3"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
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
          {running ? "⏳ Whisper 處理中…" : `🚀 上傳 ${files.length} 檔(${totalSizeMB} MB)`}
        </button>
      </div>

      {files.length > 0 && !running && !result && (
        <div style={{ fontSize: 11, color: "var(--text3, #888)" }}>
          選了 {files.length} 檔:{files.map((f) => f.name).join(" · ")}
        </div>
      )}

      {result && (
        <div style={{
          marginTop: 14, padding: 12,
          background: result.ok ? "var(--ink-mist, #F0EFEA)" : "rgba(184, 71, 74, 0.08)",
          border: `1px solid ${result.ok ? "var(--ink-line, #E5E2DA)" : "#B8474A"}`,
          borderRadius: 6, fontSize: 12,
        }}>
          {result.error ? (
            <div style={{ color: "#B8474A" }}>❌ {result.error}</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 10, marginBottom: 10 }}>
                <Stat label="總計" value={result.total ?? 0} />
                <Stat label="成功" value={result.success ?? 0} accent="#6B7A5A" />
                <Stat label="失敗" value={result.failed ?? 0} accent="#B8474A" />
              </div>
              <div style={{ borderTop: "1px solid var(--ink-line, #E5E2DA)", paddingTop: 8, maxHeight: 240, overflowY: "auto" }}>
                {(result.results ?? []).map((r, i) => (
                  <div key={i} style={{
                    fontSize: 11, padding: "4px 0",
                    color: r.ok ? "var(--text2, #555)" : "#B8474A",
                  }}>
                    {r.ok ? "✅" : "❌"} <strong>{r.filename}</strong>
                    {r.brand && ` · brand=${r.brand}`}
                    {r.chars !== undefined && ` · ${r.chars} chars`}
                    {r.error && ` · ${r.error}`}
                  </div>
                ))}
              </div>
            </>
          )}
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
