import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/legal/draft
 *   body: { case_id: string, doc_type: "answer" | "reply" | "letter", instruction?: string }
 *
 * 對齊 system-tree v2 §法務工作台/draft:
 *   1. 撈案件詳情(legal_cases table)
 *   2. RAG 撈法務 pillar 知識(目前 chunks 少,有 keyword fallback)
 *   3. Anthropic Claude 起草(answer 答辯狀 / reply 回函 / letter 律師函)
 *   4. 回傳 { draft, sources }
 *
 * 鐵則:沒法務 source 時 RAG 會 ilike fallback 跨 pillar 模糊搜(common pillar 也會回)
 */

const DOC_TYPE_LABELS: Record<string, string> = {
  answer: "民事答辯狀",
  reply: "回函(對外正式回應)",
  letter: "律師函(警告函/存證信函式)",
};

export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();
  let body: { case_id?: string; doc_type?: string; instruction?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const case_id = body.case_id;
  const doc_type = body.doc_type;
  const instruction = body.instruction || "";

  if (!case_id || !doc_type) {
    return NextResponse.json({ error: "case_id 與 doc_type 必填" }, { status: 400 });
  }
  if (!DOC_TYPE_LABELS[doc_type]) {
    return NextResponse.json({ error: `doc_type 必須為 ${Object.keys(DOC_TYPE_LABELS).join("/")}` }, { status: 400 });
  }

  // 1. 案件詳情
  const { data: legalCase, error: caseErr } = await sb
    .from("legal_cases")
    .select("*")
    .eq("id", case_id)
    .maybeSingle();

  if (caseErr || !legalCase) {
    return NextResponse.json({ error: "案件不存在或讀取失敗" }, { status: 404 });
  }

  // 2. RAG 法務 pillar 撈知識(top 5,失敗也讓 Claude 起草)
  let ragChunks: Array<{ title: string; content: string; pillar: string }> = [];
  try {
    const { data } = await sb
      .from("knowledge_chunks")
      .select("title, content, pillar")
      .eq("pillar", "legal")
      .limit(5);
    ragChunks = data || [];
  } catch {
    ragChunks = [];
  }

  // 3. 構造 prompt
  const docLabel = DOC_TYPE_LABELS[doc_type];
  const systemPrompt = [
    "你是墨宇集團法務 Claude,基於台灣法律專業起草文書。",
    "原則:",
    "- 用詞嚴謹、正式、不誇大",
    "- 引法條時標明法條編號",
    "- 不確定時用「依據相關法律規定」等保守措辭",
    "- 結尾標準格式(此致 XXX、具狀人、年月日)",
    "",
    "如有 RAG 知識庫提供類似判例 / 範本 / 過去案件,優先參考其結構跟措辭。",
  ].join("\n");

  const caseDescription = [
    `案件編號:${legalCase.case_no_internal || legalCase.case_no_external || "(內部)"}`,
    `案件名稱:${legalCase.title}`,
    `類型:${legalCase.kind}`,
    `品牌:${legalCase.brand_code || "—"}`,
    `對方:${legalCase.primary_party_name || "—"}`,
    `承辦機關:${legalCase.agency || "—"}`,
    `回應期限:${legalCase.response_deadline || "—"}`,
    `求償金額:${legalCase.amount_claimed ? `NT$ ${legalCase.amount_claimed.toLocaleString()}` : "—"}`,
    `階段:${legalCase.stage}`,
    `摘要:${legalCase.summary || "(待補)"}`,
  ].join("\n");

  const ragSection = ragChunks.length > 0
    ? "\n\n=== RAG 法務知識庫(供參考)===\n" + ragChunks.map((c, i) => `[${i + 1}] ${c.title}\n${c.content.slice(0, 500)}`).join("\n\n")
    : "\n\n(法務 pillar RAG 無命中知識,請依基本台灣法律原則起草)";

  const userPrompt = [
    `請起草一份「${docLabel}」。`,
    "",
    "=== 案件資訊 ===",
    caseDescription,
    instruction ? `\n=== 額外指示 ===\n${instruction}` : "",
    ragSection,
    "",
    "請輸出完整文書(含開頭、本文、結尾),不要包額外解釋。",
  ].join("\n");

  // 4. Anthropic Claude 起草
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY 未設定" }, { status: 500 });
  }

  try {
    const result = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const draft = result.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("\n");

    // log 進 system_run_log
    try {
      await sb.from("system_run_log").insert({
        kind: "legal_draft",
        target: case_id,
        status: "ok",
        metadata: { doc_type, draft_length: draft.length, rag_count: ragChunks.length },
      });
    } catch { /* ignore log fail */ }

    return NextResponse.json({
      ok: true,
      draft,
      doc_type,
      doc_label: docLabel,
      case_summary: legalCase.title,
      sources: ragChunks.map(c => ({ title: c.title })),
    });
  } catch (err) {
    return NextResponse.json({
      error: "Claude 起草失敗",
      detail: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
