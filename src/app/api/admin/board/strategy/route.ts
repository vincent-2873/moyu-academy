import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/board/strategy
 * 對應 system-tree v2 §投資人中心 §Claude 戰略報告(/admin/board/strategy)
 *
 * 戰略報告來源:
 *   - decision_records WHERE category = 'strategy' → 推薦策略 + 簽核狀態
 *   - claude_self_assessments 最新 period → 風險揭露(對齊報告)
 */
export async function GET() {
  const sb = getSupabaseAdmin();

  const [strategiesRes, latestRes] = await Promise.all([
    sb.from("decision_records")
      .select("id, title, context, claude_recommendation, vincent_decision, status, urgency, due_date, signoff_chain, created_at, approved_at")
      .eq("category", "strategy")
      .order("created_at", { ascending: false })
      .limit(20),
    sb.from("claude_self_assessments")
      .select("period, score, kpi_revenue, kpi_revenue_target, message_to_board, risks_disclosed, benchmark")
      .order("period", { ascending: false })
      .limit(1),
  ]);

  if (strategiesRes.error || latestRes.error) {
    return NextResponse.json({
      ok: false,
      error: strategiesRes.error?.message ?? latestRes.error?.message,
      hint: "若是 'relation does not exist',表示 D26 SQL Phase 4 schema 還沒 apply",
      strategies: [],
      latest_assessment: null,
    }, { status: 200 });
  }

  const strategies = strategiesRes.data ?? [];
  const counts = {
    pending: strategies.filter(s => s.status === "pending").length,
    approved: strategies.filter(s => s.status === "approved").length,
    rejected: strategies.filter(s => s.status === "rejected").length,
    deferred: strategies.filter(s => s.status === "deferred").length,
  };

  return NextResponse.json({
    ok: true,
    counts,
    strategies,
    latest_assessment: latestRes.data?.[0] ?? null,
  });
}
