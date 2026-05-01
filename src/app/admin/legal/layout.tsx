"use client";

/**
 * /admin/legal layout — 法務管理 sub-nav
 *
 * 對齊 system-tree v2 §法務管理:
 *   - /cases  案件中心(已建)
 *   - /knowledge  法律知識上傳(本輪新加,pillar=legal)
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

const SUB_TABS = [
  { id: "cases",     label: "案件中心",     icon: "⚖️" },
  { id: "knowledge", label: "法律知識管理", icon: "📚" },
] as const;

export default function AdminLegalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";

  return (
    <div>
      <nav style={{
        display: "flex", gap: 4, marginBottom: 20,
        borderBottom: "1px solid var(--ink-line, #E5E2DA)",
        overflowX: "auto",
      }}>
        {SUB_TABS.map(t => {
          const active = pathname.includes(`/admin/legal/${t.id}`);
          return (
            <Link
              key={t.id}
              href={`/admin/legal/${t.id}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px",
                borderRadius: "6px 6px 0 0",
                background: active ? "var(--ink-paper, #FAFAF7)" : "transparent",
                color: active ? "var(--ink-deep, #2A2622)" : "var(--text2, #5C544A)",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                textDecoration: "none",
                borderBottom: active ? "2px solid #6B7A5A" : "2px solid transparent",
                whiteSpace: "nowrap",
                fontFamily: "inherit",
              }}
            >
              <span>{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
