import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRANDS = ["nschool", "xuemi", "ooschool", "aischool", "moyuhunt", "hq"];
const BRAND_LABELS: Record<string, string> = {
  nschool: "nSchool 財經",
  xuemi: "XUEMI 學米",
  ooschool: "OOschool 無限",
  aischool: "AIschool 智能",
  moyuhunt: "墨宇獵頭",
  hq: "墨宇總部",
};

// 集團總覽:6 品牌橫向比 + 跨品牌人才流動 + 現金流瀑布
export async function GET() {
  const sb = getSupabaseAdmin();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  // 各品牌本月營收 + closures
  const { data: thisMonth } = await sb
    .from("sales_metrics_daily")
    .select("brand, net_revenue_daily, closures, raw_appointments, calls")
    .gte("date", monthStart);

  const { data: lastMonth } = await sb
    .from("sales_metrics_daily")
    .select("brand, net_revenue_daily")
    .gte("date", lastMonthStart)
    .lte("date", lastMonthEnd);

  // 各品牌 user 計數
  const { data: usersByBrand } = await sb
    .from("users")
    .select("brand, is_active");

  const brands = BRANDS.map((b) => {
    const thisMo = (thisMonth || []).filter((r: any) => r.brand === b);
    const lastMo = (lastMonth || []).filter((r: any) => r.brand === b);
    const revenue = thisMo.reduce((s, r: any) => s + Number(r.net_revenue_daily || 0), 0);
    const lastRev = lastMo.reduce((s, r: any) => s + Number(r.net_revenue_daily || 0), 0);
    const closures = thisMo.reduce((s, r: any) => s + Number(r.closures || 0), 0);
    const calls = thisMo.reduce((s, r: any) => s + Number(r.calls || 0), 0);
    const appts = thisMo.reduce((s, r: any) => s + Number(r.raw_appointments || 0), 0);
    const userTotal = (usersByBrand || []).filter((u: any) => u.brand === b).length;
    const userActive = (usersByBrand || []).filter((u: any) => u.brand === b && u.is_active).length;
    const yoy = lastRev > 0 ? Math.round(((revenue - lastRev) / lastRev) * 100) : 0;
    return {
      id: b,
      label: BRAND_LABELS[b] || b,
      revenue,
      revenue_last_month: lastRev,
      yoy_pct: yoy,
      closures,
      calls,
      appointments: appts,
      users_total: userTotal,
      users_active: userActive,
      health: yoy >= 0 ? "healthy" : yoy >= -20 ? "warning" : "critical",
    };
  });

  const totalRev = brands.reduce((s, b) => s + b.revenue, 0);
  const totalUsers = brands.reduce((s, b) => s + b.users_active, 0);

  // 跨品牌人才流動 — 從 user_stage_history 撈 brand 變更
  const { data: stageHistory } = await sb
    .from("user_stage_history")
    .select("user_id, from_brand, to_brand, changed_at")
    .gte("changed_at", new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString())
    .not("from_brand", "is", null)
    .not("to_brand", "is", null);

  const flows: Record<string, number> = {};
  (stageHistory || []).forEach((h: any) => {
    if (h.from_brand && h.to_brand && h.from_brand !== h.to_brand) {
      const key = `${h.from_brand}→${h.to_brand}`;
      flows[key] = (flows[key] || 0) + 1;
    }
  });

  const talentFlows = Object.entries(flows).map(([k, v]) => ({ flow: k, count: v })).sort((a, b) => b.count - a.count).slice(0, 10);

  // 現金流瀑布(粗算)
  const monthlyBurn = 1_500_000;
  const cashflowWaterfall = [
    { label: "月初現金", value: 10_000_000, color: "var(--ink-deep)" },
    { label: "本月營收", value: totalRev, color: "var(--gold-thread)" },
    { label: "預估燒錢", value: -monthlyBurn, color: "var(--accent-red)" },
    { label: "月底現金", value: 10_000_000 + totalRev - monthlyBurn, color: "var(--ink-deep)" },
  ];

  return NextResponse.json({
    ok: true,
    generated_at: new Date().toISOString(),
    brands,
    totals: { revenue: totalRev, users_active: totalUsers },
    talent_flows: talentFlows,
    cashflow_waterfall: cashflowWaterfall,
  });
}
