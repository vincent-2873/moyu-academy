import { getSupabaseAdmin } from "@/lib/supabase";
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

  // 產 claude_actions log
  await supabase.from("claude_actions").insert({
    action_type: "recruit_phone_contacted",
    target: String(queueId),
    summary: `${byEmail} 標記已打電話`,
    details: { queueId, byEmail, notes },
    result: "success",
  });

  return Response.json({ ok: true });
}
