"use client";

// /legal/* 共用 nav(2026-05-01 對齊 system-tree v2 §法務工作台)
// 視覺:純米白,法律事務所感

import { useRouter, usePathname } from "next/navigation";

const NAV = [
  { id: "cases", label: "📋 我的案件", path: "/legal/cases" },
  { id: "draft", label: "📝 Claude 起草", path: "/legal/draft" },
  { id: "training", label: "📖 法務訓練", path: "/legal/training" },
  { id: "knowledge", label: "📚 法律知識", path: "/legal/knowledge" },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || "";

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF7", fontFamily: "system-ui, -apple-system, 'Microsoft JhengHei', sans-serif" }}>
      <header style={{ position: "sticky", top: 0, background: "#FAFAF7", borderBottom: "1px solid #E5E2DA", zIndex: 10 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", gap: 24 }}>
          <a href="/" style={{ fontSize: 18, fontWeight: 800, color: "#2A2622", textDecoration: "none" }}>
            墨宇法務
          </a>
          <nav style={{ display: "flex", gap: 4, flex: 1 }}>
            {NAV.map((item) => {
              const active = pathname.startsWith(item.path);
              return (
                <button
                  key={item.id}
                  onClick={() => router.push(item.path)}
                  style={{
                    padding: "8px 14px",
                    border: "none",
                    borderRadius: 6,
                    background: active ? "rgba(46, 64, 87, 0.08)" : "transparent",
                    color: active ? "#2E4057" : "#666",
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "24px" }}>{children}</main>
    </div>
  );
}
