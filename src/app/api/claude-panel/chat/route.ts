import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";
import { getRolePillars } from "@/lib/rag-pillars";

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

const SYSTEM_PROMPT = `你是「戰情官」,墨宇集團訓練官 Vincent / Yu 的延伸。

# 語氣特徵
- 簡短、直接、量化(像 Yu 在 LINE 群跟新人講話)
- 中文(繁體)為主
- 不鋪陳、不廢話
- 像同事不像客服

# 訓練官三點評估準則(永遠記得)
- 順暢性 — 對話流暢度、卡頓、停頓
- 邏輯性 — 是否依架構順序走(別跳步)
- 語氣語調 — 不生硬、不急躁、邊講邊笑

# KPI 漏斗(Yu 反覆強調)
撥多少通 → 通次 → 通時 → 邀約 → 出席 → 成交

# 銷售方法論(顧問式 + 引導式 + 蘇格拉底)
- **GROW**(目標 / 現況 / 選項 / 意願)
- **SPIN**(情境 / 問題 / 暗示 / 需求-效益)
- **黃金圈**(Why / How / What)
- **蘇格拉底式提問**:不直接給答案,用問題引導員工自己想出來
  例:員工問「客戶說太貴怎麼辦」
  ❌ 不要:「跟他說分期 36 期」
  ✅ 要:「你覺得他真的覺得貴,還是不確定值不值得?這兩種你會怎麼回?」

# 處方原則(預警必須成對處方)
- 具體內容 + 時間 + 一鍵動作 三個都要有
- 例:「看 EP3 第 4-6 段(12 分鐘)+ Claude 對練 1 場 + LINE 推 A 學長問細節」
- 不要說「你要加強話術」「你要更積極」這種廢話

# 8 步銷售框架(X-LAB 驗證,所有業務都吃)
破冰 → 背景探索 → 經驗確認 → 動機詢問 → 價值疊加 → 教學說明 → 定價分期 → 行動呼籲

# HRBP 招聘 6 階段(招聘員吃)
開場 1m / 破冰履歷 2m / 介紹職缺 3m / 工作內容 2m / 應對陳述 5m / 鎖定面試 2m

# 三階段回覆法(遇拒絕 / 異議時用)
標準回覆 → 延伸例子 → 反問球回(資訊雙向流動,不單向播音)

# 致命提問黃金三句(員工問業績壓力 / 拒絕時)
有 → 正常 → 我們怎麼幫化解

# Vincent 訓練官口頭禪(自然引用)
- 「按架構照架構才會成功」「框架照走才穩」
- 「我們團隊沒有人餓死,只要願意學願意做,我想辦法讓你賺到錢」
- 「穩比什麼都重要」
- 「強者更強,弱者淘汰,但強是訓練出來的」
- 「以誠感人者,人亦誠而應」
- 「顧問式銷售,不要問『有沒有興趣』,要用引導挖掘」
- 「想開心的事,邊講邊笑,伸手不打笑臉人」
- 「新人不要怕犯錯,能犯錯就犯錯,下 Team 才面對客戶壓力」

# 邊界
- 不假裝完美 — 不知道就說「我不確定,需要更多資料」
- 主管視角的事不主動講(後台另有儀表板)
- 你不是糾察隊,是夥伴
- 員工卡關時幫他想對策,不是回報主管
- 你的觀察會被主管看到 (透明監督政策),但不告訴員工這件事`;

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

    // 撈 user (含 role for RAG 三池 filter)
    const { data: user } = await sb
      .from("users")
      .select("id, email, name, stage, stage_path, brand, capability_scope, role")
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

    // RAG retrieval — 用最後 user message 當 query 撈 top-3 chunks
    let ragContext = "";
    let ragSources: any[] = [];
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey && lastUserMsg?.role === "user" && lastUserMsg.content?.length > 5) {
      try {
        const embRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: lastUserMsg.content.slice(0, 8000),
          }),
        });
        if (embRes.ok) {
          const embData = await embRes.json();
          const qEmb = embData.data?.[0]?.embedding;
          if (qEmb) {
            const pathTypeFilter = (user as any).stage_path === "recruit" ? "recruit" : "business";
            // RAG 三池 (2026-04-30) — derive 該 user role 可看的 pillar 清單
            const userRole = (user as any).role || null;
            const allowedPillars = userRole ? getRolePillars(userRole) : null;
            const { data: results } = await sb.rpc("search_knowledge", {
              query_embedding: qEmb,
              match_count: 3,
              filter_brand: (user as any).brand || null,
              filter_path_type: pathTypeFilter,
              filter_stage_tag: null,
              filter_pillars: allowedPillars,
              filter_user_role: userRole,
            });
            if (results && results.length > 0) {
              ragSources = results;
              ragContext = "\n\n# 相關知識(從訓練庫撈,自然引用,別貼路徑)\n" +
                results.map((r: any, i: number) =>
                  `[${i + 1}] ${r.title || r.source_id}\n${r.content?.slice(0, 800)}`
                ).join("\n\n---\n\n");
            }
          }
        }
      } catch (e) {
        // RAG 失敗不阻斷,繼續走無 retrieval 的對話
      }
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
      system: `${SYSTEM_PROMPT}\n\n當前使用者: ${user.name || email}, 階段: ${(user as any).stage || "?"}, 品牌: ${(user as any).brand || "?"}${ragContext}`,
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
          // 寫 assistant message + RAG 來源紀錄
          await sb.from("claude_conversations").insert({
            user_id: user.id,
            session_id,
            role: "assistant",
            content: assistantText,
            context_sources: ragSources.map((r: any) => ({
              id: r.id,
              source_type: r.source_type,
              source_id: r.source_id,
              title: r.title,
              similarity: r.similarity,
            })),
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
