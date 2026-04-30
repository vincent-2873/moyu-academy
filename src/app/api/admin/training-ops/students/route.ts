import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AttentionPreview {
  user_id: string;
  name: string;
  brand: string;
  current_day: number;
  stuck_days: number;
  summary: string;
}

/**
 * GET /api/admin/training-ops/students
 *
 * Vincent 30 秒看完訓練狀態:
 *  - summary KPI 4 格(訓練中 / 今日上線 / 卡關 / 需介入)
 *  - progress_distribution: D0-D14 新人分布
 *  - attention_list: 前 3 預覽(完整在 /attention)
 *  - auto_handled: 全公司跑得順利的 by brand
 *  - monthly_summary: 完訓率 / 對練分 / 卡關處理率
 */
export async function GET() {
  const sb = getSupabaseAdmin();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

  try {
    // 訓練中 = users.stage='beginner' AND status='active' (新人候選池)
    // 既有 stage='beginner' 的 user 即「該訓練的人」
    const { count: totalInTraining } = await sb.from("users")
      .select("id", { count: "exact", head: true })
      .eq("stage", "beginner")
      .eq("status", "active");

    // 今日上線 = training_module_progress 今日有 update 的 distinct user
    const { data: todayActiveData } = await sb.from("training_module_progress")
      .select("user_id")
      .gte("updated_at", todayStart.toISOString());
    const todayActive = new Set((todayActiveData ?? []).map(r => r.user_id)).size;

    // 卡關中 = stuck_detected_at not null AND stuck_handled=false 的 distinct user
    const { data: stuckData } = await sb.from("training_module_progress")
      .select("user_id")
      .eq("stuck_handled", false)
      .not("stuck_detected_at", "is", null);
    const stuck = new Set((stuckData ?? []).map(r => r.user_id)).size;

    // 需介入 = claude_help_requests source=training pending
    const { count: needAttention } = await sb.from("claude_help_requests")
      .select("id", { count: "exact", head: true })
      .eq("source", "training")
      .eq("status", "pending");

    // 進度分布:每個 stage='beginner' user 的 training_current_day group
    const { data: trainees } = await sb.from("users")
      .select("id, training_current_day, brand, stage_path")
      .eq("stage", "beginner")
      .eq("status", "active");
    const dayBucket = new Map<number, number>();
    for (let d = 0; d <= 14; d++) dayBucket.set(d, 0);
    for (const t of trainees ?? []) {
      const day = Math.min(14, Math.max(0, t.training_current_day ?? 0));
      dayBucket.set(day, (dayBucket.get(day) ?? 0) + 1);
    }
    // 落後判斷:預期某 day 但還停在 < D-3 的人 → is_lagging
    // 簡化:D < 期望中位 - 2 為 lagging
    const today = new Date();
    const dayOfMonth = today.getDate();
    const expectedDay = Math.min(14, Math.floor(dayOfMonth / 2));
    const progressDistribution = Array.from(dayBucket.entries())
      .sort(([a], [b]) => a - b)
      .map(([day, count]) => ({
        day,
        count,
        is_lagging: day < expectedDay - 3 && count > 0,
      }));

    // 需介入清單前 3 預覽
    const { data: attentionRows } = await sb.from("claude_help_requests")
      .select("id, related_user_id, title, description, created_at")
      .eq("source", "training")
      .eq("status", "pending")
      .eq("category", "urgent")
      .order("created_at", { ascending: false })
      .limit(3);

    const userIds = (attentionRows ?? [])
      .map(r => r.related_user_id)
      .filter((id): id is string => id !== null);
    const userMap = new Map<string, { name: string; brand: string; training_current_day: number }>();
    if (userIds.length > 0) {
      const { data: usersData } = await sb.from("users")
        .select("id, name, brand, training_current_day")
        .in("id", userIds);
      for (const u of usersData ?? []) {
        userMap.set(u.id, {
          name: u.name ?? "(未命名)",
          brand: u.brand ?? "(unknown)",
          training_current_day: u.training_current_day ?? 0,
        });
      }
    }

    const attentionList: AttentionPreview[] = (attentionRows ?? []).map(r => {
      const u = r.related_user_id ? userMap.get(r.related_user_id) : null;
      const stuckDays = r.created_at
        ? Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000)
        : 0;
      return {
        user_id: r.related_user_id ?? "",
        name: u?.name ?? "(未知)",
        brand: u?.brand ?? "(unknown)",
        current_day: u?.training_current_day ?? 0,
        stuck_days: stuckDays,
        summary: r.title ?? "",
      };
    });

    // auto_handled: 訓練中 - 需介入 - 卡關 = 順利的人
    const autoHandledTotal = Math.max(0, (totalInTraining ?? 0) - (needAttention ?? 0) - stuck);
    const byBrand = new Map<string, number>();
    for (const t of trainees ?? []) {
      const brand = t.brand ?? "(unknown)";
      byBrand.set(brand, (byBrand.get(brand) ?? 0) + 1);
    }

    // monthly_summary
    const { count: monthEnrolled } = await sb.from("training_module_progress")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStart.toISOString());
    const { count: monthCompleted } = await sb.from("training_module_progress")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStart.toISOString())
      .eq("status", "done");
    const completionRate = (monthEnrolled ?? 0) > 0
      ? Math.round(((monthCompleted ?? 0) / (monthEnrolled ?? 1)) * 100)
      : 0;

    const { data: practiceScores } = await sb.from("roleplay_sessions")
      .select("total_score")
      .gte("started_at", monthStart.toISOString())
      .not("total_score", "is", null);
    const validScores = (practiceScores ?? [])
      .map(r => r.total_score)
      .filter((s): s is number => typeof s === "number");
    const avgPracticeScore = validScores.length > 0
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : 0;

    const { count: stuckTotal } = await sb.from("training_stuck_handlings")
      .select("id", { count: "exact", head: true })
      .gte("detected_at", monthStart.toISOString());
    const { count: stuckResolved } = await sb.from("training_stuck_handlings")
      .select("id", { count: "exact", head: true })
      .gte("detected_at", monthStart.toISOString())
      .not("resolved_at", "is", null);
    const stuckResolutionRate = (stuckTotal ?? 0) > 0
      ? Math.round(((stuckResolved ?? 0) / (stuckTotal ?? 1)) * 100)
      : 0;

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      summary: {
        total_in_training: totalInTraining ?? 0,
        today_active: todayActive,
        stuck,
        need_attention: needAttention ?? 0,
      },
      progress_distribution: progressDistribution,
      attention_list: attentionList,
      auto_handled: {
        total: autoHandledTotal,
        by_brand: Object.fromEntries(byBrand),
      },
      monthly_summary: {
        completion_rate: completionRate,
        completion_rate_change: 0,
        avg_practice_score: avgPracticeScore,
        stuck_resolution_rate: stuckResolutionRate,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
