import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

/**
 * 登入 API — 真密碼驗證
 *
 * body: { email, password }
 *
 * 回應：
 *   - 404: 找不到帳號
 *   - 401: 密碼錯誤
 *   - 200: { user, needsLineBind }
 *
 * 密碼初始化：所有既有帳號預設 "0000"，登入後請自行去改密碼頁。
 */

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return Response.json({ error: "email + password 必填" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, name, brand, role, status, created_at, line_user_id, password_hash")
    .eq("email", email)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!user) return Response.json({ error: "找不到此帳號" }, { status: 404 });

  const hash = user.password_hash;
  if (!hash) {
    return Response.json({ error: "此帳號尚未設定密碼，請聯繫管理員重置" }, { status: 500 });
  }

  const ok = await bcrypt.compare(password, hash);
  if (!ok) {
    return Response.json({ error: "密碼錯誤" }, { status: 401 });
  }

  // Remove password_hash from response
  const { password_hash, ...safeUser } = user;
  void password_hash;

  return Response.json({
    user: safeUser,
    needsLineBind: !safeUser.line_user_id,
    mustChangePassword: password === "0000", // 提示前台強制改密碼
  });
}
