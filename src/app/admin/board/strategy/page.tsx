"use client";

import { useEffect, useState } from "react";

interface Strategy {
  id: string;
  title: string;
  context: string | null;
  claude_recommendation: string | null;
  vincent_decision: string | null;
  status: string;
  urgency: string;
  due_date: string | null;
  signoff_chain: unknown;
  created_at: string;
  approved_at: string | null;
}

interface LatestAssessment {
  period: string;
  score: number | null;
  kpi_revenue: number | null;
  kpi_revenue_target: number | null;
  message_to_board: string | null;
  risks_disclosed: Array<{ risk: string; severity?: string }> | null;
  benchmark: { last_quarter?: number; last_year?: number } | null;
}

interface Data {
  ok: boolean;
  hint?: string;
  counts?: { pending: number; approved: number; rejected: number; deferred: number };
  strategies?: Strategy[];
  latest_assessment?: LatestAssessment | null;
}

export default function AdminBoardStrategyPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/board/strategy", { cache: "no-store" })
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ ok: false }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>🎯 Claude 戰略報告</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          三情境模擬 + 推薦策略 + 簽核 · 資料來源:D26 `decision_records` (category=strategy) + `claude_self_assessments`
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
          {data.counts && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 18 }}>
              <Stat label="待簽核" value={data.counts.pending} accent="#B89968" />
              <Stat label="已通過" value={data.counts.approved} accent="#6B7A5A" />
              <Stat label="已駁回" value={data.counts.rejected} accent="#B8474A" />
              <Stat label="已延後" value={data.counts.deferred} accent="#806848" />
            </div>
          )}

          {data.latest_assessment && (
            <div style={{
              background: "linear-gradient(135deg, #FAF7E8 0%, #F0EFEA 100%)",
              border: "1px solid #D4C896",
              borderRadius: 10, padding: 16, marginBottom: 18, fontSize: 13,
            }}>
              <div style={{ fontSize: 11, color: "#806848", letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>
                CLAUDE 戰略對標 · {data.latest_assessment.period}
              </div>
              {data.latest_assessment.message_to_board && (
                <div style={{ lineHeight: 1.7, color: "var(--text2, #555)" }}>{data.latest_assessment.message_to_board}</div>
              )}
            </div>
          )}

          {(data.strategies ?? []).length === 0 ? (
            <div style={infoBox}>
              📋 尚未有戰略推薦紀錄。Claude 將從 sales_metrics_daily 趨勢 + Yu KPI 漏斗(撥通→通次→通時→邀約→出席→成交)+ 風險警訊 自動產出推薦策略。
            </div>
          ) : (
            (data.strategies ?? []).map(s => <StrategyCard key={s.id} s={s} />)
          )}
        </>
      )}
    </div>
  );
}

function StrategyCard({ s }: { s: Strategy }) {
  const accent = s.status === "approved" ? "#6B7A5A" : s.status === "rejected" ? "#B8474A" : s.urgency === "critical" ? "#B8474A" : "#B89968";
  return (
    <div style={{
      background: "var(--ink-paper, #FAFAF7)",
      border: "1px solid var(--ink-line, #E5E2DA)",
      borderLeft: `4px solid ${accent}`,
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--text3, #888)", letterSpacing: 0.5, marginBottom: 4 }}>
            {new Date(s.created_at).toLocaleDateString("zh-TW")}
            {s.due_date && ` · 截止 ${new Date(s.due_date).toLocaleDateString("zh-TW")}`}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{s.title}</div>
        </div>
        <span style={{ fontSize: 11, padding: "3px 10px", background: accent, color: "#fff", borderRadius: 4, whiteSpace: "nowrap" }}>
          {s.status}
        </span>
      </div>
      {s.context && <div style={{ fontSize: 13, color: "var(--text2, #666)", marginTop: 8, lineHeight: 1.6 }}>{s.context}</div>}
      {s.claude_recommendation && (
        <div style={{ marginTop: 10, padding: 12, background: "var(--ink-mist, #F0EFEA)", borderRadius: 6, fontSize: 13 }}>
          <strong>📊 Claude 推薦:</strong>{s.claude_recommendation}
        </div>
      )}
      {s.vincent_decision && (
        <div style={{ marginTop: 8, padding: 10, background: "rgba(107, 122, 90, 0.1)", borderRadius: 6, fontSize: 12 }}>
          <strong>✅ Vincent 拍板:</strong>{s.vincent_decision}
          {s.approved_at && <span style={{ marginLeft: 8, color: "#888" }}>· {new Date(s.approved_at).toLocaleDateString("zh-TW")}</span>}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{ background: "var(--ink-paper, #FAFAF7)", border: "1px solid var(--ink-line, #E5E2DA)", borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 11, color: "var(--text3, #888)", letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 2, color: accent }}>{value}</div>
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
