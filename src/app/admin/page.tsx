"use client";

/**
 * Admin Root — client-side redirect
 *
 * 2026-05-02 fix:Next.js 16 + Zeabur nixpacks 對 server-side `redirect()` 在
 *  /admin page 觸發後,所有 /admin/* sub-routes 都會被 alias 到 redirect target
 *  (root cause:hydration mismatch + standalone build routing 衝突)
 *
 * 修法:改成 client-side useEffect + router.replace,不讓 server 做 redirect
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminRoot() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/sales/dashboard");
  }, [router]);

  return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--ds-text-3)" }}>
      跳轉到業務戰況…
    </div>
  );
}
