"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BreathingNumber from "@/components/wabi/BreathingNumber";

const STAGE_NAMES: Record<string, string> = {
  beginner: "研墨者",
  intermediate: "執筆者",
  advanced: "點墨者",
  master: "執印者",
};

export default function WorkClient() {
  const [email, setEmail] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const e = sessionStorage.getItem("moyu_current_user")
      || sessionStorage.getItem("admin_email")
      || localStorage.getItem("admin_email");
    setEmail(e);
  }, []);

  useEffect(() => {
    if (!email) { setLoading(false); return; }
    Promise.all([
      fetch(`/api/me/training?email=${encodeURIComponent(email)}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/me/sales-metrics?email=${encodeURIComponent(email)}`).then(r => r.json()).catch(() => ({})),
    ]).then(([t, m]) => {
      setUser(t.user);
      setMetrics(m || {});
      setLoading(false);
    });
  }, [email]);

  if (!email && !loading) {
    return (
      <div style={pageStyle}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", padding: 80 }}>
          <h1 style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 48, color: "var(--ink-deep)", letterSpacing: 6 }}>未 登 入</h1>
          <a href="/" style={{ color: "var(--accent-red)", marginTop: 20, display: "inline-block" }}>回登入頁</a>
        </motion.div>
      </div>
    );
  }

  const m = metrics || {};
  const monthly = m.monthly || m.month || {};
  const today = m.today || {};
  const trend = m.trend || m.history || [];

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "80px 32px" }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, marginBottom: 12, fontWeight: 600 }}
        >
          MOYU · WORK · 數 據 鏡
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, scale: 0.92, filter: "blur(12px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{
            fontFamily: "var(--font-noto-serif-tc)",
            fontSize: "clamp(80px, 18vw, 200px)",
            fontWeight: 600,
            color: "var(--ink-deep)",
            letterSpacing: 12,
            lineHeight: 1,
            marginBottom: 24,
          }}
        >
          鏡
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          style={{ fontSize: 14, color: "var(--ink-mid)", marginBottom: 48, letterSpacing: 1, lineHeight: 1.7 }}
        >
          照自己一面鏡子 · 不評判 · 看清楚 ·{" "}
          {user && <span style={{ color: "var(--accent-red)", fontFamily: "var(--font-noto-serif-tc)" }}>{STAGE_NAMES[user.stage] || ""}</span>}
        </motion.div>

        <KintsugiLine delay={0.6} />

        {/* 今日 4 metric */}
        <SectionLabel delay={0.8}>今 · TODAY</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 56 }}>
          <MetricCard label="今日撥打" value={today.calls} unit="通" delay={0.9} />
          <MetricCard label="今日通時" value={today.call_minutes} unit="分" delay={1.0} />
          <MetricCard label="今日邀約" value={today.raw_appointments} unit="場" delay={1.1} />
          <MetricCard label="今日成交" value={today.closures} unit="件" delay={1.2} />
        </div>

        {/* 本月 3 metric */}
        <SectionLabel delay={1.3}>本月 · THIS MONTH</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 56 }}>
          <MetricCard label="本月撥打" value={monthly.calls} unit="通" big delay={1.4} />
          <MetricCard label="本月通時" value={monthly.call_minutes} unit="分" big delay={1.5} />
          <MetricCard label="本月成交" value={monthly.closures} unit="件" big delay={1.6} />
        </div>

        {/* 6 月趨勢 */}
        <SectionLabel delay={1.7}>趨 · TREND · 30 DAYS</SectionLabel>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.6 }}
          style={{
            padding: 32,
            background: "var(--bg-elev)",
            border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
            borderRadius: 6,
            minHeight: 200,
            marginBottom: 48,
          }}
        >
          {trend.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--ink-mid)" }}>
              <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 20, color: "var(--ink-deep)", letterSpacing: 4, marginBottom: 8 }}>等</div>
              <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                Metabase 自動同步中(每天台北 09:00 / 17:00)<br/>
                完成 backfill 後此處顯示 30 天趨勢
              </div>
            </div>
          ) : (
            <SparkChart data={trend.slice(-30)} />
          )}
        </motion.div>

        {/* Claude 診斷預留 */}
        <SectionLabel delay={2.0}>診 · CLAUDE 戰情官</SectionLabel>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.1, duration: 0.5 }}
          whileHover={{ y: -2 }}
          style={{
            padding: 32,
            background: "var(--bg-paper)",
            border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
            borderRadius: 6,
            marginBottom: 48,
          }}
        >
          <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 20, color: "var(--ink-deep)", marginBottom: 12, letterSpacing: 2 }}>
            問戰情官
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-mid)", lineHeight: 1.8 }}>
            點右下角朱紅「<span style={{ color: "var(--accent-red)", fontFamily: "var(--font-noto-serif-tc)" }}>墨</span>」字按鈕,問「我這週做得怎樣?」<br/>
            戰情官會看你的撥打、邀約、成交數據,給<span style={{ color: "var(--accent-red)" }}>三大發現 + 處方</span>。
          </div>
        </motion.div>

        <NavBar active="work" />
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, big, delay = 0 }: { label: string; value: any; unit?: string; big?: boolean; delay?: number }) {
  const display = value == null || value === undefined ? "—" : (typeof value === "number" ? value.toLocaleString() : value);
  const hasValue = value != null && value !== undefined && value !== "—";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -2 }}
      style={{
        padding: big ? 28 : 20,
        background: "var(--bg-paper)",
        border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 10, color: "var(--ink-mid)", letterSpacing: 3, marginBottom: 10, fontWeight: 600, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        {hasValue ? (
          <BreathingNumber size={big ? 44 : 32}>{display}</BreathingNumber>
        ) : (
          <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: big ? 44 : 32, fontWeight: 600, color: "var(--ink-deep)", lineHeight: 1 }}>{display}</span>
        )}
        {unit && <span style={{ fontSize: big ? 14 : 12, color: "var(--ink-mid)" }}>{unit}</span>}
      </div>
    </motion.div>
  );
}

function SectionLabel({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, marginBottom: 16, fontWeight: 600 }}
    >
      {children}
    </motion.div>
  );
}

function KintsugiLine({ delay = 0 }: { delay?: number }) {
  return (
    <motion.svg
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ delay, duration: 0.8 }}
      width="100%" height="3"
      style={{ display: "block", transformOrigin: "left", marginBottom: 56 }}
    >
      <line x1="0" y1="1.5" x2="100%" y2="1.5" stroke="var(--gold-thread, #c9a96e)" strokeWidth="1" strokeDasharray="2 4" />
    </motion.svg>
  );
}

function SparkChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;
  const values = data.map((d: any) => Number(d.calls || d.value || 0));
  const max = Math.max(...values, 1);
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1 || 1)) * 580 + 10;
    const y = 110 - (v / max) * 100;
    return { x, y, v };
  });
  return (
    <svg width="100%" height="140" viewBox="0 0 600 140" preserveAspectRatio="none">
      <motion.polyline
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        fill="none"
        stroke="var(--ink-deep)"
        strokeWidth="1.5"
        points={points.map(p => `${p.x},${p.y}`).join(" ")}
      />
      {points.map((p, i) => (
        <motion.circle
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 + i * 0.02 }}
          cx={p.x} cy={p.y} r="2"
          fill="var(--accent-red)"
        />
      ))}
    </svg>
  );
}

function NavBar({ active }: { active: "home" | "work" | "learn" | "account" }) {
  const items = [
    { id: "home", label: "今天", href: "/home" },
    { id: "work", label: "數據", href: "/work" },
    { id: "learn", label: "養成", href: "/learn" },
    { id: "account", label: "帳號", href: "/account" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 2.3 }}
      style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 64 }}
    >
      {items.map(it => (
        <motion.a
          key={it.id}
          href={it.href}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          style={{
            textAlign: "center",
            padding: "14px 0",
            borderRadius: 4,
            background: active === it.id ? "var(--ink-deep)" : "transparent",
            color: active === it.id ? "var(--bg-paper)" : "var(--ink-deep)",
            border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
            fontFamily: "var(--font-noto-serif-tc)",
            fontSize: 14,
            textDecoration: "none",
            letterSpacing: 4,
          }}
        >
          {it.label}
        </motion.a>
      ))}
    </motion.div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--bg-paper, #f7f1e3)",
  color: "var(--ink-deep, #1a1a1a)",
};
