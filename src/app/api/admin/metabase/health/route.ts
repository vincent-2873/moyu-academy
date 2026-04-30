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
  const { data: emailRows } = await sb.from("sales_metrics_daily").select("user_email, user_name, brand").not("user_email", "is", null);
  const emailSet = new Set<string>();
  let xunlianCount = 0;
  for (const r of emailRows || []) {
    const e = (r.user_email || "").toLowerCase();
    if (e) emailSet.add(e);
    const n = r.user_name || "";
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
  const daysBehind = latestSyncDate ? Math.floor((new Date(todayTPE).getTime() - new Date(latestSyncDate).getTime()) / 86400000) : null;

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
      health: daysBehind != null && daysBehind <= 1 ? "healthy" : daysBehind != null && daysBehind <= 3 ? "warning" : "critical",
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
