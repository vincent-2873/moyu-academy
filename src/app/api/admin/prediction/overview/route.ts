import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { taipeiMonthStart, taipeiDayOfMonth, taipeiDaysInMonth, taipeiDaysAgo } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Claude 預測建議:本月業績預測 / 下月招募缺口 / 風險預警 / 情境模擬
export async function GET() {
  const sb = getSupabaseAdmin();

  // 2026-04-30 Wave A B5 fix:用台北 TZ helper(避免月初 off-by-one + dayOfMonth=1 時預測爆炸)
  const now = new Date();
  const monthStart = taipeiMonthStart(now);
  const dayOfMonth = taipeiDayOfMonth(now);
  const daysInMonth = taipeiDaysInMonth(now);
  const remainingDays = daysInMonth - dayOfMonth;
  // 月初 1-2 天樣本太少 → projection 不可信
  const projectionInsufficientData = dayOfMonth < 3;

  // 本月已實現 + 線性預估(fetchAllRows 分頁繞 1000 hard cap)
  const thisMonth = await fetchAllRows<{ date: string; net_revenue_daily: number; closures: number; raw_appointments: number; brand: string; email: string }>(() =>
    sb.from("sales_metrics_daily")
      .select("date, net_revenue_daily, closures, raw_appointments, brand, email")
      .gte("date", monthStart)
  );

  const monthRev = (thisMonth || []).reduce((s, r: any) => s + Number(r.net_revenue_daily || 0), 0);
  const monthClosures = (thisMonth || []).reduce((s, r: any) => s + Number(r.closures || 0), 0);
  const dailyAvg = dayOfMonth > 0 ? monthRev / dayOfMonth : 0;
  // 月初 < 3 天:不送 projection,避免爆炸
  const projectedRev = projectionInsufficientData ? monthRev : Math.round(monthRev + dailyAvg * remainingDays);
  const projectedClosures = projectionInsufficientData
    ? monthClosures
    : Math.round(monthClosures + (monthClosures / Math.max(dayOfMonth, 1)) * remainingDays);

  // 抓近 7 天波動算 confidence(台北 TZ)
  const lastWeek = await fetchAllRows<{ date: string; net_revenue_daily: number }>(() =>
    sb.from("sales_metrics_daily")
      .select("date, net_revenue_daily")
      .gte("date", taipeiDaysAgo(7, now))
  );
  const dailyValues = (lastWeek || []).map((r: any) => Number(r.net_revenue_daily || 0));
  const mean = dailyValues.length > 0 ? dailyValues.reduce((s, v) => s + v, 0) / dailyValues.length : 0;
  const variance = dailyValues.length > 0 ? dailyValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / dailyValues.length : 0;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 1;
  const confidence = Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));

  // 下月招募缺口 = kpi(月) - 本月 hire 進度
  const { data: hireKpi } = await sb
    .from("kpi_targets")
    .select("target_value, applies_to_brand")
    .eq("metric", "hire_count")
    .eq("period", "monthly")
    .eq("is_active", true);
  const targetHires = (hireKpi || []).reduce((s, k: any) => s + Number(k.target_value), 0) || 10;

  const { count: thisMonthHires } = await sb
    .from("users")
    .select("*", { count: "exact", head: true })
    .gte("created_at", monthStart);

  const hireGap = Math.max(0, targetHires - (thisMonthHires || 0));

  // 風險預警 = 本月業績低於 KPI 50% 的 user
  const { data: kpiUsers } = await sb
    .from("kpi_targets")
    .select("metric, target_value")
    .eq("metric", "net_revenue_daily")
    .eq("period", "daily")
    .eq("is_active", true);
  const dailyRevTarget = (kpiUsers || [])[0]?.target_value || 50000;

  const userRevMap: Record<string, number> = {};
  (thisMonth || []).forEach((r: any) => {
    if (r.email) {
      userRevMap[r.email] = (userRevMap[r.email] || 0) + Number(r.net_revenue_daily || 0);
    }
  });
  const expectedMonthRev = Number(dailyRevTarget) * dayOfMonth;
  const lowPerformers = Object.entries(userRevMap)
    .filter(([_, v]) => v < expectedMonthRev * 0.5)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 8)
    .map(([email, rev]) => ({
      user: email,
      this_month_rev: rev,
      expected: expectedMonthRev,
      pct: expectedMonthRev > 0 ? Math.round((rev / expectedMonthRev) * 100) : 0,
    }));

  // 情境模擬:3 個 if 場景
  const scenarios = [
    {
      name: "保守估計",
      assumption: "剩餘天數維持近 7 天平均",
      projected_revenue: projectedRev,
      delta_vs_target: projectedRev - (Number(dailyRevTarget) * daysInMonth),
    },
    {
      name: "樂觀估計",
      assumption: "剩餘天數提升 20%",
      projected_revenue: Math.round(monthRev + dailyAvg * remainingDays * 1.2),
      delta_vs_target: Math.round(monthRev + dailyAvg * remainingDays * 1.2) - (Number(dailyRevTarget) * daysInMonth),
    },
    {
      name: "悲觀估計",
      assumption: "剩餘天數下降 30%",
      projected_revenue: Math.round(monthRev + dailyAvg * remainingDays * 0.7),
      delta_vs_target: Math.round(monthRev + dailyAvg * remainingDays * 0.7) - (Number(dailyRevTarget) * daysInMonth),
    },
  ];

  return NextResponse.json({
    ok: true,
    generated_at: new Date().toISOString(),
    revenue_forecast: {
      this_month_actual: monthRev,
      projected_eom: projectedRev,
      projected_closures: projectedClosures,
      day_of_month: dayOfMonth,
      days_in_month: daysInMonth,
      confidence_pct: confidence,
      daily_avg: Math.round(dailyAvg),
      insufficient_data: projectionInsufficientData,        // 月初 < 3 天 UI 該標 ⚠️
    },
    hire_gap: {
      target: targetHires,
      done: thisMonthHires || 0,
      gap: hireGap,
      next_month_pressure: hireGap > 5 ? "critical" : hireGap > 2 ? "warning" : "healthy",
    },
    risk_alerts: lowPerformers,
    scenarios,
  });
}
