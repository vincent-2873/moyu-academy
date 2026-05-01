"use client";

import { useEffect, useState } from "react";

interface Metrics {
  date?: string;
  calls?: number;
  invitations?: number;
  shows?: number;
  closes?: number;
  revenue?: number;
}

export default function SalesDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("moyu_user_email") : null;
    setEmail(stored);
    if (stored) {
      fetch(`/api/me/sales-metrics?email=${encodeURIComponent(stored)}`)
        .then((r) => r.json())
        .then((d) => setMetrics(d?.today || null))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>個人戰績</h1>
        <p style={{ fontSize: 14, opacity: 0.6, marginTop: 6 }}>
          今天的撥打 · 邀約 · 出席 · 成交 · 排名 · Claude 觀察
        </p>
      </div>

      {!email && (
        <div style={infoBoxStyle}>請先登入 → 回到 <a href="/" style={{ color: "#C8102E" }}>登入頁</a></div>
      )}
      {loading && <div style={infoBoxStyle}>載入中…</div>}

      {metrics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          <Card label="今日撥打" value={metrics.calls ?? 0} unit="通" />
          <Card label="邀約" value={metrics.invitations ?? 0} unit="人" />
          <Card label="出席" value={metrics.shows ?? 0} unit="人" />
          <Card label="成交" value={metrics.closes ?? 0} unit="筆" accent />
          <Card label="營收" value={metrics.revenue ?? 0} unit="元" accent />
        </div>
      )}

      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Claude 戰情官</h2>
        <p style={{ opacity: 0.7, fontSize: 14 }}>
          右下角朱紅墨字 → 點開 → 問 AI 你的撥打節奏 / 漏斗哪裡卡住 / 今天該補什麼。
          Claude 已 ingest 整套 nSchool 真實 source(8 步驟開發檢核 + 4 本書 + 8 個逐字),會引用真內容回答。
        </p>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>今日訓練</h2>
        <p style={{ opacity: 0.7, fontSize: 14 }}>
          → 進 <a href="/sales/training" style={{ color: "#C8102E" }}>訓練頁</a> 看今日時間軸。
        </p>
      </section>
    </div>
  );
}

function Card({ label, value, unit, accent }: { label: string; value: number; unit: string; accent?: boolean }) {
  return (
    <div
      style={{
        background: "var(--ink-mist, #F0EFEA)",
        border: "1px solid var(--ink-line, #E5E2DA)",
        borderRadius: 8,
        padding: 18,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>{label}</div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: accent ? "#C8102E" : "inherit",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
        <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 6, opacity: 0.6 }}>{unit}</span>
      </div>
    </div>
  );
}

const infoBoxStyle: React.CSSProperties = {
  padding: 14,
  background: "var(--ink-mist, #F0EFEA)",
  borderRadius: 6,
  fontSize: 14,
};
