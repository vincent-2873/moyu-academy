"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const ClaudeChatPanel = dynamic(() => import("./ClaudeChatPanel"), { ssr: false });

/**
 * ClaudeChatPanelMount — 從 localStorage / sessionStorage 撈當前使用者, 餵 ClaudeChatPanel
 *
 * 規則:
 *   - /admin login screen + /(根) 時不顯示(沒登入 user)
 *   - 其他頁面有 user 才顯示
 */
export default function ClaudeChatPanelMount() {
  const [email, setEmail] = useState<string | null>(null);
  const [stage, setStage] = useState<string | undefined>();
  const [brand, setBrand] = useState<string | undefined>();

  useEffect(() => {
    if (typeof window === "undefined") return;

    function refresh() {
      // 1) sessionStorage(/me 主流程)
      let e = sessionStorage.getItem("moyu_current_user");

      // 2) admin session (HMAC cookie 由 middleware 處理, 但 admin 自己有 session in storage)
      if (!e) {
        e = sessionStorage.getItem("admin_email") || localStorage.getItem("admin_email");
      }

      // 3) recruit pages
      if (!e) {
        e = sessionStorage.getItem("moyu_recruit_email");
      }

      setEmail(e);

      // 撈 stage/brand 從 storage cache 或 API
      if (e) {
        // 試 cache
        const cacheKey = `__user_meta_${e}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          try {
            const m = JSON.parse(cached);
            setStage(m.stage);
            setBrand(m.brand);
            return;
          } catch {}
        }
        // 撈 API
        fetch(`/api/user?email=${encodeURIComponent(e)}`)
          .then((r) => r.json())
          .then((d) => {
            const u = d?.user || d;
            if (u?.stage) setStage(u.stage);
            if (u?.brand) setBrand(u.brand);
            sessionStorage.setItem(
              cacheKey,
              JSON.stringify({ stage: u?.stage, brand: u?.brand })
            );
          })
          .catch(() => {});
      }
    }

    refresh();

    // 監聽 sessionStorage 變化(登入登出)
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    const interval = setInterval(refresh, 5000);

    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(interval);
    };
  }, []);

  // 不在登入頁 / 根頁 顯示
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    if (path === "/" || path === "/admin" || path === "/login") {
      // 未登入 admin 也不顯示
      if (!email) return null;
    }
  }

  return <ClaudeChatPanel userEmail={email} stage={stage} brand={brand} />;
}
