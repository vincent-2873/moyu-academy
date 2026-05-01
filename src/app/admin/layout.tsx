"use client";

// 後台共用 layout(2026-05-01 大砍重建後)
// 對齊 system-tree v2:後台 8 大區 sidebar + content outlet

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

interface AdminSession {
  email: string;
  name: string;
  token: string;
}

const ZONES = [
  { id: "board", label: "🏛️ 投資人中心", path: "/admin/board/quarterly", subPaths: ["/admin/board"] },
  { id: "sales", label: "📊 業務管理", path: "/admin/sales/dashboard", subPaths: ["/admin/sales"] },
  { id: "legal", label: "⚖️ 法務管理", path: "/admin/legal/cases", subPaths: ["/admin/legal"] },
  { id: "training-ops", label: "📚 訓練營運", path: "/admin/training-ops", subPaths: ["/admin/training-ops"] },
  { id: "claude", label: "🤖 AI 工作台", path: "/admin/claude/live", subPaths: ["/admin/claude"] },
  { id: "human", label: "🤝 人類工作區", path: "/admin/human/sos", subPaths: ["/admin/human"] },
  { id: "settings", label: "⚙️ 系統設定", path: "/admin/settings/people", subPaths: ["/admin/settings"] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("moyu_admin_session");
    if (stored) {
      try {
        setSession(JSON.parse(stored));
      } catch {
        localStorage.removeItem("moyu_admin_session");
      }
    }
    setLoading(false);
  }, []);

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
      // /api/admin/auth 回 { user: {...}, mustChangePassword }
      // 並 set httpOnly cookie moyu_admin_session(client 拿不到 token)
      const newSession: AdminSession = {
        email: json.user?.email ?? loginEmail,
        name: json.user?.name ?? loginEmail,
        token: "cookie",  // server-side cookie 已 set,client 只記 placeholder
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

  if (loading) {
    return <div style={fullCenterStyle}>載入中…</div>;
  }

  if (!session) {
    return (
      <div style={fullCenterStyle}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>後台登入</h1>
            <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>墨宇戰情中樞 · 管理員入口</p>
          </div>
          <form onSubmit={handleLogin} style={cardStyle}>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>密碼</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
            {loginError && (
              <div style={errorStyle}>{loginError}</div>
            )}
            <button type="submit" disabled={submitting} style={submitButtonStyle(submitting)}>
              {submitting ? "驗證中…" : "登入"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "system-ui, -apple-system, 'Microsoft JhengHei', sans-serif" }}>
      <aside style={sidebarStyle}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--ink-line, #E5E2DA)" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#C8102E" }}>墨宇戰情</div>
          <div style={{ fontSize: 11, color: "var(--text3, #888)", marginTop: 2 }}>{session.name}</div>
        </div>

        <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
          {ZONES.map((zone) => {
            const active = zone.subPaths.some((p) => pathname.startsWith(p));
            return (
              <button
                key={zone.id}
                onClick={() => router.push(zone.path)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  marginBottom: 4,
                  border: "none",
                  borderRadius: 6,
                  background: active ? "rgba(200, 16, 46, 0.1)" : "transparent",
                  color: active ? "#C8102E" : "var(--text, #333)",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {zone.label}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: 12, borderTop: "1px solid var(--ink-line, #E5E2DA)" }}>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid var(--ink-line, #E5E2DA)",
              borderRadius: 6,
              background: "transparent",
              fontSize: 12,
              cursor: "pointer",
              color: "var(--text2, #666)",
              fontFamily: "inherit",
            }}
          >
            登出
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: "auto", padding: 28, background: "var(--ink-mist, #F0EFEA)" }}>
        <div className="admin-fade-in">
          {children}
        </div>
        <style jsx>{`
          .admin-fade-in {
            animation: fadeIn 250ms ease-out;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </main>
    </div>
  );
}

const fullCenterStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  fontFamily: "system-ui, -apple-system, 'Microsoft JhengHei', sans-serif",
};

const sidebarStyle: React.CSSProperties = {
  width: 220,
  background: "var(--ink-paper, #FAFAF7)",
  borderRight: "1px solid var(--ink-line, #E5E2DA)",
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
};

const cardStyle: React.CSSProperties = {
  background: "var(--ink-paper, #FAFAF7)",
  border: "1px solid var(--ink-line, #E5E2DA)",
  borderRadius: 12,
  padding: 24,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--text2, #666)",
  marginBottom: 4,
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid var(--ink-line, #E5E2DA)",
  borderRadius: 6,
  fontSize: 14,
  background: "#fff",
  fontFamily: "inherit",
};

const errorStyle: React.CSSProperties = {
  padding: 10,
  background: "rgba(184, 71, 74, 0.08)",
  border: "1px solid rgba(184, 71, 74, 0.3)",
  borderRadius: 6,
  color: "#B8474A",
  fontSize: 13,
  marginBottom: 12,
};

function submitButtonStyle(submitting: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 16px",
    background: "#C8102E",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: submitting ? "wait" : "pointer",
    opacity: submitting ? 0.6 : 1,
  };
}
