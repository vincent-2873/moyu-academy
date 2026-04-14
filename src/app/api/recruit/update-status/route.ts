import { getSupabaseAdmin } from "@/lib/supabase";
import { hasGoogleCredentials, updateRecruitSheetRow } from "@/lib/google-api";
import { NextRequest } from "next/server";

/**
 * POST /api/recruit/update-status
 *
 * 前台招聘員登記面試結果 → 同步回寫：
 * 1. Supabase recruits 表
 * 2. Google Sheet 邀約紀錄表
 * 3. v3_commands 標記完成
 *
 * body: {
 *   commandId?: string          — v3_commands ID（有就標完成）
 *   recruitId?: string          — recruits 表 ID
 *   sheetRowIndex?: number      — Google Sheet 行號
 *   candidateName: string
 *   attendance: "出席" | "未出席" | "改期" | "未出席，有提前告知"
 *   isHired?: "錄取" | "不錄取" | ""
 *   interviewNote?: string
 *   arrangeSecond?: boolean
 *   secondInterviewTime?: string   — ISO string
 *   secondManager?: string
 * }
 */

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await req.json();

  const {
    commandId,
    recruitId,
    sheetRowIndex,
    candidateName,
    attendance,
    isHired,
    interviewNote,
    arrangeSecond,
    secondInterviewTime,
    secondManager,
  } = body;

  if (!candidateName || !attendance) {
    return Response.json({ ok: false, error: "candidateName + attendance 必填" }, { status: 400 });
  }

  const results: Record<string, unknown> = { candidateName };

  // 1. 更新 Supabase recruits
  if (recruitId) {
    const updates: Record<string, unknown> = {};
    if (attendance === "出席" && isHired === "錄取") {
      updates.stage = "offer";
      updates.offered_at = new Date().toISOString();
    } else if (attendance === "出席" && isHired === "不錄取") {
      updates.stage = "rejected";
      updates.rejected_at = new Date().toISOString();
      updates.reject_reason = interviewNote || "一面不錄取";
    }
    if (arrangeSecond && secondInterviewTime) {
      updates.interview_at = secondInterviewTime;
      updates.stage = "interview_2";
    }
    if (interviewNote) {
      updates.notes = interviewNote;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from("recruits")
        .update(updates)
        .eq("id", recruitId);
      results.dbUpdated = !error;
      if (error) results.dbError = error.message;
    }
  }

  // 2. 更新 Google Sheet
  if (sheetRowIndex && hasGoogleCredentials()) {
    try {
      const sheetUpdates: Record<string, string> = {
        attendanceStatus: attendance,
      };
      if (interviewNote) sheetUpdates.interviewNote = interviewNote;
      if (isHired) sheetUpdates.isHired = isHired;
      if (arrangeSecond) sheetUpdates.isArrangeSecond = arrangeSecond ? "是" : "否";
      if (secondInterviewTime) {
        const d = new Date(secondInterviewTime);
        sheetUpdates.secondInterviewTime = d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
      }
      if (secondManager) sheetUpdates.secondManager = secondManager;

      await updateRecruitSheetRow(sheetRowIndex, sheetUpdates);
      results.sheetUpdated = true;
    } catch (err) {
      results.sheetUpdated = false;
      results.sheetError = String(err);
    }
  }

  // 3. 標記 v3_command 完成
  if (commandId) {
    await supabase
      .from("v3_commands")
      .update({ status: "done", done_at: new Date().toISOString() })
      .eq("id", commandId);
    results.commandDone = true;
  }

  // 4. Log
  await supabase.from("claude_actions").insert({
    action_type: "recruit_interview_update",
    target: candidateName,
    summary: `面試登記: ${candidateName} · ${attendance}${isHired ? ` · ${isHired}` : ""}`,
    details: body,
    result: "success",
  });

  return Response.json({ ok: true, ...results });
}
