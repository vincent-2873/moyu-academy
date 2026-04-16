import { getSupabaseAdmin } from "@/lib/supabase";
import { hasGoogleCredentials, findAndUpdateSheetByName } from "@/lib/google-api";
import { NextRequest } from "next/server";

/**
 * POST /api/recruit/mark-contacted
 * 招聘員標記「已打電話」
 * body: { queueId, byEmail, notes?, phone? }
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await req.json();
  const { queueId, byEmail, notes, phone } = body;

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
      const updates: Record<string, string> = {
        phone: finalPhone,
        inviteRecord: [
          `已打電話 ${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`,
          `聯絡人 ${byEmail}`,
          notes ? `備註: ${notes}` : "",
        ].filter(Boolean).join(" / "),
      };
      const r = await findAndUpdateSheetByName(queue.candidate_name, finalPhone, updates);
      sheetResult = { synced: true, rowIndex: r.rowIndex, created: r.created };
    } catch (e) {
      sheetResult = { synced: false, error: String(e) };
    }
  }

  // 4. 產 claude_actions log
  await supabase.from("claude_actions").insert({
    action_type: "recruit_phone_contacted",
    target: queue.candidate_name,
    summary: `${byEmail} 標記已打電話: ${queue.candidate_name}`,
    details: { queueId, byEmail, notes, sheet: sheetResult },
    result: "success",
  });

  return Response.json({ ok: true, sheet: sheetResult });
}
