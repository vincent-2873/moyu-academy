"use client";

import { brands } from "@/data/brands";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  userName: string;
  brandId: string;
  completedModules: number[];
  onLogout: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const navItems = [
  { id: "dashboard", icon: "📊", label: "儀表板" },
  { id: "training", icon: "📚", label: "課程訓練" },
  { id: "videos", icon: "🎬", label: "影片教學", badge: "NEW" },
  { id: "sparring", icon: "🎯", label: "AI 對練", badge: "核心" },
  { id: "transcripts", icon: "🎧", label: "聽 Call 逐字稿" },
  { id: "tools", icon: "🧰", label: "銷售工具箱" },
  { id: "pricing", icon: "💰", label: "報價方案" },
  { id: "kpi", icon: "📈", label: "KPI 追蹤" },
  { id: "records", icon: "📝", label: "對練紀錄" },
  { id: "finance", icon: "💹", label: "專業知識" },
  { id: "knowledge", icon: "📖", label: "品牌知識庫" },
  { id: "articles", icon: "📰", label: "業務專欄", badge: "AI" },
];

export default function Sidebar({
  currentPage,
  onNavigate,
  userName,
  brandId,
  completedModules,
  onLogout,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const brand = brands[brandId];
  const progress = Math.round((completedModules.length / 9) * 100);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside className={`w-[260px] bg-[var(--bg2)] border-r border-[var(--border)] fixed top-0 left-0 bottom-0 flex flex-col z-40 overflow-y-auto transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:z-10`}>
        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text2)] hover:bg-[var(--border)] transition-colors"
          >
            ✕
          </button>
        )}
        {/* Brand Header */}
        <div className="px-5 py-4 border-b border-[var(--border)]">
        <h2
          className="text-xl font-bold"
          style={{
            background: `linear-gradient(135deg, ${brand?.color || "#7c6cf0"}, var(--teal))`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          墨宇學院 2.0
        </h2>
        <p className="text-xs text-[var(--text3)] mt-1">
          {brand?.fullName || "MOYU Academy"}
        </p>
      </div>

      {/* Progress */}
      <div className="px-5 py-3 border-b border-[var(--border)]">
        <div className="flex justify-between text-xs text-[var(--text2)] mb-1">
          <span>學習進度</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${brand?.color || "#7c6cf0"}, var(--teal))`,
            }}
          />
        </div>
        <p className="text-[10px] text-[var(--text3)] mt-1">
          {completedModules.length}/9 模組完成
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2">
        <div className="px-4 py-2 text-[10px] text-[var(--text3)] uppercase tracking-widest">
          功能選單
        </div>
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.id} className="mx-2">
              <button
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm transition-all ${
                  currentPage === item.id
                    ? "text-white shadow-lg"
                    : "text-[var(--text2)] hover:bg-[rgba(124,108,240,0.1)] hover:text-[var(--text)]"
                }`}
                style={
                  currentPage === item.id
                    ? {
                        background: brand?.color || "var(--accent)",
                        boxShadow: `0 4px 20px ${brand?.color || "var(--accent)"}40`,
                        color: brandId === "nschool" ? "#0a0a10" : "#fff",
                      }
                    : undefined
                }
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto bg-[rgba(254,202,87,0.2)] text-[var(--gold)] px-2 py-0.5 rounded text-[10px] font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* User */}
      <div className="px-4 py-3 border-t border-[var(--border)] flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm"
          style={{
            background: `linear-gradient(135deg, ${brand?.color || "#7c6cf0"}, var(--teal))`,
            color: brandId === "nschool" ? "#0a0a10" : "#fff",
          }}
        >
          {userName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{userName}</p>
          <p className="text-[10px] text-[var(--text3)]">{brand?.name}</p>
        </div>
        <button
          onClick={onLogout}
          className="text-xs text-[var(--text3)] hover:text-[var(--red)] transition-colors"
        >
          登出
        </button>
      </div>
      </aside>
    </>
  );
}
