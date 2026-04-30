"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

/**
 * 2026-04-30 末段 G2+G3 + Quality pass:個人 insights page
 *
 * - 5 軸雷達(混合 baseline + peer top normalize)
 * - diagnosis 一句話(人類視角)
 * - 弱項 + action items(具體建議)
 * - 同事比對 + leaderboard(top 1 視覺強調)
 * - RWD 手機:單欄堆疊
 */

interface RadarData { knowledge: number; sparring: number; calls: number; appts: number; closures: number; }

interface InsightsData {
  ok: boolean;
  me: { email: string; name: string; brand: string; role: string };
  radar: RadarData;
  diagnosis: string;
  weaknesses: Array<{ axis: string; label: string; score: number }>;
  strengths: Array<{ axis: string; label: string; score: number }>;
  action_items: Array<{ axis: string; label: string; score: number; severity: "critical" | "warning" | "info"; hint: string }>;
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
  appts: "邀約",
  closures: "成交",
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "var(--accent-red, #b91c1c)",
  warning: "#d97706",
  info: "#0891b2",
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
    <div style={{ minHeight: "100vh", background: "var(--bg-paper, #f7f1e3)", padding: "32px 16px" }}>
      <style>{`
        @media (max-width: 768px) {
          .insights-grid-2col { grid-template-columns: 1fr !important; }
          .insights-grid-4col { grid-template-columns: repeat(2, 1fr) !important; }
          .insights-leaderboard-row { grid-template-columns: 28px 1fr 80px !important; gap: 6px !important; font-size: 11px !important; }
          .insights-leaderboard-row .lb-cell-extra { display: none !important; }
          .insights-action-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, marginBottom: 12, fontWeight: 600 }}>MY INSIGHTS</div>
        <h1 style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: "clamp(28px, 6vw, 56px)", fontWeight: 600, color: "var(--ink-deep)", letterSpacing: 4, marginBottom: 8, lineHeight: 1.1 }}>
          個人戰力儀表板
        </h1>
        <div style={{ fontSize: 13, color: "var(--ink-mid)", marginBottom: 16 }}>
          {data.me.name} · {data.me.brand || "—"} · {data.me.role || "—"} · 7 天聚合
        </div>

        {/* Diagnosis 一句話(人話) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: "16px 20px",
            background: data.peer_compare.percentile >= 70 ? "rgba(107,122,90,0.08)" : data.peer_compare.percentile >= 30 ? "rgba(217,119,6,0.08)" : "rgba(185,28,28,0.06)",
            border: `1px solid ${data.peer_compare.percentile >= 70 ? "#6B7A5A" : data.peer_compare.percentile >= 30 ? "#d97706" : "var(--accent-red)"}`,
            borderRadius: 8,
            fontSize: 14,
            color: "var(--ink-deep)",
            lineHeight: 1.7,
            marginBottom: 24,
          }}
        >
          {data.diagnosis}
        </motion.div>

        {/* Action items(弱項建議)— 從人類視角:看到弱馬上知道幹嘛 */}
        {data.action_items.length > 0 && (
          <Card title="🎯 你的下一步行動">
            <div className="insights-action-grid" style={{ display: "grid", gridTemplateColumns: data.action_items.length === 1 ? "1fr" : "repeat(auto-fit, minmax(260px, 1fr))", gap: 10, padding: 4 }}>
              {data.action_items.map((a) => (
                <motion.div
                  key={a.axis}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  style={{
                    padding: 14,
                    background: "var(--bg-paper)",
                    border: `1px solid ${SEVERITY_COLOR[a.severity]}`,
                    borderRadius: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: SEVERITY_COLOR[a.severity], fontWeight: 700, letterSpacing: 1 }}>
                      {a.severity === "critical" ? "🔴 嚴重弱" : a.severity === "warning" ? "🟠 弱" : "🟡 偏弱"}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--ink-deep)", fontWeight: 600 }}>{a.label}</span>
                    <span style={{ fontSize: 11, color: SEVERITY_COLOR[a.severity], marginLeft: "auto", fontWeight: 700 }}>{a.score}/100</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-mid)", lineHeight: 1.6 }}>
                    {a.hint}
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        )}

        {/* 雷達圖 + 同事比對 */}
        <div className="insights-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
          <Card title="🎯 能力雷達(混合 baseline + top)">
            <RadarChart radar={data.radar} />
            {/* strengths chips */}
            {data.strengths.length > 0 && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(107,122,90,0.06)", borderRadius: 4, fontSize: 11, color: "#6B7A5A" }}>
                ⭐ 強項:{data.strengths.map((s) => `${s.label} ${s.score}`).join(" · ")}
              </div>
            )}
          </Card>

          <Card title="📊 同事比對(同 brand)">
            <div style={{ display: "grid", gap: 12, padding: 4 }}>
              <Stat label="你的排名" value={`${data.peer_compare.my_rank} / ${data.peer_compare.peer_count}`} accent={data.peer_compare.percentile >= 70 ? "#6B7A5A" : data.peer_compare.percentile >= 30 ? "#d97706" : "var(--accent-red)"} />
              <Stat label="超越百分位" value={`${data.peer_compare.percentile}%`} sub={`top ${100 - data.peer_compare.percentile + 1}% 之內`} />
              {data.peer_compare.top && (
                <div style={{ padding: 10, background: "var(--bg-elev)", borderRadius: 4, fontSize: 12 }}>
                  <div style={{ color: "var(--ink-mid)", marginBottom: 4 }}>距 Top 1 ({data.peer_compare.top.name}):</div>
                  <div style={{ color: "var(--accent-red)", fontWeight: 600, fontSize: 14 }}>NT$ {data.peer_compare.gap_to_top_revenue.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: "var(--ink-mid)", marginTop: 4 }}>
                    Top 1: {data.peer_compare.top.calls}通 · {data.peer_compare.top.closes}成交
                  </div>
                </div>
              )}
              {data.peer_compare.median && (
                <div style={{ padding: 10, background: "var(--bg-elev)", borderRadius: 4, fontSize: 12 }}>
                  <div style={{ color: "var(--ink-mid)", marginBottom: 4 }}>距中位數:</div>
                  <div style={{ color: data.peer_compare.gap_to_median_revenue === 0 ? "#6B7A5A" : "#d97706", fontWeight: 600, fontSize: 14 }}>
                    {data.peer_compare.gap_to_median_revenue === 0 ? "✓ 已超中位" : `NT$ ${data.peer_compare.gap_to_median_revenue.toLocaleString()}`}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* 7-day 數據 */}
        <Card title="📞 過去 7 天聚合">
          <div className="insights-grid-4col" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, padding: 4 }}>
            <Stat label="撥打" value={data.seven_day.calls} unit="通" sub={`目標 ≥ 210`} ok={data.seven_day.calls >= 210} />
            <Stat label="邀約" value={data.seven_day.appts} unit="件" sub={`目標 ≥ 35`} ok={data.seven_day.appts >= 35} />
            <Stat label="成交" value={data.seven_day.closures} unit="件" sub={`目標 ≥ 7`} ok={data.seven_day.closures >= 7} accent="#c9a96e" />
            <Stat label="營收" value={`NT$ ${data.seven_day.revenue.toLocaleString()}`} sub="本週" accent="#c9a96e" />
          </div>
        </Card>

        {/* Leaderboard */}
        <Card title="🏆 brand 內 Top 10(本週營收排序)">
          <div style={{ display: "grid", gap: 4, padding: 4 }}>
            {data.leaderboard.map((p) => (
              <div key={p.rank} className="insights-leaderboard-row" style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr 80px 60px 100px",
                gap: 12,
                alignItems: "center",
                padding: "8px 12px",
                background: p.is_me
                  ? "rgba(185,28,28,0.06)"
                  : p.rank === 1 ? "rgba(201,169,110,0.10)" : "var(--bg-elev)",
                border: `${p.rank === 1 ? 2 : 1}px solid ${p.is_me ? "var(--accent-red)" : p.rank === 1 ? "#c9a96e" : "transparent"}`,
                borderRadius: 4,
                fontSize: 13,
              }}>
                <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontWeight: 700, color: p.rank === 1 ? "#c9a96e" : p.rank <= 3 ? "var(--ink-deep)" : "var(--ink-mid)", fontSize: p.rank === 1 ? 18 : 14 }}>
                  {p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : `#${p.rank}`}
                </span>
                <span style={{ color: "var(--ink-deep)", fontWeight: p.is_me || p.rank === 1 ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.is_me ? `👤 ${p.name}(我)` : p.name}
                  {p.rank === 1 && <span style={{ fontSize: 10, color: "#c9a96e", marginLeft: 6, letterSpacing: 1 }}>Top 1</span>}
                </span>
                <span className="lb-cell-extra" style={{ fontSize: 11, color: "var(--ink-mid)", textAlign: "right" }}>{p.calls} 通</span>
                <span className="lb-cell-extra" style={{ fontSize: 11, color: "var(--ink-mid)", textAlign: "right" }}>{p.closes} 成</span>
                <span style={{ fontSize: 12, color: p.rank === 1 ? "#c9a96e" : "var(--ink-deep)", fontWeight: 700, textAlign: "right" }}>
                  NT$ {p.revenue.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* 補充 */}
        <div className="insights-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12, fontSize: 12, color: "var(--ink-mid)" }}>
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
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ background: "var(--bg-elev, rgba(247,241,227,0.85))", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 8, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600, marginBottom: 10 }}>{title}</div>
      {children}
    </motion.div>
  );
}

function Stat({ label, value, unit, accent, sub, ok }: { label: string; value: any; unit?: string; accent?: string; sub?: string; ok?: boolean }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 10, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: ok === true ? "#6B7A5A" : ok === false ? "var(--accent-red)" : (accent || "var(--ink-deep)") }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {unit && <span style={{ fontSize: 11, color: "var(--ink-mid)" }}>{unit}</span>}
        {ok === true && <span style={{ fontSize: 11, color: "#6B7A5A", marginLeft: 4 }}>✓</span>}
        {ok === false && <span style={{ fontSize: 11, color: "var(--accent-red)", marginLeft: 4 }}>↓</span>}
      </div>
      {sub && <div style={{ fontSize: 10, color: "var(--ink-mid)", marginTop: 2 }}>{sub}</div>}
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
  // baseline = 70(scoring 函式 baseline 對應 70)
  const baselineRing = 0.7;
  const baselinePts = dimensions.map((_, i) => {
    const angle = (Math.PI * 2 * i) / dimensions.length - Math.PI / 2;
    return `${center + r * baselineRing * Math.cos(angle)},${center + r * baselineRing * Math.sin(angle)}`;
  }).join(" ");

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 4 }}>
      <svg width="100%" height="auto" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: size }}>
        {grids.map((g) => (
          <polygon key={g} fill="none" stroke="rgba(26,26,26,0.10)" strokeWidth={1} points={dimensions.map((_, i) => {
            const angle = (Math.PI * 2 * i) / dimensions.length - Math.PI / 2;
            return `${center + r * g * Math.cos(angle)},${center + r * g * Math.sin(angle)}`;
          }).join(" ")} />
        ))}
        {/* baseline ring(70 分及格線) */}
        <polygon points={baselinePts} fill="none" stroke="#6B7A5A" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.5} />
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
            <div style={{ fontSize: 14, fontWeight: 700, color: radar[k] >= 70 ? "#6B7A5A" : radar[k] >= 50 ? "#d97706" : "var(--accent-red)" }}>{radar[k]}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: "var(--ink-mid)" }}>
        🟩 70 線 = 達標 baseline · 紅多邊形 = 你的位置
      </div>
    </div>
  );
}
