import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/training-ops/report
 * Task 1.6 stub:回完訓率 + 完訓 30 天後表現
 * 後續加 Top 5 / Bottom 5 module + Claude 評估
 */
export async function GET() {
  const sb = getSupabaseAdmin();

  try {
    const [enrolledRes, completedRes] = await Promise.all([
      sb.from("training_module_progress")
        .select("user_id", { count: "exact", head: true }),
      sb.from("training_module_progress")
        .select("user_id", { count: "exact", head: true })
        .eq("status", "done"),
    ]);

    const enrolled = enrolledRes.count ?? 0;
    const completed = completedRes.count ?? 0;
    const completion_rate = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0;

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      summary: {
        enrolled,
        completed,
        completion_rate,
        completion_rate_change: 0,
        dropout: 0,
      },
      post_training: null,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
