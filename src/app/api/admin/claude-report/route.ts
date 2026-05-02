import { NextResponse } from "next/server";
import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/claude-report
 *
 * 讀取最新 claude_daily_narrative + 等待拍板的 decisions + 投資人最近質詢
 * 一次給 /admin/hub「Claude 報告書」頁面 + /board 投資人頁面共用
 */

function todayTaipei(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function GET() {
  const sb = getSupabaseAdmin();
  const today = todayTaipei();

  // 1) 最新 narrative
  const { data: narrative } = await sb
    .from("claude_daily_narrative")
    .select("*")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 2) 等拍板 decisions (active)
  const { data: pendingDecisions } = await sb
    .from("decision_records")
    .select("id, category, title, context, claude_recommendation, urgency, due_date, evidence_refs, created_at")
    .eq("status", "pending")
    .order("urgency", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(5);

  // 3) Claude 自己處理的最近 worker runs
  const { data: workerLog } = await sb
    .from("system_run_log")
    .select("source, status, created_at, rows_in, rows_out")
    .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(10);

  // 4) 投資人質詢歷史
  const { data: inquiries } = await sb
    .from("board_inquiries")
    .select("id, asker_role, asker_email, question, claude_answer, asked_at, answered_at")
    .order("asked_at", { ascending: false })
    .limit(8);

  // 5) Claude 預測準度趨勢(最近 10 筆有 actual 的)
  const { data: predictions } = await sb
    .from("claude_predictions")
    .select("target_period, metric, predicted_value, actual_value, accuracy_pct, predicted_at")
    .not("actual_value", "is", null)
    .order("predicted_at", { ascending: false })
    .limit(10);

  // 6) Live 北極星數字(直接從 SMD 算,即時)
  const qStart = (() => {
    const y = parseInt(today.slice(0, 4), 10);
    const m = parseInt(today.slice(5, 7), 10);
    const q1 = Math.floor((m - 1) / 3) * 3 + 1;
    return `${y}-${String(q1).padStart(2, "0")}-01`;
  })();
  const qRows = await fetchAllRows<{ closures: number; net_revenue_daily: number | null; date: string; name: string; }>(() =>
    sb.from("sales_metrics_daily")
      .select("closures, net_revenue_daily, date, name")
      .gte("date", qStart)
      .not("email", "is", null)
  );
  const qReal = qRows.filter(r => !((r.name || "").startsWith("新訓-")));
  const qRevenue = qReal.reduce((s, r) => s + (Number(r.net_revenue_daily) || 0), 0);
  const qClosures = qReal.reduce((s, r) => s + (r.closures || 0), 0);

  // 7) 14 天營收 sparkline(每日 sum)
  const fourteenDaysAgo = (() => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 13);
    return d.toISOString().slice(0, 10);
  })();
  const sparkRows = await fetchAllRows<{ date: string; net_revenue_daily: number | null; name: string; }>(() =>
    sb.from("sales_metrics_daily")
      .select("date, net_revenue_daily, name")
      .gte("date", fourteenDaysAgo)
      .not("email", "is", null)
  );
  const sparkByDate: Record<string, number> = {};
  for (const r of sparkRows) {
    if ((r.name || "").startsWith("新訓-")) continue;
    const d = r.date;
    sparkByDate[d] = (sparkByDate[d] || 0) + (Number(r.net_revenue_daily) || 0);
  }
  const spark14d: Array<{ date: string; revenue: number }> = [];
  const cur = new Date(fourteenDaysAgo + "T00:00:00Z");
  const end = new Date(today + "T00:00:00Z");
  while (cur <= end) {
    const d = cur.toISOString().slice(0, 10);
    spark14d.push({ date: d, revenue: sparkByDate[d] || 0 });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return NextResponse.json({
    ok: true,
    today,
    narrative,
    north_star: {
      quarter_revenue: qRevenue,
      quarter_target: narrative?.ns_revenue_target ?? 30000000,
      quarter_closures: qClosures,
      forecast: narrative?.ns_revenue_forecast ?? null,
      progress_pct: Math.round((qRevenue / (narrative?.ns_revenue_target ?? 30000000)) * 100),
      prediction_accuracy: narrative?.ns_prediction_accuracy ?? null,
      spark_14d: spark14d,
    },
    pending_decisions: pendingDecisions ?? [],
    recent_worker_runs: workerLog ?? [],
    recent_inquiries: inquiries ?? [],
    prediction_history: predictions ?? [],
    has_today_narrative: !!narrative && narrative.date === today,
  });
}
