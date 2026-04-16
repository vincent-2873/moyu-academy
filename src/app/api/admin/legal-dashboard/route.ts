import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * GET /api/admin/legal-dashboard
 * 法務主管後台：整體案件狀況
 *
 * 回：
 *   stats: 全部/進行中/已結案 + 按品牌 + 按類型 + 逾期/本週到期
 *   recent_events: 最近時間軸
 *   owner_load: 承辦人負荷
 *   aging: 案件存續時長分佈
 *   top_overdue: 最嚴重逾期前 10 筆
 *   deadline_heat: 未來 30 天的到期熱力圖
 */

export async function GET(_req: NextRequest) {
  const supabase = getSupabaseAdmin();

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [casesR, eventsR] = await Promise.all([
    supabase.from("legal_cases").select("*"),
    supabase.from("legal_case_events").select("*").order("event_date", { ascending: false }).limit(50),
  ]);

  const all = casesR.data || [];
  const open = all.filter((c) => c.status === "open");
  const closed = all.filter((c) => c.status === "closed");

  // 按類型
  const byKind: Record<string, number> = {};
  for (const c of open) byKind[c.kind] = (byKind[c.kind] || 0) + 1;

  // 按品牌
  const byBrand: Record<string, number> = {};
  for (const c of open) if (c.brand_code) byBrand[c.brand_code] = (byBrand[c.brand_code] || 0) + 1;

  // 逾期 / 本週到期
  const overdue = open.filter((c) => c.response_deadline && c.response_deadline < today);
  const dueWeek = open.filter((c) => c.response_deadline && c.response_deadline >= today && c.response_deadline <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));

  // 承辦人負荷
  const byOwner: Record<string, { open: number; overdue: number }> = {};
  for (const c of open) {
    const o = c.owner_email || "(未指派)";
    if (!byOwner[o]) byOwner[o] = { open: 0, overdue: 0 };
    byOwner[o].open++;
    if (c.response_deadline && c.response_deadline < today) byOwner[o].overdue++;
  }
  const ownerLoad = Object.entries(byOwner).map(([email, v]) => ({ email, ...v })).sort((a, b) => b.overdue - a.overdue || b.open - a.open);

  // Aging：距今 7/30/60/90 天
  const aging = { d0_7: 0, d8_30: 0, d31_60: 0, d61_90: 0, d91plus: 0 };
  for (const c of open) {
    const days = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
    if (days <= 7) aging.d0_7++;
    else if (days <= 30) aging.d8_30++;
    else if (days <= 60) aging.d31_60++;
    else if (days <= 90) aging.d61_90++;
    else aging.d91plus++;
  }

  // Top 逾期
  const topOverdue = overdue
    .sort((a, b) => (a.response_deadline < b.response_deadline ? -1 : 1))
    .slice(0, 10)
    .map((c) => ({
      id: c.id, title: c.title, case_no: c.case_no_internal,
      owner: c.owner_email, deadline: c.response_deadline,
      days_overdue: Math.floor((Date.now() - new Date(c.response_deadline!).getTime()) / 86400000),
    }));

  // 未來 30 天熱力圖
  const heat: Record<string, number> = {};
  for (const c of open) {
    if (c.response_deadline && c.response_deadline >= today && c.response_deadline <= in30) {
      heat[c.response_deadline] = (heat[c.response_deadline] || 0) + 1;
    }
  }

  return Response.json({
    ok: true,
    stats: {
      total: all.length,
      open: open.length,
      closed: closed.length,
      overdue: overdue.length,
      due_week: dueWeek.length,
      by_kind: byKind,
      by_brand: byBrand,
    },
    owner_load: ownerLoad,
    aging,
    top_overdue: topOverdue,
    deadline_heat: heat,
    recent_events: eventsR.data || [],
  });
}
