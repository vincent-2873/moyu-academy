import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/claude-report?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * 讀取最新 claude_daily_narrative + 等待拍板的 decisions + 投資人最近質詢
 * 一次給 /admin/hub「Claude 報告書」頁面 + /board 投資人頁面共用
 *
 * 2026-05-03 修:接 TimeRangePicker 的 from/to,沒給就 default 本季迄今。
 * north_star.range_revenue / range_target / range_label 隨 picker 變。
 */

function todayTaipei(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function isValidYmd(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function rangeLabel(from: string, to: string): string {
  if (from === to) return `${from} 當日`;
  const fY = from.slice(0, 4), fM = parseInt(from.slice(5, 7), 10);
  const tY = to.slice(0, 4), tM = parseInt(to.slice(5, 7), 10);
  if (fY === tY && fM === tM) return `${fY}年${fM}月 ${from.slice(8)}-${to.slice(8)}`;
  if (fY === tY) return `${fY}年 ${fM}/${from.slice(8)}~${tM}/${to.slice(8)}`;
  return `${from} ~ ${to}`;
}

function daysBetween(from: string, to: string): number {
  const f = new Date(from + "T00:00:00Z").getTime();
  const t = new Date(to + "T00:00:00Z").getTime();
  return Math.round((t - f) / 86400000) + 1;
}

export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const today = todayTaipei();

  // 接 picker 的 from / to(沒給就 default 本季迄今)
  const sp = req.nextUrl.searchParams;
  const fromParam = sp.get("from");
  const toParam = sp.get("to");
  const quarterStart = (() => {
    const y = parseInt(today.slice(0, 4), 10);
    const m = parseInt(today.slice(5, 7), 10);
    const q1 = Math.floor((m - 1) / 3) * 3 + 1;
    return `${y}-${String(q1).padStart(2, "0")}-01`;
  })();
  const rangeFrom = isValidYmd(fromParam) ? fromParam : quarterStart;
  const rangeTo = isValidYmd(toParam) ? toParam : today;

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

  // 6) Live 北極星數字 — picker range 內動態計算
  const rangeRows = await fetchAllRows<{ closures: number; net_revenue_daily: number | null; date: string; name: string; }>(() =>
    sb.from("sales_metrics_daily")
      .select("closures, net_revenue_daily, date, name")
      .gte("date", rangeFrom)
      .lte("date", rangeTo)
      .not("email", "is", null)
  );
  const rangeReal = rangeRows.filter(r => !((r.name || "").startsWith("新訓-")));
  const rangeRevenue = rangeReal.reduce((s, r) => s + (Number(r.net_revenue_daily) || 0), 0);
  const rangeClosures = rangeReal.reduce((s, r) => s + (r.closures || 0), 0);

  // 同時保留本季 revenue(讓 progress_pct 永遠對標季目標,不誤導)
  const qRows = rangeFrom <= quarterStart ? rangeRows : await fetchAllRows<{ closures: number; net_revenue_daily: number | null; date: string; name: string; }>(() =>
    sb.from("sales_metrics_daily")
      .select("closures, net_revenue_daily, date, name")
      .gte("date", quarterStart)
      .lte("date", today)
      .not("email", "is", null)
  );
  const qReal = qRows.filter(r => !((r.name || "").startsWith("新訓-")));
  const qRevenue = qReal.reduce((s, r) => s + (Number(r.net_revenue_daily) || 0), 0);
  const qClosures = qReal.reduce((s, r) => s + (r.closures || 0), 0);
  const quarterTarget = narrative?.ns_revenue_target ?? 30000000;
  // 季目標 prorate 到 range(用天數比例),給「range vs range_target」做 pace 比較
  const quarterDays = (() => {
    const qY = parseInt(quarterStart.slice(0, 4), 10);
    const qM = parseInt(quarterStart.slice(5, 7), 10);
    const qEnd = new Date(qY, qM + 2, 0); // q month + 3, day 0 = last day of q3
    return Math.round((qEnd.getTime() - new Date(quarterStart).getTime()) / 86400000) + 1;
  })();
  const rangeDays = daysBetween(rangeFrom, rangeTo);
  const rangeTarget = Math.round((quarterTarget * rangeDays) / quarterDays);
  const rangeProgressPct = rangeTarget > 0 ? Math.round((rangeRevenue / rangeTarget) * 100) : 0;

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
    range: { from: rangeFrom, to: rangeTo, label: rangeLabel(rangeFrom, rangeTo), days: rangeDays },
    narrative,
    north_star: {
      // Range-scoped(picker 內)
      range_revenue: rangeRevenue,
      range_target: rangeTarget,
      range_closures: rangeClosures,
      range_progress_pct: rangeProgressPct,
      // Quarter-anchored(永遠對齊季目標,給投資人看 pace 用)
      quarter_revenue: qRevenue,
      quarter_target: quarterTarget,
      quarter_closures: qClosures,
      quarter_progress_pct: Math.round((qRevenue / quarterTarget) * 100),
      // Forecast / accuracy 從 narrative 帶過(每日產的)
      forecast: narrative?.ns_revenue_forecast ?? null,
      prediction_accuracy: narrative?.ns_prediction_accuracy ?? null,
      // 14 天 sparkline 不隨 picker 變(永遠 14 天)
      spark_14d: spark14d,
      // Backward compat:舊 hub page 還在讀 progress_pct
      progress_pct: rangeProgressPct,
    },
    pending_decisions: pendingDecisions ?? [],
    recent_worker_runs: workerLog ?? [],
    recent_inquiries: inquiries ?? [],
    prediction_history: predictions ?? [],
    has_today_narrative: !!narrative && narrative.date === today,
  });
}
