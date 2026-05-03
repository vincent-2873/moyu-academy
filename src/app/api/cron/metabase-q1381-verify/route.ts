/**
 * Metabase Q1381 Verify — 0 誤差驗證(Vincent 2026-05-03 拍板)
 *
 * 用法:
 *   POST /api/cron/metabase-q1381-verify
 *   Headers: Authorization: Bearer ${CRON_SECRET}
 *   Body: { from, to }
 *
 * 邏輯:
 *   for each day in [from..to]:
 *     1. queryCard(1381, day, day) → live_rows / live_calls / live_closures / live_revenue
 *     2. SELECT count + sums FROM sales_metrics_daily WHERE date=day AND is_monthly_rollup != true
 *     3. compare → match: live === db (per-row count + each KPI sum)
 *
 * 回傳:
 *   { ok: 全部 match, summary, days[] }
 *
 * exit code:workflow 用 grep '"ok":true' result.json 判定
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { queryCard, normaliseRow } from "@/lib/metabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

const QUESTION_ID = 1381;

interface DayVerify {
  date: string;
  live: {
    rows: number;
    calls: number;
    closures: number;
    net_revenue_daily: number;
    appointments_show: number;
  };
  db: {
    rows: number;
    calls: number;
    closures: number;
    net_revenue_daily: number;
    appointments_show: number;
  };
  diff: {
    rows: number;
    calls: number;
    closures: number;
    net_revenue_daily: number;
    appointments_show: number;
  };
  match: boolean;
  error?: string;
}

function* dateRange(from: string, to: string): Generator<string> {
  const start = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10);
  }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { from?: string; to?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }
  const { from, to } = body;
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "from + to required (YYYY-MM-DD)" }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: "from must be <= to" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const startedAt = Date.now();
  const days: DayVerify[] = [];

  for (const date of dateRange(from, to)) {
    const empty = { rows: 0, calls: 0, closures: 0, net_revenue_daily: 0, appointments_show: 0 };
    const day: DayVerify = {
      date,
      live: { ...empty },
      db: { ...empty },
      diff: { ...empty },
      match: false,
    };

    try {
      // ─── Live: query Q1381 for this exact day ───
      const result = await queryCard(QUESTION_ID, { startDate: date, endDate: date });
      const normalised = result.rows
        .map((r) => normaliseRow(result.cols, r, "q1381", date))
        .filter((r): r is NonNullable<typeof r> => r !== null);
      day.live.rows = normalised.length;
      for (const r of normalised) {
        day.live.calls += Number(r.calls || 0);
        day.live.closures += Number(r.closures || 0);
        day.live.net_revenue_daily += Number(r.net_revenue_daily || 0);
        day.live.appointments_show += Number(r.appointments_show || 0);
      }

      // ─── DB: count + sums for this day(non-rollup only)───
      const { data: dbRows, error: dbErr } = await sb
        .from("sales_metrics_daily")
        .select("calls, closures, net_revenue_daily, appointments_show, is_monthly_rollup")
        .eq("date", date);
      if (dbErr) throw new Error(`DB query failed: ${dbErr.message}`);
      const filtered = (dbRows || []).filter((r) => r.is_monthly_rollup !== true);
      day.db.rows = filtered.length;
      for (const r of filtered) {
        day.db.calls += Number(r.calls || 0);
        day.db.closures += Number(r.closures || 0);
        day.db.net_revenue_daily += Number(r.net_revenue_daily || 0);
        day.db.appointments_show += Number(r.appointments_show || 0);
      }

      // ─── Diff ───
      day.diff.rows = day.db.rows - day.live.rows;
      day.diff.calls = day.db.calls - day.live.calls;
      day.diff.closures = day.db.closures - day.live.closures;
      day.diff.net_revenue_daily = day.db.net_revenue_daily - day.live.net_revenue_daily;
      day.diff.appointments_show = day.db.appointments_show - day.live.appointments_show;

      day.match =
        day.diff.rows === 0 &&
        day.diff.calls === 0 &&
        day.diff.closures === 0 &&
        Math.abs(day.diff.net_revenue_daily) < 1 &&
        day.diff.appointments_show === 0;
    } catch (err) {
      day.error = String((err as Error)?.message || err).slice(0, 300);
    }

    days.push(day);
    await new Promise((r) => setTimeout(r, 400));
  }

  const failed = days.filter((d) => !d.match || d.error);
  const ok = failed.length === 0;

  // ─── Summary ───
  const summary = {
    days_checked: days.length,
    matched_days: days.filter((d) => d.match).length,
    mismatched_days: failed.filter((d) => !d.error).map((d) => d.date),
    error_days: failed.filter((d) => d.error).map((d) => ({ date: d.date, error: d.error })),
    total: {
      live_rows: days.reduce((s, d) => s + d.live.rows, 0),
      db_rows: days.reduce((s, d) => s + d.db.rows, 0),
      live_calls: days.reduce((s, d) => s + d.live.calls, 0),
      db_calls: days.reduce((s, d) => s + d.db.calls, 0),
      live_closures: days.reduce((s, d) => s + d.live.closures, 0),
      db_closures: days.reduce((s, d) => s + d.db.closures, 0),
      live_revenue: days.reduce((s, d) => s + d.live.net_revenue_daily, 0),
      db_revenue: days.reduce((s, d) => s + d.db.net_revenue_daily, 0),
    },
  };

  return NextResponse.json({
    ok,
    range: { from, to },
    summary,
    duration_ms: Date.now() - startedAt,
    days,
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/cron/metabase-q1381-verify",
    method: "POST",
    auth: "Authorization: Bearer ${CRON_SECRET}",
    body: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" },
    purpose: "0-error verify between Q1381 live & sales_metrics_daily DB",
  });
}
