import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * GET /api/hr-training?email=xxx
 * 回傳完整 SOP (Day 1 / Day 2 ...) 結構 + 該使用者的進度
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  const supabase = getSupabaseAdmin();

  const { data: days } = await supabase
    .from("hr_training_days")
    .select("*")
    .order("display_order", { ascending: true });

  const { data: tasks } = await supabase
    .from("hr_training_tasks")
    .select("*")
    .order("display_order", { ascending: true });

  let progress: Record<string, { status: string; completed_at: string | null; notes: string | null }> = {};
  if (email) {
    const { data: prog } = await supabase
      .from("hr_training_progress")
      .select("task_id, status, completed_at, notes")
      .eq("trainee_email", email);
    progress = Object.fromEntries((prog || []).map((p) => [p.task_id, p]));
  }

  // 組合
  const structured = (days || []).map((day) => ({
    ...day,
    tasks: (tasks || [])
      .filter((t) => t.day_id === day.id)
      .map((t) => ({ ...t, progress: progress[t.id] || null })),
  }));

  // 進度統計
  const totalTasks = (tasks || []).length;
  const doneTasks = Object.values(progress).filter((p) => p.status === "done").length;

  return Response.json({
    ok: true,
    days: structured,
    stats: {
      totalTasks,
      doneTasks,
      percent: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
    },
  });
}
