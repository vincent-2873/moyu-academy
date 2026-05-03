import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/decisions/[id]/reject
 * Body: { reason: string, want_v2?: boolean (default true) }
 *
 * Vincent 拍板 Wave 7.5(2026-05-02):「駁回後 Claude 應該給更好建議」
 * Closed-loop:
 *  - update 原 decision status='rejected' + 寫 reason
 *  - 寫進 knowledge_chunks pillar=common 當教訓(下次類似 pattern Claude 自動避開)
 *  - 若 want_v2=true(預設):
 *    · call Claude API 帶 (原 decision + 原 recommendation + Vincent reject reason)
 *    · Claude 產 v2 提案
 *    · INSERT 新 decision_records row,parent_id 指向被駁回的,title 加 "(改善版)"
 *    · status='pending' 等 Vincent 再次裁決
 *  - 若 want_v2=false:這個 pattern dead,Claude 之後不再提
 */

const V2_SYSTEM_PROMPT = `你是墨宇集團的 AI 執行長。Vincent(人類副手)剛駁回了你的一個提案,給了駁回原因。
請你看完原因,改一個更好的 v2 提案。

鐵則:
1. **不要重複原來方案的核心動作**(他已經駁回了)
2. **針對他的駁回原因直接回應**,不要繞
3. 用同樣的 category(strategy / hr / operations / legal / contract)
4. 提出**具體不同**的解法 — 換角度、換手段、換時機
5. 說明 v2 跟 v1 的核心差異(一句話)
6. 嚴格 JSON 輸出

JSON Schema:
{
  "title": "v2 提案標題(20-40 字)",
  "context": "原問題重述 + 我為何聽完你 reject 後改變思路(1-2 句)",
  "claude_recommendation": "v2 具體建議(2-3 段,每段帶 reasoning)",
  "urgency": "critical / high / normal",
  "due_date": "YYYY-MM-DD or null",
  "diff_from_v1": "一句話說 v2 跟 v1 哪裡不同"
}`;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sb = getSupabaseAdmin();

  let body: { reason?: string; want_v2?: boolean };
  try { body = await req.json(); } catch { body = {}; }
  const reason = (body.reason || "").trim();
  const want_v2 = body.want_v2 !== false; // 預設 true
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

  // 1. update 原 decision = rejected
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

  // 2. 寫 RAG common pillar 教訓(只在 want_v2=false 寫進「永久避開」, want_v2=true 不寫,因為對話還沒 dead)
  if (!want_v2) {
    try {
      const lessonContent = `【Vincent 駁回的 ${decision.category} 提案 — 永久避開】
標題:${decision.title}
背景:${decision.context}
我的建議:${decision.claude_recommendation}
Vincent 駁回原因:${reason}
教訓:這個議題 Vincent 已決定 dead,類似 pattern 不要再提。`;
      await sb.from("knowledge_chunks").insert({
        content: lessonContent,
        source: `decision_rejected_dead/${id}`,
        pillar: "common",
        brand: null,
        path_type: "decision_lesson",
      });
    } catch { /* 寫失敗不擋 */ }
  }

  // 3. 若 want_v2,call Claude 產 v2 提案
  let v2_decision = null;
  let v2_diff: string | null = null;
  if (want_v2) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        const client = new Anthropic({ apiKey });
        const userContext = `原 decision:
標題:${decision.title}
類別:${decision.category}
背景:${decision.context}
我(Claude)當時的建議:${decision.claude_recommendation}
緊急度:${decision.urgency}

Vincent 駁回原因:
${reason}

請你看完駁回原因,改一個 v2 提案。要針對他的駁回直接回應,不要繞。嚴格 JSON。`;
        const msg = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 3000,
          system: V2_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userContext }],
        });
        const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // INSERT 新 decision row
          const { data: newRow, error: insertErr } = await sb
            .from("decision_records")
            .insert({
              category: decision.category,
              title: `[v2 改善版] ${parsed.title}`,
              context: parsed.context,
              claude_recommendation: parsed.claude_recommendation,
              urgency: parsed.urgency || decision.urgency,
              due_date: parsed.due_date || null,
              status: "pending",
              evidence_refs: [{ type: "rejected_parent", id: id, title: decision.title, rejected_reason: reason, diff: parsed.diff_from_v1 }],
            })
            .select()
            .single();
          if (!insertErr && newRow) {
            v2_decision = newRow;
            v2_diff = parsed.diff_from_v1 || null;
          }
        }
      } catch (err) {
        console.error("[reject v2 generation failed]", err);
      }
    }
  }

  // 4. audit log
  await sb.from("system_run_log").insert({
    source: "decision_rejected",
    status: "success",
    metadata: {
      decision_id: id,
      category: decision.category,
      title: decision.title,
      rejecter,
      reason: reason.slice(0, 300),
      want_v2,
      v2_id: v2_decision?.id || null,
    },
  });

  return NextResponse.json({
    ok: true,
    decision_id: id,
    status: "rejected",
    want_v2,
    v2_decision: v2_decision ? {
      id: v2_decision.id,
      title: v2_decision.title,
      urgency: v2_decision.urgency,
      diff_from_v1: v2_diff,
    } : null,
    lesson_recorded: !want_v2,
  });
}
