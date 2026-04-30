"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

/**
 * 2026-04-30 末段 G2+G3:個人 insights page
 *
 * 雷達 5 軸 + 同事比對 leaderboard(/api/me/insights)
 */

interface RadarData {
  knowledge: number; sparring: number; calls: number; appts: number; closures: number;
}

interface InsightsData {
  ok: boolean;
  me: { email: string; name: string; brand: string; role: string };
  radar: RadarData;
  seven_day: { calls: number; appts: number; closures: number; revenue: number };
  sparring_30d_avg: number;
  rag_usage_30d: number;
  peer_compare: {
    my_rank: number; peer_count: number; percentile: number;
    top: { name: string; revenue: number; calls: number; closes: number } | null;
    median: { revenue: number; calls: number } | null;
    gap_to_top_revenue: number; gap_to_median_revenue: number;
  };
  leaderboard: Array<{ rank: number; name: string; is_me: boolean; revenue: number; calls: number; closes: number }>;
}

const RADAR_LABELS: Record<keyof RadarData, string> = {
  knowledge: "知識使用",
  sparring: "對練表現",
  calls: "撥打量",
  appts: "邀約率",
  closures: "成交率",
};

export default function InsightsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const e = sessionStorage.getItem("moyu_current_user");
    if (!e) { router.push("/?next=/me/insights"); return; }
    setEmail(e);
  }, [router]);

  useEffect(() => {
    if (!email) return;
    fetch(`/api/me/insights?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [email]);

  if (!email || loading) return <div className="p-12 text-center text-sm" style={{ color: "var(--ink-mid)" }}>載入中…</div>;
  if (!data || !data.ok) return <div className="p-12 text-center text-sm" style={{ color: "var(--accent-red)" }}>讀取失敗</div>;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-paper, #f7f1e3)", padding: "32px 20px" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, marginBottom: 12, fontWeight: 600 }}>MY INSIGHTS</div>
        <h1 style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: "clamp(36px, 5vw, 56px)", fontWeight: 600, color: "var(--ink-deep)", letterSpacing: 4, marginBottom: 8, lineHeight: 1.1 }}>
          個人戰力儀表板
        </h1>
        <div style={{ fontSize: 13, color: "var(--ink-mid)", marginBottom: 24 }}>
          {data.me.name} · {data.me.brand || "—"} · {data.me.role || "—"} · 7 天聚合 + 同 brand 對比
        </div>

        {/* 雷達圖 + 同事比對 並排 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
          {/* 雷達圖 */}
          <Card title="能力雷達(5 軸)">
            <RadarChart radar={data.radar} />
          </Card>

          {/* 同事比對 */}
          <Card title="同事比對">
            <div style={{ display: "grid", gap: 14, padding: 8 }}>
              <Stat label="你的排名" value={`${data.peer_compare.my_rank} / ${data.peer_compare.peer_count}`} accent={data.peer_compare.percentile >= 70 ? "#6B7A5A" : data.peer_compare.percentile >= 30 ? "#d97706" : "var(--accent-red)"} />
              <Stat label="超越同事百分位" value={`${data.peer_compare.percentile}%`} />
              {data.peer_compare.top && (
                <div style={{ padding: 10, background: "var(--bg-elev)", borderRadius: 4, fontSize: 12 }}>
                  <div style={{ color: "var(--ink-mid)", marginBottom: 4 }}>距 Top 1 ({data.peer_compare.top.name}):</div>
                  <div style={{ color: "var(--accent-red)", fontWeight: 600 }}>NT$ {data.peer_compare.gap_to_top_revenue.toLocaleString()}</div>
                </div>
              )}
              {data.peer_compare.median && (
                <div style={{ padding: 10, background: "var(--bg-elev)", borderRadius: 4, fontSize: 12 }}>
                  <div style={{ color: "var(--ink-mid)", marginBottom: 4 }}>距中位數:</div>
                  <div style={{ color: data.peer_compare.gap_to_median_revenue === 0 ? "#6B7A5A" : "#d97706", fontWeight: 600 }}>
                    {data.peer_compare.gap_to_median_revenue === 0 ? "✓ 已超中位數" : `NT$ ${data.peer_compare.gap_to_median_revenue.toLocaleString()}`}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* 7-day 數據 */}
        <Card title="過去 7 天聚合">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, padding: 8 }}>
            <Stat label="撥打" value={data.seven_day.calls} unit="通" />
            <Stat label="邀約" value={data.seven_day.appts} unit="件" />
            <Stat label="成交" value={data.seven_day.closures} unit="件" accent="#c9a96e" />
            <Stat label="營收" value={`NT$ ${data.seven_day.revenue.toLocaleString()}`} accent="#c9a96e" />
          </div>
        </Card>

        {/* Leaderboard */}
        <Card title={`同 brand Top 10(本週營收)`}>
          <div style={{ display: "grid", gap: 4, padding: 8 }}>
            {data.leaderboard.map((p) => (
              <div key={p.rank} style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr 80px 60px 100px",
                gap: 12,
                alignItems: "center",
                padding: "8px 12px",
                background: p.is_me ? "rgba(185,28,28,0.06)" : "var(--bg-elev)",
                border: `1px solid ${p.is_me ? "var(--accent-red)" : "transparent"}`,
                borderRadius: 4,
                fontSize: 13,
              }}>
                <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontWeight: 700, color: p.rank === 1 ? "#c9a96e" : p.rank <= 3 ? "var(--ink-deep)" : "var(--ink-mid)" }}>
                  {p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : `#${p.rank}`}
                </span>
                <span style={{ color: "var(--ink-deep)", fontWeight: p.is_me ? 700 : 400 }}>
                  {p.is_me ? `👤 ${p.name}(我)` : p.name}
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-mid)", textAlign: "right" }}>{p.calls} 通</span>
                <span style={{ fontSize: 11, color: "var(--ink-mid)", textAlign: "right" }}>{p.closes} 成交</span>
                <span style={{ fontSize: 12, color: "var(--ink-deep)", fontWeight: 600, textAlign: "right" }}>
                  NT$ {p.revenue.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* 補充 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12, fontSize: 12, color: "var(--ink-mid)" }}>
          <div style={{ padding: 12, background: "var(--bg-elev)", borderRadius: 4 }}>
            🎯 30 天對練平均: <strong style={{ color: "var(--ink-deep)" }}>{data.sparring_30d_avg}</strong> 分
          </div>
          <div style={{ padding: 12, background: "var(--bg-elev)", borderRadius: 4 }}>
            📚 30 天 RAG 使用: <strong style={{ color: "var(--ink-deep)" }}>{data.rag_usage_30d}</strong> 次
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ background: "var(--bg-elev, rgba(247,241,227,0.85))", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 8, padding: 20, marginBottom: 20 }}>
      <div style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600, marginBottom: 12 }}>{title}</div>
      {children}
    </motion.div>
  );
}

function Stat({ label, value, unit, accent }: { label: string; value: any; unit?: string; accent?: string }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 10, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: accent || "var(--ink-deep)" }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {unit && <span style={{ fontSize: 11, color: "var(--ink-mid)" }}>{unit}</span>}
      </div>
    </div>
  );
}

function RadarChart({ radar }: { radar: RadarData }) {
  const dimensions = Object.keys(radar) as (keyof RadarData)[];
  const size = 280;
  const center = size / 2;
  const r = size / 2 - 40;
  const points = dimensions.map((k, i) => {
    const angle = (Math.PI * 2 * i) / dimensions.length - Math.PI / 2;
    const v = radar[k] / 100;
    return {
      x: center + r * v * Math.cos(angle),
      y: center + r * v * Math.sin(angle),
      lx: center + (r + 22) * Math.cos(angle),
      ly: center + (r + 22) * Math.sin(angle),
    };
  });
  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const grids = [0.25, 0.5, 0.75, 1];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 8 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {grids.map((g) => (
          <polygon key={g} fill="none" stroke="rgba(26,26,26,0.10)" strokeWidth={1} points={dimensions.map((_, i) => {
            const angle = (Math.PI * 2 * i) / dimensions.length - Math.PI / 2;
            return `${center + r * g * Math.cos(angle)},${center + r * g * Math.sin(angle)}`;
          }).join(" ")} />
        ))}
        <polygon points={polygonPoints} fill="rgba(185,28,28,0.18)" stroke="var(--accent-red)" strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill="var(--accent-red)" />
        ))}
        {dimensions.map((k, i) => (
          <text key={k} x={points[i].lx} y={points[i].ly} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="var(--ink-mid)" fontWeight={600}>
            {RADAR_LABELS[k]}
          </text>
        ))}
      </svg>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginTop: 12, width: "100%" }}>
        {dimensions.map((k) => (
          <div key={k} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "var(--ink-mid)" }}>{RADAR_LABELS[k]}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: radar[k] >= 70 ? "#6B7A5A" : radar[k] >= 30 ? "#d97706" : "var(--accent-red)" }}>{radar[k]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
