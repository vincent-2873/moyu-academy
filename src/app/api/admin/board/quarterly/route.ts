import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/board/quarterly
 * 對應 system-tree v2 §投資人中心 §季度成績單(/admin/board/quarterly)
 * 從 D26 schema claude_self_assessments 撈最新 period + history
 */
export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("claude_self_assessments")
    .select("id, period, score, kpi_revenue, kpi_revenue_target, kpi_prediction_accuracy, kpi_decision_success_rate, kpi_roi, message_to_board, risks_disclosed, benchmark, pdf_url, created_at")
    .order("period", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({
      ok: false,
      error: error.message,
      hint: "若是 'relation does not exist',表示 D26 SQL Phase 4 schema 還沒 apply",
      latest: null,
      history: [],
    }, { status: 200 });
  }

  const list = data ?? [];
  return NextResponse.json({
    ok: true,
    count: list.length,
    latest: list[0] ?? null,
    history: list,
  });
}
