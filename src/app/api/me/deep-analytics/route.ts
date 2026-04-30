import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";
import { requireCallerEmail } from "@/lib/auth";

/**
 * 個人深度分析 — 一個業務的 15 個月完整活動報告
 *
 * GET /api/me/deep-analytics?email=<email>
 *
 * 回傳:
 *   - timeSeries: 每月 (或每日對最近) 的 calls/closures/revenue
 *   - lifetime: 累計 (首日至今)
 *   - funnel: 當前 vs 歷史 rates
 *   - consistency: std dev / 最佳月 / 最差月
 *   - rankings: 在同品牌 / 全集團 的 rank
 *   - patterns: Claude 偵測的 pattern 文字 (小段，不調 Claude)
 *   - trend: 3 個月 moving average
 */

interface Metric {
  calls: number;
  connected: number;
  appts: number;
  shows: number;
  closes: number;
  revenue: number;
}

function emptyM(): Metric {
  return { calls: 0, connected: 0, appts: 0, shows: 0, closes: 0, revenue: 0 };
}
function addM(a: Metric, r: Record<string, unknown>) {
  a.calls += Number(r.calls) || 0;
  a.connected += Number(r.connected) || 0;
  a.appts += Number(r.raw_appointments) || 0;
  a.shows += Number(r.appointments_show) || 0;
  a.closes += Number(r.closures) || 0;
  a.revenue += Number(r.net_revenue_daily) || 0;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((s, x) => s + x, 0) / arr.length;
  const variance = arr.reduce((s, x) => s + (x - mean) * (x - mean), 0) / arr.length;
  return Math.sqrt(variance);
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return Response.json({ ok: false, error: "email required" }, { status: 400 });
  const authErr = requireCallerEmail(req, email);
  if (authErr) return authErr;

  const supabase = getSupabaseAdmin();

  // Pull last 15 months of this person's rows
  const fifteenMonthsAgo = new Date();
  fifteenMonthsAgo.setMonth(fifteenMonthsAgo.getMonth() - 15);
  const start = fifteenMonthsAgo.toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .from("sales_metrics_daily")
    .select("date, brand, team, name, calls, connected, raw_appointments, appointments_show, closures, net_revenue_daily, level")
    .eq("email", email)
    .gte("date", start)
    .order("date", { ascending: true });

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const myRows = (rows || []) as Array<Record<string, unknown>>;

  if (myRows.length === 0) {
    return Response.json({
      ok: true,
      email,
      bound: false,
      message: "還沒有業務資料",
    });
  }

  const latestRow = myRows[myRows.length - 1];
  const profile = {
    name: (latestRow.name as string) || email,
    brand: (latestRow.brand as string) || "-",
    team: (latestRow.team as string) || "-",
    level: (latestRow.level as string) || null,
  };

  // Group by month
  const byMonth = new Map<string, Metric>();
  for (const r of myRows) {
    const monthKey = (r.date as string).slice(0, 7); // YYYY-MM
    const m = byMonth.get(monthKey) || emptyM();
    addM(m, r);
    byMonth.set(monthKey, m);
  }
  const timeSeries = Array.from(byMonth.entries())
    .sort()
    .map(([month, m]) => ({
      month,
      ...m,
      connectRate: m.calls > 0 ? m.connected / m.calls : null,
      closeRate: m.shows > 0 ? m.closes / m.shows : null,
    }));

  // Lifetime totals
  const lifetime = emptyM();
  for (const r of myRows) addM(lifetime, r);

  // Consistency (monthly revenue std dev / mean)
  const monthlyRev = timeSeries.map((t) => t.revenue);
  const revSigma = stdDev(monthlyRev);
  const revMean = monthlyRev.length > 0 ? monthlyRev.reduce((s, x) => s + x, 0) / monthlyRev.length : 0;
  const consistencyScore = revMean > 0 ? Math.max(0, Math.min(100, 100 * (1 - revSigma / revMean))) : 0;

  // Best / worst month
  const sortedByRev = [...timeSeries].sort((a, b) => b.revenue - a.revenue);
  const bestMonth = sortedByRev[0] || null;
  const worstMonth = sortedByRev[sortedByRev.length - 1] || null;

  // 3-month moving average (trend)
  const trend = timeSeries.map((t, i) => {
    const slice = timeSeries.slice(Math.max(0, i - 2), i + 1);
    const avg = slice.reduce((s, x) => s + x.revenue, 0) / slice.length;
    return { month: t.month, ma3: avg };
  });

  // Rankings: this month vs brand / company
  const thisMonthKey = new Date().toISOString().slice(0, 7);
  const { data: brandRows } = await supabase
    .from("sales_metrics_daily")
    .select("email, net_revenue_daily")
    .eq("brand", profile.brand)
    .gte("date", thisMonthKey + "-01");
  const brandPerson = new Map<string, number>();
  for (const r of brandRows || []) {
    const k = r.email as string;
    if (!k) continue;
    brandPerson.set(k, (brandPerson.get(k) || 0) + (Number(r.net_revenue_daily) || 0));
  }
  const brandRanked = Array.from(brandPerson.entries()).sort((a, b) => b[1] - a[1]);
  const brandRankIdx = brandRanked.findIndex(([e]) => e === email);
  const brandRank = brandRankIdx >= 0 ? brandRankIdx + 1 : null;
  const brandTotal = brandRanked.length;

  const { data: allRows } = await supabase
    .from("sales_metrics_daily")
    .select("email, net_revenue_daily")
    .gte("date", thisMonthKey + "-01");
  const allPerson = new Map<string, number>();
  for (const r of allRows || []) {
    const k = r.email as string;
    if (!k) continue;
    allPerson.set(k, (allPerson.get(k) || 0) + (Number(r.net_revenue_daily) || 0));
  }
  const allRanked = Array.from(allPerson.entries()).sort((a, b) => b[1] - a[1]);
  const companyRankIdx = allRanked.findIndex(([e]) => e === email);
  const companyRank = companyRankIdx >= 0 ? companyRankIdx + 1 : null;
  const companyTotal = allRanked.length;

  // Patterns (rule-based, no Claude call)
  const patterns: string[] = [];
  if (timeSeries.length >= 3) {
    const recent3 = timeSeries.slice(-3);
    const prior3 = timeSeries.slice(-6, -3);
    if (recent3.length === 3 && prior3.length === 3) {
      const recentAvg = recent3.reduce((s, x) => s + x.revenue, 0) / 3;
      const priorAvg = prior3.reduce((s, x) => s + x.revenue, 0) / 3;
      if (priorAvg > 0) {
        const delta = ((recentAvg - priorAvg) / priorAvg) * 100;
        if (delta > 20) patterns.push(`📈 近 3 個月業績比前 3 個月成長 ${delta.toFixed(0)}% — 狀態在上升`);
        else if (delta < -20) patterns.push(`📉 近 3 個月業績比前 3 個月下滑 ${Math.abs(delta).toFixed(0)}% — 有掉速，需要介入`);
        else patterns.push(`➡️ 近 3 個月業績穩定 (${delta >= 0 ? "+" : ""}${delta.toFixed(0)}%)`);
      }
    }
  }
  if (bestMonth && worstMonth && bestMonth.month !== worstMonth.month) {
    patterns.push(
      `🏆 最強月份: ${bestMonth.month} (NT$${Math.round(bestMonth.revenue).toLocaleString()}) · 最弱: ${worstMonth.month} (NT$${Math.round(worstMonth.revenue).toLocaleString()})`
    );
  }
  if (consistencyScore >= 70) {
    patterns.push(`💎 業績穩定度 ${consistencyScore.toFixed(0)}% — 發揮很一致`);
  } else if (consistencyScore < 40) {
    patterns.push(`⚠️ 業績波動大 (穩定度 ${consistencyScore.toFixed(0)}%) — 月度差距明顯`);
  }
  if (brandRank && brandTotal > 3) {
    const pct = (brandRank / brandTotal) * 100;
    if (pct <= 20) patterns.push(`🥇 本月品牌內排名 ${brandRank}/${brandTotal} (前 ${pct.toFixed(0)}%)`);
    else if (pct >= 80) patterns.push(`🔻 本月品牌內排名 ${brandRank}/${brandTotal} (後 ${(100 - pct).toFixed(0)}%)`);
    else patterns.push(`📊 本月品牌內排名 ${brandRank}/${brandTotal}`);
  }

  return Response.json({
    ok: true,
    email,
    bound: true,
    profile,
    lifetime,
    timeSeries,
    trend,
    bestMonth,
    worstMonth,
    consistencyScore,
    rankings: {
      brand: { rank: brandRank, total: brandTotal, brandName: profile.brand },
      company: { rank: companyRank, total: companyTotal },
    },
    patterns,
    rowCount: myRows.length,
    monthCount: timeSeries.length,
  });
}
