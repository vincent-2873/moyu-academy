"use client";

/**
 * Admin Layout v3 (2026-05-02 整套重做)
 *
 * 修正:
 * 1. 修 nav bug — 全用 leaf URL,不再 hit zone-root server redirect
 * 2. 響應式 sidebar — 手機 hamburger drawer / 桌機 sticky
 * 3. 真按鈕真功能表 — 用 .ds-* design system class
 * 4. sub-nav — 各區子頁切換在 sidebar 內展開
 */

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface AdminSession {
  email: string;
  name: string;
  token: string;
}

interface SubNav {
  href: string;
  label: string;
}
interface Zone {
  id: string;
  icon: string;
  label: string;
  default: string;     // 點 zone 時 redirect 的 leaf URL(永遠是 leaf,不要 zone-root)
  matchPrefix: string; // 用於判斷 active
  subs: SubNav[];
}

const ZONES: Zone[] = [
  {
    id: "hub", icon: "🏯", label: "戰情中心",
    default: "/admin/hub",
    matchPrefix: "/admin/hub",
    subs: [
      { href: "/admin/hub", label: "🏯 集團總覽" },
    ],
  },
  {
    id: "board", icon: "🏛️", label: "投資人中心",
    default: "/admin/board",
    matchPrefix: "/admin/board",
    subs: [
      { href: "/admin/board", label: "📊 週/月/季成績單" },
      { href: "/admin/board/strategy", label: "🎯 戰略報告" },
      { href: "/admin/board/inquiry", label: "💬 質詢 Claude" },
      { href: "/admin/board/decisions", label: "✍️ 拍板紀錄" },
    ],
  },
  {
    id: "sales", icon: "📊", label: "業務管理",
    default: "/admin/sales/dashboard",
    matchPrefix: "/admin/sales",
    subs: [
      { href: "/admin/sales/dashboard", label: "🎯 業務戰況" },
      { href: "/admin/sales/individual", label: "👤 個人戰況" },
    ],
  },
  {
    id: "legal", icon: "⚖️", label: "法務管理",
    default: "/admin/legal/cases",
    matchPrefix: "/admin/legal",
    subs: [
      { href: "/admin/legal/cases", label: "📋 案件中心" },
      { href: "/admin/legal/knowledge", label: "📚 法律知識管理" },
    ],
  },
  {
    id: "training-ops", icon: "📚", label: "訓練營運",
    default: "/admin/training-ops/students",
    matchPrefix: "/admin/training-ops",
    subs: [
      { href: "/admin/training-ops/students", label: "👥 訓練生戰況" },
      { href: "/admin/training-ops/attention", label: "🚨 需介入清單" },
      { href: "/admin/training-ops/materials", label: "📖 教材管理" },
      { href: "/admin/training-ops/report", label: "📈 成效報告" },
    ],
  },
  {
    id: "claude", icon: "🤖", label: "AI 工作台",
    default: "/admin/claude/live",
    matchPrefix: "/admin/claude",
    subs: [
      { href: "/admin/claude/live", label: "🟢 即時狀態" },
      { href: "/admin/claude/log", label: "📝 工作日誌" },
      { href: "/admin/claude/knowledge", label: "📚 知識庫管理" },
      { href: "/admin/claude/rules", label: "📐 規則中心" },
      { href: "/admin/claude/personas", label: "🎭 對練 Persona" },
    ],
  },
  {
    id: "human", icon: "🤝", label: "人類工作區",
    default: "/admin/human/sos",
    matchPrefix: "/admin/human",
    subs: [
      { href: "/admin/human/sos", label: "🆘 Claude 求救" },
      { href: "/admin/human/sign-off", label: "✍️ 我必須拍板" },
      { href: "/admin/human/arbitration", label: "⚖️ 仲裁紀錄" },
    ],
  },
  {
    id: "settings", icon: "⚙️", label: "系統設定",
    default: "/admin/settings/people",
    matchPrefix: "/admin/settings",
    subs: [
      { href: "/admin/settings/people", label: "👥 人員管理" },
      { href: "/admin/settings/cron", label: "⏰ 排程管理" },
      { href: "/admin/settings/health", label: "💚 系統健康度" },
      { href: "/admin/settings/system", label: "🔧 系統參數" },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || "";
  // 2026-05-02 fix: hydration mismatch root cause:SSR session=null vs client localStorage=有值
  // 解法:用 hydrated state 確保 SSR + 第一次 client render 都顯一樣的 minimal shell
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("moyu_admin_session");
    if (stored) {
      try { setSession(JSON.parse(stored)); }
      catch { localStorage.removeItem("moyu_admin_session"); }
    }
    setHydrated(true);
  }, []);

  // 切頁時關閉 mobile drawer
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "登入失敗");
      const newSession: AdminSession = {
        email: json.user?.email ?? loginEmail,
        name: json.user?.name ?? loginEmail,
        token: "cookie",
      };
      localStorage.setItem("moyu_admin_session", JSON.stringify(newSession));
      setSession(newSession);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "登入失敗");
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("moyu_admin_session");
    setSession(null);
    router.push("/");
  }

  // 在 hydrate 完成前 render 跟 SSR 完全一致的 minimal shell(避免 hydration mismatch)
  if (!hydrated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--ds-text-3)" }}>載入中…</div>
      </div>
    );
  }

  // 未登入 → 登入卡片
  if (!session) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h1 style={{ fontSize: "var(--ds-fs-2xl)", fontWeight: 800, color: "var(--ds-primary)" }}>墨宇戰情中樞</h1>
            <p style={{ fontSize: "var(--ds-fs-sm)", color: "var(--ds-text-3)", marginTop: 6 }}>
              管理員登入 · 業務 / 法務 / 訓練 / AI 自動化
            </p>
          </div>
          <form onSubmit={handleLogin} className="ds-card">
            <div style={{ marginBottom: 14 }}>
              <label className="ds-label">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="ds-input"
                placeholder="vincent@xuemi.co"
                autoFocus
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="ds-label">密碼</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="ds-input"
              />
            </div>
            {loginError && (
              <div style={{
                padding: 10, marginBottom: 12,
                background: "var(--ds-danger-soft)",
                color: "var(--ds-danger)",
                borderRadius: "var(--ds-radius-md)",
                fontSize: "var(--ds-fs-sm)"
              }}>{loginError}</div>
            )}
            <button type="submit" disabled={submitting} className="ds-btn ds-btn--primary ds-btn--block ds-btn--lg">
              {submitting ? "驗證中…" : "登入"}
            </button>
            <div style={{ marginTop: 16, fontSize: "var(--ds-fs-xs)", color: "var(--ds-text-3)", lineHeight: 1.6 }}>
              <strong>測試帳號(密碼一律 0000)</strong>
              <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                <li>vincent@xuemi.co — 全管理</li>
                <li>sales_manager@demo.moyu — 業務主管視角</li>
                <li>legal_manager@demo.moyu — 法務主管視角</li>
              </ul>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 找出 active zone(供 sub-nav 展開用)
  const activeZone = ZONES.find(z => pathname.startsWith(z.matchPrefix));

  return (
    <div className="ds-shell">
      {/* Mobile topbar */}
      <header className="ds-shell__topbar">
        <button className="ds-shell__topbar-burger" onClick={() => setSidebarOpen(true)} aria-label="開啟選單">☰</button>
        <div className="ds-shell__topbar-title">墨宇戰情</div>
        <div style={{ width: 40 }} />
      </header>

      {/* Backdrop (mobile) */}
      <div
        className="ds-shell__sidebar-backdrop"
        data-open={sidebarOpen}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className="ds-shell__sidebar" data-open={sidebarOpen}>
        <div className="ds-shell__brand">
          <div className="ds-shell__brand-name">墨宇戰情</div>
          <div className="ds-shell__brand-user">{session.name}</div>
        </div>

        <nav className="ds-shell__nav">
          {ZONES.map((zone) => {
            const isActive = pathname.startsWith(zone.matchPrefix);
            return (
              <div key={zone.id}>
                <Link
                  href={zone.default}
                  className={`ds-shell__nav-item${isActive ? " ds-shell__nav-item--active" : ""}`}
                >
                  <span className="ds-shell__nav-icon">{zone.icon}</span>
                  <span>{zone.label}</span>
                </Link>
                {isActive && zone.subs.length > 1 && (
                  <div className="ds-shell__nav-sub">
                    {zone.subs.map((sub) => {
                      const subActive = pathname === sub.href || (sub.href === zone.default && pathname.startsWith(zone.matchPrefix) && !zone.subs.slice(1).some(s => pathname === s.href));
                      // 第二個判斷是 default sub:當在 zone 主頁但不在其他 sub 時,default sub 為 active
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={`ds-shell__nav-item${subActive ? " ds-shell__nav-item--active" : ""}`}
                        >
                          <span>{sub.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="ds-shell__footer">
          <button onClick={handleLogout} className="ds-btn ds-btn--ghost ds-btn--sm ds-btn--block">
            登出
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ds-shell__main">
        <div className="ds-page admin-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
