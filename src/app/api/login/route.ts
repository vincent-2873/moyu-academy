import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 登入 API — 擋住未綁定 LINE 的帳號
 *
 * 邏輯：
 *   1. email 找不到 → 404
 *   2. 帳號存在但 line_user_id 為空 → 403 + 帶出新的綁定碼，讓前台引導去綁
 *   3. 已綁定 → 正常回傳 user
 */
function generateBindCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return Response.json({ error: "email required" }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, name, brand, role, status, created_at, line_user_id")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!user) {
    return Response.json({ error: "找不到此帳號" }, { status: 404 });
  }

  // 未綁定 LINE → 擋掉，順便幫他產一組新的綁定碼
  if (!user.line_user_id) {
    // 先清掉可能存在的過期綁定碼，產新的
    let bindCode: string | null = null;
    for (let i = 0; i < 5; i++) {
      const code = generateBindCode();
      const { error: insertErr } = await supabase.from("line_bindings").insert({
        code,
        email,
        user_id: user.id,
      });
      if (!insertErr) {
        bindCode = code;
        break;
      }
      if (!insertErr.message?.toLowerCase().includes("duplicate")) break;
    }

    const lineBasicId = process.env.NEXT_PUBLIC_LINE_BASIC_ID || "";
    const lineFriendUrl = lineBasicId
      ? `https://line.me/R/ti/p/${encodeURIComponent(lineBasicId)}`
      : "";

    return Response.json(
      {
        error: "LINE_BIND_REQUIRED",
        message: "此帳號尚未綁定 LINE 官方帳號，請完成綁定才能登入",
        lineBindingRequired: true,
        lineBindingCode: bindCode,
        lineFriendUrl,
      },
      { status: 403 }
    );
  }

  return Response.json({ user });
}
