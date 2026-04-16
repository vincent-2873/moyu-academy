import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * POST /api/recruit/schedule-interview-104
 * 招聘員填面試時間 → 寫 queue + 寫 pending_104_actions
 * body: { queueId, interviewTime, location, byEmail, notes?, phone? }
 *
 * worker 的 api-interview-sender daemon 會掃 pending_104_actions 並用 104 API 自動發面試邀請
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await req.json();
  const { queueId, interviewTime, location, byEmail, notes, phone } = body;

  if (!queueId || !interviewTime || !byEmail) {
    return Response.json({ ok: false, error: "queueId + interviewTime + byEmail required" }, { status: 400 });
  }

  // 1. 取得 queue 資料
  const { data: queue, error: qErr } = await supabase
    .from("outreach_104_queue")
    .select("*")
    .eq("id", queueId)
    .maybeSingle();
  if (qErr || !queue) return Response.json({ ok: false, error: "queue not found" }, { status: 404 });

  // 2. 更新 queue
  await supabase.from("outreach_104_queue").update({
    interview_scheduled_at: new Date(interviewTime).toISOString(),
    interview_location: location || "線上視訊",
    interview_notes: notes || "",
    candidate_phone: phone || queue.candidate_phone,
    status: "interview_scheduled",
  }).eq("id", queueId);

  // 3. 推入 104 發信佇列 (worker 每 30 秒掃此表)
  await supabase.from("pending_104_actions").insert({
    action_type: "send_interview_invite",
    candidate_name: queue.candidate_name,
    candidate_104_id: queue.candidate_104_id,
    account: queue.account,
    payload: {
      interview_time: interviewTime,
      location: location || "線上視訊",
      contact_person: byEmail,
      job_no: queue.account === "ruifu" ? "15071604" : "14881298",
      notes,
      queue_id: queueId,
    },
    status: "pending",
  });

  // 4. Log
  await supabase.from("claude_actions").insert({
    action_type: "recruit_schedule_interview_104",
    target: queue.candidate_name,
    summary: `${byEmail} 安排 ${queue.candidate_name} 面試 ${new Date(interviewTime).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
    details: { queueId, interviewTime, location, byEmail },
    result: "success",
  });

  return Response.json({ ok: true, queued: true });
}
