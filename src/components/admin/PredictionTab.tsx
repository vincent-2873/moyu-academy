"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type Data = {
  ok: boolean;
  generated_at: string;
  revenue_forecast: { this_month_actual: number; projected_eom: number; projected_closures: number; day_of_month: number; days_in_month: number; confidence_pct: number; daily_avg: number; insufficient_data?: boolean };
  hire_gap: { target: number; done: number; gap: number; next_month_pressure: "healthy" | "warning" | "critical" };
  risk_alerts: { user: string; this_month_rev: number; expected: number; pct: number }[];
  scenarios: { name: string; assumption: string; projected_revenue: number; delta_vs_target: number }[];
};

const fmt = (n: number) => "NT$ " + n.toLocaleString();
const healthColor = (h: string) => h === "healthy" ? "var(--gold-thread, #c9a96e)" : h === "warning" ? "#d97706" : "var(--accent-red, #b91c1c)";

export default function PredictionTab() {
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/prediction/overview")
      .then(r => r.json())
      .then((j) => { if (j.ok) setD(j); else setErr(j.error || "load failed"); })
      .catch(e => setErr(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "var(--ink-mid)", fontSize: 13 }}>Claude 推演中…</div>;
  if (err || !d) return <div style={{ padding: 48, color: "var(--accent-red)" }}>讀取失敗:{err}</div>;

  const f = d.revenue_forecast;
  const monthProgress = f.day_of_month / f.days_in_month;

  return (
    <div style={{ padding: "8px 0 48px", background: "var(--bg-paper, #f7f1e3)" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={labelStyle}>預測 PREDICTION</div>
        <div style={{ fontFamily: "var(--font-noto-serif-tc, serif)", fontSize: 32, color: "var(--ink-deep, #1a1a1a)", letterSpacing: 4, marginTop: 6 }}>Claude 預測建議</div>
        <div style={{ fontSize: 11, color: "var(--ink-mid, #4a4a4a)", marginTop: 6 }}>本月業績預測 · 下月招募缺口 · 風險預警 · 情境模擬</div>
      </div>

      {/* 本月業績預測 */}
      <div style={{ ...cardOuterStyle, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <div>
            <div style={labelStyle}>本月業績預測</div>
            <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 18, color: "var(--ink-deep)", marginTop: 4, letterSpacing: 2 }}>月底總額預估</div>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-mid)", fontFamily: "var(--font-jetbrains-mono)" }}>
            信心度 {f.confidence_pct}% · 日均 {fmt(f.daily_avg)}
          </div>
        </div>
        {/* 2026-04-30 末段 P3:月初 < 3 天 projection 不可信 → 標示 */}
        {f.insufficient_data && (
          <div style={{ padding: 10, background: "rgba(217,119,6,0.08)", border: "1px solid #d97706", borderRadius: 4, marginBottom: 12, fontSize: 12, color: "#92400e" }}>
            ⚠️ 月初 {f.day_of_month} 天樣本太少 — 預估值僅供參考(實際線性預測在 D3+ 才生效)
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 16 }}>
          <Stat label="已實現" value={fmt(f.this_month_actual)} />
          <Stat label="預估月底" value={fmt(f.projected_eom)} highlight />
          <Stat label="預估成交" value={f.projected_closures.toLocaleString() + " 件"} />
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ height: 14, background: "rgba(26,26,26,0.06)", borderRadius: 1, overflow: "hidden", position: "relative" }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${f.this_month_actual && f.projected_eom ? (f.this_month_actual / f.projected_eom) * 100 : 0}%` }}
              transition={{ duration: 1.4, ease: "easeOut" }}
              style={{ height: "100%", background: "var(--ink-deep)" }} />
            <div style={{ position: "absolute", top: 0, left: `${monthProgress * 100}%`, width: 2, height: "100%", background: "var(--accent-red)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "var(--ink-mid)", fontFamily: "var(--font-jetbrains-mono)" }}>
            <span>月初</span>
            <span>今日 D{f.day_of_month} / D{f.days_in_month}</span>
            <span>月底</span>
          </div>
        </div>
      </div>

      {/* 招募缺口 */}
      <div style={{ ...cardOuterStyle, marginBottom: 24, borderLeft: `4px solid ${healthColor(d.hire_gap.next_month_pressure)}` }}>
        <div style={labelStyle}>下月招募缺口</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginTop: 16 }}>
          <Stat label="月目標" value={d.hire_gap.target.toString() + " 人"} />
          <Stat label="本月已招" value={d.hire_gap.done.toString() + " 人"} />
          <Stat label="缺口" value={d.hire_gap.gap.toString() + " 人"} highlight color={healthColor(d.hire_gap.next_month_pressure)} />
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: "var(--ink-mid)", fontFamily: "var(--font-jetbrains-mono)" }}>
          下月壓力:{d.hire_gap.next_month_pressure === "critical" ? "🔴 高" : d.hire_gap.next_month_pressure === "warning" ? "🟡 中" : "🟢 低"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20 }}>
        {/* 風險預警 */}
        <div style={cardOuterStyle}>
          <div style={labelStyle}>風險預警(本月低於目標 50%)</div>
          <div style={{ marginTop: 12, maxHeight: 320, overflowY: "auto" }}>
            {d.risk_alerts.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--gold-thread)", fontSize: 13, padding: 24 }}>本月所有人都達標 ≥ 50%</div>
            ) : d.risk_alerts.map((a, idx) => (
              <motion.div key={a.user} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
                style={{ padding: "10px 12px", borderRadius: 4, marginBottom: 6, background: "rgba(185,28,28,0.04)", display: "grid", gridTemplateColumns: "1fr 80px 60px", gap: 8, alignItems: "center" }}>
                <div style={{ fontSize: 12, color: "var(--ink-deep)", fontFamily: "var(--font-jetbrains-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.user}</div>
                <div style={{ fontSize: 11, color: "var(--ink-mid)", fontFamily: "var(--font-jetbrains-mono)", textAlign: "right" }}>{fmt(a.this_month_rev)}</div>
                <div style={{ fontSize: 12, color: "var(--accent-red)", fontFamily: "var(--font-jetbrains-mono)", textAlign: "right", fontWeight: 600 }}>{a.pct}%</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* 情境模擬 */}
        <div style={cardOuterStyle}>
          <div style={labelStyle}>情境模擬</div>
          <div style={{ marginTop: 12 }}>
            {d.scenarios.map((s, idx) => (
              <motion.div key={s.name} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}
                style={{ padding: "12px 14px", borderRadius: 4, marginBottom: 8, background: "var(--bg-paper)", border: "1px solid var(--border-soft, rgba(26,26,26,0.08))" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 13, color: "var(--ink-deep)", letterSpacing: 1 }}>{s.name}</div>
                  <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 13, color: s.delta_vs_target >= 0 ? "var(--gold-thread)" : "var(--accent-red)", fontWeight: 600 }}>
                    {s.delta_vs_target >= 0 ? "+" : ""}{(s.delta_vs_target / 10000).toFixed(0)} 萬
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "var(--ink-mid)", marginBottom: 4 }}>{s.assumption}</div>
                <div style={{ fontSize: 11, color: "var(--ink-deep)", fontFamily: "var(--font-jetbrains-mono)" }}>預估 {fmt(s.projected_revenue)}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 32, fontSize: 10, color: "var(--ink-mid)", textAlign: "right", letterSpacing: 1, fontFamily: "var(--font-jetbrains-mono)" }}>
        更新於 {new Date(d.generated_at).toLocaleString("zh-TW")}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight, color }: { label: string; value: string; highlight?: boolean; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--ink-mid)", letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: highlight ? 24 : 18, color: color || "var(--ink-deep)", marginTop: 4, fontWeight: highlight ? 700 : 500 }}>{value}</div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--ink-mid)", letterSpacing: 3, fontWeight: 600, textTransform: "uppercase" };
const cardOuterStyle: React.CSSProperties = { background: "var(--bg-elev, rgba(247,241,227,0.85))", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6, padding: "20px 24px" };
