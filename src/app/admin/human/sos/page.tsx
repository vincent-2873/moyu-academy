"use client";

import { useEffect, useState } from "react";

interface HelpRequest {
  id: string;
  category: string;
  source: string;
  title: string;
  description: string | null;
  claude_attempts: unknown;
  claude_recommendation: string | null;
  status: string;
  created_at: string;
}

interface Data {
  ok: boolean;
  counts: { total: number; pending: number; resolved: number; others: number };
  pending: HelpRequest[];
  resolved: HelpRequest[];
  others: HelpRequest[];
}

export default function AdminHumanSosPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/help-requests", { cache: "no-store" })
      .then(r => r.json())
      .then((d: Data) => setData(d))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>🆘 Claude 求救清單</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          給 Vincent only — Claude 卡住的事 / 緊急(紅) / 一般(黃) / 已處理(綠)
          <br />
          資料來源:D18 `claude_help_requests` table
        </p>
      </div>

      {loading && <div style={infoBox}>載入中…</div>}
      {error && <div style={{ ...infoBox, color: "#B8474A" }}>讀取失敗:{error}</div>}

      {data?.ok && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
            <KPICard label="總計" value={data.counts.total} />
            <KPICard label="🔴 待處理" value={data.counts.pending} accent="#B8474A" />
            <KPICard label="🟢 已處理" value={data.counts.resolved} accent="#6B7A5A" />
            <KPICard label="其他狀態" value={data.counts.others} accent="#94a3b8" />
          </div>

          {data.pending.length > 0 ? (
            <section style={section}>
              <h2 style={sectionTitle}>🔴 待處理({data.pending.length})</h2>
              {data.pending.map(req => <HelpRequestCard key={req.id} req={req} accent="#B8474A" />)}
            </section>
          ) : (
            <section style={section}>
              <h2 style={sectionTitle}>🟢 沒有待處理的求救</h2>
              <div style={{ ...infoBox, fontSize: 13 }}>Claude 目前沒卡關。這是正常狀態。</div>
            </section>
          )}

          {data.resolved.length > 0 && (
            <section style={section}>
              <h2 style={sectionTitle}>🟢 已處理({data.resolved.length},最近)</h2>
              {data.resolved.slice(0, 10).map(req => <HelpRequestCard key={req.id} req={req} accent="#6B7A5A" />)}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function HelpRequestCard({ req, accent }: { req: HelpRequest; accent: string }) {
  const created = new Date(req.created_at);
  return (
    <div style={{
      background: "var(--ink-paper, #FAFAF7)",
      border: "1px solid var(--ink-line, #E5E2DA)",
      borderLeft: `4px solid ${accent}`,
      borderRadius: 8,
      padding: 14,
      marginBottom: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--text3, #888)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
            {req.category} · {req.source} · {created.toLocaleDateString("zh-TW")} {created.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{req.title}</div>
          {req.description && (
            <div style={{ fontSize: 13, color: "var(--text2, #666)", marginTop: 6, lineHeight: 1.6 }}>{req.description}</div>
          )}
          {req.claude_recommendation && (
            <div style={{ marginTop: 8, padding: 10, background: "var(--ink-mist, #F0EFEA)", borderRadius: 6, fontSize: 12 }}>
              <strong>Claude 建議:</strong>{req.claude_recommendation}
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, padding: "3px 10px", background: accent, color: "#fff", borderRadius: 4, whiteSpace: "nowrap" }}>
          {req.status}
        </div>
      </div>
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
};

const section: React.CSSProperties = {
  marginBottom: 24,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 12,
};
