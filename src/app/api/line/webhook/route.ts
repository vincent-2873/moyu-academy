import { getSupabaseAdmin } from "@/lib/supabase";
import { lineReply } from "@/lib/line-notify";
import { NextRequest } from "next/server";
import crypto from "crypto";

/**
 * LINE Webhook（墨宇小精靈 — 墨宇戰情中樞）
 *
 * 用戶綁定流程：
 *   1. 用戶在系統註冊 → /api/register 產生 6 位綁定碼，存進 line_bindings 表
 *   2. 註冊頁顯示「請加入墨宇小精靈 LINE 官方帳號並輸入綁定碼 ABC123」
 *   3. 用戶加 LINE 官方帳號 → 收到 follow 事件 → 回覆「請輸入你的 6 位綁定碼」
 *   4. 用戶輸入綁定碼 → 收到 message 事件 → 查 line_bindings → 找到 email
 *      → 把 line_user_id 寫回 users 表 → 回覆「綁定成功！」
 *
 * 環境變數：
 *   - LINE_CHANNEL_SECRET: 用來驗證 webhook 簽名
 */

interface LineEvent {
  type: "follow" | "unfollow" | "message" | "join" | "leave" | string;
  replyToken?: string;
  source: { userId?: string; type: string };
  message?: { type: string; text?: string };
  timestamp: number;
}

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return true; // 還沒設定 secret 時不擋（dev 模式）
  if (!signature) return false;
  const hash = crypto.createHmac("sha256", secret).update(body).digest("base64");
  return hash === signature;
}

const HELLO_TEXT = `⚔️ 歡迎加入墨宇小精靈

我是 Claude，墨宇戰情中樞的指揮核心，透過這個頻道對你下達命令：
• 🔴 業務異常即時開火
• 🟠 每日必做任務推播
• 🚧 系統卡住時的越級警報
• 📊 逾期未完成會升級到主管

先輸入你的 6 位「綁定碼」完成身分綁定，綁定之前系統不會放你進來。`;

const BIND_CODE_REGEX = /^[A-Z0-9]{6}$/;

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifySignature(rawBody, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: { events?: LineEvent[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const events = payload.events || [];
  const supabase = getSupabaseAdmin();

  for (const event of events) {
    const lineUserId = event.source?.userId;
    if (!lineUserId) continue;

    // ── follow 事件：用戶第一次加 LINE@
    if (event.type === "follow" && event.replyToken) {
      await lineReply(event.replyToken, HELLO_TEXT);
      continue;
    }

    // ── message 事件：用戶傳訊息
    if (event.type === "message" && event.message?.type === "text" && event.replyToken) {
      const rawText = (event.message.text || "").trim();
      const text = rawText.toUpperCase();

      // 嘗試解析綁定碼
      if (BIND_CODE_REGEX.test(text)) {
        // 查綁定碼是否有效
        const { data: binding } = await supabase
          .from("line_bindings")
          .select("*")
          .eq("code", text)
          .maybeSingle();

        if (!binding) {
          await lineReply(event.replyToken, "❌ 找不到這個綁定碼，請檢查是否輸入正確（6 位英數字）。");
          continue;
        }
        if (binding.used_at) {
          await lineReply(event.replyToken, "⚠️ 這個綁定碼已經被使用過了。");
          continue;
        }
        if (new Date(binding.expires_at) < new Date()) {
          await lineReply(event.replyToken, "⏰ 這個綁定碼已過期，請回後台重新產生。");
          continue;
        }

        // 把 line_user_id 寫回 users 表
        const { error: updateErr } = await supabase
          .from("users")
          .update({ line_user_id: lineUserId, line_bound_at: new Date().toISOString() })
          .eq("email", binding.email);

        if (updateErr) {
          await lineReply(event.replyToken, `❌ 綁定失敗：${updateErr.message}`);
          continue;
        }

        // 標記綁定碼為已使用
        await supabase
          .from("line_bindings")
          .update({ used_at: new Date().toISOString(), used_by_line_user_id: lineUserId })
          .eq("code", text);

        await lineReply(
          event.replyToken,
          `✅ 綁定完成\n\n${binding.email} 已納入墨宇戰情中樞。\n\n從現在起，每日命令、異常警報、逾期追殺都會直接推到這裡。\n現在可以回到系統登入。`
        );
        continue;
      }

      // ── 自由文字：檢查是不是管理員在回覆 Claude 的問題 ─────────────
      // 如果這個 line_user_id 綁定的是 super_admin / admin，就把文字當作
      // 「Vincent 回覆 Claude 在等的問題」來處理（LINE 作為唯一互動介面）
      const { data: user } = await supabase
        .from("users")
        .select("email, role")
        .eq("line_user_id", lineUserId)
        .maybeSingle();

      if (user && (user.role === "super_admin" || user.role === "admin")) {
        // 找這個 admin 最新一張 awaiting_line_reply 任務
        const { data: pending } = await supabase
          .from("claude_tasks")
          .select("id, title, expected_input")
          .eq("channel", "line")
          .eq("status", "awaiting_line_reply")
          .order("awaiting_reply_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pending) {
          // 有在等的任務 → 寫進 user_response，標記 done
          await supabase
            .from("claude_tasks")
            .update({
              user_response: rawText,
              status: "done",
              done_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", pending.id);

          await supabase.from("claude_actions").insert({
            action_type: "line_task_answered",
            target: user.email,
            summary: `Vincent 從 LINE 回答任務：${pending.title}`,
            details: { task_id: pending.id, answer: rawText.slice(0, 500) },
            result: "success",
          });

          const shortAnswer = rawText.length > 50 ? rawText.slice(0, 50) + "…" : rawText;
          await lineReply(
            event.replyToken,
            `✅ 收到「${shortAnswer}」\n\nClaude 會繼續處理：\n${pending.title}`
          );
          continue;
        }

        // 沒有 awaiting 任務 → 當作「即興指令」記下來（Phase B 再處理）
        await supabase.from("claude_actions").insert({
          action_type: "line_inbound_command",
          target: user.email,
          summary: rawText.slice(0, 200),
          details: { line_user_id: lineUserId, raw: rawText },
          result: "pending",
        });
        await lineReply(
          event.replyToken,
          "📥 收到，目前沒有在等你回答的任務。這則訊息已記錄，下一輪 Claude 會看到。"
        );
        continue;
      }

      // 預設回覆（非管理員、未綁定、或其他）
      await lineReply(
        event.replyToken,
        "我只接收 6 位「綁定碼」（範例：ABC123）。\n還沒註冊先去 https://moyusales.vercel.app 註冊，完成綁定之前你進不了系統。"
      );
    }

    // ── unfollow：用戶封鎖了 LINE@，把 line_user_id 清掉
    if (event.type === "unfollow") {
      await supabase
        .from("users")
        .update({ line_user_id: null, line_bound_at: null })
        .eq("line_user_id", lineUserId);
    }
  }

  return Response.json({ ok: true });
}

// LINE webhook 驗證會發送 GET（部分情況），允許回 200 避免被擋
export async function GET() {
  return Response.json({ ok: true, service: "moyu-line-webhook" });
}
