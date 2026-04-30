"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import BreathingNumber from "@/components/wabi/BreathingNumber";

type Health = "healthy" | "warning" | "critical";
type Data = {
  ok: boolean;
  generated_at: string;
  north_star: { label: string; value: number; target: number; pct: number; projected: number; last_month: number; yoy_pct: number; health: Health };
  okr: { label: string; pct: number; target: number; actual: number; health: Health };
  ltv_cac: { ltv: number; cac: number; ratio: number; health: Health; note: string };
  burn: { monthly: number; cash: number; runway_months: number; health: Health; note: string };
  activity: { users_total: number; users_active: number; month_calls: number; month_appointments: number; month_closures: number };
};

const healthColor = (h: Health) => h === "healthy" ? "var(--gold-thread, #c9a96e)" : h === "warning" ? "#d97706" : "var(--accent-red, #b91c1c)";
const fmtCurrency = (n: number) => "NT$ " + n.toLocaleString();
const fmtNum = (n: number) => n.toLocaleString();

export default function StrategyTab() {
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/strategy/overview")
      .then(r => r.json())
      .then((j) => { if (j.ok) setD(j); else setErr(j.error || "load failed"); })
      .catch(e => setErr(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "var(--ink-mid)", fontSize: 13 }}>載入戰略指標…</div>;
  if (err || !d) return <div style={{ padding: 48, color: "var(--accent-red)" }}>讀取失敗:{err}</div>;

  return (
    <div style={{ padding: "8px 0 48px", background: "var(--bg-paper, #f7f1e3)" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={labelStyle}>戰略 STRATEGY</div>
        <div style={{ fontFamily: "var(--font-noto-serif-tc, serif)", fontSize: 32, color: "var(--ink-deep, #1a1a1a)", letterSpacing: 4, marginTop: 6 }}>戰略指標</div>
        <div style={{ fontSize: 11, color: "var(--ink-mid, #4a4a4a)", marginTop: 6 }}>北極星 / OKR / LTV·CAC / 月燒錢 / 跑道 — 每 1 分鐘更新</div>
      </div>

      <KintsugiLine />

      {/* 北極星巨型 hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        style={{ background: "var(--bg-elev, rgba(247,241,227,0.85))", border: `1px solid ${healthColor(d.north_star.health)}`, borderRadius: 8, padding: "32px 40px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={labelStyle}>北極星 NORTH STAR</div>
            <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 14, color: "var(--ink-deep)", marginTop: 4, letterSpacing: 2 }}>{d.north_star.label}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: healthColor(d.north_star.health), display: "inline-block" }} />
            <span style={{ fontSize: 11, color: healthColor(d.north_star.health), fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>{d.north_star.health}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 32, flexWrap: "wrap" }}>
          <div>
            <BreathingNumber size={56} color="var(--ink-deep)">{fmtCurrency(d.north_star.value)}</BreathingNumber>
            <div style={{ fontSize: 11, color: "var(--ink-mid)", marginTop: 8, fontFamily: "var(--font-jetbrains-mono)" }}>
              月底預估 {fmtCurrency(d.north_star.projected)} · 目標 {fmtCurrency(d.north_star.target)} · {d.north_star.pct}%
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, color: "var(--ink-mid)", marginBottom: 8, letterSpacing: 1 }}>達成度</div>
            <div style={{ height: 14, background: "rgba(26,26,26,0.08)", borderRadius: 1, overflow: "hidden" }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, d.north_star.pct)}%` }} transition={{ duration: 1.4, ease: "easeOut" }}
                style={{ height: "100%", background: healthColor(d.north_star.health) }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "var(--ink-mid)", fontFamily: "var(--font-jetbrains-mono)" }}>
              <span>0</span>
              <span>vs 上月 {d.north_star.yoy_pct >= 0 ? "+" : ""}{d.north_star.yoy_pct}%</span>
              <span>{fmtCurrency(d.north_star.target)}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 4 卡片矩陣 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <Card title="OKR 達成" health={d.okr.health} label="OKR · 月">
          <BreathingNumber size={36} color={healthColor(d.okr.health)}>{d.okr.pct + "%"}</BreathingNumber>
          <div style={cardSubStyle}>實 {fmtCurrency(d.okr.actual)} / 目 {fmtCurrency(d.okr.target)}</div>
        </Card>
        <Card title="LTV / CAC" health={d.ltv_cac.health} label="UNIT · 經濟">
          <div style={cardNumStyle(d.ltv_cac.health)}>{d.ltv_cac.ratio}×</div>
          <div style={cardSubStyle}>LTV {fmtCurrency(d.ltv_cac.ltv)} ÷ CAC {fmtCurrency(d.ltv_cac.cac)}</div>
          <div style={{ ...cardSubStyle, opacity: 0.6, marginTop: 4 }}>{d.ltv_cac.note}</div>
        </Card>
        <Card title="月燒錢" health="healthy" label="月 BURN">
          <div style={cardNumStyle("healthy")}>{fmtCurrency(d.burn.monthly)}</div>
          <div style={cardSubStyle}>現金 {fmtCurrency(d.burn.cash)}</div>
          <div style={{ ...cardSubStyle, opacity: 0.6, marginTop: 4 }}>{d.burn.note}</div>
        </Card>
        <Card title="現金跑道" health={d.burn.health} label="月 RUNWAY">
          <div style={cardNumStyle(d.burn.health)}>{d.burn.runway_months} 月</div>
          <div style={cardSubStyle}>{d.burn.runway_months >= 12 ? "充裕" : d.burn.runway_months >= 6 ? "需注意" : "緊縮"}</div>
        </Card>
      </div>

      <KintsugiLine />

      {/* 活動數據 */}
      <div>
        <div style={labelStyle}>活動 ACTIVITY</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 12 }}>
          <MiniStat label="總用戶" value={d.activity.users_total} />
          <MiniStat label="活躍用戶" value={d.activity.users_active} />
          <MiniStat label="本月撥打" value={d.activity.month_calls} />
          <MiniStat label="本月邀約" value={d.activity.month_appointments} />
          <MiniStat label="本月成交" value={d.activity.month_closures} />
        </div>
      </div>

      <div style={{ marginTop: 32, fontSize: 10, color: "var(--ink-mid)", textAlign: "right", letterSpacing: 1, fontFamily: "var(--font-jetbrains-mono)" }}>
        更新於 {new Date(d.generated_at).toLocaleString("zh-TW")}
      </div>
    </div>
  );
}

function Card({ title, health, label, children }: { title: string; health: Health; label: string; children: React.ReactNode }) {
  return (
    <motion.div whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(26,26,26,0.08)" }} transition={{ duration: 0.2 }}
      style={{ background: "var(--bg-elev, rgba(247,241,227,0.85))", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6, padding: "20px 22px", position: "relative" }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: 4, height: 32, background: healthColor(health), borderRadius: "0 0 0 4px" }} />
      <div style={labelStyle}>{label}</div>
      <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 14, color: "var(--ink-deep)", marginTop: 4, marginBottom: 12, letterSpacing: 2 }}>{title}</div>
      {children}
    </motion.div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "var(--bg-paper)", border: "1px solid var(--border-soft, rgba(26,26,26,0.06))", borderRadius: 4, padding: "12px 16px" }}>
      <div style={{ fontSize: 10, color: "var(--ink-mid)", letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 22, color: "var(--ink-deep)", marginTop: 4, fontWeight: 600 }}>{fmtNum(value)}</div>
    </div>
  );
}

function KintsugiLine() {
  return <svg width="100%" height="3" style={{ margin: "24px 0", display: "block" }}><line x1="0" y1="1.5" x2="100%" y2="1.5" stroke="var(--gold-thread, #c9a96e)" strokeWidth="1" strokeDasharray="2 4" /></svg>;
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--ink-mid)", letterSpacing: 3, fontWeight: 600, textTransform: "uppercase" };
const cardNumStyle = (h: Health): React.CSSProperties => ({ fontFamily: "var(--font-jetbrains-mono, monospace)", fontSize: 36, fontWeight: 700, color: healthColor(h), marginTop: 4, letterSpacing: 1 });
const cardSubStyle: React.CSSProperties = { fontSize: 11, color: "var(--ink-mid)", marginTop: 6, fontFamily: "var(--font-jetbrains-mono)" };
