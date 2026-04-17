import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * POST /api/recruit/tasks/claim
 * body: { taskId, email }
 *
 * 招聘員認領一筆未分配的任務（把 owner_email 從 manager 改成自己）
 */

const MANAGER_EMAIL = "lynn@xplatform.world";

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json();
    const { taskId, email } = body;

    if (!taskId || !email) {
      return Response.json({ ok: false, error: "taskId + email required" }, { status: 400 });
    }

    // 確認任務存在且是未認領狀態（owner 是 manager + status pending）
    const { data: task, error: fetchErr } = await supabase
      .from("v3_commands")
      .select("id, owner_email, status, title")
      .eq("id", taskId)
      .single();

    if (fetchErr || !task) {
      return Response.json({ ok: false, error: "任務不存在" }, { status: 404 });
    }

    if (task.owner_email !== MANAGER_EMAIL) {
      return Response.json({ ok: false, error: `任務已被 ${task.owner_email} 認領` }, { status: 409 });
    }

    if (task.status !== "pending") {
      return Response.json({ ok: false, error: `任務狀態是 ${task.status}，無法認領` }, { status: 409 });
    }

    // 更新 owner + 標記 acknowledged
    const { data: updated, error: updateErr } = await supabase
      .from("v3_commands")
      .update({
        owner_email: email,
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .select()
      .single();

    if (updateErr) {
      return Response.json({ ok: false, error: updateErr.message }, { status: 500 });
    }

    // 記錄
    await supabase.from("claude_actions").insert({
      action_type: "recruit_task_claimed",
      target: task.title,
      summary: `${email} 認領任務: ${task.title}`,
      details: { taskId, email },
      result: "success",
    });

    return Response.json({ ok: true, task: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
