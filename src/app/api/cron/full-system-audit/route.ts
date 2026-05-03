/**
 * Full System Audit — Vincent 2026-05-03 拍板「全面檢查 + 自動修正」
 *
 * 用法:
 *   POST /api/cron/full-system-audit
 *   Headers: Authorization: Bearer ${CRON_SECRET}
 *   Body: { lookback_days?: number }   (default: 90)
 *
 * 檢查面向:
 *   1. SMD 日期 coverage(過去 N 天每天有幾 row,找出 0 row 的日期 = 缺料)
 *   2. system_run_log 過去 7 天:每個 source 的 ok / fail / 失敗率
 *   3. metabase_sync_log 過去 7 天:Q1381 同步狀態
 *   4. claude_predictions:已預測 vs 已 fill actual,過期未 fill 的數量
 *   5. decision_records:pending 的數量,timeline
 *   6. knowledge_chunks:embedding 完成度
 *   7. (no auto-fix — 純 diagnostic,Vincent 看完決定動什麼)
 *
 * 回傳:
 *   { ok, summary, smd_coverage, cron_health, metabase_health, predictions, decisions, knowledge }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface SmdDayCoverage {
  date: string;
  rows: number;
  total_calls: number;
  total_closures: number;
  total_revenue: number;
}

function dayDiffStr(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { lookback_days?: number };
  try { body = await req.json(); } catch { body = {}; }
  const lookbackDays = body.lookback_days ?? 90;
  const fromDate = dayDiffStr(lookbackDays);
  const toDate = dayDiffStr(0);

  const sb = getSupabaseAdmin();
  const startedAt = Date.now();

  // ───────── 1. SMD date coverage ─────────
  const smdRows = await fetchAllRows<{
    date: string;
    calls: number;
    closures: number;
    net_revenue_daily: number;
  }>(() =>
    sb.from("sales_metrics_daily")
      .select("date, calls, closures, net_revenue_daily")
      .gte("date", fromDate)
      .lte("date", toDate)
  );

  const smdByDate = new Map<string, SmdDayCoverage>();
  for (const r of smdRows) {
    const d = r.date;
    if (!smdByDate.has(d)) {
      smdByDate.set(d, { date: d, rows: 0, total_calls: 0, total_closures: 0, total_revenue: 0 });
    }
    const agg = smdByDate.get(d)!;
    agg.rows += 1;
    agg.total_calls += Number(r.calls || 0);
    agg.total_closures += Number(r.closures || 0);
    agg.total_revenue += Number(r.net_revenue_daily || 0);
  }

  // 列出所有預期日期(過去 N 天)
  const expectedDates: string[] = [];
  for (let i = lookbackDays; i >= 0; i--) {
    expectedDates.push(dayDiffStr(i));
  }

  // 找出 0 row 的日期 + 含 row 數低於 5 的日期(可能漏抓)
  const missingDates: string[] = [];
  const sparseDates: { date: string; rows: number }[] = [];
  for (const d of expectedDates) {
    const c = smdByDate.get(d);
    if (!c || c.rows === 0) {
      missingDates.push(d);
    } else if (c.rows < 5) {
      sparseDates.push({ date: d, rows: c.rows });
    }
  }

  // 排除週日(Metabase 週日不一定有資料)
  const missingDatesNonSunday = missingDates.filter((d) => {
    const day = new Date(d + "T00:00:00Z").getUTCDay();
    return day !== 0; // 0 = Sunday(UTC),台北 Sunday 也接近
  });

  // ───────── 2. system_run_log past 7 days ─────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const runLogs = await fetchAllRows<{
    source: string;
    status: string;
    created_at: string;
    error_message: string | null;
  }>(() =>
    sb.from("system_run_log")
      .select("source, status, created_at, error_message")
      .gte("created_at", sevenDaysAgo)
  );

  const cronHealth: Record<string, { runs: number; ok: number; fail: number; partial: number; noop: number; last_run_at: string; last_error: string | null }> = {};
  for (const r of runLogs) {
    if (!cronHealth[r.source]) {
      cronHealth[r.source] = { runs: 0, ok: 0, fail: 0, partial: 0, noop: 0, last_run_at: r.created_at, last_error: null };
    }
    const h = cronHealth[r.source];
    h.runs += 1;
    if (r.status === "ok") h.ok += 1;
    else if (r.status === "fail") {
      h.fail += 1;
      if (!h.last_error) h.last_error = r.error_message;
    }
    else if (r.status === "partial") h.partial += 1;
    else if (r.status === "noop") h.noop += 1;
    if (r.created_at > h.last_run_at) h.last_run_at = r.created_at;
  }

  const failingSources = Object.entries(cronHealth)
    .filter(([_, h]) => h.fail > 0 && h.fail / h.runs > 0.3)
    .map(([source, h]) => ({ source, fail_rate_pct: Math.round((h.fail / h.runs) * 100), runs: h.runs, last_error: h.last_error }));

  // ───────── 3. metabase_sync_log past 7 days ─────────
  const metabaseSyncLogs = await fetchAllRows<{
    brand: string;
    status: string;
    rows: number;
    error: string | null;
    run_at: string;
  }>(() =>
    sb.from("metabase_sync_log")
      .select("brand, status, rows, error, run_at")
      .gte("run_at", sevenDaysAgo)
  );

  const metabaseHealth: Record<string, { runs: number; success: number; failed: number; partial: number; total_rows: number; last_run: string }> = {};
  for (const r of metabaseSyncLogs) {
    const k = r.brand || "unknown";
    if (!metabaseHealth[k]) {
      metabaseHealth[k] = { runs: 0, success: 0, failed: 0, partial: 0, total_rows: 0, last_run: r.run_at };
    }
    const h = metabaseHealth[k];
    h.runs += 1;
    if (r.status === "success") h.success += 1;
    else if (r.status === "failed") h.failed += 1;
    else if (r.status === "partial") h.partial += 1;
    h.total_rows += Number(r.rows || 0);
    if (r.run_at > h.last_run) h.last_run = r.run_at;
  }

  // ───────── 4. claude_predictions ─────────
  const { count: predTotal } = await sb.from("claude_predictions").select("id", { count: "exact", head: true });
  const { count: predFilled } = await sb.from("claude_predictions").select("id", { count: "exact", head: true }).not("actual_value", "is", null);
  const predPending = (predTotal || 0) - (predFilled || 0);

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: oldPending } = await sb
    .from("claude_predictions")
    .select("target_period, metric, predicted_at")
    .is("actual_value", null)
    .lt("predicted_at", fourteenDaysAgo)
    .limit(20);

  // ───────── 5. decision_records ─────────
  const { count: decTotal } = await sb.from("decision_records").select("id", { count: "exact", head: true });
  const { count: decPending } = await sb.from("decision_records").select("id", { count: "exact", head: true }).eq("status", "pending");
  const { count: decApproved } = await sb.from("decision_records").select("id", { count: "exact", head: true }).eq("status", "approved");
  const { count: decRejected } = await sb.from("decision_records").select("id", { count: "exact", head: true }).eq("status", "rejected");

  // ───────── 6. knowledge_chunks ─────────
  const { count: kcTotal } = await sb.from("knowledge_chunks").select("id", { count: "exact", head: true });
  const { count: kcWithEmb } = await sb.from("knowledge_chunks").select("id", { count: "exact", head: true }).not("embedding", "is", null);
  const kcPending = (kcTotal || 0) - (kcWithEmb || 0);

  // ───────── Diagnoses ─────────
  const issues: string[] = [];
  if (missingDatesNonSunday.length > 0) {
    issues.push(`SMD 過去 ${lookbackDays} 天缺 ${missingDatesNonSunday.length} 個非週日日期 → 需 backfill`);
  }
  if (sparseDates.length > 0) {
    issues.push(`SMD 有 ${sparseDates.length} 個日期 row < 5 → 可能漏抓`);
  }
  if (failingSources.length > 0) {
    issues.push(`${failingSources.length} 個 cron source 失敗率 > 30%`);
  }
  if ((predPending || 0) > 0 && (oldPending?.length || 0) > 0) {
    issues.push(`${oldPending?.length} 個 prediction 超過 14 天還沒 fill actual`);
  }
  if (kcPending > 100) {
    issues.push(`${kcPending} 個 knowledge chunks 還沒生 embedding`);
  }

  return NextResponse.json({
    ok: issues.length === 0,
    range: { from: fromDate, to: toDate, lookback_days: lookbackDays },
    issues,
    summary: {
      smd_dates_with_data: smdByDate.size,
      smd_dates_expected: expectedDates.length,
      smd_dates_missing: missingDates.length,
      smd_dates_missing_non_sunday: missingDatesNonSunday.length,
      smd_dates_sparse: sparseDates.length,
      cron_sources_tracked: Object.keys(cronHealth).length,
      cron_failing_sources: failingSources.length,
      metabase_brands_synced: Object.keys(metabaseHealth).length,
      predictions_total: predTotal || 0,
      predictions_filled: predFilled || 0,
      predictions_pending: predPending,
      predictions_old_pending: oldPending?.length || 0,
      decisions_total: decTotal || 0,
      decisions_pending: decPending || 0,
      decisions_approved: decApproved || 0,
      decisions_rejected: decRejected || 0,
      knowledge_chunks_total: kcTotal || 0,
      knowledge_chunks_with_embedding: kcWithEmb || 0,
      knowledge_chunks_pending_embedding: kcPending,
    },
    smd_coverage: {
      missing_dates_non_sunday: missingDatesNonSunday,
      missing_dates_all: missingDates.slice(0, 50),  // cap
      sparse_dates: sparseDates.slice(0, 30),
    },
    cron_health: {
      failing: failingSources,
      all: cronHealth,
    },
    metabase_health: metabaseHealth,
    predictions: {
      total: predTotal || 0,
      filled: predFilled || 0,
      pending: predPending,
      old_pending_sample: oldPending?.slice(0, 10) || [],
    },
    decisions: {
      total: decTotal || 0,
      pending: decPending || 0,
      approved: decApproved || 0,
      rejected: decRejected || 0,
    },
    knowledge: {
      total: kcTotal || 0,
      with_embedding: kcWithEmb || 0,
      pending_embedding: kcPending,
      embedding_pct: kcTotal ? Math.round(((kcWithEmb || 0) / kcTotal) * 100) : 0,
    },
    duration_ms: Date.now() - startedAt,
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/cron/full-system-audit",
    method: "POST",
    auth: "Authorization: Bearer ${CRON_SECRET}",
    body: { lookback_days: "number (default 90)" },
    purpose: "Full system audit — SMD coverage / cron health / metabase sync / predictions / decisions / knowledge",
  });
}
