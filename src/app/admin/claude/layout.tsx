"use client";

/**
 * /admin/claude layout — AI 工作台 sub-nav
 *
 * 純功能性 sub-nav 補上 5 子頁 navigation gap
 * (live / log / knowledge / rules / personas)
 *
 * 視覺維持米白主題,不做 Phase 5 視覺整併(那是 8 週 roadmap 第 7 週才動)
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

const SUB_TABS = [
  { id: "live",      label: "即時狀態", icon: "📡" },
  { id: "log",       label: "工作日誌", icon: "📋" },
  { id: "knowledge", label: "知識庫管理", icon: "📚" },
  { id: "rules",     label: "規則中心", icon: "⚙️" },
  { id: "personas",  label: "對練 Persona", icon: "🎭" },
] as const;

export default function AdminClaudeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";

  return (
    <div>
      <nav style={{
        display: "flex",
        gap: 4,
        marginBottom: 20,
        borderBottom: "1px solid var(--ink-line, #E5E2DA)",
        paddingBottom: 0,
        overflowX: "auto",
      }}>
        {SUB_TABS.map(t => {
          const active = pathname.includes(`/admin/claude/${t.id}`);
          return (
            <Link
              key={t.id}
              href={`/admin/claude/${t.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: "6px 6px 0 0",
                background: active ? "var(--ink-paper, #FAFAF7)" : "transparent",
                color: active ? "var(--ink-deep, #2A2622)" : "var(--text2, #5C544A)",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                textDecoration: "none",
                borderBottom: active ? "2px solid #C8102E" : "2px solid transparent",
                whiteSpace: "nowrap",
                fontFamily: "inherit",
                transition: "all 150ms",
              }}
            >
              <span style={{ fontSize: 14 }}>{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
