import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ModuleStats {
  module_id: string;
  enrolled: number;
  completed: number;
  skipped: number;
  stuck: number;
  total_score_sum: number;
  total_score_count: number;
  total_duration_sum: number;
}

/**
 * POST /api/cron/training-effectiveness
 *
 * 每週日 02:00 台北 (UTC 18:00 週六) 跑
 * GitHub Actions trigger,需要 CRON_SECRET bearer
 *
 * 邏輯:
 *   1. 撈過去 7 天 training_module_progress + roleplay_sessions
 *   2. group by module_id 算:enrolled / completed / skipped / avg_score / avg_duration
 *   3. 完訓者 30 天後的 sales_metrics_daily 表現(post_training_metrics)
 *   4. Claude 評估「有效 / 一般 / 無效」+ 改寫建議(OpenAI gpt-4o-mini)
 *   5. UPSERT 到 module_effectiveness (UNIQUE module_id, period)
 *
 * 空 case:prod 沒 training_module_progress 時 return 空結果,不報錯
 */
export async function POST(req: NextRequest) {
  // CRON_SECRET 驗 (middleware 已擋 /api/cron/*?,但這個 route 不在 /api/admin/* 下,要自己驗)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const sb = getSupabaseAdmin();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const period = `${now.getFullYear()}-W${getWeekNum(now)}`;

  try {
    // 1. 過去 7 天 training_module_progress
    const { data: progressRows } = await sb.from("training_module_progress")
      .select("id, module_id, status, started_at, completed_at, completion_data")
      .gte("created_at", sevenDaysAgo.toISOString());

    // 2. 過去 7 天 roleplay_sessions(對 sparring 類 module 評分)
    const { data: sessionRows } = await sb.from("roleplay_sessions")
      .select("id, module_id, total_score, duration_seconds")
      .gte("started_at", sevenDaysAgo.toISOString())
      .not("total_score", "is", null);

    // 3. group by module_id
    const stats = new Map<string, ModuleStats>();
    function ensure(moduleId: string): ModuleStats {
      let s = stats.get(moduleId);
      if (!s) {
        s = {
          module_id: moduleId,
          enrolled: 0, completed: 0, skipped: 0, stuck: 0,
          total_score_sum: 0, total_score_count: 0, total_duration_sum: 0,
        };
        stats.set(moduleId, s);
      }
      return s;
    }

    for (const p of progressRows ?? []) {
      if (!p.module_id) continue;
      const s = ensure(p.module_id);
      s.enrolled += 1;
      if (p.status === "done") s.completed += 1;
      if (p.status === "skipped") s.skipped += 1;
      if (p.status === "stuck") s.stuck += 1;
      if (p.started_at && p.completed_at) {
        const dur = (new Date(p.completed_at).getTime() - new Date(p.started_at).getTime()) / 60000;
        if (dur > 0) s.total_duration_sum += dur;
      }
    }
    for (const r of sessionRows ?? []) {
      if (!r.module_id) continue;
      const s = ensure(r.module_id);
      if (typeof r.total_score === "number") {
        s.total_score_sum += r.total_score;
        s.total_score_count += 1;
      }
    }

    if (stats.size === 0) {
      return NextResponse.json({
        ok: true,
        period,
        note: "no training activity in last 7 days; nothing to compute",
        modules_processed: 0,
      });
    }

    // 4. 每 module 寫進 module_effectiveness
    const upserts = Array.from(stats.values()).map(s => {
      const completionRate = s.enrolled > 0 ? Math.round((s.completed / s.enrolled) * 100) : 0;
      const avgScore = s.total_score_count > 0 ? Math.round(s.total_score_sum / s.total_score_count) : null;
      const avgDuration = s.completed > 0 ? Math.round(s.total_duration_sum / s.completed) : null;
      return {
        module_id: s.module_id,
        period,
        enrolled_count: s.enrolled,
        completed_count: s.completed,
        skipped_count: s.skipped,
        stuck_count: s.stuck,
        avg_score: avgScore,
        avg_duration_minutes: avgDuration,
        post_training_metrics: null,
        claude_assessment: classifyEffectiveness(completionRate, avgScore),
        claude_suggestion: null,
        computed_at: now.toISOString(),
      };
    });

    const { error: upsertErr } = await sb.from("module_effectiveness")
      .upsert(upserts, { onConflict: "module_id,period" });

    if (upsertErr) {
      return NextResponse.json(
        { ok: false, error: `UPSERT failed: ${upsertErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      period,
      modules_processed: stats.size,
      total_enrolled: Array.from(stats.values()).reduce((a, s) => a + s.enrolled, 0),
      total_completed: Array.from(stats.values()).reduce((a, s) => a + s.completed, 0),
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

/**
 * 簡單規則式 effectiveness 分類(OpenAI 整合等 prod 有資料再開)
 * - 完訓率 ≥ 70 + 平均分 ≥ 75 → 有效
 * - 完訓率 < 40 OR 平均分 < 60 → 無效
 * - 其餘 → 一般
 */
function classifyEffectiveness(completionRate: number, avgScore: number | null): string {
  if (completionRate >= 70 && (avgScore ?? 100) >= 75) return "有效";
  if (completionRate < 40 || (avgScore !== null && avgScore < 60)) return "無效";
  return "一般";
}
