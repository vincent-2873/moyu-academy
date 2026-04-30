/**
 * Metabase Q1381 Rolling Sync — 每 15 min 抓 today + 每天第一次抓補 yesterday
 *
 * 設計精神(Vincent 2026-04-30 規格):
 *   - Mon-Sat 09:00-22:00 每 15 min 跑
 *   - 每天 09:00 第一次:抓 yesterday(完整收尾)+ today
 *   - 之後每 15 min:只抓 today(today 進行中,持續更新)
 *   - 22:00 後不跑
 *   - 失敗自動 retry(lib/metabase.ts queryCard 已有 3 次 retry)
 *
 * 用法:
 *   POST /api/cron/metabase-q1381-rolling-sync
 *   Headers: Authorization: Bearer ${CRON_SECRET}
 *   Body: { force_yesterday?: boolean }  (default: 自動判斷今天是不是第一次跑)
 *
 * Zeabur Cron 設定:
 *   schedule: 每 15 min Mon-Sat 09-22 (cron: see GET response for actual expression)
 *   POST /api/cron/metabase-q1381-rolling-sync
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { queryCard, normaliseRow, upsertDaily } from "@/lib/metabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const QUESTION_ID = 1381;

interface DayResult {
  date: string;
  metabase_rows: number;
  inserted: number;
  duration_ms: number;
  status: "success" | "failed";
  error?: string;
}

function todayTaipei(): string {
  // 台北時區 (UTC+8) — 業務看的是台北日期
  const now = new Date();
  const taipei = new Date(now.getTime() + 8 * 3600 * 1000);
  return taipei.toISOString().slice(0, 10);
}

function yesterdayTaipei(): string {
  const now = new Date();
  const taipei = new Date(now.getTime() + 8 * 3600 * 1000);
  taipei.setUTCDate(taipei.getUTCDate() - 1);
  return taipei.toISOString().slice(0, 10);
}

async function syncOneDay(date: string): Promise<DayResult> {
  const t0 = Date.now();
  const sb = getSupabaseAdmin();
  try {
    const result = await queryCard(QUESTION_ID, { startDate: date, endDate: date });
    const normalised = result.rows
      .map((r) => normaliseRow(result.cols, r, "q1381", date))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    let inserted = 0;
    if (normalised.length > 0) {
      const up = await upsertDaily(normalised);
      inserted = up.inserted;
      if (up.error) throw new Error(up.error);
    }

    await sb.from("metabase_sync_log").insert({
      brand: "q1381-rolling",
      question_id: QUESTION_ID,
      trigger: "cron",
      rows: inserted,
      duration_ms: Date.now() - t0,
      status: "success",
    });

    return {
      date,
      metabase_rows: result.rows.length,
      inserted,
      duration_ms: Date.now() - t0,
      status: "success",
    };
  } catch (err) {
    const msg = String((err as Error)?.message || err).slice(0, 300);
    await sb.from("metabase_sync_log").insert({
      brand: "q1381-rolling",
      question_id: QUESTION_ID,
      trigger: "cron",
      rows: 0,
      duration_ms: Date.now() - t0,
      status: "failed",
      error: msg,
    });
    return {
      date,
      metabase_rows: 0,
      inserted: 0,
      duration_ms: Date.now() - t0,
      status: "failed",
      error: msg,
    };
  }
}

async function isFirstRunToday(): Promise<boolean> {
  // 判斷今天有沒有跑過(metabase_sync_log 裡 brand=q1381-rolling 今天有沒有 entry)
  const sb = getSupabaseAdmin();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  // 台北時區 → UTC 換算(台北 00:00 = UTC 16:00 前一天)
  const taipeiTodayUTC = new Date(todayStart.getTime() - 8 * 3600 * 1000);

  const { count } = await sb
    .from("metabase_sync_log")
    .select("id", { count: "exact", head: true })
    .eq("brand", "q1381-rolling")
    .gte("run_at", taipeiTodayUTC.toISOString());

  return (count || 0) === 0;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { force_yesterday?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const today = todayTaipei();
  const yesterday = yesterdayTaipei();
  const startedAt = Date.now();
  const days: DayResult[] = [];

  // 判斷要不要補 yesterday(今天第一次跑 OR 強制)
  const isFirst = body.force_yesterday || await isFirstRunToday();

  if (isFirst) {
    days.push(await syncOneDay(yesterday));
  }
  days.push(await syncOneDay(today));

  const failed = days.filter((d) => d.status === "failed");
  const totalInserted = days.reduce((s, d) => s + d.inserted, 0);

  return NextResponse.json({
    ok: failed.length === 0,
    is_first_run_today: isFirst,
    today_taipei: today,
    yesterday_taipei: yesterday,
    days_processed: days.length,
    total_inserted: totalInserted,
    failed_count: failed.length,
    duration_ms: Date.now() - startedAt,
    days,
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/cron/metabase-q1381-rolling-sync",
    method: "POST",
    auth: "Authorization: Bearer ${CRON_SECRET}",
    behavior: "每次 trigger:抓 today;若今天第一次跑(metabase_sync_log 無 entry)則先補 yesterday",
    schedule_suggestion: "Zeabur Cron: '*/15 9-22 * * 1-6' (台北時區,每 15 min,Mon-Sat,09-22 點)",
    body_schema: {
      force_yesterday: "boolean - 強制也補 yesterday (預設依 sync_log 自動判斷)",
    },
  });
}
