"use client";

import { useEffect, useState } from "react";

/**
 * /work — 數據鏡(下班 / 中午照鏡子)
 *
 * spec A2: 過去 / 現在 / Claude 診斷 / 處方
 * 資料源 = sales_metrics_daily(F0 Metabase 接通後真實資料)
 *
 * Skeleton 階段(F0 未通):顯示 mock + 「資料尚未接通」標示
 */

export default function WorkClient() {
  const [email, setEmail] = useState<string | null>(null);
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
    fetch(`/api/me/sales-metrics?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => { setMetrics(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [email]);

  if (!email) {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: "center", padding: 80 }}>
          <h1 style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 32, color: "var(--ink-deep)" }}>未登入</h1>
          <a href="/" style={{ color: "var(--accent-red)" }}>回登入頁</a>
        </div>
      </div>
    );
  }

  // metrics 形狀依據 /api/me/sales-metrics 既有實作可能不同 — 容錯處理
  const m = metrics || {};
  const monthlyData = m.monthly || m.month || {};
  const trend = m.trend || m.history || [];

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "60px 24px 80px" }}>
        <div style={{ fontSize: 12, color: "var(--ink-mid)", letterSpacing: 2, marginBottom: 8 }}>
          MOYU · WORK
        </div>
        <h1 style={{
          fontFamily: "var(--font-noto-serif-tc)",
          fontSize: 56,
          fontWeight: 600,
          color: "var(--ink-deep)",
          marginBottom: 24,
          letterSpacing: 4,
        }}>
          數據鏡
        </h1>
        <div style={{ fontSize: 14, color: "var(--ink-mid)", marginBottom: 40 }}>
          照自己一面鏡子 · 不評判 · 看清楚
        </div>

        {/* 本月過去 */}
        <SectionLabel>過 · LAST</SectionLabel>
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          <MetricCard label="本月撥打" value={monthlyData.calls ?? "—"} unit="通" />
          <MetricCard label="本月通時" value={monthlyData.call_minutes ?? monthlyData.duration_min ?? "—"} unit="分" />
          <MetricCard label="本月成交" value={monthlyData.closures ?? monthlyData.closed ?? "—"} unit="件" />
        </div>

        {/* 今日 */}
        <SectionLabel>今 · TODAY</SectionLabel>
        <div className="grid md:grid-cols-4 gap-4 mb-12">
          <MetricCard label="今日撥打" value={m.today?.calls ?? "—"} unit="通" small />
          <MetricCard label="今日邀約" value={m.today?.appointments ?? m.today?.raw_appointments ?? "—"} unit="場" small />
          <MetricCard label="今日 Demo" value={m.today?.raw_demos ?? "—"} unit="場" small />
          <MetricCard label="今日成交" value={m.today?.closures ?? "—"} unit="件" small />
        </div>

        {/* 6 月趨勢 */}
        <SectionLabel>趨 · TREND</SectionLabel>
        <div style={{
          padding: 24,
          background: "var(--bg-elev)",
          border: "1px solid var(--border-soft)",
          borderRadius: 6,
          minHeight: 140,
          marginBottom: 32,
        }}>
          {trend.length === 0 ? (
            <div style={{ color: "var(--ink-mid)", fontSize: 13, textAlign: "center", padding: 24 }}>
              尚無歷史趨勢資料 — Metabase 接通後將顯示 6 月趨勢線
            </div>
          ) : (
            <SparkChart data={trend.slice(-30)} />
          )}
        </div>

        {/* Claude 診斷預留 */}
        <SectionLabel>診 · CLAUDE</SectionLabel>
        <div style={{
          padding: 24,
          background: "var(--bg-paper)",
          border: "1px solid var(--border-soft)",
          borderRadius: 6,
          marginBottom: 32,
        }}>
          <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 16, color: "var(--ink-deep)", marginBottom: 8 }}>
            戰情官每日診斷
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-mid)", lineHeight: 1.7 }}>
            點右下角朱紅「墨」字按鈕,問戰情官「我這週做得怎樣?」<br/>
            Claude 會看你的撥打、邀約、成交數據,給三大發現 + 處方。
          </div>
        </div>

        {/* 4 link bar */}
        <div className="mt-12 grid grid-cols-4 gap-2">
          <NavBtn href="/home" label="今天" />
          <NavBtn href="/work" label="數據" active />
          <NavBtn href="/learn" label="養成" />
          <NavBtn href="/account" label="帳號" />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, small }: { label: string; value: any; unit?: string; small?: boolean }) {
  return (
    <div style={{
      padding: small ? 18 : 24,
      background: "var(--bg-paper)",
      border: "1px solid var(--border-soft)",
      borderRadius: 6,
    }}>
      <div style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 2, marginBottom: 8 }}>
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span style={{
          fontFamily: "var(--font-jetbrains-mono)",
          fontSize: small ? 28 : 36,
          fontWeight: 600,
          color: "var(--ink-deep)",
        }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {unit && <span style={{ fontSize: 12, color: "var(--ink-mid)" }}>{unit}</span>}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: "var(--ink-mid)", letterSpacing: 2, marginBottom: 16 }}>
      {children}
    </div>
  );
}

function SparkChart({ data }: { data: any[] }) {
  if (data.length === 0) return null;
  const values = data.map((d: any) => Number(d.calls || d.value || 0));
  const max = Math.max(...values, 1);
  return (
    <svg width="100%" height="120" viewBox="0 0 600 120" preserveAspectRatio="none">
      {values.map((v, i) => {
        const x = (i / (values.length - 1 || 1)) * 580 + 10;
        const y = 110 - (v / max) * 100;
        return <circle key={i} cx={x} cy={y} r="2" fill="var(--accent-red, #b91c1c)" />;
      })}
      <polyline
        fill="none"
        stroke="var(--ink-deep, #1a1a1a)"
        strokeWidth="1.5"
        points={values.map((v, i) => {
          const x = (i / (values.length - 1 || 1)) * 580 + 10;
          const y = 110 - (v / max) * 100;
          return `${x},${y}`;
        }).join(" ")}
      />
    </svg>
  );
}

function NavBtn({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <a href={href} className="text-center py-3 rounded-md" style={{
      background: active ? "var(--ink-deep)" : "transparent",
      color: active ? "var(--bg-paper)" : "var(--ink-deep)",
      border: "1px solid var(--border-soft)",
      fontFamily: "var(--font-noto-serif-tc)",
      fontSize: 14,
      textDecoration: "none",
    }}>
      {label}
    </a>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--bg-paper, #f7f1e3)",
  color: "var(--ink-deep, #1a1a1a)",
};
