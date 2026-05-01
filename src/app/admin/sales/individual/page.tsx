"use client";

import { useEffect, useState } from "react";

interface UserMetric {
  email: string;
  name: string;
  brand: string | null;
  today_calls: number;
  today_appointments: number;
  today_closures: number;
  week_calls: number;
  week_appointments: number;
  week_closures: number;
  last_active_date: string | null;
  conversion_rate: number;
  streak_days: number;
  silent_days: number;
  claude_warning: string | null;
}

interface IndividualData {
  ok: boolean;
  generated_at: string;
  today: string;
  brand: string;
  user_count: number;
  warning_count: number;
  streak_count: number;
  users: UserMetric[];
}

const BRANDS = [
  { id: "all", label: "全部" },
  { id: "nschool", label: "nSchool 財經" },
  { id: "xuemi", label: "學米" },
  { id: "ooschool", label: "無限" },
  { id: "aischool", label: "AI 未來" },
];

export default function AdminSalesIndividualPage() {
  const [data, setData] = useState<IndividualData | null>(null);
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState("all");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/sales/individual?brand=${brand}`, { cache: "no-store" })
      .then(r => r.json())
      .then((j: IndividualData) => { if (j.ok) setData(j); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [brand]);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>👤 個人戰況(主管視角)</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          下屬列表 / 個人 KPI / 連勝連敗 / Claude 卡關偵測 — 對齊 system-tree v2 §業務管理/individual
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {BRANDS.map(b => (
          <button key={b.id} onClick={() => setBrand(b.id)}
            style={{
              padding: "6px 14px", fontSize: 13, fontWeight: brand === b.id ? 700 : 500,
              background: brand === b.id ? "var(--accent, #C03A2B)" : "var(--ink-paper, #FAFAF7)",
              color: brand === b.id ? "#fff" : "var(--text, #333)",
              border: "1px solid var(--ink-line, #E5E2DA)", borderRadius: 6, cursor: "pointer",
            }}>
            {b.label}
          </button>
        ))}
      </div>

      {loading && <div style={infoBox}>載入中…</div>}

      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
            <KpiCard label="總人數" value={data.user_count} />
            <KpiCard label="🚨 Claude 警告" value={data.warning_count} highlight={data.warning_count > 0} />
            <KpiCard label="🔥 連勝中(≥3 天)" value={data.streak_count} />
            <KpiCard label="今日資料日期" value={data.today} small />
          </div>

          <div style={{
            background: "var(--ink-paper, #FAFAF7)",
            border: "1px solid var(--ink-line, #E5E2DA)",
            borderRadius: 10, overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--ink-mist, #F0EFEA)", textAlign: "left" }}>
                  <th style={th}>姓名</th>
                  <th style={th}>品牌</th>
                  <th style={thR}>今日 通/邀/成</th>
                  <th style={thR}>本週 通/邀/成</th>
                  <th style={thR}>轉換率</th>
                  <th style={thR}>狀態</th>
                  <th style={th}>Claude 警告</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map(u => (
                  <tr key={u.email} style={{ borderTop: "1px solid var(--ink-line, #E5E2DA)" }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{u.name || "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--text3, #888)" }}>{u.email}</div>
                    </td>
                    <td style={td}>{u.brand || "—"}</td>
                    <td style={tdR}>{u.today_calls}/{u.today_appointments}/{u.today_closures}</td>
                    <td style={tdR}>{u.week_calls}/{u.week_appointments}/{u.week_closures}</td>
                    <td style={tdR}>{u.conversion_rate}%</td>
                    <td style={tdR}>
                      {u.streak_days >= 3 && <span style={{ color: "#D4A017", fontWeight: 700 }}>🔥 {u.streak_days} 連勝</span>}
                      {u.silent_days >= 3 && <span style={{ color: "#C03A2B", fontWeight: 700 }}>⚠ {u.silent_days} 天靜默</span>}
                      {u.streak_days < 3 && u.silent_days < 3 && <span style={{ color: "var(--text3, #888)" }}>—</span>}
                    </td>
                    <td style={{ ...td, color: u.claude_warning ? "#C03A2B" : "var(--text3, #888)" }}>
                      {u.claude_warning || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.users.length === 0 && (
            <div style={{ ...infoBox, textAlign: "center", marginTop: 16 }}>
              這個品牌沒有業務員 sales_metrics_daily 資料 — 可能是 Metabase sync 還沒跑或品牌沒人。
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, highlight, small }: { label: string; value: number | string; sub?: string; highlight?: boolean; small?: boolean }) {
  return (
    <div style={{
      background: highlight ? "#FFF3F1" : "var(--ink-paper, #FAFAF7)",
      border: `1px solid ${highlight ? "#FFD9D2" : "var(--ink-line, #E5E2DA)"}`,
      borderRadius: 10, padding: 14,
    }}>
      <div style={{ fontSize: 11, color: "var(--text3, #888)", letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: small ? 16 : 26, fontWeight: 800, marginTop: 4, color: highlight ? "#C03A2B" : "inherit" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text3, #888)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "var(--text2, #555)" };
const thR: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "10px 12px", fontSize: 13, verticalAlign: "top" };
const tdR: React.CSSProperties = { ...td, textAlign: "right" };
const infoBox: React.CSSProperties = { padding: 14, background: "var(--ink-mist, #F0EFEA)", borderRadius: 6, fontSize: 14 };
