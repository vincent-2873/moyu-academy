import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { taipeiToday, taipeiDaysAgo } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/sales/individual?brand=nschool
 *
 * 主管視角:看下屬個人戰況。
 *  - sales_metrics_daily(Vincent 真資料)group by user
 *  - 連勝連敗(過去 7 天連續成交 / 連續零成交)
 *  - Claude 卡關偵測(連續 3 天沒邀約 = 卡關)
 *
 * 對齊 system-tree v2 §業務管理/individual:
 *   - 下屬列表(按品牌篩)
 *   - 個人 KPI(通數 / 邀約 / 成交 / 達成率)
 *   - 連勝連敗
 *   - Claude 偵測卡關
 */

interface UserMetric {
  email: string;
  name: string;
  brand: string | null;
  today_calls: number;
  today_appointments: number;
  today_closures: number;
  week_calls: number;
  week_appointments: number;
  week_closures: number;
  last_active_date: string | null;
  conversion_rate: number;
  streak_days: number;          // 連續成交天數(>0 連勝 / 0 普通)
  silent_days: number;            // 連續零通天數(>=3 卡關)
  claude_warning: string | null; // Claude 偵測卡關訊息
}

export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const url = new URL(req.url);
  const brand = url.searchParams.get("brand");

  const today = taipeiToday();
  const week_start = taipeiDaysAgo(7);

  // 2026-05-02 fix:column appointments_show(不是 appointments)+ exclude is_monthly_rollup
  let q = sb.from("sales_metrics_daily")
    .select("email, name, brand, date, calls, appointments_show, closures")
    .gte("date", week_start)
    .not("email", "is", null)
    .not("is_monthly_rollup", "is", true);
  if (brand && brand !== "all") q = q.eq("brand", brand);

  const rows = await fetchAllRows<{
    email: string; name: string; brand: string | null; date: string;
    calls: number; appointments_show: number; closures: number;
  }>(() => q);

  // 2026-05-02 fix:today fallback to latest_workday(週末資料沒 finalize 時)
  const datesInWeek = Array.from(new Set((rows || []).map(r => r.date))).sort();
  const latestDate = datesInWeek[datesInWeek.length - 1];
  const todayHasData = (rows || []).some(r => r.date === today);
  const effectiveToday = todayHasData ? today : (latestDate || today);

  const map = new Map<string, UserMetric>();
  for (const r of rows || []) {
    const email = (r.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) continue;
    const name = (r.name || "").trim();
    if (name.startsWith("新訓-") || name.startsWith("新訓 ")) continue;

    if (!map.has(email)) {
      map.set(email, {
        email, name, brand: r.brand || null,
        today_calls: 0, today_appointments: 0, today_closures: 0,
        week_calls: 0, week_appointments: 0, week_closures: 0,
        last_active_date: null,
        conversion_rate: 0, streak_days: 0, silent_days: 0, claude_warning: null,
      });
    }
    const u = map.get(email)!;
    const calls = r.calls || 0, app = r.appointments_show || 0, cls = r.closures || 0;
    u.week_calls += calls;
    u.week_appointments += app;
    u.week_closures += cls;
    if (r.date === effectiveToday) {
      u.today_calls = calls;
      u.today_appointments = app;
      u.today_closures = cls;
    }
    if (calls > 0 || app > 0 || cls > 0) {
      if (!u.last_active_date || r.date > u.last_active_date) u.last_active_date = r.date;
    }
  }

  const list = Array.from(map.values());

  // 補:streak / silent / claude_warning(per user 過去 7 天逐日掃)
  for (const u of list) {
    const userRows = (rows || []).filter(r => (r.email || "").toLowerCase() === u.email)
      .sort((a, b) => b.date.localeCompare(a.date));

    // streak:從今天回推連續成交天
    let streak = 0;
    for (const r of userRows) {
      if ((r.closures || 0) > 0) streak++;
      else break;
    }
    u.streak_days = streak;

    // silent:從今天回推連續零通(calls=0)天
    let silent = 0;
    for (const r of userRows) {
      if ((r.calls || 0) === 0) silent++;
      else break;
    }
    u.silent_days = silent;

    // conversion:邀約/通(本週)
    u.conversion_rate = u.week_calls > 0 ? Math.round((u.week_appointments / u.week_calls) * 100) : 0;

    // Claude 偵測卡關
    if (silent >= 3) u.claude_warning = `連續 ${silent} 天 0 通 — Claude 建議:留 voice memo / 派組長`;
    else if (u.week_calls > 50 && u.week_appointments === 0) u.claude_warning = `${u.week_calls} 通但 0 邀約 — 開場白可能有問題`;
    else if (u.week_appointments > 5 && u.week_closures === 0) u.claude_warning = `邀約 ${u.week_appointments} 但 0 成交 — 收尾節奏偏弱`;
  }

  // 排序:警告 > 連勝 > 在線
  list.sort((a, b) => {
    if (a.claude_warning && !b.claude_warning) return -1;
    if (!a.claude_warning && b.claude_warning) return 1;
    if (a.streak_days !== b.streak_days) return b.streak_days - a.streak_days;
    return (b.week_calls || 0) - (a.week_calls || 0);
  });

  return NextResponse.json({
    ok: true,
    generated_at: new Date().toISOString(),
    today,
    brand: brand || "all",
    user_count: list.length,
    warning_count: list.filter(u => u.claude_warning).length,
    streak_count: list.filter(u => u.streak_days >= 3).length,
    users: list,
  });
}
