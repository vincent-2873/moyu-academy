import { getSupabaseAdmin } from "@/lib/supabase";
import { lineReply } from "@/lib/line-notify";
import { NextRequest } from "next/server";
import crypto from "crypto";

/**
 * LINE Webhook（墨宇小精靈）
 *
 * 用戶綁定流程：
 *   1. 用戶在系統註冊 → /api/register 產生 6 位綁定碼，存進 line_bindings 表
 *   2. 註冊頁顯示「請加入墨宇小精靈 LINE@ 並輸入綁定碼 ABC123」
 *   3. 用戶加 LINE@ → 我們收到 follow 事件 → 回覆「請輸入你的 6 位綁定碼」
 *   4. 用戶輸入綁定碼 → 我們收到 message 事件 → 查 line_bindings → 找到 email
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

const HELLO_TEXT = `👋 歡迎加入墨宇小精靈！

我是 Claude，墨宇學院的監測系統，我會在這裡推播：
• 🚧 系統卡住的緊急通知
• 🔴 業務異常警報
• 🤖 Claude 指派的任務
• 📊 每日戰報

請輸入你的 6 位「綁定碼」完成帳號連結。
（綁定碼會在你註冊時顯示在後台）`;

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
      const text = (event.message.text || "").trim().toUpperCase();

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
          `✅ 綁定成功！\n\n你的帳號 ${binding.email} 已連結到墨宇小精靈。\n\n之後系統的緊急通知都會直接推到這裡。`
        );
        continue;
      }

      // 預設回覆
      await lineReply(
        event.replyToken,
        "我只接收 6 位「綁定碼」（範例：ABC123）。\n如果還沒註冊請先到 https://moyusales.vercel.app 註冊。"
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
