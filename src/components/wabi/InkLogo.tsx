"use client";

import { motion } from "framer-motion";
import { useState } from "react";

/**
 * InkLogo — 墨宇 logo with 水墨化 hover 動畫
 *
 * Hover: 字像水墨慢慢化開重組
 * - opacity blur scale 變化
 * - 兩字分開動畫 stagger
 */
interface Props {
  text?: string;
  size?: number;
  onClick?: () => void;
  href?: string;
}

export default function InkLogo({ text = "墨宇", size = 32, onClick, href }: Props) {
  const [hover, setHover] = useState(false);

  const Inner = () => (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        display: "inline-flex",
        gap: size * 0.1,
        cursor: onClick || href ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      {text.split("").map((ch, i) => (
        <motion.span
          key={i}
          animate={hover ? { scale: [1, 1.15, 0.95, 1.05, 1], filter: ["blur(0px)", "blur(3px)", "blur(1px)", "blur(0px)"] } : { scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
          style={{
            fontSize: size,
            fontFamily: "var(--font-noto-serif-tc, serif)",
            fontWeight: 700,
            color: "var(--ink-deep, #1a1a1a)",
            letterSpacing: 2,
            display: "inline-block",
          }}
        >
          {ch}
        </motion.span>
      ))}
    </div>
  );

  if (href) {
    return <a href={href} style={{ textDecoration: "none" }}><Inner /></a>;
  }
  return <Inner />;
}
