import { getSupabaseAdmin } from "@/lib/supabase";
import { hasGoogleCredentials, findAndUpdateSheetByName, createCalendarEvent } from "@/lib/google-api";
import { NextRequest } from "next/server";

/**
 * POST /api/recruit/schedule-interview-104
 * 招聘員填面試時間 →
 *  1. 更新 outreach_104_queue
 *  2. 推 pending_104_actions（worker 自動用 104 API 發面試邀請）
 *  3. 同步 Google Sheet（一面時間 + 主管 + 備註）
 *  4. 建 Google Calendar 事件
 *  5. Log
 *
 * body: { queueId, interviewTime, location, byEmail, notes?, phone?, interviewManager? }
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await req.json();
  const { queueId, interviewTime, location, byEmail, notes, phone, interviewManager } = body;

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

  const results: Record<string, unknown> = { candidateName: queue.candidate_name };

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
  results.queued104 = true;

  // 4. 同步 Google Sheet
  if (hasGoogleCredentials()) {
    try {
      const t = new Date(interviewTime);
      const timeStr = t.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
      const finalPhone = phone || queue.candidate_phone || "";
      const updates: Record<string, string> = {
        interviewTime: timeStr,
        interviewManager: interviewManager || "",
        interviewNote: [
          location ? `地點: ${location}` : "",
          notes || "",
          `排於: ${byEmail}`,
        ].filter(Boolean).join(" / "),
      };
      if (finalPhone) updates.phone = finalPhone;
      const r = await findAndUpdateSheetByName(queue.candidate_name, finalPhone, updates, {
        name: queue.candidate_name,
        branch: location || "線上視訊",
        recruiter: byEmail,
        phone: finalPhone,
        inviteDate: new Date().toISOString().slice(0, 10).replace(/-/g, "/"),
        inviteMethod: "104信件邀約",
        channel: queue.account === "ruifu" ? "睿富" : "墨凡",
        jobType: "業務",
      });
      results.sheetSynced = true;
      results.sheetRowIndex = r.rowIndex;
    } catch (e) {
      results.sheetSynced = false;
      results.sheetError = String(e);
    }
  }

  // 5. Google Calendar 事件
  if (hasGoogleCredentials()) {
    try {
      const cal = await createCalendarEvent({
        calendarId: byEmail,
        candidateName: queue.candidate_name,
        location: location || "線上視訊",
        startTime: new Date(interviewTime).toISOString(),
        attendees: interviewManager ? [] : [],
        description: [
          `候選人：${queue.candidate_name}`,
          `來源：104 ${queue.account === "ruifu" ? "睿富" : "墨凡"}`,
          `負責人：${byEmail}`,
          `面試主管：${interviewManager || "待定"}`,
          notes ? `備註：${notes}` : "",
        ].filter(Boolean).join("\n"),
      });
      results.calendarCreated = true;
      results.calendarLink = cal.htmlLink;
    } catch (e) {
      results.calendarCreated = false;
      results.calendarError = String(e);
    }
  }

  // 6. Log
  await supabase.from("claude_actions").insert({
    action_type: "recruit_schedule_interview_104",
    target: queue.candidate_name,
    summary: `${byEmail} 安排 ${queue.candidate_name} 面試 ${new Date(interviewTime).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
    details: { queueId, interviewTime, location, byEmail, results },
    result: "success",
  });

  return Response.json({ ok: true, ...results });
}
