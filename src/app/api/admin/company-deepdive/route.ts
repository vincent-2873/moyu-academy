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

  return NextResponse.json({
    ok: true,
    brand,
    employees: employeesEnriched,
    trend,
    sparrings,
    summary: {
      employee_count: employeesEnriched.length,
      week_total_revenue: employeesEnriched.reduce((s, e: any) => s + e.week_revenue, 0),
      week_total_calls: employeesEnriched.reduce((s, e: any) => s + e.week_calls, 0),
      sparring_count_30d: sparrings.length,
    },
  });
}
