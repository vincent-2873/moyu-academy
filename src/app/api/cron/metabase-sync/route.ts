import { syncAllEnabledBrands } from "@/lib/metabase";
import { notifyAdminBlocked } from "@/lib/notify-admin";
import { NextRequest } from "next/server";

/*
 * 每 15 分鐘跑一次：同步所有啟用 brand 的今日業務數據
 *
 * schedule: 建議 "slash 15 1-14 star star star"  (UTC 01:00-14:00 = 台北 09:00-22:00)
 *
 * 失敗時（尤其是 Metabase 認證問題），透過 notifyAdminBlocked 推 LINE + 建 claude_tasks
 */

function todayTaipei(): string {
  // 台北時區是 UTC+8
  const now = new Date();
  const tpOffsetMs = 8 * 60 * 60 * 1000;
  const tp = new Date(now.getTime() + tpOffsetMs);
  return tp.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    if (!request.headers.get("x-vercel-cron") && !request.headers.get("x-zeabur-cron")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const date = todayTaipei();
  const started = Date.now();

  try {
    const results = await syncAllEnabledBrands(date, "cron");
    const failed = results.filter((r) => r.status === "failed");
    const totalRows = results.reduce((s, r) => s + r.rows, 0);

    // 只有失敗且是可能卡很久的錯誤（auth / env missing）才推 LINE，避免噪音
    for (const f of failed) {
      const isBlocker =
        f.error?.includes("METABASE_BLOCK") ||
        f.error?.includes("METABASE_LOGIN_FAILED") ||
        f.error?.includes("找不到 enabled 的 metabase source");
      if (isBlocker) {
        await notifyAdminBlocked({
          what: `Metabase 同步失敗 (brand=${f.brand})`,
          why: f.error || "unknown",
          needFromUser:
            "檢查 Zeabur env vars METABASE_USER / METABASE_PASS，或到 admin 後台補 metabase_sources 設定",
          severity: "high",
          link: "https://moyusales.zeabur.app/admin",
        });
      }
    }

    return Response.json({
      ok: true,
      date,
      duration_ms: Date.now() - started,
      results,
      summary: { brands: results.length, totalRows, failed: failed.length },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    await notifyAdminBlocked({
      what: "metabase-sync cron 整個 crash",
      why: msg,
      needFromUser: "看 Zeabur logs 找根因",
      severity: "critical",
    });
    return Response.json(
      { ok: false, error: msg, duration_ms: Date.now() - started },
      { status: 500 }
    );
  }
}
