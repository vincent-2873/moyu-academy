import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { taipeiDaysAgo } from "@/lib/time";

/**
 * 2026-04-30 末段 G2+G3:個人 insights
 *
 * GET /api/me/insights?email=xxx
 *
 * 回:
 *   - radar: 5 軸能力指標(0-100 normalized)
 *     - knowledge: 個人 RAG retrieval 使用次數
 *     - sparring: 對練平均分
 *     - calls: 7 天總撥打 / brand 平均
 *     - appts: 7 天總邀約 / brand 平均
 *     - closures: 7 天成交 / brand 平均
 *   - peer_compare: 同 brand 員工 7d net_revenue ranking + 你的位置
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const weekAgo = taipeiDaysAgo(7);

  const { data: user } = await sb
    .from("users")
    .select("id, email, name, brand, role, stage_path")
    .eq("email", email)
    .maybeSingle();
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  // 1. 我自己過去 7d 的 sales metrics
  const myMetrics = await fetchAllRows<{ calls: number; raw_appointments: number; closures: number; net_revenue_daily: number }>(() =>
    sb.from("sales_metrics_daily")
      .select("calls, raw_appointments, closures, net_revenue_daily")
      .eq("email", email)
      .gte("date", weekAgo)
  );
  const myCalls = myMetrics.reduce((s, r) => s + Number(r.calls || 0), 0);
  const myAppts = myMetrics.reduce((s, r) => s + Number(r.raw_appointments || 0), 0);
  const myCloses = myMetrics.reduce((s, r) => s + Number(r.closures || 0), 0);
  const myRevenue = myMetrics.reduce((s, r) => s + Number(r.net_revenue_daily || 0), 0);

  // 2. 同 brand 員工 7d ranking
  const brandMetrics = await fetchAllRows<{ email: string; name: string; calls: number; raw_appointments: number; closures: number; net_revenue_daily: number; brand: string }>(() => {
    let q = sb.from("sales_metrics_daily")
      .select("email, name, calls, raw_appointments, closures, net_revenue_daily, brand")
      .gte("date", weekAgo);
    if (user.brand) q = q.eq("brand", user.brand);
    return q;
  });

  const peerMap: Record<string, { email: string; name: string; calls: number; appts: number; closes: number; revenue: number }> = {};
  for (const r of brandMetrics) {
    const k = r.email;
    if (!k) continue;
    if (!peerMap[k]) peerMap[k] = { email: k, name: r.name || k, calls: 0, appts: 0, closes: 0, revenue: 0 };
    peerMap[k].calls += Number(r.calls || 0);
    peerMap[k].appts += Number(r.raw_appointments || 0);
    peerMap[k].closes += Number(r.closures || 0);
    peerMap[k].revenue += Number(r.net_revenue_daily || 0);
  }
  const peers = Object.values(peerMap).sort((a, b) => b.revenue - a.revenue);
  const myRank = peers.findIndex((p) => p.email === email) + 1;
  const peerCount = peers.length;
  const top = peers[0];
  const median = peers[Math.floor(peerCount / 2)];

  // 3. 我的對練分數(過去 30 天平均)
  const monthAgo = taipeiDaysAgo(30);
  const { data: sparrings } = await sb
    .from("sparring_records")
    .select("score, scores")
    .eq("user_email", email)
    .gte("created_at", monthAgo + "T00:00:00+08:00")
    .limit(50);
  const mySparringAvg = sparrings && sparrings.length > 0
    ? sparrings.reduce((s, r) => s + Number(r.score || 0), 0) / sparrings.length
    : 0;

  // 4. 我用過的 RAG retrieval 次數(過去 30 天)
  const { data: convo } = await sb
    .from("claude_conversations")
    .select("context_sources")
    .eq("user_id", user.id)
    .gte("created_at", monthAgo + "T00:00:00+08:00")
    .limit(500);
  const ragUsageCount = (convo || []).reduce((s, r: any) =>
    s + ((r.context_sources && Array.isArray(r.context_sources)) ? r.context_sources.length : 0),
    0
  );

  // 5. 雷達 normalize(my / peer top × 100,cap 100)
  function norm(my: number, peerTop: number): number {
    if (peerTop <= 0) return my > 0 ? 100 : 0;
    return Math.min(100, Math.round((my / peerTop) * 100));
  }
  const radar = {
    knowledge: Math.min(100, ragUsageCount * 5),    // 0-20 次 = 100
    sparring: Math.min(100, Math.round(mySparringAvg)),
    calls: norm(myCalls, top?.calls || 1),
    appts: norm(myAppts, top?.appts || 1),
    closures: norm(myCloses, top?.closes || 1),
  };

  // 6. percentile rank
  const myPercentile = peerCount > 0 ? Math.round(((peerCount - myRank + 1) / peerCount) * 100) : 0;

  return NextResponse.json({
    ok: true,
    me: {
      email: user.email, name: user.name, brand: user.brand, role: user.role,
    },
    radar,
    seven_day: {
      calls: myCalls, appts: myAppts, closures: myCloses, revenue: myRevenue,
    },
    sparring_30d_avg: Math.round(mySparringAvg),
    rag_usage_30d: ragUsageCount,
    peer_compare: {
      my_rank: myRank,
      peer_count: peerCount,
      percentile: myPercentile,
      top: top ? { name: top.name, revenue: top.revenue, calls: top.calls, closes: top.closes } : null,
      median: median ? { revenue: median.revenue, calls: median.calls } : null,
      gap_to_top_revenue: top ? Math.max(0, top.revenue - myRevenue) : 0,
      gap_to_median_revenue: median ? Math.max(0, median.revenue - myRevenue) : 0,
    },
    leaderboard: peers.slice(0, 10).map((p, i) => ({
      rank: i + 1,
      name: p.name,
      email: p.email === email ? email : "*****",   // 只顯示我自己的 email,別人 mask
      is_me: p.email === email,
      revenue: p.revenue,
      calls: p.calls,
      closes: p.closes,
    })),
  });
}
