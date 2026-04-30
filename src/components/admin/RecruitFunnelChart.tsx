"use client";

/**
 * 2026-04-30 Wave D M7:招聘漏斗 waterfall chart
 *
 * 替換原本的 bar chart(line 2596-2611 admin/page.tsx)
 * 用 SVG 畫真正漏斗形狀:每階段梯形,自上往下逐漸收窄
 * 顯示:
 *   - 各階段絕對人數
 *   - 跨階段轉換率(下/上 × 100%)
 *   - 整體流失預警(連續跌 > 50% 紅色)
 */

import { motion } from "framer-motion";

interface Props {
  stages: Record<string, number>;
  accentColor: string;
}

const STAGE_ORDER = ["applied", "screening", "interview_1", "interview_2", "offer", "onboarded", "probation", "passed"];
const STAGE_LABELS: Record<string, string> = {
  applied: "投遞", screening: "篩選", interview_1: "一面", interview_2: "二面",
  offer: "Offer", onboarded: "報到", probation: "試用", passed: "通過",
};

export default function RecruitFunnelChart({ stages, accentColor }: Props) {
  // build active stage list(只顯示有 ≥ 1 人 + 後續所有 stage,避免漏斗中間斷層)
  const counts = STAGE_ORDER.map((s) => stages[s] || 0);
  let firstNonZero = counts.findIndex((c) => c > 0);
  if (firstNonZero < 0) firstNonZero = 0;
  const visible = STAGE_ORDER.slice(firstNonZero);
  const max = Math.max(1, ...visible.map((s) => stages[s] || 0));

  const W = 600;     // svg viewport
  const H = 360;
  const pad = 20;
  const stageH = (H - 2 * pad) / Math.max(visible.length, 1);

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>招聘漏斗</div>
        <div style={{ fontSize: 11, color: "var(--text3)" }}>
          整體轉換率:{counts[0] > 0 ? Math.round((stages["passed"] || 0) / counts[0] * 100) : 0}%
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {visible.map((sid, idx) => {
          const count = stages[sid] || 0;
          const next = visible[idx + 1];
          const nextCount = next ? (stages[next] || 0) : count;

          // 梯形 width 從 max 比例算
          const widthTop = (count / max) * (W - 2 * pad);
          const widthBottom = (nextCount / max) * (W - 2 * pad);

          // x 中心對齊
          const cxTop = W / 2;
          const cxBottom = W / 2;
          const yTop = pad + idx * stageH;
          const yBottom = yTop + stageH - 8;

          const xTopLeft = cxTop - widthTop / 2;
          const xTopRight = cxTop + widthTop / 2;
          const xBotLeft = cxBottom - widthBottom / 2;
          const xBotRight = cxBottom + widthBottom / 2;

          // 計算轉換率
          const convPct = idx === 0 ? null : (counts[firstNonZero + idx - 1] > 0
            ? Math.round((count / counts[firstNonZero + idx - 1]) * 100)
            : 0);
          const isDrop = convPct !== null && convPct < 50;

          return (
            <motion.g
              key={sid}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06, duration: 0.5 }}
            >
              {/* 梯形(漏斗段) */}
              <polygon
                points={`${xTopLeft},${yTop} ${xTopRight},${yTop} ${xBotRight},${yBottom} ${xBotLeft},${yBottom}`}
                fill={count > 0 ? accentColor : "var(--bg2)"}
                opacity={count > 0 ? 0.85 - idx * 0.07 : 0.3}
                stroke={accentColor}
                strokeWidth={count > 0 ? 1 : 0}
              />
              {/* 階段 label(左側) */}
              <text
                x={pad}
                y={yTop + stageH / 2}
                fontSize="11"
                fill="var(--text3)"
                dominantBaseline="middle"
              >
                {STAGE_LABELS[sid]}
              </text>
              {/* 數字(中央) */}
              <text
                x={W / 2}
                y={yTop + stageH / 2 - 4}
                fontSize="18"
                fontWeight="700"
                fill={count > 0 ? "#fff" : "var(--text3)"}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {count}
              </text>
              {/* 轉換率(右側,跌 > 50% 紅) */}
              {convPct !== null && (
                <text
                  x={W - pad}
                  y={yTop + stageH / 2}
                  fontSize="11"
                  fill={isDrop ? "#B91C1C" : "var(--text3)"}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontWeight={isDrop ? "700" : "400"}
                >
                  {isDrop && "⚠️ "}{convPct}%
                </text>
              )}
            </motion.g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 12, marginTop: 14, fontSize: 11, color: "var(--text3)", justifyContent: "center" }}>
        <span>← 階段</span>
        <span>數字 = 人數</span>
        <span>→ 該階段轉換率(<span style={{ color: "var(--accent-red)" }}>⚠️ &lt;50% 紅色</span>)</span>
      </div>
    </div>
  );
}
