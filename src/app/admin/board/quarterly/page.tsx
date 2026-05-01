"use client";

import { useEffect, useState } from "react";

interface Assessment {
  id: string;
  period: string;
  score: number | null;
  kpi_revenue: number | null;
  kpi_revenue_target: number | null;
  kpi_prediction_accuracy: number | null;
  kpi_decision_success_rate: number | null;
  kpi_roi: number | null;
  message_to_board: string | null;
  risks_disclosed: Array<{ risk: string; severity?: string }> | null;
  benchmark: { last_quarter?: number; last_year?: number } | null;
  pdf_url: string | null;
  created_at: string;
}

interface Data {
  ok: boolean;
  hint?: string;
  count?: number;
  latest?: Assessment | null;
  history?: Assessment[];
}

export default function AdminBoardQuarterlyPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/board/quarterly", { cache: "no-store" })
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ ok: false }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>🏛️ 季度成績單</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          給投資人 / 董事 / 財務長 — Claude 自評 + 4 大 KPI + 風險揭露 · 資料來源:D26 `claude_self_assessments`
        </p>
      </div>

      {loading && <div style={infoBox}>載入中…</div>}

      {data && !data.ok && (
        <div style={{ ...infoBox, color: "#B89968" }}>
          🟡 D26 Phase 4 schema 還沒 apply。Apply Migration workflow 跑 D26 SQL 後本頁有資料。
        </div>
      )}

      {data?.ok && !data.latest && (
        <div style={infoBox}>
          📊 尚未有 Q 自評紀錄。Claude 將在每季度結束自動產生(從 sales_metrics_daily / training 成效 / decision_records 結果驗證 抽出)。
        </div>
      )}

      {data?.ok && data.latest && (
        <>
          <KPIPanel a={data.latest} />
          {data.latest.message_to_board && (
            <Card title="💬 Claude 給董事會的話" accent="#6B7A5A">
              <div style={{ fontSize: 14, lineHeight: 1.8, color: "var(--text2, #555)" }}>
                {data.latest.message_to_board}
              </div>
            </Card>
          )}
          {Array.isArray(data.latest.risks_disclosed) && data.latest.risks_disclosed.length > 0 && (
            <Card title="⚠️ 主動揭露的風險" accent="#B8474A">
              <ul style={{ marginTop: 4, paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
                {data.latest.risks_disclosed.map((r, i) => (
                  <li key={i}>
                    {r.risk}
                    {r.severity && <span style={{ marginLeft: 8, padding: "2px 8px", background: "#B8474A", color: "#fff", borderRadius: 4, fontSize: 11 }}>{r.severity}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {data.latest.benchmark && (
            <Card title="📊 對標基準" accent="#B89968">
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 }}>
                {data.latest.benchmark.last_quarter !== undefined && (
                  <div>vs 上季:<strong>{data.latest.benchmark.last_quarter}</strong></div>
                )}
                {data.latest.benchmark.last_year !== undefined && (
                  <div>vs 去年同季:<strong>{data.latest.benchmark.last_year}</strong></div>
                )}
              </div>
            </Card>
          )}
          {data.latest.pdf_url && (
            <a href={data.latest.pdf_url} target="_blank" rel="noopener noreferrer" style={{
              display: "inline-block", marginTop: 12, padding: "8px 18px",
              background: "#2A2622", color: "#fff", textDecoration: "none",
              borderRadius: 6, fontSize: 13, fontWeight: 600,
            }}>📥 下載完整 PDF 報告</a>
          )}

          {(data.history ?? []).length > 1 && (
            <section style={{ marginTop: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>📚 歷史季度</h2>
              {(data.history ?? []).slice(1).map(h => (
                <div key={h.id} style={{
                  background: "var(--ink-paper, #FAFAF7)",
                  border: "1px solid var(--ink-line, #E5E2DA)",
                  borderRadius: 6,
                  padding: "10px 14px",
                  marginBottom: 6,
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                }}>
                  <span><strong>{h.period}</strong></span>
                  <span>分數 {h.score ?? "—"}</span>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function KPIPanel({ a }: { a: Assessment }) {
  const revenuePct = a.kpi_revenue && a.kpi_revenue_target
    ? Math.round((Number(a.kpi_revenue) / Number(a.kpi_revenue_target)) * 100)
    : null;

  return (
    <>
      <div style={{ background: "linear-gradient(135deg, #FAF7E8 0%, #F0EFEA 100%)", border: "1px solid #D4C896", borderRadius: 12, padding: 24, marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: "#806848", letterSpacing: 1, marginBottom: 6 }}>{a.period} · CLAUDE 自評</div>
        <div style={{ fontSize: 56, fontWeight: 900, color: "#2A2622", lineHeight: 1 }}>
          {a.score ?? "—"} <span style={{ fontSize: 18, color: "#806848", fontWeight: 600 }}>/ 100</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }}>
        <KPICard label="季營收達成率" value={revenuePct !== null ? `${revenuePct}%` : "—"} sub={a.kpi_revenue ? `${Math.round(Number(a.kpi_revenue) / 10000)} 萬` : ""} accent="#6B7A5A" />
        <KPICard label="預測準度" value={a.kpi_prediction_accuracy !== null ? `${Math.round(Number(a.kpi_prediction_accuracy) * 100)}%` : "—"} accent="#2E4057" />
        <KPICard label="決策成功率" value={a.kpi_decision_success_rate !== null ? `${Math.round(Number(a.kpi_decision_success_rate) * 100)}%` : "—"} accent="#B89968" />
        <KPICard label="ROI" value={a.kpi_roi !== null ? `${a.kpi_roi}x` : "—"} accent="#A65A4D" />
      </div>
    </>
  );
}

function KPICard({ label, value, sub = "", accent = "#666" }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: "var(--ink-paper, #FAFAF7)", border: "1px solid var(--ink-line, #E5E2DA)", borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 11, color: "var(--text3, #888)", letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: accent }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text3, #888)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Card({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--ink-paper, #FAFAF7)",
      border: "1px solid var(--ink-line, #E5E2DA)",
      borderLeft: `4px solid ${accent}`,
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{title}</div>
      {children}
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
