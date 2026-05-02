"use client";

/**
 * /board — 投資人 / 董事 / CFO portal(預留殼,Wave 7+ 完整 ship)
 *
 * 目前邏輯:讀 moyu_admin_session,如果 persona_role=board_audience → 進場
 * 暫時實作:轉到 /admin/hub 顯示 read-only Claude 報告書
 *
 * Wave 7 會做:
 * - 完整 read-only 鏡射(隱藏「核准 / 駁回」button,只能看 + 質詢 + Export PDF)
 * - 季度 PDF export
 * - LINE binding 季報通知
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const stored = typeof window !== "undefined" && localStorage.getItem("moyu_admin_session");
    if (!stored) {
      router.replace("/?next=/board");
      return;
    }
    // 暫時:所有人都導 admin/hub。Wave 7 加 persona_role 檢查 + 真正 read-only 視角
    router.replace("/admin/hub");
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "var(--ds-text-3)" }}>導向 Claude 報告書…</div>
      {children}
    </div>
  );
}
