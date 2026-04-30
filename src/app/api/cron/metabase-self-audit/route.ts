/**
 * Metabase Self-Audit — 每天 23:00 自動驗證資料品質
 *
 * 設計精神(Vincent 2026-04-30 規格 / handoff Part 4 階段 3 第 6):
 *   - 隨機抽 5 個 active 員工
 *   - 拉他們 yesterday DB row
 *   - live query Metabase Q1381 同期間
 *   - 對比 calls / closures / revenue
 *   - 任一指標差 > 5% → 推 LINE Notify 給 Vincent
 *   - 寫 metabase_sync_log 留軌跡
 *
 * 用法:
 *   POST /api/cron/metabase-self-audit
 *   Headers: Authorization: Bearer ${CRON_SECRET}
 *   Body: { sample_size?: number, target_date?: 'YYYY-MM-DD' (default yesterday) }
 *
 * Zeabur Cron 設定:
 *   schedule: 0 23 * * *
 *   POST /api/cron/metabase-self-audit
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { queryCard, normaliseRow } from "@/lib/metabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const QUESTION_ID = 1381;
const DIFF_THRESHOLD_PCT = 5; // 任一指標差 > 5% 警報

interface DiffRow {
  email: string;
  name: string | null;
  brand: string | null;
  date: string;
  // db side
  db_calls: number;
  db_closures: number;
  db_revenue: number;
  // live side
  live_calls: number;
  live_closures: number;
  live_revenue: number;
  // diffs (signed)
  diff_calls_pct: number;
  diff_closures_pct: number;
  diff_revenue_pct: number;
  // any > threshold
  flagged: boolean;
}

function pctDiff(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  if (a === 0) return Infinity;
  return Math.abs((b - a) / a) * 100;
}

function yesterdayUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function pushLineAlert(message: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const adminId = process.env.LINE_ADMIN_USER_ID;
  if (!token || !adminId) return;
  try {
    await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: adminId,
        messages: [{ type: "text", text: message.slice(0, 4900) }],
      }),
    });
  } catch {
    // 非 critical,fail silently
  }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { sample_size?: number; target_date?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const sampleSize = Math.max(1, Math.min(20, body.sample_size ?? 5));
  const targetDate = body.target_date && /^\d{4}-\d{2}-\d{2}$/.test(body.target_date)
    ? body.target_date
    : yesterdayUTC();

  const sb = getSupabaseAdmin();
  const startedAt = Date.now();

  // ───────── Step 1: 抽 sample 員工(過去 7 天有 row 且 target_date 也有 row 的)─────────
  const recentSince = (() => {
    const d = new Date(targetDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  })();

  const { data: activeRows, error: activeErr } = await sb
    .from("sales_metrics_daily")
    .select("salesperson_id, email, name, brand, date")
    .gte("date", recentSince)
    .lte("date", targetDate);

  if (activeErr || !activeRows || activeRows.length === 0) {
    return NextResponse.json({
      ok: false,
      stage: "fetch_active_employees",
      error: activeErr?.message || "no rows in window",
      window: { from: recentSince, to: targetDate },
    }, { status: 500 });
  }

  // 抽出 target_date 有 row 的員工(audit 對象)
  const onTarget = activeRows.filter((r) => r.date === targetDate);
  if (onTarget.length === 0) {
    return NextResponse.json({
      ok: true,
      stage: "no_data_on_target_date",
      target_date: targetDate,
      message: "DB 在 target_date 沒 row,無法 audit(可能該天連假/週日)",
    });
  }

  const uniqueEmails = Array.from(new Set(onTarget.map((r) => r.email).filter(Boolean)));
  const sampled = uniqueEmails
    .map((e) => ({ e, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .slice(0, sampleSize)
    .map((x) => x.e);

  // ───────── Step 2: live query Metabase Q1381 ─────────
  let liveResult;
  try {
    liveResult = await queryCard(QUESTION_ID, { startDate: targetDate, endDate: targetDate });
  } catch (err) {
    const msg = String((err as Error)?.message || err).slice(0, 300);
    await sb.from("metabase_sync_log").insert({
      brand: "self-audit",
      question_id: QUESTION_ID,
      trigger: "cron",
      rows: 0,
      duration_ms: Date.now() - startedAt,
      status: "failed",
      error: `live query failed: ${msg}`,
    });
    return NextResponse.json({
      ok: false,
      stage: "metabase_live_query",
      error: msg,
    }, { status: 500 });
  }

  const liveAgg: Record<string, { calls: number; closures: number; revenue: number; name: string | null; brand: string | null }> = {};
  for (const row of liveResult.rows) {
    const norm = normaliseRow(liveResult.cols, row, "q1381", targetDate);
    if (!norm || !norm.email) continue;
    const k = norm.email.toLowerCase();
    liveAgg[k] = {
      calls: norm.calls,
      closures: norm.closures,
      revenue: norm.gross_revenue,
      name: norm.name,
      brand: norm.brand,
    };
  }

  // ───────── Step 3: per-sample diff ─────────
  const diffs: DiffRow[] = [];
  for (const email of sampled) {
    if (!email) continue;
    const dbRows = onTarget.filter((r) => r.email?.toLowerCase() === email.toLowerCase());
    const dbAgg = dbRows.reduce((acc, r: any) => ({
      calls: acc.calls + Number(r.calls || 0),
      closures: acc.closures + Number(r.closures || 0),
      revenue: acc.revenue + Number(r.gross_revenue || 0),
    }), { calls: 0, closures: 0, revenue: 0 });

    // 但 onTarget 沒撈完整欄位,要重撈
    const { data: fullDb } = await sb
      .from("sales_metrics_daily")
      .select("calls, closures, gross_revenue, name, brand")
      .eq("date", targetDate)
      .ilike("email", email)
      .maybeSingle();

    const dbCalls = Number(fullDb?.calls || 0);
    const dbClosures = Number(fullDb?.closures || 0);
    const dbRevenue = Number(fullDb?.gross_revenue || 0);

    const live = liveAgg[email.toLowerCase()] || { calls: 0, closures: 0, revenue: 0, name: null, brand: null };
    const diffCallsPct = pctDiff(dbCalls, live.calls);
    const diffClosuresPct = pctDiff(dbClosures, live.closures);
    const diffRevenuePct = pctDiff(dbRevenue, live.revenue);
    const flagged = diffCallsPct > DIFF_THRESHOLD_PCT || diffClosuresPct > DIFF_THRESHOLD_PCT || diffRevenuePct > DIFF_THRESHOLD_PCT;

    diffs.push({
      email,
      name: fullDb?.name || live.name,
      brand: fullDb?.brand || live.brand,
      date: targetDate,
      db_calls: dbCalls,
      db_closures: dbClosures,
      db_revenue: dbRevenue,
      live_calls: live.calls,
      live_closures: live.closures,
      live_revenue: live.revenue,
      diff_calls_pct: Number.isFinite(diffCallsPct) ? Math.round(diffCallsPct * 10) / 10 : -1,
      diff_closures_pct: Number.isFinite(diffClosuresPct) ? Math.round(diffClosuresPct * 10) / 10 : -1,
      diff_revenue_pct: Number.isFinite(diffRevenuePct) ? Math.round(diffRevenuePct * 10) / 10 : -1,
      flagged,
    });
  }

  const flaggedRows = diffs.filter((d) => d.flagged);

  // ───────── Step 4: 推 LINE Notify ─────────
  if (flaggedRows.length > 0) {
    const lines = [
      `[Self-Audit] ${targetDate} 發現 ${flaggedRows.length}/${diffs.length} 員工數據差 > ${DIFF_THRESHOLD_PCT}%`,
      ``,
      ...flaggedRows.slice(0, 5).map((d) =>
        `• ${d.name || d.email}(${d.brand}):` +
        `\n  calls DB=${d.db_calls} live=${d.live_calls} (Δ${d.diff_calls_pct}%)` +
        `\n  closures DB=${d.db_closures} live=${d.live_closures} (Δ${d.diff_closures_pct}%)` +
        `\n  revenue DB=${d.db_revenue} live=${d.live_revenue} (Δ${d.diff_revenue_pct}%)`
      ),
      ``,
      `→ 進 /admin → Metabase 對標 跑完整 audit`,
    ].join("\n");
    await pushLineAlert(lines);
  }

  // ───────── Step 5: log ─────────
  await sb.from("metabase_sync_log").insert({
    brand: "self-audit",
    question_id: QUESTION_ID,
    trigger: "cron",
    rows: diffs.length,
    duration_ms: Date.now() - startedAt,
    status: flaggedRows.length > 0 ? "partial" : "success",
    error: flaggedRows.length > 0 ? `${flaggedRows.length} flagged: ${flaggedRows.map(f => f.email).slice(0,3).join(',')}` : null,
  });

  return NextResponse.json({
    ok: true,
    target_date: targetDate,
    sampled_count: diffs.length,
    flagged_count: flaggedRows.length,
    threshold_pct: DIFF_THRESHOLD_PCT,
    line_pushed: flaggedRows.length > 0,
    duration_ms: Date.now() - startedAt,
    diffs,
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/cron/metabase-self-audit",
    method: "POST",
    auth: "Authorization: Bearer ${CRON_SECRET}",
    body_schema: {
      sample_size: "number 1-20 (default: 5)",
      target_date: "YYYY-MM-DD (default: yesterday UTC)",
    },
    behavior: "隨機抽 N 員工 → live query Metabase Q1381 對比 DB → 任一指標差 > 5% 推 LINE Notify",
    threshold_pct: DIFF_THRESHOLD_PCT,
    schedule_suggestion: "Zeabur Cron: 0 23 * * *",
  });
}
