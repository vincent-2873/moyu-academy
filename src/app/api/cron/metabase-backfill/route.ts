import { syncAllEnabledBrands } from "@/lib/metabase";
import { NextRequest } from "next/server";

/**
 * Metabase 一次性回測(historical backfill)
 *
 * GET /api/admin/metabase-backfill?from=2025-01-01&days=30
 *
 * 為避免 serverless timeout(Zeabur ~300 sec),每呼叫處理至多 days(default 30)天
 * 回傳下次 caller 要傳的 from(`next` field)和已完成的 summary。
 *
 * 用法(GitHub Actions 或 cron):
 *   from=2025-01-01 → 跑完 30 天 → next=2025-01-31
 *   再 call from=2025-01-31 → 跑完 30 天 → next=2025-03-02
 *   loop until next > today
 *
 * 認證:CRON_SECRET(避免外人觸發)
 */

export const maxDuration = 300; // Zeabur ignore but legacy

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.floor((db - da) / (24 * 60 * 60 * 1000));
}

function todayTaipei(): string {
  const tp = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return tp.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  // Auth — accept Bearer CRON_SECRET 或 x-zeabur-cron / x-cron-bypass header
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const bypassed = req.headers.get("x-zeabur-cron") || req.headers.get("x-cron-bypass");
  if (cronSecret && !bypassed && auth !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized", debug: { hasAuth: !!auth, hasSecret: !!cronSecret, authPrefix: auth?.slice(0,10) } }, { status: 401 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || "2025-01-01";
  const daysParam = parseInt(url.searchParams.get("days") || "30", 10);
  const days = Math.min(Math.max(daysParam, 1), 60); // clamp 1-60

  const today = todayTaipei();
  const totalRemaining = diffDays(from, today);
  if (totalRemaining < 0) {
    return Response.json({ ok: true, done: true, msg: `from=${from} 已超過今天 ${today}`, next: null });
  }

  const actualDays = Math.min(days, totalRemaining + 1);
  const dates: string[] = [];
  for (let i = 0; i < actualDays; i++) {
    dates.push(addDays(from, i));
  }

  const started = Date.now();
  const results: Array<{ date: string; rows: number; status: string; brand: string; error?: string }> = [];
  let totalRows = 0;
  let failed = 0;

  for (const date of dates) {
    try {
      const dayResults = await syncAllEnabledBrands(date, "manual");
      for (const r of dayResults) {
        results.push({ date, rows: r.rows, status: r.status, brand: r.brand, error: r.error?.slice(0, 200) });
        totalRows += r.rows;
        if (r.status === "failed") failed++;
      }
    } catch (e) {
      results.push({
        date,
        rows: 0,
        status: "error",
        brand: e instanceof Error ? e.message.slice(0, 80) : "unknown",
      });
      failed++;
    }
    // 不要打太快
    await new Promise((r) => setTimeout(r, 200));
  }

  const lastDate = dates[dates.length - 1];
  const next = addDays(lastDate, 1);
  const reachedToday = next > today;

  return Response.json({
    ok: true,
    from,
    days_processed: actualDays,
    last_date: lastDate,
    next: reachedToday ? null : next,
    done: reachedToday,
    today,
    duration_ms: Date.now() - started,
    summary: {
      total_rows: totalRows,
      failed,
      results: results.slice(-30), // 最後 30 row 顯示
    },
  });
}
