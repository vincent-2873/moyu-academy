/**
 * 2026-04-30 末段 視覺精緻化:毛玻璃 + 毛邊 design tokens
 *
 * 設計語言:wabi-sabi + glassmorphism
 *   - 毛玻璃:backdrop-filter blur + 半透明 paper bg
 *   - 毛邊:細 1px outline + inner highlight + soft outer shadow(模擬墨筆毛邊)
 *   - 金線分隔(墨宇識別)
 *   - 字級嚴格 hierarchy(Noto Serif TC 中文襯線 + JetBrains Mono 數字)
 *
 * 用法:
 *   <div style={glassCard}>...</div>
 *   <div style={{ ...glassCard, ...glassCardHover(isHover) }}>...</div>
 *   <h1 style={serifH1}>標題</h1>
 *   <span style={monoNum}>1234</span>
 */

import type { CSSProperties } from "react";

// ─────────────────────────────────────────────────────────────
// 毛玻璃卡片(預設 light theme — 米白紙紋背景)
// ─────────────────────────────────────────────────────────────
export const glassCard: CSSProperties = {
  background: "rgba(247, 241, 227, 0.72)",
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  border: "1px solid rgba(26, 26, 26, 0.06)",
  borderRadius: 12,
  boxShadow: [
    "0 0 0 0.5px rgba(26,26,26,0.04)",
    "0 4px 24px rgba(26,26,26,0.05)",
    "0 1px 2px rgba(26,26,26,0.02)",
    "inset 0 1px 0 rgba(255,255,255,0.45)",
    "inset 0 -1px 0 rgba(26,26,26,0.03)",
  ].join(", "),
  transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
};

// 深色玻璃(搭配 admin dark sidebar 用)
export const glassCardDark: CSSProperties = {
  background: "rgba(26, 26, 26, 0.55)",
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: 12,
  boxShadow: [
    "0 0 0 0.5px rgba(255,255,255,0.04)",
    "0 4px 24px rgba(0,0,0,0.30)",
    "inset 0 1px 0 rgba(255,255,255,0.06)",
  ].join(", "),
  color: "rgba(247,241,227,0.92)",
  transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
};

// 強調卡(朱紅毛邊 — critical / important)
export const glassCardAccent: CSSProperties = {
  ...glassCard,
  background: "rgba(247, 241, 227, 0.78)",
  border: "1px solid rgba(184, 71, 74, 0.32)",
  boxShadow: [
    "0 0 0 0.5px rgba(184, 71, 74, 0.10)",
    "0 4px 32px rgba(184, 71, 74, 0.08)",
    "0 1px 2px rgba(26,26,26,0.04)",
    "inset 0 1px 0 rgba(255,255,255,0.50)",
    "inset 0 -1px 0 rgba(184, 71, 74, 0.06)",
  ].join(", "),
};

// 金毛邊(top performer / 領跑者)
export const glassCardGold: CSSProperties = {
  ...glassCard,
  background: "rgba(252, 248, 235, 0.78)",
  border: "1px solid rgba(201, 169, 110, 0.36)",
  boxShadow: [
    "0 0 0 0.5px rgba(201, 169, 110, 0.14)",
    "0 4px 32px rgba(201, 169, 110, 0.08)",
    "inset 0 1px 0 rgba(255,255,255,0.55)",
    "inset 0 -1px 0 rgba(201, 169, 110, 0.06)",
  ].join(", "),
};

// hover 提升(微微抬起 + shadow 加深)
export function glassCardHover(isHover: boolean): CSSProperties {
  if (!isHover) return {};
  return {
    transform: "translateY(-2px)",
    boxShadow: [
      "0 0 0 0.5px rgba(26,26,26,0.06)",
      "0 8px 36px rgba(26,26,26,0.08)",
      "0 2px 4px rgba(26,26,26,0.03)",
      "inset 0 1px 0 rgba(255,255,255,0.55)",
    ].join(", "),
  };
}

// ─────────────────────────────────────────────────────────────
// Typography
// ─────────────────────────────────────────────────────────────

// 大標題(英文 + label 用)
export const sectionLabel: CSSProperties = {
  fontSize: 11,
  color: "rgba(26,26,26,0.55)",
  letterSpacing: 4,
  fontWeight: 600,
  textTransform: "uppercase",
};

// 中文 H1 — Noto Serif TC + clamp + 大字距
export const serifH1: CSSProperties = {
  fontFamily: "var(--font-noto-serif-tc, serif)",
  fontSize: "clamp(28px, 5vw, 56px)",
  fontWeight: 600,
  color: "rgba(26,26,26,0.92)",
  letterSpacing: 4,
  lineHeight: 1.1,
};

// 中文 H2
export const serifH2: CSSProperties = {
  fontFamily: "var(--font-noto-serif-tc, serif)",
  fontSize: "clamp(20px, 3vw, 28px)",
  fontWeight: 600,
  color: "rgba(26,26,26,0.92)",
  letterSpacing: 2,
};

// 卡片小標題
export const cardTitle: CSSProperties = {
  fontSize: 12,
  color: "rgba(26,26,26,0.55)",
  letterSpacing: 2,
  fontWeight: 600,
  textTransform: "uppercase",
};

// 數字(JetBrains Mono)
export const monoNum: CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono, monospace)",
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: '"tnum"',
};

// 大數字(KPI 顯示用)
export const bigNumber: CSSProperties = {
  ...monoNum,
  fontSize: 36,
  fontWeight: 700,
  color: "rgba(26,26,26,0.92)",
  lineHeight: 1,
};

// 中數字
export const midNumber: CSSProperties = {
  ...monoNum,
  fontSize: 22,
  fontWeight: 700,
  color: "rgba(26,26,26,0.92)",
  lineHeight: 1.1,
};

// ─────────────────────────────────────────────────────────────
// 金線分隔(墨宇識別 — kintsugi 風格)
// ─────────────────────────────────────────────────────────────
export const goldDivider: CSSProperties = {
  height: 1,
  background: "linear-gradient(90deg, transparent 0%, rgba(201,169,110,0.5) 20%, rgba(201,169,110,0.7) 50%, rgba(201,169,110,0.5) 80%, transparent 100%)",
  margin: "20px 0",
  border: 0,
};

// 朱紅章印小點(裝飾)
export const inkDot: CSSProperties = {
  display: "inline-block",
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "rgba(184, 71, 74, 0.85)",
  boxShadow: "0 0 8px rgba(184, 71, 74, 0.4)",
  marginRight: 8,
};

// ─────────────────────────────────────────────────────────────
// 健康度顏色(語意 token)
// ─────────────────────────────────────────────────────────────
export const HEALTH_COLOR = {
  healthy: "#6B7A5A",
  warning: "#B89968",
  critical: "#B8474A",
  neutral: "rgba(26,26,26,0.55)",
} as const;

export const HEALTH_BG = {
  healthy: "rgba(107, 122, 90, 0.06)",
  warning: "rgba(184, 153, 104, 0.08)",
  critical: "rgba(184, 71, 74, 0.05)",
  neutral: "rgba(26, 26, 26, 0.03)",
} as const;

export function healthFromPct(pct: number, goodThreshold = 80, warnThreshold = 50): keyof typeof HEALTH_COLOR {
  if (pct >= goodThreshold) return "healthy";
  if (pct >= warnThreshold) return "warning";
  return "critical";
}

// ─────────────────────────────────────────────────────────────
// CSS class names(用 globals.css 預先定義的)
// ─────────────────────────────────────────────────────────────
export const CSS_GLASS_CARD = "moyu-glass-card";
export const CSS_GLASS_CARD_HOVER = "moyu-glass-card-hover";
