"use client";

import { useEffect, useState } from "react";

interface Decision {
  id: string;
  category: string;
  title: string;
  context: string | null;
  claude_recommendation: string | null;
  vincent_decision: string | null;
  status: string;
  urgency: string;
  due_date: string | null;
  created_at: string;
  approved_at: string | null;
}

interface Data {
  ok: boolean;
  hint?: string;
  counts?: { total: number; today_must: number; week_must: number; approved: number; others: number };
  today_must?: Decision[];
  week_must?: Decision[];
  approved?: Decision[];
  others?: Decision[];
}

export default function AdminHumanSignOffPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/decisions", { cache: "no-store" })
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ ok: false }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>✍️ 我必須拍板</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          Claude 寫好的草稿 / 等簽核合約 / 人事異動 / 報告 sign-off · 資料來源:D26 `decision_records`
        </p>
      </div>

      {loading && <div style={infoBox}>載入中…</div>}

      {data && !data.ok && (
        <div style={{ ...infoBox, color: "#B89968" }}>
          🟡 D26 SQL Phase 4 schema 還沒 apply。Apply Migration workflow 跑 supabase-migration-D26-phase4-schema.sql 後本頁就會有資料。
          {data.hint && <div style={{ fontSize: 11, marginTop: 6 }}>{data.hint}</div>}
        </div>
      )}

      {data?.ok && data.counts && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
            <KPICard label="🔴 今天必拍板" value={data.counts.today_must} accent="#B8474A" />
            <KPICard label="🟠 本週必拍板" value={data.counts.week_must} accent="#B89968" />
            <KPICard label="🟢 已拍板" value={data.counts.approved} accent="#6B7A5A" />
            <KPICard label="總計" value={data.counts.total} />
          </div>

          {data.today_must && data.today_must.length > 0 && (
            <Section title="🔴 今天必拍板" decisions={data.today_must} accent="#B8474A" />
          )}
          {data.week_must && data.week_must.length > 0 && (
            <Section title="🟠 本週必拍板" decisions={data.week_must} accent="#B89968" />
          )}
          {data.approved && data.approved.length > 0 && (
            <Section title="🟢 已拍板(最近)" decisions={data.approved.slice(0, 10)} accent="#6B7A5A" />
          )}

          {data.counts.total === 0 && (
            <div style={infoBox}>🟢 沒有待拍板的事。Claude 都自己處理掉了。</div>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, decisions, accent }: { title: string; decisions: Decision[]; accent: string }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{title}</h2>
      {decisions.map(d => <DecisionCard key={d.id} d={d} accent={accent} />)}
    </section>
  );
}

function DecisionCard({ d, accent }: { d: Decision; accent: string }) {
  return (
    <div style={{
      background: "var(--ink-paper, #FAFAF7)",
      border: "1px solid var(--ink-line, #E5E2DA)",
      borderLeft: `4px solid ${accent}`,
      borderRadius: 8,
      padding: 14,
      marginBottom: 10,
    }}>
      <div style={{ fontSize: 11, color: "var(--text3, #888)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
        {d.category} · {new Date(d.created_at).toLocaleDateString("zh-TW")}
        {d.due_date && ` · 截止 ${new Date(d.due_date).toLocaleDateString("zh-TW")}`}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{d.title}</div>
      {d.context && (
        <div style={{ fontSize: 13, color: "var(--text2, #666)", marginBottom: 8, lineHeight: 1.6 }}>{d.context}</div>
      )}
      {d.claude_recommendation && (
        <div style={{ padding: 10, background: "var(--ink-mist, #F0EFEA)", borderRadius: 6, fontSize: 12, marginBottom: 6 }}>
          <strong>Claude 建議:</strong>{d.claude_recommendation}
        </div>
      )}
      {d.vincent_decision && (
        <div style={{ padding: 10, background: "rgba(107, 122, 90, 0.1)", borderRadius: 6, fontSize: 12 }}>
          <strong>Vincent 拍板:</strong>{d.vincent_decision}
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, accent = "#666" }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ background: "var(--ink-paper, #FAFAF7)", border: "1px solid var(--ink-line, #E5E2DA)", borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 11, color: "var(--text3, #888)", letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color: accent }}>{value}</div>
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
