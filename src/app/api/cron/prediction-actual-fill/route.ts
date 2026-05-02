import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * /api/cron/prediction-actual-fill — Wave 8 #2 prediction 閉環(後半)
 *
 * 每天 23:00 台北 = UTC 15:00 跑
 * 找 target_period 已過期 + actual_value IS NULL 的 prediction → 從 SMD 算 actual → fill + accuracy
 *
 * accuracy_pct 公式:
 *   if predicted == 0 && actual == 0: 100
 *   else: max(0, 100 - |predicted - actual| / max(actual, 1) * 100)
 *
 * 投資人質詢 Claude 多準時 — 可顯歷史 prediction.accuracy_pct 平均
 */

const REVENUE_PER_CLOSURE = 80000; // 預設每成交 NT$8 萬(也可以從 sales_metrics_daily revenue 欄位算 — 這版先用簡單)

function isoWeekBounds(weekStr: string): { from: string; to: string } | null {
  // 'week-2026-W18' → 2026-04-27 (Mon) ~ 2026-05-03 (Sun)
  const m = weekStr.match(/^week-(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);

  // ISO 8601: week 1 = the week containing Jan 4
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

  const targetMon = new Date(week1Mon);
  targetMon.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);
  const targetSun = new Date(targetMon);
  targetSun.setUTCDate(targetMon.getUTCDate() + 6);

  return {
    from: targetMon.toISOString().slice(0, 10),
    to: targetSun.toISOString().slice(0, 10),
  };
}

function monthBounds(monthStr: string): { from: string; to: string } | null {
  // 'month-2026-05'
  const m = monthStr.match(/^month-(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const last = new Date(Date.UTC(year, mo, 0)).getUTCDate();
  return {
    from: `${year}-${String(mo).padStart(2, "0")}-01`,
    to: `${year}-${String(mo).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
  };
}

function tpeToday(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function calcAccuracy(predicted: number, actual: number): number {
  if (predicted === 0 && actual === 0) return 100;
  if (actual === 0) return predicted === 0 ? 100 : 0;
  const err = Math.abs(predicted - actual);
  return Math.max(0, Math.round((100 - (err / Math.max(actual, 1)) * 100) * 100) / 100);
}

export async function POST(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();
    const today = tpeToday();

    // 找 actual_value IS NULL 的 prediction
    const { data: pending } = await sb
      .from("claude_predictions")
      .select("id, target_period, metric, predicted_value")
      .is("actual_value", null)
      .order("predicted_at", { ascending: true })
      .limit(50);

    if (!pending || pending.length === 0) {
      return NextResponse.json({ ok: true, filled: 0, message: "no pending predictions" });
    }

    const filled: Array<{ id: string; target: string; metric: string; predicted: number; actual: number; accuracy: number }> = [];
    const skipped: Array<{ id: string; reason: string }> = [];

    for (const p of pending) {
      let bounds: { from: string; to: string } | null = null;
      if (p.target_period.startsWith("week-")) bounds = isoWeekBounds(p.target_period);
      else if (p.target_period.startsWith("month-")) bounds = monthBounds(p.target_period);

      if (!bounds) {
        skipped.push({ id: p.id, reason: "unparseable target_period" });
        continue;
      }
      // 還沒過期 → skip
      if (bounds.to >= today) {
        skipped.push({ id: p.id, reason: `not yet expired (to=${bounds.to})` });
        continue;
      }

      // 撈 SMD 該區間 sum
      const smdRows = await fetchAllRows<{ calls: number; closures: number; appointments_show: number }>(() =>
        sb.from("sales_metrics_daily")
          .select("calls, closures, appointments_show")
          .gte("date", bounds!.from)
          .lte("date", bounds!.to)
      );

      let actual = 0;
      const sumCalls = smdRows.reduce((s, r) => s + (r.calls || 0), 0);
      const sumCloses = smdRows.reduce((s, r) => s + (r.closures || 0), 0);
      const sumAppts = smdRows.reduce((s, r) => s + (r.appointments_show || 0), 0);

      switch (p.metric) {
        case "calls": actual = sumCalls; break;
        case "closures": actual = sumCloses; break;
        case "revenue": actual = sumCloses * REVENUE_PER_CLOSURE; break;
        case "conversion_rate": actual = sumAppts > 0 ? sumCloses / sumAppts : 0; break;
        default:
          skipped.push({ id: p.id, reason: `unknown metric ${p.metric}` });
          continue;
      }

      const accuracy = calcAccuracy(Number(p.predicted_value), actual);

      const { error: updErr } = await sb
        .from("claude_predictions")
        .update({
          actual_value: actual,
          actual_filled_at: new Date().toISOString(),
          accuracy_pct: accuracy,
        })
        .eq("id", p.id);

      if (updErr) {
        skipped.push({ id: p.id, reason: updErr.message });
        continue;
      }

      filled.push({
        id: p.id,
        target: p.target_period,
        metric: p.metric,
        predicted: Number(p.predicted_value),
        actual,
        accuracy,
      });
    }

    await sb.from("system_run_log").insert({
      source: "prediction-actual-fill",
      status: "success",
      metadata: {
        filled_count: filled.length,
        skipped_count: skipped.length,
      },
    });

    return NextResponse.json({
      ok: true,
      filled,
      skipped,
      total_pending_initial: pending.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const GET = POST;
