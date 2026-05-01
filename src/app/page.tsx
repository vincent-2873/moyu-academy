"use client";

// 墨宇戰情中樞 — 根登入頁(2026-05-01 大砍重建後 minimal)
// 對齊 system-tree v2:登入後依角色 redirect 到對應入口
//   super_admin / ceo / coo / cfo / director → /admin
//   legal_*                                    → /legal/cases
//   其他(sales / training)                    → /sales/dashboard

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginUser, registerUser } from "@/lib/store";

const HQ_ROLES = ["super_admin", "ceo", "coo", "cfo", "director"];

function redirectByRole(router: ReturnType<typeof useRouter>, role: string | null | undefined) {
  if (!role) {
    router.push("/sales/dashboard");
    return;
  }
  if (HQ_ROLES.includes(role)) {
    router.push("/admin");
  } else if (role.includes("legal")) {
    router.push("/legal/cases");
  } else {
    router.push("/sales/dashboard");
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [bootLoading, setBootLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. 檢查 LINE OAuth callback / 既有 session
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 檢查 LINE OAuth error
    const urlParams = new URLSearchParams(window.location.search);
    const oauthErr = urlParams.get("line_oauth_error");
    if (oauthErr) {
      const clean = window.location.pathname;
      window.history.replaceState({}, "", clean);
      setTimeout(() => alert("LINE 登入失敗:" + oauthErr), 200);
    }

    // 已有 LINE OAuth session cookie → role-based redirect
    const cookieMap = Object.fromEntries(
      document.cookie.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k, v.join("=")];
      })
    );
    if (cookieMap.moyu_oauth_session) {
      try {
        const json = JSON.parse(
          atob(cookieMap.moyu_oauth_session.replace(/-/g, "+").replace(/_/g, "/"))
        );
        redirectByRole(router, json.role);
        return;
      } catch {
        // ignore parse error
      }
    }

    // 已有 localStorage user → role-based redirect
    const stored = localStorage.getItem("moyu_user_email");
    if (stored) {
      const usersJson = localStorage.getItem("moyu_users");
      if (usersJson) {
        try {
          const users = JSON.parse(usersJson);
          const u = users.find((x: { email: string }) => x.email === stored);
          if (u) {
            redirectByRole(router, u.role);
            return;
          }
        } catch {
          // ignore
        }
      }
    }

    setBootLoading(false);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      let user;
      if (isRegister) {
        user = registerUser(email, password, name, "sales", "moyu-default");
      } else {
        user = loginUser(email, password);
      }
      if (!user) {
        throw new Error(isRegister ? "註冊失敗" : "Email 或密碼錯誤");
      }
      redirectByRole(router, user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登入失敗");
    } finally {
      setSubmitting(false);
    }
  }

  if (bootLoading) {
    return (
      <div style={pageStyle}>
        <div style={{ color: "var(--text2, #666)", fontSize: 14 }}>載入中…</div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{
            fontSize: 36,
            fontWeight: 800,
            margin: 0,
            background: "linear-gradient(135deg, #C8102E, #B89968)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            墨宇戰情中樞
          </h1>
          <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 8 }}>
            業務 × 法務 × 訓練 — 集團 AI 經營系統
          </p>
        </div>

        <form onSubmit={handleSubmit} style={cardStyle}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 0, marginBottom: 20 }}>
            {isRegister ? "建立帳號" : "登入"}
          </h2>

          {isRegister && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>姓名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>密碼</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              padding: 10,
              background: "rgba(184, 71, 74, 0.08)",
              border: "1px solid rgba(184, 71, 74, 0.3)",
              borderRadius: 6,
              color: "#B8474A",
              fontSize: 13,
              marginBottom: 12,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
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
            }}
          >
            {submitting ? "處理中…" : isRegister ? "建立帳號" : "登入"}
          </button>

          <div style={{ marginTop: 12, textAlign: "center", fontSize: 13 }}>
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text2, #666)",
                cursor: "pointer",
                textDecoration: "underline",
                fontSize: 13,
              }}
            >
              {isRegister ? "已有帳號?登入" : "沒有帳號?註冊"}
            </button>
          </div>

          <div style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid var(--ink-line, #E5E2DA)",
            textAlign: "center",
          }}>
            <a
              href="/api/line/oauth/start"
              style={{
                display: "inline-block",
                padding: "10px 16px",
                background: "#06C755",
                color: "#fff",
                borderRadius: 6,
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              用 LINE 登入
            </a>
          </div>
        </form>

        <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: "var(--text3, #999)" }}>
          後台管理 → <a href="/admin" style={{ color: "var(--text2, #666)" }}>/admin</a>
        </div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  fontFamily: "system-ui, -apple-system, 'Microsoft JhengHei', sans-serif",
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
