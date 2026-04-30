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

  // 1. 我自己過去 7d 的 sales metrics(過濾 is_monthly_rollup 防 sum 翻倍)
  const myMetrics = await fetchAllRows<{ calls: number; raw_appointments: number; closures: number; net_revenue_daily: number }>(() =>
    sb.from("sales_metrics_daily")
      .select("calls, raw_appointments, closures, net_revenue_daily")
      .eq("email", email)
      .gte("date", weekAgo)
      .not("is_monthly_rollup", "is", true)
  );
  const myCalls = myMetrics.reduce((s, r) => s + Number(r.calls || 0), 0);
  const myAppts = myMetrics.reduce((s, r) => s + Number(r.raw_appointments || 0), 0);
  const myCloses = myMetrics.reduce((s, r) => s + Number(r.closures || 0), 0);
  const myRevenue = myMetrics.reduce((s, r) => s + Number(r.net_revenue_daily || 0), 0);

  // 2. 同 brand 員工 7d ranking — 過濾 is_monthly_rollup
  const brandMetrics = await fetchAllRows<{ email: string; name: string; calls: number; raw_appointments: number; closures: number; net_revenue_daily: number; brand: string }>(() => {
    let q = sb.from("sales_metrics_daily")
      .select("email, name, calls, raw_appointments, closures, net_revenue_daily, brand")
      .gte("date", weekAgo)
      .not("is_monthly_rollup", "is", true);
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

  // 5. 雷達 normalize — 改用「絕對 baseline + 相對 top」混合算
  //   baseline = KPI 期望水準(每軸 hard-coded 合理門檻);超過 baseline 算 70+
  //   top = peer 第一名;達 top 算 100
  //   公式:0~baseline 線性 0→70,baseline~top 線性 70→100
  function radarScore(my: number, baseline: number, peerTop: number): number {
    if (my <= 0) return 0;
    if (my >= peerTop && peerTop > 0) return 100;
    if (my <= baseline) return Math.round((my / baseline) * 70);
    // baseline < my < top
    const range = Math.max(1, peerTop - baseline);
    return Math.min(100, 70 + Math.round(((my - baseline) / range) * 30));
  }

  // baseline:7 天該到的最低水準
  //   calls 7 天 = 30 通/日 × 7 = 210
  //   appts 7 天 = 5/日 × 7 = 35
  //   closures 7 天 = 1/日 × 7 = 7
  //   sparring = 60 分及格
  //   knowledge = 5 次 RAG retrieval 起步
  const radar = {
    knowledge: radarScore(ragUsageCount, 5, 25),
    sparring: radarScore(mySparringAvg, 60, 90),
    calls: radarScore(myCalls, 210, top?.calls || 350),
    appts: radarScore(myAppts, 35, top?.appts || 60),
    closures: radarScore(myCloses, 7, top?.closes || 15),
  };

  // 6. percentile rank
  const myPercentile = peerCount > 0 ? Math.round(((peerCount - myRank + 1) / peerCount) * 100) : 0;

  // 7. weakness 分析(< 50 算弱),按弱度排
  const radarLabels = { knowledge: "知識使用", sparring: "對練表現", calls: "撥打量", appts: "邀約", closures: "成交" };
  const weaknesses = (Object.entries(radar) as [keyof typeof radar, number][])
    .filter(([_, v]) => v < 50)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([k, v]) => ({ axis: k, label: radarLabels[k], score: v }));

  const strengths = (Object.entries(radar) as [keyof typeof radar, number][])
    .filter(([_, v]) => v >= 70)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => ({ axis: k, label: radarLabels[k], score: v }));

  // 8. action items based on weakness
  const ACTION_HINTS: Record<string, string> = {
    knowledge: "問戰情官至少 5 個實際遇到的問題,每天 1 個 → 每週 ≥ 5 次",
    sparring: "本週至少 3 場對練(/learn → 對練),目標 score ≥ 70",
    calls: "每日 30 通底線,週末補上;低於 210/週直接看通話品質而非量",
    appts: "邀約轉換率 < 17% → 練 8 步框架第 3-5 步『動機詢問』 + 練『致命提問黃金三句』",
    closures: "成交少 → 看『定價分期』段(EP4)+ 對練模擬『太貴』異議處理",
  };
  const actionItems = weaknesses.map((w) => ({
    axis: w.axis,
    label: w.label,
    score: w.score,
    severity: w.score < 30 ? "critical" : w.score < 50 ? "warning" : "info",
    hint: ACTION_HINTS[w.axis] || "—",
  }));

  // 9. diagnosis 一句話(從人類視角)
  let diagnosis = "";
  if (weaknesses.length === 0 && strengths.length >= 3) {
    diagnosis = `🌟 全面均衡發展(percentile ${myPercentile}%)— 不要鬆懈,把已有的轉成穩定產出`;
  } else if (myPercentile >= 80) {
    diagnosis = `🥇 brand 內 top ${100 - myPercentile + 1}%,持續穩定 + 找『最弱那 1 軸』突破 = 上一階`;
  } else if (myPercentile >= 50) {
    diagnosis = `📊 中位以上(percentile ${myPercentile}%),距 top 1 差 NT$ ${(top?.revenue ? top.revenue - myRevenue : 0).toLocaleString()} — 補弱項就追得上`;
  } else if (myPercentile >= 20) {
    diagnosis = `⚠️ percentile ${myPercentile}% — 先把『${weaknesses[0]?.label || "弱項"}』練到 ≥ 50 是關鍵`;
  } else {
    diagnosis = `🔴 ${100 - myPercentile + 1}% 後段 — 量不夠,先把通話量補到 baseline 再看品質`;
  }

  return NextResponse.json({
    ok: true,
    me: {
      email: user.email, name: user.name, brand: user.brand, role: user.role,
    },
    radar,
    diagnosis,                    // 一句話人話
    weaknesses,                   // < 50 軸排
    strengths,                    // ≥ 70 軸排
    action_items: actionItems,    // 每弱項 1 個具體建議
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
