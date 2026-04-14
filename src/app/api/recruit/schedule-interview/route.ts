import { getSupabaseAdmin } from "@/lib/supabase";
import { hasGoogleCredentials, createCalendarEvent, updateRecruitSheetRow } from "@/lib/google-api";
import { NextRequest } from "next/server";

/**
 * POST /api/recruit/schedule-interview
 *
 * 前台招聘員安排面試 → 同步：
 * 1. Google Calendar 建立面試事件
 * 2. Supabase recruits 更新 interview_at
 * 3. Google Sheet 更新一面/二面時間
 *
 * body: {
 *   recruitId?: string
 *   sheetRowIndex?: number
 *   candidateName: string
 *   location: string          — 據點名稱
 *   startTime: string         — ISO string
 *   endTime?: string          — ISO string，預設 +1hr
 *   interviewManager?: string — 面試主管名字
 *   managerEmail?: string     — 面試主管 email（加到 Calendar 邀請）
 *   calendarEmail: string     — 招聘員 email（Calendar owner）
 *   round: 1 | 2              — 一面 or 二面
 * }
 */

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await req.json();

  const {
    recruitId,
    sheetRowIndex,
    candidateName,
    location,
    startTime,
    endTime,
    interviewManager,
    managerEmail,
    calendarEmail,
    round = 1,
  } = body;

  if (!candidateName || !startTime || !calendarEmail) {
    return Response.json(
      { ok: false, error: "candidateName + startTime + calendarEmail 必填" },
      { status: 400 }
    );
  }

  const results: Record<string, unknown> = { candidateName, round };

  // 1. Google Calendar
  if (hasGoogleCredentials()) {
    try {
      const attendees = managerEmail ? [managerEmail] : [];
      const calResult = await createCalendarEvent({
        calendarId: calendarEmail,
        candidateName,
        location: location || "待定",
        startTime,
        endTime,
        attendees,
        description: [
          `面試候選人：${candidateName}`,
          `據點：${location || "待定"}`,
          `面試主管：${interviewManager || "待定"}`,
          `第${round}面`,
        ].join("\n"),
      });
      results.calendarCreated = true;
      results.calendarLink = calResult.htmlLink;
    } catch (err) {
      results.calendarCreated = false;
      results.calendarError = String(err);
    }
  } else {
    results.calendarCreated = false;
    results.calendarError = "Google credentials not configured";
  }

  // 2. Supabase recruits
  if (recruitId) {
    const stage = round === 1 ? "interview_1" : "interview_2";
    const { error } = await supabase
      .from("recruits")
      .update({ interview_at: startTime, stage })
      .eq("id", recruitId);
    results.dbUpdated = !error;
    if (error) results.dbError = error.message;
  }

  // 3. Google Sheet
  if (sheetRowIndex && hasGoogleCredentials()) {
    try {
      const d = new Date(startTime);
      const timeStr = d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
      const updates: Record<string, string> =
        round === 1
          ? { interviewTime: timeStr, interviewManager: interviewManager || "" }
          : { secondInterviewTime: timeStr, secondManager: interviewManager || "" };
      await updateRecruitSheetRow(sheetRowIndex, updates);
      results.sheetUpdated = true;
    } catch (err) {
      results.sheetUpdated = false;
      results.sheetError = String(err);
    }
  }

  // 4. 推入 104 worker 佇列
  const { error: queueErr } = await supabase.from("pending_104_actions").insert({
    action_type: "send_interview_invite",
    candidate_name: candidateName,
    candidate_104_id: body.candidate104Id || null,
    account: body.account || "mofan",
    payload: {
      interviewTime: startTime,
      endTime,
      interviewManager,
      location: location || null,
      round,
      calendarLink: results.calendarLink || null,
    },
    recruit_id: recruitId || null,
  });
  results.queued104 = !queueErr;
  if (queueErr) results.queue104Error = queueErr.message;

  // 5. Log
  await supabase.from("claude_actions").insert({
    action_type: "recruit_schedule_interview",
    target: candidateName,
    summary: `安排第${round}面: ${candidateName} · ${new Date(startTime).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
    details: body,
    result: "success",
  });

  return Response.json({ ok: true, ...results });
}
