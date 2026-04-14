import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * POST /api/hr-training/progress
 * 更新某個 trainee 的某個任務進度
 *
 * body: { email, taskId, status, notes? }
 * status: pending / in_progress / done
 */
export async function POST(req: NextRequest) {
  const { email, taskId, status, notes } = await req.json();
  if (!email || !taskId || !status) {
    return Response.json({ error: "email + taskId + status 必填" }, { status: 400 });
  }
  if (!["pending", "in_progress", "done"].includes(status)) {
    return Response.json({ error: "status invalid" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const payload: Record<string, unknown> = {
    trainee_email: email,
    task_id: taskId,
    status,
    updated_at: new Date().toISOString(),
  };
  if (notes !== undefined) payload.notes = notes;
  if (status === "done") payload.completed_at = new Date().toISOString();

  const { error } = await supabase
    .from("hr_training_progress")
    .upsert(payload, { onConflict: "trainee_email,task_id" });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
