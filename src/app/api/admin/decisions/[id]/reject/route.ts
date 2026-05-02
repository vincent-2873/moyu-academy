import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/decisions/[id]/reject
 * Body: { reason: string }  必填
 *
 * Vincent 拍板:reject 必須帶原因
 * Side effect:寫進 RAG common pillar 當教訓,Claude 之後類似 pattern 避開
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sb = getSupabaseAdmin();

  let body: { reason?: string };
  try { body = await req.json(); } catch { body = {}; }
  const reason = (body.reason || "").trim();
  if (!reason || reason.length < 4) {
    return NextResponse.json({ ok: false, error: "reject 需提供原因(>= 4 字)" }, { status: 400 });
  }

  const sessionCookie = req.cookies.get("moyu_admin_session")?.value;
  const rejecter = sessionCookie?.split("|")?.[0] || "unknown";

  const { data: decision, error: fetchErr } = await sb
    .from("decision_records")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr || !decision) {
    return NextResponse.json({ ok: false, error: "decision not found" }, { status: 404 });
  }
  if (decision.status !== "pending") {
    return NextResponse.json({ ok: false, error: `decision already ${decision.status}` }, { status: 400 });
  }

  // Update
  const rejectionText = `[駁回] ${reason}`;
  const { error: updateErr } = await sb
    .from("decision_records")
    .update({
      status: "rejected",
      vincent_decision: rejectionText,
      approved_by_email: rejecter,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
  }

  // 寫進 knowledge_chunks 給 Claude 學:這類提案被駁回,以後避開
  try {
    const lessonContent = `【Vincent 駁回的 ${decision.category} 提案】
標題:${decision.title}
背景:${decision.context}
我(Claude)當時的建議:${decision.claude_recommendation}
Vincent 駁回原因:${reason}

教訓:類似 pattern(${decision.category} + ${decision.title})我之後不要再提,或要先 reasoning 過 Vincent 的駁回原因。`;
    await sb.from("knowledge_chunks").insert({
      content: lessonContent,
      source: `decision_rejected/${id}`,
      pillar: "common",
      brand: null,
      path_type: "decision_lesson",
    });
  } catch { /* RAG 寫失敗不阻擋 reject */ }

  await sb.from("system_run_log").insert({
    source: "decision_rejected",
    status: "success",
    metadata: {
      decision_id: id,
      category: decision.category,
      title: decision.title,
      rejecter,
      reason: reason.slice(0, 300),
    },
  });

  return NextResponse.json({
    ok: true,
    decision_id: id,
    status: "rejected",
    lesson_recorded: true,
  });
}
