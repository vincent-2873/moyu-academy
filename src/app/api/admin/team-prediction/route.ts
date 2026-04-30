import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";
import { NextRequest } from "next/server";
import { taipeiToday, taipeiDayOfMonth, taipeiDaysInMonth, taipeiMonthStart } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔮 團隊層級預測 — 給主管看「誰本月會達標 / 誰會炸」
 *
 * GET /api/admin/team-prediction?brand=<optional>
 *
 * 對每個業務:
 *   1. 本月至今 + 剩餘天數 → 線性推算月底結果
 *   2. 對比歷史月平均 → 他是上升還是下滑
 *   3. 標記 risk level: on_track / behind / at_risk / critical
 *   4. 預測下一步: surge / maintain / recover / crash
 *
 * 輸出依 riskLevel 排序，主管一眼看「今天誰要特別關注」
 */

interface PersonPrediction {
  email: string;
  name: string;
  brand: string;
  team: string;
  monthRevenue: number;
  projectedMonthRevenue: number;
  avgMonthlyRev: number;
  vsAvgPct: number | null;
  monthCloses: number;
  daysActive: number;
  last3DaysAvg: number;
  prev3DaysAvg: number;
  momentum: string;
  riskLevel: "on_track" | "behind" | "at_risk" | "critical";
  predictedNextStep: string;
}

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  const supabase = getSupabaseAdmin();
  // 2026-04-30 Wave A B11 fix:用 lib/time.ts 統一台北 TZ helper
  const today = taipeiToday();
  const monthStart = taipeiMonthStart();

  // Need last 6 months for historical baseline + this month for progress
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const startDate = sixMonthsAgo.toISOString().slice(0, 10);

  // fetchAllRows 分頁繞 Supabase db-max-rows=1000 hard cap
  // (6 個月 × 50 人 × N brand 遠超 1000 row,Vincent 2026-04-30 反饋同 root cause)
  const allRows = await fetchAllRows<any>(() => {
    let query = supabase
      .from("sales_metrics_daily")
      .select("date, email, name, brand, team, calls, closures, net_revenue_daily")
      .gte("date", startDate);
    if (brand) query = query.eq("brand", brand);
    return query;
  });

  // Group by email
  const byEmail = new Map<
    string,
    {
      name: string;
      brand: string;
      team: string;
      monthRev: number;
      monthCloses: number;
      monthDays: Set<string>;
      last3: number[]; // calls
      prev3: number[];
      histMonthlyRev: Record<string, number>; // YYYY-MM → total rev
    }
  >();

  const todayDate = new Date(today);

  for (const r of allRows) {
    const email = (r.email as string) || "";
    if (!email) continue;
    const entry = byEmail.get(email) || {
      name: (r.name as string) || email,
      brand: (r.brand as string) || "-",
      team: (r.team as string) || "-",
      monthRev: 0,
      monthCloses: 0,
      monthDays: new Set<string>(),
      last3: [],
      prev3: [],
      histMonthlyRev: {},
    };

    const date = r.date as string;
    const calls = Number(r.calls) || 0;
    const closes = Number(r.closures) || 0;
    const rev = Number(r.net_revenue_daily) || 0;
    const ymMonth = date.slice(0, 7);

    entry.histMonthlyRev[ymMonth] = (entry.histMonthlyRev[ymMonth] || 0) + rev;

    if (date >= monthStart && date <= today) {
      entry.monthRev += rev;
      entry.monthCloses += closes;
      entry.monthDays.add(date);
    }
    const diff = (todayDate.getTime() - new Date(date).getTime()) / (1000 * 3600 * 24);
    if (diff >= 0 && diff <= 2) entry.last3.push(calls);
    else if (diff >= 3 && diff <= 5) entry.prev3.push(calls);

    byEmail.set(email, entry);
  }

  // 2026-04-30 Wave A B11 fix:用台北 TZ helper(parseInt(today.slice(-2)) 在月初 ok 但 robust)
  const daysInMonth = taipeiDaysInMonth();
  const daysElapsed = taipeiDayOfMonth();
  const daysRemaining = daysInMonth - daysElapsed;
  // 月初 < 3 天 projection 不可信
  const projectionInsufficient = daysElapsed < 3;

  const predictions: PersonPrediction[] = [];
  for (const [email, e] of byEmail.entries()) {
    // Avg monthly revenue from historical (exclude current month)
    const histMonths = Object.entries(e.histMonthlyRev).filter(([ym]) => ym !== today.slice(0, 7));
    const avgMonthlyRev = histMonths.length > 0
      ? histMonths.reduce((s, [, v]) => s + v, 0) / histMonths.length
      : 0;

    // Projection
    // 2026-04-30 Wave A B11 fix:用 daysElapsed 為分母(全月經過天數)而非 e.monthDays.size(該人活躍天數)
    //   原本「上月新人本月只打 1 天」會被推估「全月每天都這收入」嚴重高估
    const dailyAvg = daysElapsed > 0 ? e.monthRev / daysElapsed : 0;
    const projectedMonthRev = projectionInsufficient
      ? e.monthRev
      : Math.round(e.monthRev + dailyAvg * daysRemaining);

    // vs average
    const vsAvgPct = avgMonthlyRev > 0 ? ((projectedMonthRev - avgMonthlyRev) / avgMonthlyRev) * 100 : null;

    // Momentum
    const last3Avg = e.last3.length > 0 ? e.last3.reduce((s, x) => s + x, 0) / e.last3.length : 0;
    const prev3Avg = e.prev3.length > 0 ? e.prev3.reduce((s, x) => s + x, 0) / e.prev3.length : 0;
    let momentum = "flat";
    if (prev3Avg > 0) {
      const pct = ((last3Avg - prev3Avg) / prev3Avg) * 100;
      if (pct > 30) momentum = "surging";
      else if (pct > 10) momentum = "improving";
      else if (pct < -30) momentum = "crashing";
      else if (pct < -10) momentum = "declining";
    }

    // Risk level
    let riskLevel: PersonPrediction["riskLevel"] = "on_track";
    if (vsAvgPct != null) {
      if (vsAvgPct < -50 || momentum === "crashing") riskLevel = "critical";
      else if (vsAvgPct < -25 || momentum === "declining") riskLevel = "at_risk";
      else if (vsAvgPct < -10) riskLevel = "behind";
      else riskLevel = "on_track";
    } else {
      // No historical baseline (new hire) — classify by momentum alone
      if (momentum === "crashing") riskLevel = "critical";
      else if (momentum === "declining") riskLevel = "at_risk";
    }

    // Predicted next step (pattern matching)
    let predictedNextStep = "維持節奏";
    if (riskLevel === "critical") {
      if (last3Avg === 0) predictedNextStep = "可能離職 (連續 3 天 0 通)";
      else predictedNextStep = "即將炸掉 — 主管立刻 1-on-1";
    } else if (riskLevel === "at_risk") {
      if (momentum === "declining") predictedNextStep = "下滑中 — 今天需要介入";
      else predictedNextStep = "進度落後月平均 ↓，需要追";
    } else if (riskLevel === "behind") {
      predictedNextStep = "略落後 — 觀察明天";
    } else if (momentum === "surging") {
      predictedNextStep = "🔥 正在突破 — 給更多資源支援";
    } else if (momentum === "improving") {
      predictedNextStep = "狀態穩定上升";
    }

    predictions.push({
      email,
      name: e.name,
      brand: e.brand,
      team: e.team,
      monthRevenue: e.monthRev,
      projectedMonthRevenue: projectedMonthRev,
      avgMonthlyRev: Math.round(avgMonthlyRev),
      vsAvgPct: vsAvgPct != null ? Math.round(vsAvgPct) : null,
      monthCloses: e.monthCloses,
      daysActive: e.monthDays.size,
      last3DaysAvg: Math.round(last3Avg),
      prev3DaysAvg: Math.round(prev3Avg),
      momentum,
      riskLevel,
      predictedNextStep,
    });
  }

  // Sort by risk level severity first, then by projected month revenue
  const riskOrder = { critical: 0, at_risk: 1, behind: 2, on_track: 3 };
  predictions.sort((a, b) => {
    const rd = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    if (rd !== 0) return rd;
    return b.projectedMonthRevenue - a.projectedMonthRevenue;
  });

  const summary = {
    critical: predictions.filter((p) => p.riskLevel === "critical").length,
    at_risk: predictions.filter((p) => p.riskLevel === "at_risk").length,
    behind: predictions.filter((p) => p.riskLevel === "behind").length,
    on_track: predictions.filter((p) => p.riskLevel === "on_track").length,
    surging: predictions.filter((p) => p.momentum === "surging").length,
    crashing: predictions.filter((p) => p.momentum === "crashing").length,
  };

  return Response.json({
    ok: true,
    today,
    monthStart,
    daysElapsed,
    daysRemaining,
    summary,
    predictions,
    total: predictions.length,
  });
}
