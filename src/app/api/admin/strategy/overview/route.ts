import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { taipeiMonthStart, taipeiLastMonthRange, taipeiDayOfMonth, taipeiDaysInMonth } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 戰略指標:北極星 / OKR / LTV/CAC / 月燒錢 / 跑道
export async function GET() {
  const sb = getSupabaseAdmin();

  // 2026-04-30 Wave A B3 fix:用台北 TZ helper 避免月初 off-by-one
  const now = new Date();
  const monthStart = taipeiMonthStart(now);
  const { start: lastMonthStart, end: lastMonthEnd } = taipeiLastMonthRange(now);

  // 北極星 = 本月總營收
  // fetchAllRows 分頁繞過 1000 row hard cap(2026-04-30 fix)
  const thisMonth = await fetchAllRows<{ net_revenue_daily: number; raw_appointments: number; closures: number; calls: number }>(() =>
    sb.from("sales_metrics_daily")
      .select("net_revenue_daily, raw_appointments, closures, calls")
      .gte("date", monthStart)
  );
  const monthRevenue = (thisMonth || []).reduce((s, r: any) => s + (Number(r.net_revenue_daily) || 0), 0);
  const monthClosures = (thisMonth || []).reduce((s, r: any) => s + (Number(r.closures) || 0), 0);
  const monthCalls = (thisMonth || []).reduce((s, r: any) => s + (Number(r.calls) || 0), 0);
  const monthAppts = (thisMonth || []).reduce((s, r: any) => s + (Number(r.raw_appointments) || 0), 0);

  // 上月對比
  const lastMonth = await fetchAllRows<{ net_revenue_daily: number }>(() =>
    sb.from("sales_metrics_daily")
      .select("net_revenue_daily")
      .gte("date", lastMonthStart)
      .lte("date", lastMonthEnd)
  );
  const lastMonthRevenue = (lastMonth || []).reduce((s, r: any) => s + (Number(r.net_revenue_daily) || 0), 0);

  // 線性預估到月底(用台北日)
  const dayOfMonth = taipeiDayOfMonth(now);
  const daysInMonth = taipeiDaysInMonth(now);
  // 月初 1-2 天樣本太少 → 直接用上月做估計避免爆炸
  const projectedMonthRevenue = dayOfMonth >= 3
    ? Math.round((monthRevenue / dayOfMonth) * daysInMonth)
    : 0;

  // OKR 完成度 = 本月營收 / KPI 目標(撈月份 KPI 加總)
  const { data: kpiTargets } = await sb
    .from("kpi_targets")
    .select("metric, target_value, period")
    .eq("is_active", true)
    .eq("period", "monthly");
  const monthRevenueTarget = (kpiTargets || [])
    .filter((k: any) => k.metric === "net_revenue_daily" || k.metric === "net_revenue")
    .reduce((s, k: any) => s + Number(k.target_value), 0) || 5_000_000;

  const okrPct = monthRevenueTarget > 0 ? Math.round((monthRevenue / monthRevenueTarget) * 100) : 0;

  // 用戶數
  const { count: usersTotal } = await sb.from("users").select("*", { count: "exact", head: true });
  const { count: usersActive } = await sb.from("users").select("*", { count: "exact", head: true }).eq("is_active", true);

  // 月燒錢 + 跑道(預設值,等 settings 表)
  const monthlyBurn = 1_500_000;
  const cashOnHand = 10_000_000;
  const runwayMonths = monthlyBurn > 0 ? Math.round((cashOnHand / monthlyBurn) * 10) / 10 : 0;

  // LTV/CAC(粗算:近 6 個月 ARPU × 平均存活 / 招聘成本)— 台北 TZ
  const sixMoAgo = new Date(now.getTime() - 6 * 30 * 86400000);
  const sixMonthsAgo = taipeiMonthStart(sixMoAgo);
  const half = await fetchAllRows<{ net_revenue_daily: number; closures: number }>(() =>
    sb.from("sales_metrics_daily")
      .select("net_revenue_daily, closures")
      .gte("date", sixMonthsAgo)
  );
  const halfRev = (half || []).reduce((s, r: any) => s + (Number(r.net_revenue_daily) || 0), 0);
  const halfClosures = (half || []).reduce((s, r: any) => s + (Number(r.closures) || 0), 0);
  const arpu = halfClosures > 0 ? Math.round(halfRev / halfClosures) : 0;
  const ltv = Math.round(arpu * 1.8); // 假設客戶平均回購 1.8 次
  const cac = 8000; // 估算單次招聘成本
  const ltvCacRatio = cac > 0 ? Math.round((ltv / cac) * 10) / 10 : 0;

  return NextResponse.json({
    ok: true,
    generated_at: new Date().toISOString(),
    north_star: {
      label: "本月總營收",
      value: monthRevenue,
      target: monthRevenueTarget,
      pct: okrPct,
      projected: projectedMonthRevenue,
      last_month: lastMonthRevenue,
      yoy_pct: lastMonthRevenue > 0 ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : 0,
      health: okrPct >= 80 ? "healthy" : okrPct >= 50 ? "warning" : "critical",
    },
    okr: {
      label: "本月 KPI 達成度",
      pct: okrPct,
      target: monthRevenueTarget,
      actual: monthRevenue,
      health: okrPct >= 80 ? "healthy" : okrPct >= 50 ? "warning" : "critical",
    },
    ltv_cac: {
      ltv,
      cac,
      ratio: ltvCacRatio,
      health: ltvCacRatio >= 3 ? "healthy" : ltvCacRatio >= 1.5 ? "warning" : "critical",
      note: "LTV 用近 6 月 ARPU × 1.8 估算;CAC 預設 8000",
    },
    burn: {
      monthly: monthlyBurn,
      cash: cashOnHand,
      runway_months: runwayMonths,
      health: runwayMonths >= 12 ? "healthy" : runwayMonths >= 6 ? "warning" : "critical",
      note: "預設值。後續接 settings 表",
    },
    activity: {
      users_total: usersTotal || 0,
      users_active: usersActive || 0,
      month_calls: monthCalls,
      month_appointments: monthAppts,
      month_closures: monthClosures,
    },
  });
}
