import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/training-ops/students
 * Task 1.3 stub:回 summary KPI(目前只用 D18 新表 count)
 * 後續會加 progress_distribution / attention_list / monthly_summary
 */
export async function GET() {
  const sb = getSupabaseAdmin();

  try {
    const [progressRes, attentionRes] = await Promise.all([
      sb.from("training_module_progress")
        .select("user_id", { count: "exact", head: true }),
      sb.from("claude_help_requests")
        .select("id", { count: "exact", head: true })
        .eq("source", "training")
        .eq("status", "pending"),
    ]);

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      summary: {
        total_in_training: progressRes.count ?? 0,
        today_active: 0,
        stuck: 0,
        need_attention: attentionRes.count ?? 0,
      },
      progress_distribution: [],
      attention_list: [],
      auto_handled: { total: 0, by_brand: {} },
      monthly_summary: {
        completion_rate: 0,
        completion_rate_change: 0,
        avg_practice_score: 0,
        stuck_resolution_rate: 0,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
