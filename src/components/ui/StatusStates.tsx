/**
 * 共用 status states component(EmptyState / LoadingDots / ErrorBox / WarningBox)
 *
 * 取代散在各 admin page 的 infoBox 重複片段,Phase 6 polish 收斂
 *
 * 用法:
 *   {loading && <LoadingDots>載入中…</LoadingDots>}
 *   {error && <ErrorBox>{error}</ErrorBox>}
 *   {!loading && data.length === 0 && <EmptyState icon="📭" title="還沒資料" />}
 */

import type { CSSProperties } from "react";

interface BoxProps {
  children?: React.ReactNode;
  style?: CSSProperties;
}

export function LoadingDots({ children = "載入中…" }: BoxProps) {
  return (
    <div style={{
      padding: 14,
      background: "var(--ink-mist, #F0EFEA)",
      borderRadius: 6,
      fontSize: 14,
      color: "var(--text2, #5C544A)",
      lineHeight: 1.6,
    }}>
      <span className="loading-dots">{children}</span>
      <style jsx>{`
        .loading-dots::after {
          content: "·";
          animation: dots 1.4s steps(4, end) infinite;
          margin-left: 4px;
        }
        @keyframes dots {
          0%, 20%   { content: "·"; }
          40%       { content: "··"; }
          60%       { content: "···"; }
          80%, 100% { content: "····"; }
        }
      `}</style>
    </div>
  );
}

export function EmptyState({ icon = "📭", title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div style={{
      padding: "28px 20px",
      background: "var(--ink-mist, #F0EFEA)",
      border: "1px dashed var(--ink-line, #E5E2DA)",
      borderRadius: 10,
      textAlign: "center",
      color: "var(--text2, #5C544A)",
    }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: "var(--text, #2A2622)" }}>{title}</div>
      {hint && (
        <div style={{ fontSize: 12, color: "var(--text3, #888)", lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function ErrorBox({ children, style }: BoxProps) {
  return (
    <div style={{
      padding: 14,
      background: "rgba(184, 71, 74, 0.08)",
      border: "1px solid rgba(184, 71, 74, 0.3)",
      color: "#B8474A",
      borderRadius: 6,
      fontSize: 13,
      lineHeight: 1.6,
      ...style,
    }}>
      ❌ {children}
    </div>
  );
}

export function WarningBox({ children, style }: BoxProps) {
  return (
    <div style={{
      padding: 14,
      background: "rgba(184, 153, 104, 0.08)",
      border: "1px solid rgba(184, 153, 104, 0.3)",
      color: "#806848",
      borderRadius: 6,
      fontSize: 13,
      lineHeight: 1.6,
      ...style,
    }}>
      🟡 {children}
    </div>
  );
}
