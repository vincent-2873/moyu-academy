import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/debug/smd
 *
 * 暫時 debug endpoint — 確認 sales_metrics_daily 真實狀態
 * 為什麼 ceo / chairman 撈 0 但 metabase-health 顯 6227 rows
 */
export async function GET() {
  const sb = getSupabaseAdmin();

  // 1. raw count(沒 filter)
  const { count: total } = await sb.from("sales_metrics_daily").select("*", { count: "exact", head: true });

  // 2. is_monthly_rollup distribution
  const { data: rollupNull } = await sb.from("sales_metrics_daily").select("date", { count: "exact", head: true }).is("is_monthly_rollup", null);
  const { count: rollupNullCount } = await sb.from("sales_metrics_daily").select("*", { count: "exact", head: true }).is("is_monthly_rollup", null);
  const { count: rollupTrueCount } = await sb.from("sales_metrics_daily").select("*", { count: "exact", head: true }).eq("is_monthly_rollup", true);
  const { count: rollupFalseCount } = await sb.from("sales_metrics_daily").select("*", { count: "exact", head: true }).eq("is_monthly_rollup", false);

  // 3. 用 chairman-overview 同樣 filter 看 row 數
  const { count: chairmanFilterCount } = await sb.from("sales_metrics_daily")
    .select("*", { count: "exact", head: true })
    .gte("date", "2026-04-25")
    .not("is_monthly_rollup", "is", true)
    .not("email", "is", null);

  // 4. 5 月 rows 數 + sample
  const { data: mayRows } = await sb.from("sales_metrics_daily")
    .select("date, salesperson_id, email, name, brand, calls, connected, raw_appointments, appointments_show, closures, is_monthly_rollup")
    .gte("date", "2026-05-01")
    .limit(5);

  // 5. 同樣 filter 的 5 月 row count
  const { count: mayFiltered } = await sb.from("sales_metrics_daily")
    .select("*", { count: "exact", head: true })
    .gte("date", "2026-05-01")
    .not("is_monthly_rollup", "is", true)
    .not("email", "is", null);

  return NextResponse.json({
    total,
    is_monthly_rollup: {
      null_count: rollupNullCount,
      true_count: rollupTrueCount,
      false_count: rollupFalseCount,
    },
    chairman_filter_count: chairmanFilterCount,
    may_filtered_count: mayFiltered,
    may_sample_5: mayRows,
  });
}
