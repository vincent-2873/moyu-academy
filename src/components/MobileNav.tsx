"use client";

import { usePathname } from "next/navigation";

const tabs = [
  { label: "待辦", emoji: "📋", href: "/today" },
  { label: "招聘", emoji: "🎯", href: "/recruit/104" },
  { label: "法務", emoji: "⚖️", href: "/legal/cases" },
  { label: "日曆", emoji: "📅", href: "/recruit/calendar" },
  { label: "我的", emoji: "👤", href: "/me" },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <>
      <style>{`
        .mobile-nav-bar {
          display: none;
        }
        @media (max-width: 768px) {
          .mobile-nav-bar {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 50;
            background: #0f172a;
            border-top: 1px solid rgba(255,255,255,0.1);
            padding: 6px 0;
            padding-bottom: calc(6px + env(safe-area-inset-bottom));
            justify-content: space-around;
            align-items: center;
          }
        }
      `}</style>
      <nav className="mobile-nav-bar">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <a
              key={tab.href}
              href={tab.href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                textDecoration: "none",
                color: active ? "#60a5fa" : "#94a3b8",
                fontSize: 10,
                fontWeight: active ? 700 : 500,
                padding: "4px 8px",
                borderRadius: 8,
                background: active ? "rgba(96,165,250,0.1)" : "transparent",
                transition: "all 0.15s",
                minWidth: 48,
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.emoji}</span>
              <span>{tab.label}</span>
            </a>
          );
        })}
      </nav>
    </>
  );
}
