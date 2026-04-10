import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 登入 API
 *
 * 設計：
 *   - 找不到帳號 → 404
 *   - 找到帳號但沒綁 LINE → 200 + user + needsLineBind:true（不擋登入，前台會顯示補綁 banner）
 *   - 已綁 LINE → 200 + user
 *
 * 補綁流程：前台收到 needsLineBind=true 就顯示 banner，按鈕導向 /api/line/oauth/start?mode=bind&email=<user email>
 */

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

  const needsLineBind = !user.line_user_id;

  return Response.json({
    user,
    needsLineBind,
  });
}
