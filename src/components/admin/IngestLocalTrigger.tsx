"use client";

import { useState } from "react";

interface IngestResult {
  files_scanned?: number;
  chunks_added?: number;
  chunks_updated?: number;
  errors?: string[];
  duration_ms?: number;
  error?: string;
}

/**
 * 觸發 /api/admin/rag/ingest-local-training POST
 * 把 content/training/ 整個資料夾(含 5 品牌 sales/{brand}/.md)ingest 進 knowledge_chunks
 *
 * 對齊 Vincent 鐵則「資料給了串上去就好」
 */
export default function IngestLocalTrigger() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);

  const trigger = async () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/rag/ingest-local-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      setResult(json);
    } catch (e) {
      setResult({ error: (e as Error).message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{
      background: "var(--ink-paper, #FAFAF7)",
      border: "1px solid var(--ink-line, #E5E2DA)",
      borderRadius: 10, padding: 18,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>📥 同步本機訓練資料 → RAG</div>
          <div style={{ fontSize: 12, color: "var(--text2, #666)", lineHeight: 1.6 }}>
            掃描 <code>content/training/</code>(含 5 品牌 <code>sales/{`{nschool, xuemi, ooschool, xlab, sales-deck-v2}`}</code>)的 .md / .txt 檔,
            ingest 進 <code>knowledge_chunks</code>(pillar 自動推斷 sales / legal / common)。
            <br />
            重複 ingest 用 <code>content_hash</code> 防重,只更新有變動的 chunk。Embedding 由 cron 後續補。
          </div>
        </div>
        <button
          onClick={trigger}
          disabled={running}
          style={{
            padding: "10px 22px",
            background: running ? "var(--ink-line, #ccc)" : "var(--ink-deep, #2A2622)",
            color: "#fff", border: "none", borderRadius: 6,
            fontSize: 13, fontWeight: 700,
            cursor: running ? "wait" : "pointer",
            fontFamily: "inherit", whiteSpace: "nowrap",
          }}
        >
          {running ? "⏳ Ingest 中…" : "🚀 立即同步"}
        </button>
      </div>

      {result && (
        <div style={{
          marginTop: 14, padding: 12,
          background: result.error ? "rgba(184, 71, 74, 0.08)" : "var(--ink-mist, #F0EFEA)",
          border: result.error ? "1px solid #B8474A" : "1px solid var(--ink-line, #E5E2DA)",
          borderRadius: 6, fontSize: 12,
        }}>
          {result.error ? (
            <div style={{ color: "#B8474A" }}>❌ {result.error}</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
              <Stat label="掃描檔案" value={result.files_scanned ?? 0} />
              <Stat label="新增 chunks" value={result.chunks_added ?? 0} accent="#6B7A5A" />
              <Stat label="更新 chunks" value={result.chunks_updated ?? 0} accent="#B89968" />
              <Stat label="耗時 (ms)" value={result.duration_ms ?? 0} />
              {(result.errors?.length ?? 0) > 0 && (
                <div style={{ gridColumn: "1 / -1", color: "#B8474A", fontSize: 11 }}>
                  ⚠️ 部分檔案失敗:{result.errors?.slice(0, 3).join(" · ")}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text3, #888)" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent ?? "var(--text, #2A2622)" }}>{value}</div>
    </div>
  );
}
