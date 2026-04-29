"use client";

import { motion } from "framer-motion";

/**
 * StreakScroll — 連續 N 天簽到 → 紙張捲起來捲軸動畫
 *
 * 用法: <StreakScroll days={7} />
 */

interface Props {
  days: number;
  threshold?: number; // 達到 threshold 才顯示 scroll(預設 7)
}

export default function StreakScroll({ days, threshold = 7 }: Props) {
  if (days < threshold) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: 0.8, type: "spring", stiffness: 120 }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 20px",
        background: "linear-gradient(90deg, var(--gold-thread, #c9a96e) 0%, transparent 5%, transparent 95%, var(--gold-thread, #c9a96e) 100%)",
        border: "1px solid var(--gold-thread, #c9a96e)",
        borderRadius: 4,
        position: "relative",
      }}
    >
      {/* 左捲軸頭 */}
      <motion.div
        animate={{ rotateY: [0, 15, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: 8, height: 36,
          background: "var(--gold-thread, #c9a96e)",
          borderRadius: 4,
        }}
      />
      <div>
        <div style={{ fontSize: 10, color: "var(--ink-mid)", letterSpacing: 3, fontWeight: 600 }}>連續</div>
        <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 22, color: "var(--ink-deep)", letterSpacing: 2, lineHeight: 1 }}>
          {days} <span style={{ fontSize: 12, color: "var(--ink-mid)" }}>天</span>
        </div>
      </div>
      {/* 右捲軸頭 */}
      <motion.div
        animate={{ rotateY: [0, -15, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: 8, height: 36,
          background: "var(--gold-thread, #c9a96e)",
          borderRadius: 4,
        }}
      />
    </motion.div>
  );
}
