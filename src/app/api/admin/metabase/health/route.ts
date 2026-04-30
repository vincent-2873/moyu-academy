import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Metabase 同步健康檢查:rows count / latest_date / distinct user / 前後台對齊
export async function GET() {
  const sb = getSupabaseAdmin();

  const { count: totalRows } = await sb.from("sales_metrics_daily").select("*", { count: "exact", head: true });

  const { data: maxDate } = await sb.from("sales_metrics_daily").select("date").order("date", { ascending: false }).limit(1);
  const { data: minDate } = await sb.from("sales_metrics_daily").select("date").order("date", { ascending: true }).limit(1);

  // 統計各 brand 數量
  const { data: byBrandRaw } = await sb.from("sales_metrics_daily").select("brand, date");
  const brandCount: Record<string, { rows: number; latest: string; users: Set<string> }> = {};

  // 統計 distinct emails
  const { data: emailRows } = await sb.from("sales_metrics_daily").select("email, name, brand").not("email", "is", null);
  const emailSet = new Set<string>();
  let xunlianCount = 0;
  for (const r of emailRows || []) {
    const e = (r.email || "").toLowerCase();
    if (e) emailSet.add(e);
    const n = r.name || "";
    if (n.startsWith("新訓-") || n.startsWith("新訓 ") || n.startsWith("新訓:")) xunlianCount += 1;
  }

  for (const r of byBrandRaw || []) {
    const b = r.brand || "(無 brand)";
    if (!brandCount[b]) brandCount[b] = { rows: 0, latest: "", users: new Set() };
    brandCount[b].rows += 1;
    if (r.date > brandCount[b].latest) brandCount[b].latest = r.date;
  }

  // 撈最近一次 GitHub Actions Metabase sync 的 system_run_log
  const { data: lastRuns } = await sb
    .from("system_run_log")
    .select("source, status, created_at, duration_ms, metadata, error_message, rows_in, rows_out")
    .or("source.like.%metabase%,source.like.%cron%metabase-bulk-upsert%")
    .order("created_at", { ascending: false })
    .limit(10);

  // 對比 users 表 vs sales_metrics_daily distinct
  const { count: usersTotal } = await sb.from("users").select("*", { count: "exact", head: true });
  const { count: usersActive } = await sb.from("users").select("*", { count: "exact", head: true }).eq("is_active", true);

  // 算「Metabase 有資料但 users 表沒」的差距
  const { data: existingUsers } = await sb.from("users").select("email").in("email", Array.from(emailSet));
  const existingEmailSet = new Set((existingUsers || []).map((u: any) => u.email.toLowerCase()));
  const missingFromUsers = Array.from(emailSet).filter((e) => !existingEmailSet.has(e));

  const todayTPE = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const latestSyncDate = maxDate?.[0]?.date || null;
  // 算「應有資料」的 baseline:
  //   平日 → 上一個 工作日(週六/日 → 週五;週一 → 週五,因為週末沒人上班)
  //   注意:Metabase Q1381 「今天」可能 LINE 結算延遲到隔天才 finalize,所以 baseline 取「昨天 / 上週五」
  function isWorkday(dateStr: string): boolean {
    const dow = new Date(dateStr + "T00:00:00Z").getUTCDay(); // 0=Sun, 6=Sat
    return dow >= 1 && dow <= 5;
  }
  function lastWorkdayBefore(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00Z");
    do {
      d.setUTCDate(d.getUTCDate() - 1);
    } while (![1, 2, 3, 4, 5].includes(d.getUTCDay()));
    return d.toISOString().slice(0, 10);
  }
  const expectedLatest = isWorkday(todayTPE) ? lastWorkdayBefore(todayTPE) : lastWorkdayBefore(todayTPE);
  // daysBehind:相對於「上個工作日」(unless 今天本身是 workday 而 sync 已含今天)
  let daysBehind: number | null = null;
  if (latestSyncDate) {
    if (latestSyncDate >= todayTPE) {
      daysBehind = 0; // 已 sync 到今天或更新
    } else if (latestSyncDate >= expectedLatest) {
      daysBehind = 0; // 已 sync 到上個工作日
    } else {
      // 算工作日 gap(扣週末)
      let gap = 0;
      const cur = new Date(latestSyncDate + "T00:00:00Z");
      const target = new Date(expectedLatest + "T00:00:00Z");
      while (cur < target) {
        cur.setUTCDate(cur.getUTCDate() + 1);
        if ([1, 2, 3, 4, 5].includes(cur.getUTCDay())) gap += 1;
      }
      daysBehind = gap;
    }
  }

  return NextResponse.json({
    ok: true,
    generated_at: new Date().toISOString(),
    sales_metrics_daily: {
      total_rows: totalRows || 0,
      latest_date: latestSyncDate,
      earliest_date: minDate?.[0]?.date || null,
      distinct_users: emailSet.size,
      xunlian_filtered: xunlianCount,
      days_behind_today: daysBehind,
      expected_latest_workday: expectedLatest,
      today_is_workday: isWorkday(todayTPE),
      health: daysBehind === 0 ? "healthy" : daysBehind != null && daysBehind <= 1 ? "warning" : "critical",
      note: daysBehind === 0
        ? `已同步到 ${latestSyncDate} (Metabase 對「今天」可能尚未 finalize,以上個工作日 ${expectedLatest} 為基準)`
        : `落後 ${daysBehind} 個工作日 (latest=${latestSyncDate} vs 預期=${expectedLatest})`,
    },
    by_brand: Object.entries(brandCount).map(([brand, v]) => ({
      brand,
      rows: v.rows,
      latest: v.latest,
    })).sort((a, b) => b.rows - a.rows),
    users_table: {
      total: usersTotal || 0,
      active: usersActive || 0,
    },
    cross_check: {
      metabase_distinct_emails: emailSet.size,
      users_table_emails: existingEmailSet.size,
      missing_in_users: missingFromUsers.length,
      missing_examples: missingFromUsers.slice(0, 10),
    },
    recent_sync_runs: lastRuns || [],
    schedule: {
      label: "工作時段每 15 分鐘",
      cron: ["*/15 1-13 * * *", "0 14 * * *"],
      timezone_window: "台北 09:00-22:00",
      runs_per_day: 56,
    },
  });
}
