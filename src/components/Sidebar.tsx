"use client";

import { brands } from "@/data/brands";
import { getModulesForBrand } from "@/data/modules";

export type UserRole = "admin" | "manager" | "mentor" | "sales_rep";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  userName: string;
  brandId: string;
  completedModules: number[];
  onLogout: () => void;
  userRole: UserRole;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  id: string;
  icon: string;
  label: string;
  badge?: string;
  /** Minimum role required. If omitted, all roles can see it */
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { id: "dashboard", icon: "📊", label: "儀表板" },
  { id: "training", icon: "📚", label: "課程訓練" },
  { id: "videos", icon: "🎬", label: "影片教學" },
  { id: "sparring", icon: "🎯", label: "AI 對練", badge: "核心" },
  { id: "sop", icon: "📋", label: "SOP 規範", badge: "NEW" },
  { id: "knowledge", icon: "📖", label: "品牌知識庫" },
  { id: "pricing", icon: "💰", label: "報價方案" },
  { id: "kpi", icon: "📈", label: "KPI 追蹤" },
  { id: "mentorship", icon: "🏮", label: "我的師徒" },
  { id: "profile", icon: "👤", label: "個人檔案" },
];

function canSeeItem(item: NavItem, role: UserRole): boolean {
  if (!item.roles) return true;
  return item.roles.includes(role);
}

export default function Sidebar({
  currentPage,
  onNavigate,
  userName,
  brandId,
  completedModules,
  onLogout,
  userRole,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const brand = brands[brandId];
  const brandModules = getModulesForBrand(brandId);
  const progress = Math.round((completedModules.length / brandModules.length) * 100);

  const visibleItems = navItems.filter((item) => canSeeItem(item, userRole));

  const roleLabels: Record<UserRole, string> = {
    admin: "管理員",
    manager: "據點主管",
    mentor: "師父",
    sales_rep: "業務",
  };

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
          {brand?.fullName || "墨宇學院 2.0"}
        </h2>
        <p className="text-xs text-[var(--text3)] mt-1">
          教育訓練系統
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
          {completedModules.length}/{brandModules.length} 模組完成
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2">
        <div className="px-4 py-2 text-[10px] text-[var(--text3)] uppercase tracking-widest">
          功能選單
        </div>
        <ul className="space-y-0.5">
          {visibleItems.map((item) => (
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
                        color: ["nschool", "aischool"].includes(brandId) ? "#0a0a10" : "#fff",
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
            color: ["nschool", "aischool"].includes(brandId) ? "#0a0a10" : "#fff",
          }}
        >
          {userName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{userName}</p>
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                color: brand?.color || "var(--accent)",
                backgroundColor: brand?.colorLight || "rgba(124,108,240,0.15)",
              }}
            >
              {roleLabels[userRole]}
            </span>
            <span className="text-[10px] text-[var(--text3)]">{brand?.name}</span>
          </div>
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
