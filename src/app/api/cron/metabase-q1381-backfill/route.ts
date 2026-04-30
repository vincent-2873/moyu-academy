/**
 * Metabase Q1381 Backfill — 一天一個 query 抓全公司業務健康指標
 *
 * 設計精神(Vincent 2026-04-30 規格):
 *   - 一個 question(1381)包全公司 5 brand,raw 抓進來都要對
 *   - 一天一個 query(不拉長區間,確保每天具體數字)
 *   - 用 lib/metabase.ts server-side auth(METABASE_USER/PASS env + 14 天 token cache)
 *   - 每天獨立 try/catch,失敗不影響其他天 + 寫 metabase_sync_log
 *   - upsert by (date, salesperson_id) idempotent,可重跑
 *
 * 用法:
 *   POST /api/cron/metabase-q1381-backfill
 *   Headers: Authorization: Bearer ${CRON_SECRET}
 *   Body: { from, to, dry_run?, do_truncate? }
 *
 *   - dry_run=true (default):跑 query 不寫 DB,純 verify
 *   - do_truncate=true:先刪除 [from..to] 範圍的舊 row(範圍外不動)
 *
 * 範例:
 *   一次性 backfill 1/1-4/30:
 *   { from: "2026-01-01", to: "2026-04-30", dry_run: false, do_truncate: true }
 *
 *   每 15 min cron 抓 today:
 *   { from: "2026-04-30", to: "2026-04-30", dry_run: false, do_truncate: false }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { queryCard, normaliseRow, upsertDaily } from "@/lib/metabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800; // 13 min — 120 天 backfill 預留

const QUESTION_ID = 1381;

interface DayResult {
  date: string;
  metabase_rows: number;
  inserted: number;
  duration_ms: number;
  status: "success" | "failed";
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
  // CRON_SECRET bearer auth
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { from?: string; to?: string; dry_run?: boolean; do_truncate?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const { from, to, dry_run = true, do_truncate = false } = body;
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "from + to required (YYYY-MM-DD)" }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: "from must be <= to" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const startedAt = Date.now();
  const days: DayResult[] = [];
  let truncatedRows = 0;

  // ───────── Step 1: TRUNCATE range (only if not dry_run) ─────────
  if (do_truncate && !dry_run) {
    const { data: deleted, error: delErr } = await sb
      .from("sales_metrics_daily")
      .delete()
      .gte("date", from)
      .lte("date", to)
      .select("date");
    if (delErr) {
      return NextResponse.json(
        { error: `truncate failed: ${delErr.message}`, summary: { from, to } },
        { status: 500 }
      );
    }
    truncatedRows = deleted?.length ?? 0;
  }

  // ───────── Step 2: per-day backfill ─────────
  for (const date of dateRange(from, to)) {
    const t0 = Date.now();
    try {
      const result = await queryCard(QUESTION_ID, { startDate: date, endDate: date });
      const normalised = result.rows
        .map((r) => normaliseRow(result.cols, r, "q1381", date))
        .filter((r): r is NonNullable<typeof r> => r !== null);

      let inserted = 0;
      if (!dry_run && normalised.length > 0) {
        const up = await upsertDaily(normalised);
        inserted = up.inserted;
        if (up.error) throw new Error(up.error);
      } else if (dry_run) {
        inserted = normalised.length; // dry_run 顯示「會 insert 多少」
      }

      await sb.from("metabase_sync_log").insert({
        brand: "q1381",
        question_id: QUESTION_ID,
        trigger: dry_run ? "manual" : "manual",
        rows: inserted,
        duration_ms: Date.now() - t0,
        status: "success",
        error: dry_run ? `[dry_run] would insert ${normalised.length} rows for ${date}` : null,
      });

      days.push({
        date,
        metabase_rows: result.rows.length,
        inserted,
        duration_ms: Date.now() - t0,
        status: "success",
      });

      // inter-day delay 0.5s 避免 hammer Metabase
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      const msg = String((err as Error)?.message || err).slice(0, 300);
      await sb.from("metabase_sync_log").insert({
        brand: "q1381",
        question_id: QUESTION_ID,
        trigger: "manual",
        rows: 0,
        duration_ms: Date.now() - t0,
        status: "failed",
        error: msg,
      });
      days.push({
        date,
        metabase_rows: 0,
        inserted: 0,
        duration_ms: Date.now() - t0,
        status: "failed",
        error: msg,
      });
    }
  }

  // ───────── Step 3: summary ─────────
  const totalRows = days.reduce((s, d) => s + d.metabase_rows, 0);
  const totalInserted = days.reduce((s, d) => s + d.inserted, 0);
  const failedDays = days.filter((d) => d.status === "failed").map((d) => d.date);

  return NextResponse.json({
    ok: failedDays.length === 0,
    range: { from, to },
    dry_run,
    do_truncate,
    truncated_rows: truncatedRows,
    days_processed: days.length,
    total_metabase_rows: totalRows,
    total_inserted: totalInserted,
    failed_days: failedDays,
    duration_ms: Date.now() - startedAt,
    days,
  });
}

// 也支援 GET ping(check endpoint 是否存在)
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/cron/metabase-q1381-backfill",
    method: "POST",
    auth: "Authorization: Bearer ${CRON_SECRET}",
    body_schema: {
      from: "YYYY-MM-DD",
      to: "YYYY-MM-DD",
      dry_run: "boolean (default: true)",
      do_truncate: "boolean (default: false) — 刪除 [from..to] 範圍內既有 row",
    },
    question_id: QUESTION_ID,
  });
}
