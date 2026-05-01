import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TopModuleRow {
  module_id: string;
  title: string;
  module_type: string;
  enrolled: number;
  completed: number;
  completion_rate: number;
  avg_score: number | null;
  claude_assessment: string | null;
  claude_suggestion: string | null;
}

/**
 * GET /api/admin/training-ops/report
 *
 * 回:整體 KPI / Top 5 / Bottom 5 modules + Claude 評估
 * 來源:module_effectiveness(由 weekly cron 產出)+ training_modules(撈 title)
 */
export async function GET() {
  const sb = getSupabaseAdmin();
  const now = new Date();
  const period = `${now.getFullYear()}-W${getWeekNum(now)}`;

  try {
    // 整體 KPI
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

    // 撈 module_effectiveness 本週(period 對齊),沒就拉最近一週
    let { data: effRows } = await sb.from("module_effectiveness")
      .select("module_id, period, enrolled_count, completed_count, avg_score, claude_assessment, claude_suggestion, computed_at")
      .eq("period", period);

    // fallback: 沒本週,撈最近一筆
    if (!effRows || effRows.length === 0) {
      const recent = await sb.from("module_effectiveness")
        .select("module_id, period, enrolled_count, completed_count, avg_score, claude_assessment, claude_suggestion, computed_at")
        .order("computed_at", { ascending: false })
        .limit(50);
      effRows = recent.data ?? [];
    }

    // 拿對應 module title
    const moduleIds = (effRows ?? []).map(r => r.module_id);
    const moduleMap = new Map<string, { title: string; module_type: string }>();
    if (moduleIds.length > 0) {
      const { data: modules } = await sb.from("training_modules")
        .select("id, title, module_type")
        .in("id", moduleIds);
      for (const m of modules ?? []) {
        moduleMap.set(m.id, {
          title: m.title ?? "(未命名)",
          module_type: m.module_type ?? "",
        });
      }
    }

    const enriched: TopModuleRow[] = (effRows ?? []).map(r => {
      const m = moduleMap.get(r.module_id);
      const completionRate = (r.enrolled_count ?? 0) > 0
        ? Math.round(((r.completed_count ?? 0) / (r.enrolled_count ?? 1)) * 100)
        : 0;
      return {
        module_id: r.module_id,
        title: m?.title ?? "(未對應 module)",
        module_type: m?.module_type ?? "",
        enrolled: r.enrolled_count ?? 0,
        completed: r.completed_count ?? 0,
        completion_rate: completionRate,
        avg_score: r.avg_score,
        claude_assessment: r.claude_assessment,
        claude_suggestion: r.claude_suggestion,
      };
    });

    // Top 5 / Bottom 5(以 completion_rate 排序,enrolled >= 3 才算)
    const eligible = enriched.filter(r => r.enrolled >= 3);
    const top5 = [...eligible].sort((a, b) => b.completion_rate - a.completion_rate).slice(0, 5);
    const bottom5 = [...eligible].sort((a, b) => a.completion_rate - b.completion_rate).slice(0, 5);

    return NextResponse.json({
      ok: true,
      generated_at: now.toISOString(),
      period,
      summary: {
        enrolled,
        completed,
        completion_rate,
        completion_rate_change: 0,
        dropout: 0,
      },
      post_training: null,
      top5,
      bottom5,
      total_evaluated: enriched.length,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

function getWeekNum(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = (d.getTime() - start.getTime()) / 86400000;
  return Math.ceil((diff + start.getDay() + 1) / 7);
}
