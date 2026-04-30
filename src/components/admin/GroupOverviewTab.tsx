"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type Brand = {
  id: string;
  label: string;
  revenue: number;
  revenue_last_month: number;
  yoy_pct: number;
  closures: number;
  calls: number;
  appointments: number;
  users_total: number;
  users_active: number;
  health: "healthy" | "warning" | "critical";
};
type Data = {
  ok: boolean;
  generated_at: string;
  brands: Brand[];
  totals: { revenue: number; users_active: number };
  talent_flows: { flow: string; count: number }[];
  cashflow_waterfall: { label: string; value: number; color: string }[];
};

const fmt = (n: number) => "NT$ " + n.toLocaleString();
const healthColor = (h: string) => h === "healthy" ? "var(--gold-thread, #c9a96e)" : h === "warning" ? "#d97706" : "var(--accent-red, #b91c1c)";

export default function GroupOverviewTab() {
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/group-overview")
      .then(r => r.json())
      .then((j) => { if (j.ok) setD(j); else setErr(j.error || "load failed"); })
      .catch(e => setErr(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "var(--ink-mid)", fontSize: 13 }}>載入集團總覽…</div>;
  if (err || !d) return <div style={{ padding: 48, color: "var(--accent-red)" }}>讀取失敗:{err}</div>;

  const maxRev = Math.max(1, ...d.brands.map(b => b.revenue));
  const maxFlow = Math.max(1, ...d.talent_flows.map(f => f.count));
  const maxAbs = Math.max(...d.cashflow_waterfall.map(s => Math.abs(s.value)));

  return (
    <div style={{ padding: "8px 0 48px", background: "var(--bg-paper, #f7f1e3)" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={labelStyle}>集團 EMPIRE</div>
        <div style={{ fontFamily: "var(--font-noto-serif-tc, serif)", fontSize: 32, color: "var(--ink-deep, #1a1a1a)", letterSpacing: 4, marginTop: 6 }}>集團總覽</div>
        <div style={{ fontSize: 11, color: "var(--ink-mid, #4a4a4a)", marginTop: 6 }}>6 品牌橫向比 · 跨品牌人才流動 · 集團現金流瀑布</div>
      </div>

      {/* 集團 totals */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={cardOuterStyle}>
          <div style={labelStyle}>本月集團總營收</div>
          <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 36, color: "var(--ink-deep)", fontWeight: 700, marginTop: 8 }}>{fmt(d.totals.revenue)}</div>
        </div>
        <div style={cardOuterStyle}>
          <div style={labelStyle}>活躍員工總數</div>
          <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 36, color: "var(--ink-deep)", fontWeight: 700, marginTop: 8 }}>{d.totals.users_active.toLocaleString()}</div>
        </div>
      </div>

      {/* 6 品牌橫向比 */}
      <div style={{ marginBottom: 32 }}>
        <div style={labelStyle}>6 品牌橫向比</div>
        <div style={{ marginTop: 12, background: "var(--bg-elev, rgba(247,241,227,0.85))", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6, overflow: "hidden" }}>
          {d.brands.map((b, idx) => (
            <motion.div key={b.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
              style={{ padding: "14px 20px", borderBottom: idx < d.brands.length - 1 ? "1px solid var(--border-soft, rgba(26,26,26,0.06))" : "none", display: "grid", gridTemplateColumns: "180px 1fr 100px 80px", gap: 16, alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 14, color: "var(--ink-deep)", letterSpacing: 1 }}>{b.label}</div>
                <div style={{ fontSize: 10, color: "var(--ink-mid)", marginTop: 2, fontFamily: "var(--font-jetbrains-mono)" }}>{b.users_active}/{b.users_total} 人</div>
              </div>
              <div>
                <div style={{ height: 8, background: "rgba(26,26,26,0.06)", borderRadius: 1, overflow: "hidden" }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(b.revenue / maxRev) * 100}%` }} transition={{ duration: 1.0, delay: idx * 0.04, ease: "easeOut" }}
                    style={{ height: "100%", background: healthColor(b.health) }} />
                </div>
                <div style={{ fontSize: 10, color: "var(--ink-mid)", marginTop: 4, fontFamily: "var(--font-jetbrains-mono)" }}>
                  {b.calls.toLocaleString()} 撥 · {b.appointments.toLocaleString()} 邀 · {b.closures.toLocaleString()} 成
                </div>
              </div>
              <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 14, color: "var(--ink-deep)", textAlign: "right", fontWeight: 600 }}>
                {fmt(b.revenue)}
              </div>
              <div style={{ textAlign: "right", fontSize: 12, fontFamily: "var(--font-jetbrains-mono)", color: b.yoy_pct >= 0 ? "var(--gold-thread)" : "var(--accent-red)", fontWeight: 600 }}>
                {b.yoy_pct >= 0 ? "+" : ""}{b.yoy_pct}%
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* 跨品牌人才流動 */}
        <div>
          <div style={labelStyle}>跨品牌人才流動 (近 3 月)</div>
          <div style={{ marginTop: 12, background: "var(--bg-elev, rgba(247,241,227,0.85))", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6, padding: 16 }}>
            {d.talent_flows.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--ink-mid)", fontSize: 12, padding: 24 }}>近 3 月無跨品牌調動</div>
            ) : d.talent_flows.map((f, idx) => (
              <motion.div key={f.flow} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.04 }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: idx < d.talent_flows.length - 1 ? "1px dashed var(--border-soft, rgba(26,26,26,0.06))" : "none" }}>
                <div style={{ flex: 1, fontSize: 12, color: "var(--ink-deep)", fontFamily: "var(--font-jetbrains-mono)" }}>{f.flow}</div>
                <div style={{ flex: 1, height: 6, background: "rgba(26,26,26,0.04)", borderRadius: 1 }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(f.count / maxFlow) * 100}%` }} transition={{ duration: 0.8, delay: idx * 0.05 }}
                    style={{ height: "100%", background: "var(--gold-thread, #c9a96e)" }} />
                </div>
                <div style={{ width: 32, textAlign: "right", fontFamily: "var(--font-jetbrains-mono)", fontSize: 13, color: "var(--ink-deep)" }}>{f.count}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* 現金流瀑布 */}
        <div>
          <div style={labelStyle}>集團現金流瀑布</div>
          <div style={{ marginTop: 12, background: "var(--bg-elev, rgba(247,241,227,0.85))", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6, padding: 16 }}>
            {d.cashflow_waterfall.map((s, idx) => {
              const pct = (Math.abs(s.value) / maxAbs) * 100;
              const isNeg = s.value < 0;
              return (
                <motion.div key={s.label} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }}
                  style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "var(--ink-deep)", fontFamily: "var(--font-noto-serif-tc)" }}>{s.label}</span>
                    <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: isNeg ? "var(--accent-red)" : "var(--ink-deep)", fontWeight: 600 }}>{isNeg ? "-" : ""}{fmt(Math.abs(s.value))}</span>
                  </div>
                  <div style={{ height: 12, background: "rgba(26,26,26,0.04)", borderRadius: 1, overflow: "hidden" }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: idx * 0.08 }}
                      style={{ height: "100%", background: s.color }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 32, fontSize: 10, color: "var(--ink-mid)", textAlign: "right", letterSpacing: 1, fontFamily: "var(--font-jetbrains-mono)" }}>
        更新於 {new Date(d.generated_at).toLocaleString("zh-TW")}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--ink-mid)", letterSpacing: 3, fontWeight: 600, textTransform: "uppercase" };
const cardOuterStyle: React.CSSProperties = { background: "var(--bg-elev, rgba(247,241,227,0.85))", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6, padding: "20px 24px" };
