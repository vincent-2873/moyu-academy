import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 104 邀約批次 — server-side queue management
 *
 * Vincent 規格:
 *   睿富(ruifu) 平日 7-9am 200 封 / 假日 300 封
 *   其他 100 封(hr 自己看 = 不自動)
 *   Lynn 公版邀約信
 *
 * Server-side(本路由)做:
 *   1. 計算今日該發配額(根據平日/假日 + brand)
 *   2. 從 outreach_104_queue 撈 status=pending 的 candidate
 *   3. 標記 status=ready_to_send 給本機 worker 拉
 *   4. 本機 worker(moyu-worker repo)呼叫 GET 拉 batch → Playwright 走 104 → POST 回 status=sent
 *
 * 每 30 min 跑一次(平日 7-9am 才 active),其餘時段 idempotent NOOP。
 */

export const runtime = "nodejs";

const BRAND_DAILY_QUOTA: Record<string, { weekday: number; weekend: number }> = {
  ruifu: { weekday: 200, weekend: 300 },
  // 其他 brand:hr 自己看,不自動
};

const SEND_HOURS_TPE = [7, 8, 9]; // 平日 7-9am 台北 = UTC 23,0,1

function getTaipeiHour(): number {
  const tpDate = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return tpDate.getUTCHours();
}

function isWeekend(): boolean {
  const tpDate = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const dow = tpDate.getUTCDay(); // 0=Sun, 6=Sat
  return dow === 0 || dow === 6;
}

function todayTaipei(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    if (!req.headers.get("x-zeabur-cron")) return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const date = todayTaipei();
  const hour = getTaipeiHour();
  const weekend = isWeekend();
  const inSendWindow = SEND_HOURS_TPE.includes(hour);

  if (!inSendWindow && !req.headers.get("x-force-send")) {
    return Response.json({
      ok: true,
      noop: true,
      reason: `not in send window (now ${hour} TPE, allowed ${SEND_HOURS_TPE.join(",")}—or 6 disable for weekend if 想 always-on)`,
      date,
    });
  }

  const results: Array<{ brand: string; quota: number; sentToday: number; markedReady: number }> = [];

  for (const brand of Object.keys(BRAND_DAILY_QUOTA)) {
    const quotaCfg = BRAND_DAILY_QUOTA[brand];
    const quota = weekend ? quotaCfg.weekend : quotaCfg.weekday;

    // 今日已發
    const { count: sentToday } = await supabase
      .from("outreach_104_queue")
      .select("id", { count: "exact", head: true })
      .eq("brand", brand)
      .eq("date", date)
      .in("status", ["sent", "ready_to_send"]);

    const remaining = Math.max(quota - (sentToday || 0), 0);
    if (remaining === 0) {
      results.push({ brand, quota, sentToday: sentToday || 0, markedReady: 0 });
      continue;
    }

    // 撈 pending,標記 ready_to_send,本機 worker 拉
    const { data: pending } = await supabase
      .from("outreach_104_queue")
      .select("id")
      .eq("brand", brand)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(remaining);

    const ids = (pending || []).map((r) => r.id);
    if (ids.length > 0) {
      await supabase
        .from("outreach_104_queue")
        .update({ status: "ready_to_send", date, marked_ready_at: new Date().toISOString() })
        .in("id", ids);
    }

    results.push({ brand, quota, sentToday: sentToday || 0, markedReady: ids.length });
  }

  return Response.json({ ok: true, date, hour_tpe: hour, weekend, results });
}
