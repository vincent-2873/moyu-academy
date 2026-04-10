import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 註冊 API（強制 LINE 綁定）
 *
 * 流程：
 *   1. 建立 users 資料列
 *   2. 產生 6 位綁定碼，寫入 line_bindings 表（24h 有效）
 *   3. 回傳 { userId, bindCode, lineFriendUrl }
 *   4. 前台顯示綁定 UI → 使用者加 LINE@ 並在 LINE 輸入該綁定碼
 *      → webhook 把 line_user_id 寫回 users 表
 *   5. 前台 poll /api/line/binding-status?code=XXXXXX，顯示綁定完成後才放進系統
 *
 * 未綁定 LINE 的帳號無法登入（/api/login 會擋）。
 */

function generateBindCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去掉易混淆的 0/O/1/I
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function POST(req: NextRequest) {
  const { email, name, brand } = await req.json();
  if (!email) return Response.json({ ok: false, error: "email required" }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // 1. 查或建 user
  const { data: existing } = await supabase
    .from("users")
    .select("id, line_user_id")
    .eq("email", email)
    .maybeSingle();

  let userId: string | null = existing?.id || null;
  let alreadyBound = !!existing?.line_user_id;

  if (!existing) {
    const { data, error } = await supabase
      .from("users")
      .insert({
        email,
        name: name || email.split("@")[0],
        brand: brand || "nschool",
        role: brand === "hq" ? "ceo" : brand === "legal" ? "director" : "sales_rep",
        status: "active",
      })
      .select("id")
      .single();

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
    userId = data.id;
  }

  // 已綁過 LINE 直接放行（回頭再註冊的情境）
  if (alreadyBound) {
    return Response.json({ ok: true, userId, alreadyBound: true });
  }

  // 2. 產生綁定碼（碰撞就重生，最多 5 次）
  let bindCode: string | null = null;
  for (let i = 0; i < 5; i++) {
    const code = generateBindCode();
    const { error: insertErr } = await supabase.from("line_bindings").insert({
      code,
      email,
      user_id: userId,
    });
    if (!insertErr) {
      bindCode = code;
      break;
    }
    // 如果不是 unique 違反就直接噴錯
    if (!insertErr.message?.toLowerCase().includes("duplicate")) {
      return Response.json({ ok: false, error: insertErr.message }, { status: 500 });
    }
  }

  if (!bindCode) {
    return Response.json({ ok: false, error: "無法產生綁定碼，請重試" }, { status: 500 });
  }

  // 3. LINE 官方帳號加好友網址（由環境變數提供 basic id，例：@abc1234x）
  const lineBasicId = process.env.NEXT_PUBLIC_LINE_BASIC_ID || "";
  const lineFriendUrl = lineBasicId
    ? `https://line.me/R/ti/p/${encodeURIComponent(lineBasicId)}`
    : "";

  // 回傳鍵名與 src/lib/sync.ts 的 SyncRegisterResult 對齊
  return Response.json({
    ok: true,
    userId,
    lineBindingRequired: true,
    lineBindingCode: bindCode,
    lineFriendUrl,
    message: "請加入 LINE 官方帳號並輸入綁定碼完成啟用",
  });
}
