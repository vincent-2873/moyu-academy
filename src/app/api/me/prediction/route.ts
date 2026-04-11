import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 🔮 個人行為預測 — 預測業務下一步會做什麼 + 他今天/本月會不會達標
 *
 * GET /api/me/prediction?email=<email>
 *
 * 這是「人類行為建模」層 — Claude 更透徹地分析業務，並預測他下一步：
 *
 * 預測維度:
 *  1. todayProjection: 基於當下 pace 推算 EOD 會到達哪裡
 *  2. monthProjection: 基於當月 trend 推算月底結果
 *  3. momentumSignal: 3 天動能 (improving / declining / flat)
 *  4. riskSignal: 下一個會卡的點 (calls OK but appointments lagging / volume OK but close rate crashing)
 *  5. burnoutRisk: 連續多天 0 通 → 可能要離職
 *  6. dayOfWeekPattern: 這個人週幾最強 / 最弱
 *  7. bestHourPattern: 一天哪個時段成交率最高 (目前沒 hourly data, 用 day-of-week 代替)
 *  8. nextBestAction: Claude 推薦的「接下來 60 分鐘做這件事」
 *
 * Rule-based 算完，不調 Claude 以省 token (CEO dashboard 才用 Claude)
 */

interface DailyRow {
  date: string;
  calls: number;
  connected: number;
  appts: number;
  shows: number;
  closes: number;
  revenue: number;
}

function todayTaipei(): string {
  const now = new Date();
  const tp = new Date(now.getTime() + 8 * 3600 * 1000);
  return tp.toISOString().slice(0, 10);
}

function dayOfWeek(dateStr: string): number {
  // 0=Sun, 1=Mon, ... 6=Sat
  return new Date(dateStr + "T00:00:00Z").getUTCDay();
}

function dayLabel(dow: number): string {
  return ["週日", "週一", "週二", "週三", "週四", "週五", "週六"][dow];
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return Response.json({ ok: false, error: "email required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const today = todayTaipei();

  // Last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = thirtyDaysAgo.toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .from("sales_metrics_daily")
    .select("date, calls, connected, raw_appointments, appointments_show, closures, net_revenue_daily, brand, level, name")
    .eq("email", email)
    .gte("date", startDate)
    .order("date", { ascending: true });

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const allRows = rows || [];

  if (allRows.length === 0) {
    return Response.json({
      ok: true,
      email,
      bound: false,
      message: "還沒有業務資料可以預測",
    });
  }

  const latest = allRows[allRows.length - 1] as Record<string, unknown>;
  const profile = {
    name: (latest.name as string) || email,
    brand: (latest.brand as string) || "-",
    level: (latest.level as string) || null,
  };

  const daily: DailyRow[] = allRows.map((r) => ({
    date: r.date as string,
    calls: Number(r.calls) || 0,
    connected: Number(r.connected) || 0,
    appts: Number(r.raw_appointments) || 0,
    shows: Number(r.appointments_show) || 0,
    closes: Number(r.closures) || 0,
    revenue: Number(r.net_revenue_daily) || 0,
  }));

  const todayData = daily.find((d) => d.date === today);
  const recent7 = daily.filter((d) => {
    const diff = (new Date(today).getTime() - new Date(d.date).getTime()) / (1000 * 3600 * 24);
    return diff >= 0 && diff <= 6;
  });
  const prev7 = daily.filter((d) => {
    const diff = (new Date(today).getTime() - new Date(d.date).getTime()) / (1000 * 3600 * 24);
    return diff >= 7 && diff <= 13;
  });

  // 1. Today projection (linear extrapolation from current hour)
  const nowTp = new Date(Date.now() + 8 * 3600 * 1000);
  const hourTw = nowTp.getUTCHours() + nowTp.getUTCMinutes() / 60;
  const shiftStart = 9;
  const shiftEnd = 20;
  const elapsedFrac = Math.max(0, Math.min(1, (hourTw - shiftStart) / (shiftEnd - shiftStart)));

  // Historical average daily calls (last 7 days excluding today and 0-call days)
  const activeDays = recent7.filter((d) => d.date !== today && d.calls > 0);
  const avgHistoricalCalls = activeDays.length > 0
    ? activeDays.reduce((s, d) => s + d.calls, 0) / activeDays.length
    : 0;
  const avgHistoricalRev = activeDays.length > 0
    ? activeDays.reduce((s, d) => s + d.revenue, 0) / activeDays.length
    : 0;

  const currentCalls = todayData?.calls || 0;
  const currentRev = todayData?.revenue || 0;
  const projectedCalls = elapsedFrac > 0.1
    ? Math.round(currentCalls / elapsedFrac)
    : Math.round(avgHistoricalCalls);
  const projectedRev = elapsedFrac > 0.1
    ? Math.round(currentRev / elapsedFrac)
    : Math.round(avgHistoricalRev);

  const todayProjection = {
    now: `${Math.floor(hourTw)}:${String(Math.floor((hourTw % 1) * 60)).padStart(2, "0")}`,
    elapsedPct: Math.round(elapsedFrac * 100),
    currentCalls,
    currentRev,
    projectedCalls,
    projectedRev,
    avgHistoricalCalls: Math.round(avgHistoricalCalls),
    avgHistoricalRev: Math.round(avgHistoricalRev),
    vsHistoricalPct: avgHistoricalCalls > 0 ? Math.round(((projectedCalls - avgHistoricalCalls) / avgHistoricalCalls) * 100) : null,
  };

  // 2. Month projection
  const monthStart = today.slice(0, 8) + "01";
  const monthRows = daily.filter((d) => d.date >= monthStart && d.date <= today);
  const daysElapsedInMonth = Math.max(1, monthRows.length);
  const monthCalls = monthRows.reduce((s, d) => s + d.calls, 0);
  const monthRev = monthRows.reduce((s, d) => s + d.revenue, 0);
  const monthCloses = monthRows.reduce((s, d) => s + d.closes, 0);
  const daysInMonth = new Date(new Date(today).getFullYear(), new Date(today).getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - parseInt(today.slice(-2), 10);
  const avgDailyRev = monthRev / daysElapsedInMonth;
  const monthProjection = {
    daysElapsed: daysElapsedInMonth,
    daysTotal: daysInMonth,
    daysRemaining,
    currentCalls: monthCalls,
    currentRev: monthRev,
    currentCloses: monthCloses,
    projectedMonthRev: Math.round(monthRev + avgDailyRev * daysRemaining),
    avgDailyRev: Math.round(avgDailyRev),
  };

  // 3. Momentum signal (last 3 days vs prev 3 days calls)
  const last3 = daily.slice(-3);
  const prev3 = daily.slice(-6, -3);
  const last3Avg = last3.length > 0 ? last3.reduce((s, d) => s + d.calls, 0) / last3.length : 0;
  const prev3Avg = prev3.length > 0 ? prev3.reduce((s, d) => s + d.calls, 0) / prev3.length : 0;
  let momentum: "surging" | "improving" | "flat" | "declining" | "crashing" = "flat";
  let momentumPct = 0;
  if (prev3Avg > 0) {
    momentumPct = ((last3Avg - prev3Avg) / prev3Avg) * 100;
    if (momentumPct > 30) momentum = "surging";
    else if (momentumPct > 10) momentum = "improving";
    else if (momentumPct < -30) momentum = "crashing";
    else if (momentumPct < -10) momentum = "declining";
    else momentum = "flat";
  }

  // 4. Risk signal — find the bottleneck
  // Compare recent 7 vs prev 7 funnel rates
  const agg = (rows: DailyRow[]) => rows.reduce(
    (a, r) => ({ calls: a.calls + r.calls, connected: a.connected + r.connected, appts: a.appts + r.appts, shows: a.shows + r.shows, closes: a.closes + r.closes, revenue: a.revenue + r.revenue }),
    { calls: 0, connected: 0, appts: 0, shows: 0, closes: 0, revenue: 0 }
  );
  const recent7Agg = agg(recent7);
  const prev7Agg = agg(prev7);
  const rate = (n: number, d: number) => (d > 0 ? n / d : 0);
  const recentRates = {
    connectRate: rate(recent7Agg.connected, recent7Agg.calls),
    inviteRate: rate(recent7Agg.appts, recent7Agg.connected),
    showRate: rate(recent7Agg.shows, recent7Agg.appts),
    closeRate: rate(recent7Agg.closes, recent7Agg.shows),
  };
  const prevRates = {
    connectRate: rate(prev7Agg.connected, prev7Agg.calls),
    inviteRate: rate(prev7Agg.appts, prev7Agg.connected),
    showRate: rate(prev7Agg.shows, prev7Agg.appts),
    closeRate: rate(prev7Agg.closes, prev7Agg.shows),
  };
  const rateDeltas = {
    connectRate: recentRates.connectRate - prevRates.connectRate,
    inviteRate: recentRates.inviteRate - prevRates.inviteRate,
    showRate: recentRates.showRate - prevRates.showRate,
    closeRate: recentRates.closeRate - prevRates.closeRate,
  };
  // The worst delta = the bottleneck about to break
  const worstRate = Object.entries(rateDeltas).sort((a, b) => a[1] - b[1])[0];
  const bottleneck = worstRate && worstRate[1] < -0.02
    ? { metric: worstRate[0], delta: worstRate[1], currentRate: recentRates[worstRate[0] as keyof typeof recentRates] }
    : null;

  // 5. Burnout risk — consecutive 0-call days in last 5
  const last5 = daily.slice(-5);
  let zeroStreak = 0;
  for (let i = last5.length - 1; i >= 0; i--) {
    if (last5[i].calls === 0) zeroStreak++;
    else break;
  }
  const burnoutRisk = zeroStreak >= 3 ? "high" : zeroStreak >= 2 ? "medium" : "low";

  // 6. Day-of-week pattern — find which day this person is strongest
  const byDow: Record<number, { count: number; revSum: number; callsSum: number }> = {};
  for (const d of daily) {
    const dow = dayOfWeek(d.date);
    const e = byDow[dow] || { count: 0, revSum: 0, callsSum: 0 };
    e.count += 1;
    e.revSum += d.revenue;
    e.callsSum += d.calls;
    byDow[dow] = e;
  }
  const dowStats = Object.entries(byDow).map(([dow, v]) => ({
    dow: parseInt(dow),
    label: dayLabel(parseInt(dow)),
    avgRev: v.count > 0 ? v.revSum / v.count : 0,
    avgCalls: v.count > 0 ? v.callsSum / v.count : 0,
    samples: v.count,
  }));
  dowStats.sort((a, b) => b.avgRev - a.avgRev);
  const bestDay = dowStats[0];
  const worstDay = dowStats[dowStats.length - 1];

  // 7. Next best action — Claude-like heuristic
  let nextBestAction = { title: "", detail: "", priority: "normal" as "critical" | "high" | "normal" };
  if (burnoutRisk === "high") {
    nextBestAction = {
      title: "🚨 立刻撥第 1 通電話",
      detail: `你連續 ${zeroStreak} 天沒打電話，這是 burnout 前兆。現在就打 1 通，任何對象都好，把節奏找回來。跟主管說狀況。`,
      priority: "critical",
    };
  } else if (momentum === "crashing") {
    nextBestAction = {
      title: "🔴 今晚 review 最近 3 通錄音",
      detail: `你近 3 天通次比前 3 天掉了 ${Math.abs(momentumPct).toFixed(0)}%，狀態在下滑。下班前挑 3 通最近的通話自我診斷。`,
      priority: "critical",
    };
  } else if (bottleneck && bottleneck.metric === "closeRate") {
    nextBestAction = {
      title: "⚠️ 今天重點: 結案話術演練",
      detail: `你的成交率比上週下滑 ${Math.abs(bottleneck.delta * 100).toFixed(1)}%。接下來的 1 小時找主管或同事演練 3 次「要錢」話術。`,
      priority: "high",
    };
  } else if (bottleneck && bottleneck.metric === "inviteRate") {
    nextBestAction = {
      title: "⚠️ 今天重點: 邀約轉換",
      detail: `你的邀約率比上週下滑 ${Math.abs(bottleneck.delta * 100).toFixed(1)}%。接通後 30 秒內就要切入邀約，不要聊天太久。`,
      priority: "high",
    };
  } else if (bottleneck && bottleneck.metric === "connectRate") {
    nextBestAction = {
      title: "⚠️ 今天重點: 接通率優化",
      detail: `你的接通率掉了 ${Math.abs(bottleneck.delta * 100).toFixed(1)}%。可能是名單品質或撥打時段問題。試試改到中午或傍晚，或換一批新名單。`,
      priority: "high",
    };
  } else if (todayProjection.vsHistoricalPct != null && todayProjection.vsHistoricalPct < -30) {
    nextBestAction = {
      title: "📈 追進度",
      detail: `照你目前速度 EOD 只到 ${todayProjection.projectedCalls} 通，比平均 ${todayProjection.avgHistoricalCalls} 通少 ${Math.abs(todayProjection.vsHistoricalPct)}%。下小時衝 20 通就能追回來。`,
      priority: "high",
    };
  } else if (momentum === "surging") {
    nextBestAction = {
      title: "🔥 趁勝追擊",
      detail: `你近 3 天通次比前 3 天成長 ${momentumPct.toFixed(0)}%，狀態在上升。維持節奏，今天再加 20 通有機會創新高。`,
      priority: "normal",
    };
  } else {
    nextBestAction = {
      title: "✅ 穩定執行",
      detail: `你目前狀態穩定。維持節奏，下 1 小時目標再 20 通 + 確保有 1 個邀約進來。`,
      priority: "normal",
    };
  }

  return Response.json({
    ok: true,
    email,
    bound: true,
    profile,
    todayProjection,
    monthProjection,
    momentum: {
      label: momentum,
      pct: Math.round(momentumPct),
      last3AvgCalls: Math.round(last3Avg),
      prev3AvgCalls: Math.round(prev3Avg),
    },
    bottleneck,
    rates: {
      recent7: recentRates,
      prev7: prevRates,
      deltas: rateDeltas,
    },
    burnoutRisk: {
      level: burnoutRisk,
      zeroStreak,
    },
    bestDay: bestDay.samples >= 2 ? bestDay : null,
    worstDay: worstDay.samples >= 2 ? worstDay : null,
    nextBestAction,
    generatedAt: new Date().toISOString(),
  });
}
