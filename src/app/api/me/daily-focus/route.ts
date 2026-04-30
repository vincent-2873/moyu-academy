import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { taipeiToday, taipeiDaysAgo } from "@/lib/time";

/**
 * 2026-04-30 末段:員工前台 DailyFocus
 *
 * GET /api/me/daily-focus?email=xxx
 *
 * 員工一登入第一個看到的東西 — 「今天該注意什麼 / 該做什麼」
 *
 * 回:
 *   - today 進度(撥打 / 邀約 / 成交)+ 今日目標差距
 *   - 7d 累計 vs baseline
 *   - 本週 brand 內排名 + 距上一名差距
 *   - 弱項 1 個 + 具體 action
 *   - 待辦命令(v3_commands)
 *   - 對練狀況(沒練到的提醒)
 *   - 戰情官提醒(rule-based 不用 LLM)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const today = taipeiToday();
  const weekAgo = taipeiDaysAgo(7);

  const { data: user } = await sb
    .from("users")
    .select("id, email, name, brand, role, stage_path, stage")
    .eq("email", email)
    .maybeSingle();
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  // 1. 今日 metrics
  const { data: todayRow } = await sb
    .from("sales_metrics_daily")
    .select("calls, raw_appointments, closures, net_revenue_daily")
    .eq("email", email)
    .eq("date", today)
    .maybeSingle();

  const todayCalls = Number(todayRow?.calls || 0);
  const todayAppts = Number(todayRow?.raw_appointments || 0);
  const todayCloses = Number(todayRow?.closures || 0);
  const todayRev = Number(todayRow?.net_revenue_daily || 0);

  // 2. 7d 累計
  const week = await fetchAllRows<{ date: string; calls: number; raw_appointments: number; closures: number; net_revenue_daily: number }>(() =>
    sb.from("sales_metrics_daily")
      .select("date, calls, raw_appointments, closures, net_revenue_daily")
      .eq("email", email)
      .gte("date", weekAgo)
  );
  const weekCalls = week.reduce((s, r) => s + Number(r.calls || 0), 0);
  const weekAppts = week.reduce((s, r) => s + Number(r.raw_appointments || 0), 0);
  const weekCloses = week.reduce((s, r) => s + Number(r.closures || 0), 0);
  const weekRev = week.reduce((s, r) => s + Number(r.net_revenue_daily || 0), 0);

  // 3. brand 內排名
  const brandWeek = await fetchAllRows<{ email: string; name: string; calls: number; net_revenue_daily: number }>(() => {
    let q = sb.from("sales_metrics_daily")
      .select("email, name, calls, net_revenue_daily")
      .gte("date", weekAgo);
    if (user.brand) q = q.eq("brand", user.brand);
    return q;
  });
  const peerMap: Record<string, { email: string; name: string; revenue: number }> = {};
  for (const r of brandWeek) {
    if (!r.email) continue;
    if (!peerMap[r.email]) peerMap[r.email] = { email: r.email, name: r.name || r.email, revenue: 0 };
    peerMap[r.email].revenue += Number(r.net_revenue_daily || 0);
  }
  const peers = Object.values(peerMap).sort((a, b) => b.revenue - a.revenue);
  const myRank = peers.findIndex((p) => p.email === email) + 1;
  const peerCount = peers.length;
  const aboveMe = myRank > 1 ? peers[myRank - 2] : null;
  const gapToAbove = aboveMe ? Math.max(0, aboveMe.revenue - weekRev) : 0;

  // 4. 弱項分析(基於 7 天 baseline)
  const dailyBaselines = { calls: 30, appts: 5, closes: 1 };
  const weekBaselines = { calls: 210, appts: 35, closes: 7 };
  const weakAxes: { axis: string; label: string; current: number; baseline: number; gap: number; hint: string }[] = [];
  if (weekCalls < weekBaselines.calls) {
    weakAxes.push({
      axis: "calls", label: "撥打量",
      current: weekCalls, baseline: weekBaselines.calls,
      gap: weekBaselines.calls - weekCalls,
      hint: `本週還差 ${weekBaselines.calls - weekCalls} 通 — 今天再加 ${Math.ceil((weekBaselines.calls - weekCalls) / Math.max(1, 7 - new Date(today).getDay()))} 通就追上 baseline`,
    });
  }
  if (weekAppts < weekBaselines.appts && weekCalls > 100) {
    weakAxes.push({
      axis: "appts", label: "邀約轉換",
      current: weekAppts, baseline: weekBaselines.appts, gap: weekBaselines.appts - weekAppts,
      hint: "撥打有量但邀約少 → 練 8 步框架第 3-5 步『動機詢問』+ 致命提問黃金三句",
    });
  }
  if (weekCloses < weekBaselines.closes && weekAppts > 20) {
    weakAxes.push({
      axis: "closes", label: "收網成交",
      current: weekCloses, baseline: weekBaselines.closes, gap: weekBaselines.closes - weekCloses,
      hint: "邀約有但成交少 → 看 EP4『定價分期』+ 對練『太貴』異議處理",
    });
  }
  // 取最弱的一個
  const topWeakness = weakAxes.sort((a, b) => (b.baseline - b.current) - (a.baseline - a.current))[0] || null;

  // 5. 待辦命令(v3_commands assigned to me)
  const { data: cmds } = await sb
    .from("v3_commands")
    .select("id, title, detail, severity, deadline, status")
    .eq("owner_email", email)
    .in("status", ["pending", "acknowledged"])
    .order("severity", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(5);

  // 6. 7 天內有沒有對練
  const sevenDays = taipeiDaysAgo(7) + "T00:00:00+08:00";
  const { data: recentSpar } = await sb
    .from("sparring_records")
    .select("id, score, created_at")
    .eq("user_email", email)
    .gte("created_at", sevenDays)
    .order("created_at", { ascending: false })
    .limit(3);

  // 7. 戰情官提醒(rule-based)
  const reminders: { type: string; level: "info" | "warning" | "critical"; text: string }[] = [];
  if (todayCalls === 0) {
    reminders.push({ type: "today_zero", level: "warning", text: `🌅 今天還沒開口 — 目標 ${dailyBaselines.calls} 通,先打 5 通熱身` });
  } else if (todayCalls < 10) {
    reminders.push({ type: "today_low", level: "info", text: `📞 今天打 ${todayCalls} 通 — 上午目標 15 通` });
  }
  if (!recentSpar || recentSpar.length === 0) {
    reminders.push({ type: "no_sparring", level: "warning", text: "🎯 7 天沒對練了 — 進 /learn 安排 1 場" });
  }
  if (todayCalls >= 50 && todayCloses === 0 && todayAppts === 0) {
    reminders.push({ type: "no_conversion", level: "warning", text: "📉 今日 50+ 通 0 邀約 — 先停一下,聽自己錄音 5 分鐘看哪卡住" });
  }
  if ((cmds || []).filter((c) => c.severity === "critical").length > 0) {
    reminders.push({ type: "critical_cmd", level: "critical", text: `🔴 你有 ${(cmds || []).filter((c) => c.severity === "critical").length} 件緊急指派` });
  }

  // 8. 一句話 morning brief
  let headline = "";
  if (todayCalls === 0 && new Date(today + "T00:00:00").getDay() >= 1 && new Date(today + "T00:00:00").getDay() <= 5) {
    headline = `早安 ${user.name || ""},今日從零開始,先打 ${dailyBaselines.calls} 通熱身`;
  } else if (myRank === 1 && weekRev > 0) {
    headline = `🥇 ${user.name || ""} 你本週 brand 第 1!保持節奏`;
  } else if (myRank > 0 && myRank <= 3) {
    headline = `🏃 ${user.name || ""} 本週排名 #${myRank}/${peerCount},距 #${myRank - 1} 差 NT$ ${gapToAbove.toLocaleString()}`;
  } else if (topWeakness) {
    headline = `⚡ ${user.name || ""} 今日重點:把『${topWeakness.label}』追到 baseline`;
  } else {
    headline = `☀️ ${user.name || ""} 今日繼續推進`;
  }

  return NextResponse.json({
    ok: true,
    me: { email: user.email, name: user.name, brand: user.brand, stage: user.stage, role: user.role },
    headline,
    today: {
      date: today,
      calls: todayCalls, appts: todayAppts, closes: todayCloses, revenue: todayRev,
      target: dailyBaselines.calls,
      gap_to_target: Math.max(0, dailyBaselines.calls - todayCalls),
      pct: Math.min(100, Math.round((todayCalls / dailyBaselines.calls) * 100)),
    },
    seven_day: {
      calls: weekCalls, appts: weekAppts, closes: weekCloses, revenue: weekRev,
      baseline: weekBaselines,
    },
    rank: {
      my_rank: myRank, peer_count: peerCount,
      above_me: aboveMe,
      gap_to_above: gapToAbove,
    },
    weakness: topWeakness,
    reminders,
    pending_commands: cmds || [],
    recent_sparring_count: (recentSpar || []).length,
  });
}
