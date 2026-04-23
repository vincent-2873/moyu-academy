"use client";

import { brands } from "@/data/brands";

export type CompanyType = "sales" | "recruit" | "hq" | "legal";
export type UserRole =
  | "chairman"
  | "sales_manager"
  | "recruit_manager"
  | "mentor"
  | "sales_rep"
  | "recruiter";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  userName: string;
  brandId: string;
  companyType: CompanyType;
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
}

const SALES_NAV: NavItem[] = [
  { id: "dashboard", icon: "📊", label: "今日戰況" },
  { id: "kpi", icon: "📈", label: "KPI 戰報" },
  { id: "sparring", icon: "🎯", label: "AI 對練", badge: "核心" },
  { id: "checkin", icon: "🌅", label: "每日上工" },
  { id: "profile", icon: "👤", label: "個人檔案" },
];

const RECRUIT_NAV: NavItem[] = [
  { id: "dashboard", icon: "🎯", label: "今日戰況" },
  { id: "candidates", icon: "👥", label: "我的候選人" },
  { id: "add_candidate", icon: "➕", label: "新增候選人" },
  { id: "funnel", icon: "🔻", label: "漏斗追蹤" },
  { id: "profile", icon: "👤", label: "個人檔案" },
];

const ROLE_LABELS: Record<UserRole, string> = {
  chairman: "董事長",
  sales_manager: "業務主管",
  recruit_manager: "獵頭主管",
  mentor: "師傅",
  sales_rep: "業務員",
  recruiter: "招聘員",
};

const COMPANY_LABELS: Record<CompanyType, string> = {
  sales: "業務戰線",
  recruit: "獵頭戰線",
  hq: "墨宇股份有限公司",
  legal: "法務顧問事務所",
};

export default function Sidebar({
  currentPage,
  onNavigate,
  userName,
  brandId,
  companyType,
  onLogout,
  userRole,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const brand = brands[brandId];
  const navItems = companyType === "recruit" ? RECRUIT_NAV : SALES_NAV;
  const accent =
    companyType === "recruit"
      ? "#fb923c"
      : brand?.color || "#7c6cf0";
  const accentLight =
    companyType === "recruit"
      ? "rgba(251,146,60,0.15)"
      : brand?.colorLight || "rgba(124,108,240,0.15)";
  const headline =
    companyType === "recruit"
      ? "墨宇獵頭戰情"
      : brand?.fullName || "墨宇戰情中樞";
  const isLightAccent =
    accent === "#feca57" || accent === "#10B981" || accent === "#fbbf24";

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={`w-[260px] bg-[var(--bg2)] border-r border-[var(--border)] fixed top-0 left-0 bottom-0 flex flex-col z-40 overflow-y-auto transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 md:z-10`}
      >
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
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] px-2 py-0.5 rounded font-semibold tracking-wider"
              style={{ background: accentLight, color: accent }}
            >
              {COMPANY_LABELS[companyType]}
            </span>
          </div>
          <h2
            className="text-xl font-bold"
            style={{
              background: `linear-gradient(135deg, ${accent}, var(--teal))`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {headline}
          </h2>
          <p className="text-xs text-[var(--text3)] mt-1">數據蒐集前台</p>
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
                      ? "shadow-lg"
                      : "text-[var(--text2)] hover:bg-[rgba(124,108,240,0.1)] hover:text-[var(--text)]"
                  }`}
                  style={
                    currentPage === item.id
                      ? {
                          background: accent,
                          boxShadow: `0 4px 20px ${accent}40`,
                          color: isLightAccent ? "#0a0a10" : "#fff",
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

          <div className="px-4 py-2 mt-4 text-[10px] text-[var(--text3)] uppercase tracking-widest">
            學習中心
          </div>
          <ul className="space-y-0.5">
            <li className="mx-2">
              <a
                href="/training"
                className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm transition-all text-[var(--text2)] hover:bg-[rgba(245,158,11,0.1)] hover:text-[var(--text)]"
              >
                <span className="text-base">📚</span>
                <span>新訓區域</span>
                <span className="ml-auto bg-[rgba(245,158,11,0.2)] text-[#F59E0B] px-2 py-0.5 rounded text-[10px] font-bold">
                  NEW
                </span>
              </a>
            </li>
          </ul>
        </nav>

        {/* User */}
        <div className="px-4 py-3 border-t border-[var(--border)] flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{
              background: `linear-gradient(135deg, ${accent}, var(--teal))`,
              color: isLightAccent ? "#0a0a10" : "#fff",
            }}
          >
            {userName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{userName}</p>
            <div className="flex items-center gap-1.5">
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ color: accent, backgroundColor: accentLight }}
              >
                {ROLE_LABELS[userRole]}
              </span>
              {companyType === "sales" && (
                <span className="text-[10px] text-[var(--text3)]">
                  {brand?.name}
                </span>
              )}
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
