import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { taipeiToday, taipeiDaysAgo, taipeiMonthStart } from "@/lib/time";

/**
 * 2026-04-30 末段 K4:主控台「最該看什麼」focus widget
 *
 * GET /api/admin/focus-board
 *
 * 從人類視角:Vincent 一上 admin 應該看到的 5 件事:
 *   1. 今天最該關注的 alert(critical)
 *   2. 本週領跑者(top 1 員工)+ 落後最嚴重員工
 *   3. 今天/週的關鍵數字 + 變化趨勢(7d vs prev 7d)
 *   4. 月底預估(達標機率)
 *   5. 該行動的 1 件事
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = getSupabaseAdmin();
  const today = taipeiToday();
  const weekAgo = taipeiDaysAgo(7);
  const twoWeekAgo = taipeiDaysAgo(14);
  const monthStart = taipeiMonthStart();

  // 1. 本週 + 上週 metrics(全 brand 聚合)
  // 2026-04-30 末段 critical fix:過濾 is_monthly_rollup → 防 sum 翻倍
  const thisWeekData = await fetchAllRows<{ email: string; name: string; brand: string; calls: number; raw_appointments: number; closures: number; net_revenue_daily: number; date: string }>(() =>
    sb.from("sales_metrics_daily")
      .select("email, name, brand, calls, raw_appointments, closures, net_revenue_daily, date")
      .gte("date", weekAgo)
      .not("is_monthly_rollup", "is", true)
  );
  const lastWeekData = await fetchAllRows<{ calls: number; raw_appointments: number; closures: number; net_revenue_daily: number }>(() =>
    sb.from("sales_metrics_daily")
      .select("calls, raw_appointments, closures, net_revenue_daily, date")
      .gte("date", twoWeekAgo)
      .lt("date", weekAgo)
      .not("is_monthly_rollup", "is", true)
  );
  const monthData = await fetchAllRows<{ net_revenue_daily: number }>(() =>
    sb.from("sales_metrics_daily")
      .select("net_revenue_daily, date")
      .gte("date", monthStart)
      .not("is_monthly_rollup", "is", true)
  );

  const sumWeek = (rows: any[], col: string) => rows.reduce((s, r) => s + Number(r[col] || 0), 0);
  const thisWeek = {
    calls: sumWeek(thisWeekData, "calls"),
    appts: sumWeek(thisWeekData, "raw_appointments"),
    closes: sumWeek(thisWeekData, "closures"),
    revenue: sumWeek(thisWeekData, "net_revenue_daily"),
  };
  const lastWeek = {
    calls: sumWeek(lastWeekData, "calls"),
    appts: sumWeek(lastWeekData, "raw_appointments"),
    closes: sumWeek(lastWeekData, "closures"),
    revenue: sumWeek(lastWeekData, "net_revenue_daily"),
  };
  function deltaPct(curr: number, prev: number): number {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  }
  const wow = {
    calls: deltaPct(thisWeek.calls, lastWeek.calls),
    appts: deltaPct(thisWeek.appts, lastWeek.appts),
    closes: deltaPct(thisWeek.closes, lastWeek.closes),
    revenue: deltaPct(thisWeek.revenue, lastWeek.revenue),
  };

  // 2. 本週 top 1 + bottom 員工(by revenue)
  const perEmail: Record<string, { email: string; name: string; brand: string; calls: number; revenue: number; closes: number; appts: number }> = {};
  for (const r of thisWeekData) {
    const k = r.email;
    if (!k) continue;
    if (!perEmail[k]) perEmail[k] = { email: k, name: r.name || k, brand: r.brand, calls: 0, revenue: 0, closes: 0, appts: 0 };
    perEmail[k].calls += Number(r.calls || 0);
    perEmail[k].revenue += Number(r.net_revenue_daily || 0);
    perEmail[k].closes += Number(r.closures || 0);
    perEmail[k].appts += Number(r.raw_appointments || 0);
  }
  const sortedEmp = Object.values(perEmail).sort((a, b) => b.revenue - a.revenue);
  const top1 = sortedEmp[0] || null;

  // 3. 月底預估 + 達標機率
  const monthRev = monthData.reduce((s, r: any) => s + Number(r.net_revenue_daily || 0), 0);
  const dayOfMonth = Number(today.slice(-2));
  // 用台北 月份 day 0 取月天
  const ymInt = Number(today.slice(0, 4)) * 100 + Number(today.slice(5, 7));
  const y = Math.floor(ymInt / 100), m = ymInt % 100;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dailyAvgMonth = dayOfMonth > 0 ? monthRev / dayOfMonth : 0;
  const projectedEom = Math.round(monthRev + dailyAvgMonth * (daysInMonth - dayOfMonth));

  // KPI target(動態撈)
  const { data: kpiTargets } = await sb
    .from("kpi_targets")
    .select("metric, target_value")
    .eq("is_active", true)
    .eq("period", "monthly")
    .in("metric", ["net_revenue_daily", "net_revenue"]);
  const monthTarget = (kpiTargets || []).reduce((s, k: any) => s + Number(k.target_value || 0), 0) || 5_000_000;
  const onTrackPct = monthTarget > 0 ? Math.min(150, Math.round((projectedEom / monthTarget) * 100)) : 0;

  // 4. 待處理 critical commands
  const { data: critCmds } = await sb
    .from("v3_commands")
    .select("id, title, severity, owner_email, created_at")
    .eq("status", "pending")
    .eq("severity", "critical")
    .order("created_at", { ascending: false })
    .limit(5);

  // 5. 本月 vs 上月對比
  const lastMonthAgo = taipeiDaysAgo(60);
  const lastMonthData = await fetchAllRows<{ net_revenue_daily: number; date: string }>(() =>
    sb.from("sales_metrics_daily")
      .select("net_revenue_daily, date")
      .gte("date", lastMonthAgo)
      .lt("date", monthStart)
      .not("is_monthly_rollup", "is", true)
  );
  const lastMonthRev = lastMonthData.reduce((s, r: any) => s + Number(r.net_revenue_daily || 0), 0);
  const monthDelta = deltaPct(monthRev, lastMonthRev);

  // 6. 「該行動的 1 件事」自動推
  let topAction = "";
  let topActionLink = "/admin";
  if ((critCmds || []).length > 0) {
    topAction = `🔴 立刻處理 ${critCmds!.length} 件緊急命令`;
    topActionLink = "/admin?tab=commands";
  } else if (onTrackPct < 70 && dayOfMonth >= 10) {
    topAction = `📉 月底預估僅達 KPI ${onTrackPct}% — 需檢視業務戰線哪裡卡`;
    topActionLink = "/admin?tab=sales";
  } else if (wow.revenue < -20) {
    topAction = `🔻 本週營收較上週跌 ${wow.revenue}% — 看戰情指揮中心`;
    topActionLink = "/admin?tab=pillars";
  } else if (sortedEmp.length > 0 && sortedEmp.filter((e) => e.calls < 50).length / sortedEmp.length > 0.5) {
    topAction = `📞 過半員工本週通數 < 50 — 需團隊喚醒`;
    topActionLink = "/admin?tab=group";
  } else if (top1 && top1.revenue > 0) {
    topAction = `✅ ${top1.name} 領跑(NT$ ${top1.revenue.toLocaleString()})— 看 Top 怎麼做`;
    topActionLink = "/admin?tab=group";
  } else {
    topAction = `📊 整體穩定 — 看戰略指標確認長期方向`;
    topActionLink = "/admin?tab=strategy";
  }

  // 高層視角額外判斷:對標 + 風險訊號
  // 對標 1:每員人均週撥打 vs 行業 baseline (200/週 = 健康)
  const avgCallsPerEmp = sortedEmp.length > 0 ? Math.round(thisWeek.calls / sortedEmp.length) : 0;
  // 對標 2:轉換率(整體) calls→appts→closes
  const callToApptRate = thisWeek.calls > 0 ? Math.round((thisWeek.appts / thisWeek.calls) * 1000) / 10 : 0;
  const apptToCloseRate = thisWeek.appts > 0 ? Math.round((thisWeek.closes / thisWeek.appts) * 100) : 0;
  // 對標 3:活躍員工 / 在線員工(出席率)
  const activeEmpCount = sortedEmp.filter((e) => e.calls > 0).length;
  const attendancePct = sortedEmp.length > 0 ? Math.round((activeEmpCount / sortedEmp.length) * 100) : 0;
  // 對標 4:Top 1 vs Median(內部 spread,反映團隊穩定度)
  const sortedRev = sortedEmp.map((e) => e.revenue).filter((v) => v > 0).sort((a, b) => b - a);
  const median = sortedRev.length > 0 ? sortedRev[Math.floor(sortedRev.length / 2)] : 0;
  const topToMedianRatio = median > 0 && top1 ? Math.round((top1.revenue / median) * 10) / 10 : 0;

  // 投資人視角風險訊號
  const risks: { level: "high" | "medium" | "low"; signal: string }[] = [];
  if (onTrackPct < 70 && dayOfMonth >= 10) risks.push({ level: "high", signal: `月底達標僅 ${onTrackPct}% — 收入風險` });
  if (attendancePct < 60) risks.push({ level: "high", signal: `${100 - attendancePct}% 員工本週 0 通 — 人力閒置` });
  if (wow.revenue < -20) risks.push({ level: "high", signal: `本週營收 WoW ${wow.revenue}% — 動能下滑` });
  if (topToMedianRatio > 5) risks.push({ level: "medium", signal: `Top:Median = ${topToMedianRatio}× — 過度依賴單一 Top` });
  if (callToApptRate > 0 && callToApptRate < 10) risks.push({ level: "medium", signal: `撥打→邀約 ${callToApptRate}% — 通話品質弱` });
  if (apptToCloseRate > 0 && apptToCloseRate < 15) risks.push({ level: "medium", signal: `邀約→成交 ${apptToCloseRate}% — 收網能力弱` });
  if (monthDelta < -10) risks.push({ level: "medium", signal: `本月 vs 上月 ${monthDelta}% — 月成長負` });

  return NextResponse.json({
    ok: true,
    generated_at: new Date().toISOString(),
    today,
    this_week: thisWeek,
    last_week: lastWeek,
    wow_pct: wow,
    top_performer: top1 ? {
      name: top1.name, brand: top1.brand, revenue: top1.revenue, calls: top1.calls, closes: top1.closes,
    } : null,
    bottom_count: sortedEmp.filter((e) => e.calls < 30).length,
    employee_count: sortedEmp.length,
    // 高層視角(投資人 / 董事長 / 總經理):對標 + 風險
    benchmark: {
      avg_calls_per_employee: avgCallsPerEmp,
      avg_calls_baseline: 200,                           // 行業 baseline 200/週/人
      call_to_appt_rate_pct: callToApptRate,
      call_to_appt_baseline: 15,                         // 健康 ≥ 15%
      appt_to_close_rate_pct: apptToCloseRate,
      appt_to_close_baseline: 25,                        // 健康 ≥ 25%
      attendance_pct: attendancePct,                     // 員工活躍率
      top_to_median_ratio: topToMedianRatio,             // 1-3 健康,>5 過度依賴
      active_employee_count: activeEmpCount,
    },
    risks,                                                // 紅黃旗
    month_progress: {
      day_of_month: dayOfMonth, days_in_month: daysInMonth,
      revenue: monthRev, target: monthTarget,
      projected_eom: projectedEom,
      on_track_pct: onTrackPct,
      vs_last_month_pct: monthDelta,
      health: onTrackPct >= 95 ? "healthy" : onTrackPct >= 70 ? "warning" : "critical",
    },
    pending_critical_commands: critCmds || [],
    top_action: topAction,
    top_action_link: topActionLink,
  });
}
