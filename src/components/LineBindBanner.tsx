"use client";

import { useEffect, useState } from "react";

/**
 * LINE 綁定 Banner
 *
 * 用法：
 *   <LineBindBanner email={user.email} />
 *
 * 行為：
 *   1. 初始 mount 時查 /api/users/me?email=<email>，若 line_user_id 為空則顯示 banner
 *   2. 使用者點「用 LINE 一鍵綁定」→ 跳 /api/line/oauth/start?mode=bind&email=...
 *   3. OAuth callback 完成後 302 回首頁，cookie 裡帶 session，前台 bootstrap
 *   4. 使用者也可以點「之後再說」暫時關閉（localStorage 紀錄到明天）
 *
 * 樣式：淺色、醒目但不擋畫面、可關閉。
 */

interface Props {
  email: string;
  /** "top" 會 fixed 在頁面頂端；"inline" 會按正常流佈局 */
  variant?: "top" | "inline";
}

const DISMISS_KEY_PREFIX = "moyu_line_bind_dismissed_";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function LineBindBanner({ email, variant = "inline" }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!email) return;
    // 已綁定？查一次
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data?.needsLineBind) {
          // 檢查是否今天已經關閉過
          const dismissed = localStorage.getItem(DISMISS_KEY_PREFIX + email);
          if (dismissed === todayStr()) return;
          setShow(true);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email]);

  if (!show) return null;

  const bindHref = `/api/line/oauth/start?mode=bind&email=${encodeURIComponent(email)}`;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY_PREFIX + email, todayStr());
    setShow(false);
  };

  const containerStyle: React.CSSProperties =
    variant === "top"
      ? {
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          padding: "12px 20px",
          background: "linear-gradient(90deg, rgba(6,199,85,0.95), rgba(0,185,0,0.95))",
          boxShadow: "0 6px 20px -6px rgba(6,199,85,0.4)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          justifyContent: "center",
        }
      : {
          margin: "16px 0",
          padding: "16px 20px",
          background: "linear-gradient(90deg, rgba(6,199,85,0.08), rgba(6,199,85,0.02))",
          border: "1.5px solid rgba(6,199,85,0.3)",
          borderRadius: 16,
          color: "#0f172a",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        };

  return (
    <div style={containerStyle}>
      <div style={{ fontSize: 28 }}>📱</div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>
          你還沒綁定 LINE
        </div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>
          系統的每日命令、警報、卡住通知都走 LINE 推播。現在一鍵完成綁定。
        </div>
      </div>
      <a
        href={bindHref}
        style={{
          padding: "10px 18px",
          background: variant === "top" ? "#fff" : "linear-gradient(135deg, #06C755, #00B900)",
          color: variant === "top" ? "#00B900" : "#fff",
          borderRadius: 10,
          fontWeight: 700,
          fontSize: 13,
          textDecoration: "none",
          boxShadow: variant === "top" ? "none" : "0 8px 20px -8px rgba(6,199,85,0.55)",
          whiteSpace: "nowrap",
        }}
      >
        用 LINE 一鍵綁定
      </a>
      <button
        type="button"
        onClick={dismiss}
        style={{
          padding: "8px 12px",
          background: "transparent",
          color: variant === "top" ? "rgba(255,255,255,0.85)" : "#64748b",
          border: `1px solid ${variant === "top" ? "rgba(255,255,255,0.4)" : "#e2e8f0"}`,
          borderRadius: 8,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        之後再說
      </button>
    </div>
  );
}
