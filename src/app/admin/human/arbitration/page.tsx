"use client";

import { useEffect, useState } from "react";

interface Arbitration {
  id: string;
  conflict_summary: string;
  parties: Array<{ name: string; role: string }> | null;
  process_log: unknown;
  conclusion: string | null;
  claude_learnings: string | null;
  ingested_to_rag: boolean;
  arbitrated_at: string | null;
  created_at: string;
}

interface Data {
  ok: boolean;
  hint?: string;
  count?: number;
  records?: Arbitration[];
}

export default function AdminHumanArbitrationPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/arbitrations", { cache: "no-store" })
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ ok: false }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>⚖️ 仲裁紀錄</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          原始衝突 / 處理過程 / 結論 / Claude 從中學什麼 · 資料來源:D26 `arbitration_records`
        </p>
      </div>

      {loading && <div style={infoBox}>載入中…</div>}

      {data && !data.ok && (
        <div style={{ ...infoBox, color: "#B89968" }}>
          🟡 D26 Phase 4 schema 還沒 apply。Apply Migration workflow 跑 D26 SQL 後本頁有資料。
        </div>
      )}

      {data?.ok && (
        <>
          <div style={{ marginBottom: 20, fontSize: 14, color: "var(--text2, #666)" }}>
            目前 {data.count ?? 0} 筆仲裁紀錄
          </div>

          {(data.records?.length ?? 0) === 0 && (
            <div style={infoBox}>沒有仲裁紀錄(系統運作良好,衝突由 Claude 自處理)</div>
          )}

          {(data.records ?? []).map(r => (
            <div key={r.id} style={{
              background: "var(--ink-paper, #FAFAF7)",
              border: "1px solid var(--ink-line, #E5E2DA)",
              borderRadius: 8,
              padding: 16,
              marginBottom: 12,
            }}>
              <div style={{ fontSize: 11, color: "var(--text3, #888)", marginBottom: 6 }}>
                {r.arbitrated_at
                  ? `仲裁日 ${new Date(r.arbitrated_at).toLocaleDateString("zh-TW")}`
                  : `建立 ${new Date(r.created_at).toLocaleDateString("zh-TW")}`}
                {r.ingested_to_rag && " · ✅ 已寫進 RAG"}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{r.conflict_summary}</div>
              {Array.isArray(r.parties) && r.parties.length > 0 && (
                <div style={{ fontSize: 12, color: "var(--text2, #666)", marginBottom: 8 }}>
                  涉事方:{r.parties.map(p => `${p.name}(${p.role})`).join("、")}
                </div>
              )}
              {r.conclusion && (
                <div style={{ padding: 10, background: "var(--ink-mist, #F0EFEA)", borderRadius: 6, fontSize: 13, marginBottom: 6 }}>
                  <strong>結論:</strong>{r.conclusion}
                </div>
              )}
              {r.claude_learnings && (
                <div style={{ padding: 10, background: "rgba(46, 64, 87, 0.08)", borderRadius: 6, fontSize: 13 }}>
                  <strong>Claude 學到:</strong>{r.claude_learnings}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

const infoBox: React.CSSProperties = {
  padding: 14,
  background: "var(--ink-mist, #F0EFEA)",
  borderRadius: 6,
  fontSize: 14,
  lineHeight: 1.6,
};
