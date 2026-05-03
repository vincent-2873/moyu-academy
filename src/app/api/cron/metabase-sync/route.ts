import { NextRequest } from "next/server";

/*
 * /api/cron/metabase-sync — DEPRECATED 2026-05-03
 *
 * 由 Q1381 cross-brand sync 完整 supersede:
 *   - /api/cron/metabase-q1381-rolling-sync(每 15 min Mon-Sat 09-22)
 *   - /api/cron/metabase-q1381-backfill(manual 補日)
 *
 * 過去 7 天 Q1381 100% 成功(147/147),legacy per-brand 66% 失敗(976/1467 xuemi)
 *
 * 失敗 root cause:Zeabur env 沒 METABASE_USER/PASS,session cache 過期就 fail。
 * 而 Q1381 流程靠 daily-sync workflow 透過 GitHub secrets 每 15 min 灌新 cache,所以穩。
 *
 * 解決:整個 endpoint 不做事,回 410 Gone,別再 log 噪音。
 *      管理員手動 trigger 改用 /api/admin/metabase-sync(那個還是動的)。
 */

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    if (!request.headers.get("x-vercel-cron") && !request.headers.get("x-zeabur-cron")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return Response.json(
    {
      ok: false,
      deprecated: true,
      message:
        "metabase-sync cron 已 deprecate。Q1381 cross-brand sync supersede。改用 /api/cron/metabase-q1381-rolling-sync",
      supersede_by: [
        "/api/cron/metabase-q1381-rolling-sync",
        "/api/cron/metabase-q1381-backfill",
      ],
    },
    { status: 410 }
  );
}

export const POST = GET;
