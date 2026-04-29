"use client";

import { motion } from "framer-motion";

/**
 * BreathingNumber — 數字呼吸效果 (KPI 數字 1.0 ↔ 1.02 scale, 2s 循環)
 *
 * 用法: <BreathingNumber>123,260</BreathingNumber>
 */

interface Props {
  children: React.ReactNode;
  size?: number;
  color?: string;
  mono?: boolean;
}

export default function BreathingNumber({ children, size = 36, color, mono = true }: Props) {
  return (
    <motion.span
      animate={{ scale: [1, 1.02, 1] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      style={{
        fontFamily: mono ? "var(--font-jetbrains-mono)" : "var(--font-noto-serif-tc)",
        fontSize: size,
        fontWeight: 600,
        color: color || "var(--ink-deep)",
        display: "inline-block",
        lineHeight: 1,
      }}
    >
      {children}
    </motion.span>
  );
}
