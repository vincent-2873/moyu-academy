import { getSupabaseAdmin } from "@/lib/supabase";
import { hasGoogleCredentials, findAndUpdateSheetByName } from "@/lib/google-api";
import { NextRequest } from "next/server";

/**
 * POST /api/recruit/mark-contacted
 * 招聘員標記「已打電話」
 * body: {
 *   queueId, byEmail, notes?, phone?,
 *   contactResult?, interviewTime?, interviewMethod?,
 *   expectedSalary?, workStatus?
 * }
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await req.json();
  const {
    queueId, byEmail, notes, phone,
    contactResult, interviewTime, interviewMethod,
    expectedSalary, workStatus,
  } = body;

  if (!queueId || !byEmail) {
    return Response.json({ ok: false, error: "queueId + byEmail required" }, { status: 400 });
  }

  // 1. 讀 queue 取候選人資料
  const { data: queue } = await supabase
    .from("outreach_104_queue")
    .select("*")
    .eq("id", queueId)
    .maybeSingle();
  if (!queue) return Response.json({ ok: false, error: "queue not found" }, { status: 404 });

  // 2. 更新 queue
  const patch: Record<string, unknown> = {
    phone_contacted_at: new Date().toISOString(),
    phone_contacted_by: byEmail,
  };
  if (notes) patch.interview_notes = notes;
  if (phone) patch.candidate_phone = phone;
  // 如果填了面試時間，一起更新 queue
  if (interviewTime) {
    patch.interview_scheduled_at = new Date(interviewTime).toISOString();
    patch.interview_location = interviewMethod || null;
  }

  const { error } = await supabase
    .from("outreach_104_queue")
    .update(patch)
    .eq("id", queueId);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  // 3. 同步 Google Sheet（電話補登到邀約紀錄表）
  let sheetResult: Record<string, unknown> = { synced: false };
  if (hasGoogleCredentials()) {
    try {
      const finalPhone = phone || queue.candidate_phone || "";
      const nowStr = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
      const recordParts = [
        `已打電話 ${nowStr}`,
        `聯絡人 ${byEmail}`,
        contactResult ? `結果: ${contactResult}` : "",
        workStatus ? `工作狀態: ${workStatus}` : "",
        expectedSalary ? `期望薪資: ${expectedSalary}` : "",
        interviewMethod ? `面試方式: ${interviewMethod}` : "",
        notes ? `備註: ${notes}` : "",
      ].filter(Boolean).join(" / ");

      const updates: Record<string, string> = {
        phone: finalPhone,
        inviteRecord: recordParts,
      };
      // 如果有面試時間，更新 Sheet 的面試欄位
      if (interviewTime) {
        const ivTime = new Date(interviewTime).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
        updates.interviewTime = ivTime;
      }

      const r = await findAndUpdateSheetByName(
        queue.candidate_name,
        finalPhone,
        updates,
        {
          name: queue.candidate_name,
          branch: "高雄",
          recruiter: byEmail,
          phone: finalPhone,
          inviteDate: new Date().toISOString().slice(0, 10).replace(/-/g, "/"),
          inviteMethod: "104信件邀約",
          channel: queue.account === "ruifu" ? "睿富" : "墨凡",
          jobType: "業務",
        }
      );
      sheetResult = { synced: true, rowIndex: r.rowIndex, created: r.created };
    } catch (e) {
      sheetResult = { synced: false, error: String(e) };
    }
  }

  // 4. 更新對應的 v3_command 為 done（若存在）
  let taskUpdated = false;
  try {
    const { data: cmds } = await supabase
      .from("v3_commands")
      .select("id")
      .eq("pillar_id", "recruit")
      .like("ai_reasoning", `queue_id:${queueId}`)
      .eq("status", "pending")
      .limit(1);

    if (cmds && cmds.length > 0) {
      await supabase
        .from("v3_commands")
        .update({ status: "done", done_at: new Date().toISOString() })
        .eq("id", cmds[0].id);
      taskUpdated = true;
    }
  } catch {
    // non-critical, ignore
  }

  // 5. 產 claude_actions log
  await supabase.from("claude_actions").insert({
    action_type: "recruit_phone_contacted",
    target: queue.candidate_name,
    summary: `${byEmail} 標記已打電話: ${queue.candidate_name} (${contactResult || "未填結果"})`,
    details: {
      queueId, byEmail, notes, contactResult,
      interviewTime, interviewMethod, expectedSalary, workStatus,
      sheet: sheetResult, taskUpdated,
    },
    result: "success",
  });

  return Response.json({ ok: true, sheet: sheetResult, taskUpdated });
}
