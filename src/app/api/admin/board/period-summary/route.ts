import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/board/period-summary?period=week|month|quarter
 *
 * Vincent 規格(2026-05-02):
 * - 週成績單:過去 7 天(包含 today)
 * - 月成績單:本月 1 號到 today
 * - 季成績單:當季第一天到 today
 * - 資料來源 sales_metrics_daily(Metabase Q1381 incremental sync)
 * - 排除「新訓-」前綴(這是訓練中的學員,Vincent 要看正式員工)— 改:**包含**新訓但分類顯示
 *   實際決定:本 endpoint 預設**包含**所有 row(讓 Vincent 看到全部),前端可篩
 */

function todayTaipei(): string {
  const tp = new Date(Date.now() + 8 * 3600 * 1000);
  return tp.toISOString().slice(0, 10);
}
function daysAgo(d: string, n: number): string {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() - n);
  return dt.toISOString().slice(0, 10);
}
function monthStart(d: string): string {
  return d.slice(0, 8) + "01";
}
function quarterStart(d: string): string {
  const y = parseInt(d.slice(0, 4), 10);
  const m = parseInt(d.slice(5, 7), 10);
  const q1 = Math.floor((m - 1) / 3) * 3 + 1;
  return `${y}-${String(q1).padStart(2, "0")}-01`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const period = (url.searchParams.get("period") || "week") as "week" | "month" | "quarter";
  const today = todayTaipei();
  let from: string;
  if (period === "week") from = daysAgo(today, 6);
  else if (period === "month") from = monthStart(today);
  else from = quarterStart(today);

  const sb = getSupabaseAdmin();
  const rows = await fetchAllRows<{
    date: string;
    email: string;
    name: string;
    brand: string | null;
    calls: number;
    connected: number;
    raw_appointments: number;
    appointments_show: number;
    closures: number;
    net_revenue_daily: number;
  }>(() =>
    sb.from("sales_metrics_daily")
      .select("date, email, name, brand, calls, connected, raw_appointments, appointments_show, closures, net_revenue_daily")
      .gte("date", from)
      .lte("date", today)
      .not("email", "is", null)
  );

  // totals (排除新訓-)
  const realRows = rows.filter(r => {
    const n = (r.name || "").trim();
    return !n.startsWith("新訓-") && !n.startsWith("新訓 ") && !n.startsWith("新訓:");
  });

  const totals = {
    calls: realRows.reduce((s, r) => s + (r.calls || 0), 0),
    connected: realRows.reduce((s, r) => s + (r.connected || 0), 0),
    appointments: realRows.reduce((s, r) => s + (r.appointments_show || 0), 0),
    closures: realRows.reduce((s, r) => s + (r.closures || 0), 0),
    revenue: realRows.reduce((s, r) => s + (Number(r.net_revenue_daily) || 0), 0),
    active_users: new Set(realRows.filter(r => (r.calls || 0) > 0).map(r => (r.email || "").toLowerCase())).size,
  };

  // by brand
  const brandMap = new Map<string, { calls: number; closures: number; revenue: number; people: Set<string> }>();
  for (const r of realRows) {
    const b = r.brand || "(無)";
    const m = brandMap.get(b) || { calls: 0, closures: 0, revenue: 0, people: new Set() };
    m.calls += r.calls || 0;
    m.closures += r.closures || 0;
    m.revenue += Number(r.net_revenue_daily) || 0;
    if (r.email) m.people.add(r.email.toLowerCase());
    brandMap.set(b, m);
  }
  const by_brand = Array.from(brandMap.entries())
    .map(([brand, m]) => ({ brand, calls: m.calls, closures: m.closures, revenue: m.revenue, people: m.people.size }))
    .sort((a, b) => b.revenue - a.revenue || b.closures - a.closures);

  // top performers (by revenue)
  const personMap = new Map<string, { name: string; brand: string; calls: number; closures: number; revenue: number }>();
  for (const r of realRows) {
    const k = (r.email || "").toLowerCase();
    if (!k) continue;
    const e = personMap.get(k) || { name: r.name || k, brand: r.brand || "—", calls: 0, closures: 0, revenue: 0 };
    e.calls += r.calls || 0;
    e.closures += r.closures || 0;
    e.revenue += Number(r.net_revenue_daily) || 0;
    personMap.set(k, e);
  }
  const top_performers = Array.from(personMap.values())
    .sort((a, b) => b.revenue - a.revenue || b.closures - a.closures)
    .slice(0, 5);

  // highlights / warnings (Claude-style 觀察,本 endpoint 自己生)
  const highlights: string[] = [];
  const warnings: string[] = [];

  if (top_performers[0]) {
    const p = top_performers[0];
    if (p.revenue > 0) highlights.push(`${p.name}(${p.brand})本期成交 ${p.closures} 筆 / 營收 NT$ ${Math.round(p.revenue / 10000)} 萬,Top 1`);
  }
  const topBrand = by_brand[0];
  if (topBrand && topBrand.revenue > 0) {
    highlights.push(`${topBrand.brand} 品牌領先,${topBrand.people} 位業務貢獻 NT$ ${Math.round(topBrand.revenue / 10000)} 萬`);
  }
  // 沒打的人
  const totalReps = new Set(realRows.map(r => (r.email || "").toLowerCase())).size;
  const silentReps = totalReps - totals.active_users;
  if (totalReps > 0 && silentReps / totalReps > 0.3) {
    warnings.push(`${silentReps}/${totalReps} 位業務本期 0 通(${Math.round((silentReps / totalReps) * 100)}%)`);
  }
  // 量多無成交
  const struggling = Array.from(personMap.values()).filter(p => p.calls > 100 && p.closures === 0);
  if (struggling.length > 0) {
    warnings.push(`${struggling.length} 位業務撥打 100+ 通但 0 成交(收尾節奏要修)`);
  }
  if (totals.calls > 0 && totals.connected / totals.calls < 0.4) {
    warnings.push(`接通率僅 ${Math.round((totals.connected / totals.calls) * 100)}% — 名單品質或撥打時段要看`);
  }

  return NextResponse.json({
    ok: true,
    period,
    range: { from, to: today },
    totals,
    by_brand,
    top_performers,
    highlights,
    warnings,
    rows_scanned: rows.length,
    real_rows: realRows.length,
    xunlian_rows: rows.length - realRows.length,
  });
}
