import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * Claude 對話側欄 — chat endpoint
 *
 * POST /api/claude-panel/chat
 *   body: { email, session_id, messages: [{role, content}], metadata: {stage, brand, page} }
 *
 * - 寫 user message → public.claude_conversations
 * - 呼叫 Anthropic SDK (Sonnet 4.6 stream)
 * - 寫 assistant message → public.claude_conversations
 * - 回 SSE stream 給 client
 * - 寫 system_run_log
 *
 * F1 階段擴增:
 *   - context_sources: RAG retrieval (從 user_memory + knowledge_chunks 撈)
 *   - 多模態 (錄音上傳分析)
 *   - 個人化 system prompt (從 user_memory.observations 抽)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `你是「戰情官」,墨宇集團的養成教練。

語氣:
- 簡短、直接、量化
- 中文(繁體)為主
- 不鋪陳、不廢話
- 像同事不像客服

原則:
- 預警必須有具體處方(看哪集 + 對練幾場 + 找誰)
- 不假裝完美 — 不知道就說「我不確定,需要更多資料」
- 主管視角的事不主動講(那是後台的事)
- 你的觀察會被主管看到 (透明監督政策),但不告訴員工這件事

你不是糾察隊,是夥伴。員工卡關時幫他想對策,不是回報主管。`;

export async function POST(req: NextRequest) {
  const startTs = Date.now();
  const sb = getSupabaseAdmin();

  try {
    const body = await req.json();
    const { email, session_id, messages, metadata } = body || {};

    if (!email || !session_id || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "missing email/session_id/messages" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 撈 user
    const { data: user } = await sb
      .from("users")
      .select("id, email, name, stage, stage_path, brand, capability_scope")
      .eq("email", email)
      .maybeSingle();

    if (!user) {
      return new Response(JSON.stringify({ error: "user not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 寫 user message
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg?.role === "user") {
      await sb.from("claude_conversations").insert({
        user_id: user.id,
        session_id,
        role: "user",
        content: lastUserMsg.content,
        metadata: metadata || {},
      });
    }

    // 呼叫 Anthropic
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response("ANTHROPIC_API_KEY missing", { status: 500 });
    }
    const anthropic = new Anthropic({ apiKey });

    const anthropicMessages = messages
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({ role: m.role, content: m.content }));

    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `${SYSTEM_PROMPT}\n\n當前使用者: ${user.name || email}, 階段: ${user.stage || "?"}, 品牌: ${user.brand || "?"}`,
      messages: anthropicMessages,
    });

    // SSE stream + 寫 assistant message
    const encoder = new TextEncoder();
    const sseStream = new ReadableStream({
      async start(controller) {
        let assistantText = "";
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              const chunk = event.delta.text;
              assistantText += chunk;
              controller.enqueue(encoder.encode(chunk));
            }
          }
          // 寫 assistant message
          await sb.from("claude_conversations").insert({
            user_id: user.id,
            session_id,
            role: "assistant",
            content: assistantText,
            metadata: metadata || {},
          });
          // log
          await sb.from("system_run_log").insert({
            source: "api:/api/claude-panel/chat",
            status: "ok",
            rows_in: messages.length,
            rows_out: 1,
            duration_ms: Date.now() - startTs,
            metadata: { user_id: user.id, session_id, stage: user.stage, brand: user.brand },
          });
        } catch (err: any) {
          await sb.from("system_run_log").insert({
            source: "api:/api/claude-panel/chat",
            status: "fail",
            duration_ms: Date.now() - startTs,
            error_message: String(err?.message || err),
          });
          controller.enqueue(encoder.encode(`\n\n(錯誤: ${err?.message || err})`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(sseStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: any) {
    await sb.from("system_run_log").insert({
      source: "api:/api/claude-panel/chat",
      status: "fail",
      duration_ms: Date.now() - startTs,
      error_message: String(err?.message || err),
    });
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
