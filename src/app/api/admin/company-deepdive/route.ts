import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";
import { getAdminScope } from "@/lib/admin-scope";
import { taipeiDaysAgo } from "@/lib/time";

/**
 * 2026-04-30 末段 G4:CompanyDeepDive
 *
 * GET /api/admin/company-deepdive?brand=nschool
 *
 * 回:
 *   - employees: 該 brand 員工列表 + 7d 個人 KPI
 *   - sparrings: 最近 30 天對練 top 20
 *   - trend: 7 天日 KPI 走勢(整 brand)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const scope = await getAdminScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brand = req.nextUrl.searchParams.get("brand");
  if (!brand) return NextResponse.json({ error: "brand required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const weekAgo = taipeiDaysAgo(7);
  const monthAgo = taipeiDaysAgo(30);

  // 1. 該 brand 員工
  const { data: employees } = await sb
    .from("users")
    .select("id, email, name, role, status, created_at")
    .eq("brand", brand)
    .eq("status", "active");

  // 2. 7d KPI per employee
  const empMetrics = await fetchAllRows<{ email: string; date: string; calls: number; raw_appointments: number; closures: number; net_revenue_daily: number }>(() =>
    sb.from("sales_metrics_daily")
      .select("email, date, calls, raw_appointments, closures, net_revenue_daily")
      .eq("brand", brand)
      .gte("date", weekAgo)
  );

  const perEmail: Record<string, { calls: number; appts: number; closes: number; revenue: number; days: Set<string> }> = {};
  for (const m of empMetrics) {
    const k = m.email;
    if (!k) continue;
    if (!perEmail[k]) perEmail[k] = { calls: 0, appts: 0, closes: 0, revenue: 0, days: new Set() };
    perEmail[k].calls += Number(m.calls || 0);
    perEmail[k].appts += Number(m.raw_appointments || 0);
    perEmail[k].closes += Number(m.closures || 0);
    perEmail[k].revenue += Number(m.net_revenue_daily || 0);
    perEmail[k].days.add(m.date);
  }

  const employeesEnriched = (employees || []).map((u: any) => {
    const k = perEmail[u.email] || { calls: 0, appts: 0, closes: 0, revenue: 0, days: new Set() };
    return {
      id: u.id, email: u.email, name: u.name, role: u.role,
      week_calls: k.calls, week_appts: k.appts, week_closes: k.closes, week_revenue: k.revenue,
      active_days_7d: k.days.size,
      conversion_call_to_appt: k.calls > 0 ? Math.round((k.appts / k.calls) * 100) : 0,
      conversion_appt_to_close: k.appts > 0 ? Math.round((k.closes / k.appts) * 100) : 0,
    };
  }).sort((a: any, b: any) => b.week_revenue - a.week_revenue);

  // 3. 7d trend(整 brand)
  const dayBuckets: Record<string, { date: string; calls: number; appts: number; closes: number; revenue: number }> = {};
  for (const m of empMetrics) {
    if (!dayBuckets[m.date]) dayBuckets[m.date] = { date: m.date, calls: 0, appts: 0, closes: 0, revenue: 0 };
    dayBuckets[m.date].calls += Number(m.calls || 0);
    dayBuckets[m.date].appts += Number(m.raw_appointments || 0);
    dayBuckets[m.date].closes += Number(m.closures || 0);
    dayBuckets[m.date].revenue += Number(m.net_revenue_daily || 0);
  }
  const trend = Object.values(dayBuckets).sort((a, b) => a.date.localeCompare(b.date));

  // 4. 30d 對練 top 20
  const { data: sparringsRaw } = await sb
    .from("sparring_records")
    .select("user_email, score, scenario, created_at")
    .gte("created_at", monthAgo + "T00:00:00+08:00")
    .order("score", { ascending: false })
    .limit(50);

  const brandUserSet = new Set((employees || []).map((u: any) => u.email));
  const sparrings = (sparringsRaw || [])
    .filter((s) => brandUserSet.has(s.user_email))
    .slice(0, 20)
    .map((s: any) => ({
      user_email: s.user_email,
      score: s.score,
      scenario: s.scenario || "—",
      created_at: s.created_at,
    }));

  // 5. 員工分群(從人類視角:看到要立刻知道哪批人需要關注)
  //   領跑者:revenue ≥ top 30%
  //   中堅:30%~70%
  //   落後:bottom 30%(且 active_days ≥ 3 才算)
  //   隱形:active_days < 3(本週幾乎沒打卡)
  const sortedByRev = [...employeesEnriched].sort((a: any, b: any) => b.week_revenue - a.week_revenue);
  const totalEmp = sortedByRev.length;
  const top30 = Math.max(1, Math.ceil(totalEmp * 0.3));
  const bottom30 = Math.max(1, Math.ceil(totalEmp * 0.3));
  const groups = {
    leaders: sortedByRev.slice(0, top30).filter((e: any) => e.active_days_7d >= 3),
    middle: sortedByRev.slice(top30, totalEmp - bottom30).filter((e: any) => e.active_days_7d >= 3),
    laggers: sortedByRev.slice(totalEmp - bottom30).filter((e: any) => e.active_days_7d >= 3),
    invisible: sortedByRev.filter((e: any) => e.active_days_7d < 3),
  };

  // 6. 該關注的人(自動偵測)
  //   - 量多質差:calls ≥ 210 但 closes = 0
  //   - 邀約墜崖:appts > 0 但 close 比例 < 5%
  //   - 突然消失:active_days_7d ≤ 1(週初打過後沒再打)
  //   - top performer 連續沒打卡:exclude
  const concerns: Array<{ email: string; name: string; reason: string; severity: "critical" | "warning" }> = [];
  for (const e of employeesEnriched as any[]) {
    if (e.active_days_7d <= 1 && e.week_calls > 0) {
      concerns.push({ email: e.email, name: e.name, reason: `本週只打 ${e.active_days_7d} 天卡 (${e.week_calls} 通) — 突然消失?`, severity: "critical" });
    } else if (e.week_calls >= 210 && e.week_closes === 0) {
      concerns.push({ email: e.email, name: e.name, reason: `${e.week_calls} 通 0 成交 — 量到質沒到`, severity: "warning" });
    } else if (e.week_appts > 5 && e.week_closes === 0) {
      concerns.push({ email: e.email, name: e.name, reason: `${e.week_appts} 邀約 0 成交 — 收網問題`, severity: "warning" });
    }
  }
  // dedup
  const seen = new Set();
  const concernsDedup = concerns.filter((c) => seen.has(c.email) ? false : seen.add(c.email));

  // 7. brand-level diagnosis
  const totalCallsBrand = employeesEnriched.reduce((s, e: any) => s + e.week_calls, 0);
  const totalRevBrand = employeesEnriched.reduce((s, e: any) => s + e.week_revenue, 0);
  const avgCallsPerEmp = totalEmp > 0 ? Math.round(totalCallsBrand / totalEmp) : 0;
  let diagnosis = "";
  if (totalEmp === 0) diagnosis = "🚫 此 brand 沒任何在線業務員";
  else if (groups.invisible.length / totalEmp > 0.3) diagnosis = `⚠️ ${Math.round((groups.invisible.length / totalEmp) * 100)}% 員工本週未活躍 — 需點名`;
  else if (concernsDedup.length / totalEmp > 0.3) diagnosis = `🟠 ${concernsDedup.length} 位需特別關注(占 ${Math.round((concernsDedup.length / totalEmp) * 100)}%)`;
  else if (avgCallsPerEmp < 100) diagnosis = `📞 平均每人本週 ${avgCallsPerEmp} 通 — 量還沒到 baseline`;
  else if (groups.leaders.length > 0) diagnosis = `✅ 領跑者 ${groups.leaders.length} 位(${groups.leaders[0].name}領頭) · 平均 ${avgCallsPerEmp} 通/人`;
  else diagnosis = `📊 整體運作中(${avgCallsPerEmp} 通/人均)`;

  return NextResponse.json({
    ok: true,
    brand,
    employees: employeesEnriched,
    trend,
    sparrings,
    groups: {
      leaders: groups.leaders.map((e: any) => ({ email: e.email, name: e.name, week_revenue: e.week_revenue, week_calls: e.week_calls })),
      middle_count: groups.middle.length,
      laggers: groups.laggers.map((e: any) => ({ email: e.email, name: e.name, week_revenue: e.week_revenue, week_calls: e.week_calls, active_days_7d: e.active_days_7d })),
      invisible: groups.invisible.map((e: any) => ({ email: e.email, name: e.name, active_days_7d: e.active_days_7d })),
    },
    concerns: concernsDedup,
    diagnosis,
    summary: {
      employee_count: totalEmp,
      week_total_revenue: totalRevBrand,
      week_total_calls: totalCallsBrand,
      avg_calls_per_employee: avgCallsPerEmp,
      sparring_count_30d: sparrings.length,
      leaders_count: groups.leaders.length,
      laggers_count: groups.laggers.length,
      invisible_count: groups.invisible.length,
    },
  });
}
