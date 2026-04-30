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
        {/* 跨品牌人才流動 — SVG Sankey-like flow chart (Vincent 2026-04-30 反饋#13) */}
        <div>
          <div style={labelStyle}>跨品牌人才流動 (近 3 月)</div>
          <div style={{ marginTop: 12, background: "var(--bg-elev, rgba(247,241,227,0.85))", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6, padding: 16 }}>
            {d.talent_flows.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--ink-mid)", fontSize: 12, padding: 24 }}>近 3 月無跨品牌調動</div>
            ) : (
              <TalentFlowSankey flows={d.talent_flows} />
            )}
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

const BRAND_LABEL_MAP: Record<string, string> = {
  nschool: "nSchool", xuemi: "XUEMI", ooschool: "OOschool", aischool: "AIschool", moyuhunt: "墨宇獵頭", hq: "墨宇 HQ", legal: "法務", common: "其他",
};

/**
 * SVG Sankey-like talent flow chart
 * - Source brands 在左,Target brands 在右
 * - Curved Bezier path 連接,寬度 = flow count(min 1.5 / max 12 px)
 * - Hover 顯示 count
 */
function TalentFlowSankey({ flows }: { flows: { flow: string; count: number }[] }) {
  // Parse flows: "from→to" → { from, to, count }
  const parsed = flows.map(f => {
    const [from, to] = f.flow.split("→");
    return { from: (from || "").trim(), to: (to || "").trim(), count: f.count };
  }).filter(f => f.from && f.to);

  // Aggregate by source / target
  const sources = new Map<string, number>();
  const targets = new Map<string, number>();
  for (const f of parsed) {
    sources.set(f.from, (sources.get(f.from) || 0) + f.count);
    targets.set(f.to, (targets.get(f.to) || 0) + f.count);
  }
  const sourceList = Array.from(sources.entries()).sort((a, b) => b[1] - a[1]);
  const targetList = Array.from(targets.entries()).sort((a, b) => b[1] - a[1]);

  const W = 480, H = Math.max(180, Math.max(sourceList.length, targetList.length) * 32 + 40);
  const PAD_TOP = 20, PAD_BOTTOM = 20;
  const COL_X_LEFT = 96, COL_X_RIGHT = W - 96;
  const NODE_W = 8;
  const PLOT_H = H - PAD_TOP - PAD_BOTTOM;

  // Compute Y position for each node (proportional to total count)
  const totalSrc = sourceList.reduce((s, [, c]) => s + c, 0);
  const totalTgt = targetList.reduce((s, [, c]) => s + c, 0);
  const srcPos = new Map<string, { y: number; h: number }>();
  let yCur = PAD_TOP;
  for (const [name, count] of sourceList) {
    const h = totalSrc > 0 ? (count / totalSrc) * PLOT_H * 0.9 : 0;
    srcPos.set(name, { y: yCur + h / 2, h: Math.max(h, 6) });
    yCur += h + 4;
  }
  const tgtPos = new Map<string, { y: number; h: number }>();
  yCur = PAD_TOP;
  for (const [name, count] of targetList) {
    const h = totalTgt > 0 ? (count / totalTgt) * PLOT_H * 0.9 : 0;
    tgtPos.set(name, { y: yCur + h / 2, h: Math.max(h, 6) });
    yCur += h + 4;
  }

  // Path width scale
  const maxC = Math.max(1, ...parsed.map(f => f.count));
  const strokeFor = (c: number) => 1.5 + (c / maxC) * 10;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="跨品牌人才流動">
      <defs>
        <linearGradient id="flowGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c9a96e" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#b91c1c" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      {/* Flow paths (drawn first, behind nodes) */}
      {parsed.map((f, i) => {
        const s = srcPos.get(f.from);
        const t = tgtPos.get(f.to);
        if (!s || !t) return null;
        const x1 = COL_X_LEFT + NODE_W / 2;
        const x2 = COL_X_RIGHT - NODE_W / 2;
        const cx1 = x1 + (x2 - x1) * 0.4;
        const cx2 = x1 + (x2 - x1) * 0.6;
        return (
          <path
            key={i}
            d={`M ${x1},${s.y} C ${cx1},${s.y} ${cx2},${t.y} ${x2},${t.y}`}
            stroke="url(#flowGrad)"
            strokeWidth={strokeFor(f.count)}
            fill="none"
            opacity={0.7}
          >
            <title>{`${BRAND_LABEL_MAP[f.from] || f.from} → ${BRAND_LABEL_MAP[f.to] || f.to}: ${f.count} 人`}</title>
          </path>
        );
      })}
      {/* Source nodes (left) */}
      {Array.from(srcPos.entries()).map(([name, p]) => (
        <g key={`s-${name}`}>
          <rect x={COL_X_LEFT - NODE_W / 2} y={p.y - p.h / 2} width={NODE_W} height={p.h} fill="#1a1a1a" rx={1} />
          <text x={COL_X_LEFT - NODE_W / 2 - 6} y={p.y + 3} textAnchor="end" fontSize={11} fill="var(--ink-deep)" fontFamily="var(--font-noto-serif-tc, serif)">
            {BRAND_LABEL_MAP[name] || name}
          </text>
          <text x={COL_X_LEFT - NODE_W / 2 - 6} y={p.y + 16} textAnchor="end" fontSize={9} fill="var(--ink-mid)" fontFamily="var(--font-jetbrains-mono, monospace)">
            -{sources.get(name)}
          </text>
        </g>
      ))}
      {/* Target nodes (right) */}
      {Array.from(tgtPos.entries()).map(([name, p]) => (
        <g key={`t-${name}`}>
          <rect x={COL_X_RIGHT - NODE_W / 2} y={p.y - p.h / 2} width={NODE_W} height={p.h} fill="#b91c1c" rx={1} />
          <text x={COL_X_RIGHT + NODE_W / 2 + 6} y={p.y + 3} textAnchor="start" fontSize={11} fill="var(--ink-deep)" fontFamily="var(--font-noto-serif-tc, serif)">
            {BRAND_LABEL_MAP[name] || name}
          </text>
          <text x={COL_X_RIGHT + NODE_W / 2 + 6} y={p.y + 16} textAnchor="start" fontSize={9} fill="var(--ink-mid)" fontFamily="var(--font-jetbrains-mono, monospace)">
            +{targets.get(name)}
          </text>
        </g>
      ))}
    </svg>
  );
}
