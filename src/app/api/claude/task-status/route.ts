import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 讀取 claude_tasks 單一任務的狀態 — 給 Claude Code (terminal)、cron job、
 * 或任何需要「我剛剛發了個問題給 Vincent，他回了嗎？」的呼叫端用。
 *
 * GET /api/claude/task-status?id=<uuid>
 *
 * Returns:
 *   { ok, id, title, status, channel, user_response, awaiting_reply_at, done_at, updated_at }
 *
 * 呼叫方式（Claude Code loop）：
 *   const { taskId } = await askAdminViaLine({ question: "..." })
 *   while (true) {
 *     await sleep(3000)
 *     const res = await fetch(`${host}/api/claude/task-status?id=${taskId}`)
 *     const d = await res.json()
 *     if (d.status === 'done' && d.user_response) { answer = d.user_response; break }
 *   }
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return Response.json({ ok: false, error: "id required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("claude_tasks")
    .select(
      "id, title, status, channel, expected_input, user_response, awaiting_reply_at, done_at, updated_at, priority, category"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json({ ok: false, error: "task not found" }, { status: 404 });
  }

  return Response.json({
    ok: true,
    id: data.id,
    title: data.title,
    status: data.status,
    channel: data.channel,
    expectedInput: data.expected_input,
    userResponse: data.user_response,
    awaitingReplyAt: data.awaiting_reply_at,
    doneAt: data.done_at,
    updatedAt: data.updated_at,
    priority: data.priority,
    category: data.category,
    answered: data.status === "done" && !!data.user_response,
  });
}
