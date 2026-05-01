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
  approved_at: string | null;
  created_at: string;
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

export default function AdminBoardDecisionsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [filter, setFilter] = useState<"all" | "approved" | "pending">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/decisions", { cache: "no-store" })
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ ok: false }))
      .finally(() => setLoading(false));
  }, []);

  const all: Decision[] = data?.ok
    ? [...(data.today_must ?? []), ...(data.week_must ?? []), ...(data.approved ?? []), ...(data.others ?? [])]
    : [];

  const filtered = filter === "all"
    ? all
    : filter === "approved"
      ? all.filter(d => d.status === "approved")
      : all.filter(d => d.status === "pending");

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>🏛️ 拍板紀錄</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          類訴訟卷宗格式 — 原始衝突 / Claude 建議 / Vincent 拍板 / 簽核鏈追蹤 · 資料來源:D26 `decision_records`
        </p>
      </div>

      {loading && <div style={infoBox}>載入中…</div>}

      {data && !data.ok && (
        <div style={{ ...infoBox, color: "#B89968" }}>
          🟡 D26 Phase 4 schema 還沒 apply。Apply Migration workflow 跑 D26 SQL 後本頁有資料。
        </div>
      )}

      {data?.ok && data.counts && (() => {
        const counts = data.counts;
        return (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {(["all", "pending", "approved"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "6px 14px",
                  border: "1px solid var(--ink-line, #E5E2DA)",
                  borderRadius: 6,
                  background: filter === f ? "#2A2622" : "var(--ink-paper, #FAFAF7)",
                  color: filter === f ? "#fff" : "var(--text, #333)",
                  fontSize: 13,
                  fontWeight: filter === f ? 700 : 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {f === "all" ? `全部 (${counts.total})` : f === "pending" ? `待拍板 (${counts.today_must + counts.week_must})` : `已拍板 (${counts.approved})`}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={infoBox}>沒有符合條件的拍板紀錄</div>
          ) : (
            filtered.map(d => (
              <div key={d.id} style={{
                background: "var(--ink-paper, #FAFAF7)",
                border: "1px solid var(--ink-line, #E5E2DA)",
                borderLeft: `4px solid ${d.status === "approved" ? "#6B7A5A" : d.urgency === "critical" ? "#B8474A" : "#B89968"}`,
                borderRadius: 8,
                padding: 16,
                marginBottom: 12,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: "var(--text3, #888)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                      {d.category} · {new Date(d.created_at).toLocaleDateString("zh-TW")}
                      {d.approved_at && ` · 拍板於 ${new Date(d.approved_at).toLocaleDateString("zh-TW")}`}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{d.title}</div>
                  </div>
                  <span style={{ fontSize: 11, padding: "3px 10px", background: d.status === "approved" ? "#6B7A5A" : "#B89968", color: "#fff", borderRadius: 4, whiteSpace: "nowrap" }}>
                    {d.status}
                  </span>
                </div>
                {d.context && <div style={{ fontSize: 13, color: "var(--text2, #666)", marginTop: 8, lineHeight: 1.6 }}>{d.context}</div>}
                {d.vincent_decision && (
                  <div style={{ marginTop: 8, padding: 10, background: "rgba(107, 122, 90, 0.1)", borderRadius: 6, fontSize: 12 }}>
                    <strong>Vincent 拍板:</strong>{d.vincent_decision}
                  </div>
                )}
              </div>
            ))
          )}
        </>
        );
      })()}
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
