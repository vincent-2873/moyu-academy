import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 註冊 API
 *
 * 註冊成功會回傳：
 *   - userId
 *   - lineBindingCode: 6 位綁定碼，註冊頁要顯示給用戶看
 *   - lineBindingExpiresAt
 *   - lineBindingRequired: true（前端要強制用戶完成綁定才能繼續）
 */

const BIND_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去除容易混淆的 0/O/1/I

function generateBindingCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += BIND_CODE_CHARS[Math.floor(Math.random() * BIND_CODE_CHARS.length)];
  }
  return code;
}

async function createUniqueBindingCode(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateBindingCode();
    const { data } = await supabase.from("line_bindings").select("code").eq("code", code).maybeSingle();
    if (!data) return code;
  }
  // 極端情況：fallback 加上時間戳
  return generateBindingCode() + Date.now().toString(36).slice(-2).toUpperCase();
}

export async function POST(req: NextRequest) {
  const { email, name, brand } = await req.json();
  if (!email) return Response.json({ error: "email required" }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // Check if user exists
  const { data: existing } = await supabase
    .from("users")
    .select("id, line_user_id")
    .eq("email", email)
    .single();

  let userId: string;
  let alreadyBound = false;

  if (existing) {
    userId = existing.id;
    alreadyBound = !!existing.line_user_id;
  } else {
    // Create new user
    const { data, error } = await supabase
      .from("users")
      .insert({
        email,
        name: name || email.split("@")[0],
        brand: brand || "nschool",
        role: brand === "hq" ? "ceo" : "sales_rep",
        status: "active",
      })
      .select("id")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    userId = data.id;
  }

  // 已綁定就不發新碼
  if (alreadyBound) {
    return Response.json({
      userId,
      lineBindingRequired: false,
      message: "已綁定 LINE",
    });
  }

  // 產生綁定碼
  const code = await createUniqueBindingCode(supabase);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: bindErr } = await supabase.from("line_bindings").insert({
    code,
    email,
    user_id: userId,
    expires_at: expiresAt,
  });

  if (bindErr) {
    // 綁定碼存不進去也不擋註冊
    return Response.json({
      userId,
      lineBindingRequired: true,
      lineBindingError: bindErr.message,
    });
  }

  return Response.json({
    userId,
    lineBindingRequired: true,
    lineBindingCode: code,
    lineBindingExpiresAt: expiresAt,
    lineFriendUrl: process.env.LINE_FRIEND_URL || null, // 加好友連結（環境變數，由用戶提供）
  });
}
