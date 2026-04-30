import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { setUserSessionCookie } from "@/lib/auth";

/**
 * 登入 API — 真密碼驗證 + set HMAC cookie(2026-04-30 安全 #1 加)
 *
 * body: { email, password }
 *
 * 回應：
 *   - 404: 找不到帳號
 *   - 401: 密碼錯誤
 *   - 200: { user, needsLineBind } + Set-Cookie moyu_user_session
 *
 * 密碼初始化：所有既有帳號預設 "0000"，登入後請自行去改密碼頁。
 *
 * Cookie:
 *   - 14 天有效,httpOnly,sameSite=lax
 *   - format: email|expiry_ms|hex_hmac_sha256
 *   - 簽章 secret = SUPABASE_SERVICE_ROLE_KEY (跟 admin session 同 secret)
 *   - 後續 /api/me/* 依 cookie email 驗證 ?email= 一致
 */

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "email + password 必填" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, name, brand, role, status, created_at, line_user_id, password_hash")
    .eq("email", email)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: "找不到此帳號" }, { status: 404 });

  const hash = user.password_hash;
  if (!hash) {
    return NextResponse.json({ error: "此帳號尚未設定密碼，請聯繫管理員重置" }, { status: 500 });
  }

  const ok = await bcrypt.compare(password, hash);
  if (!ok) {
    return NextResponse.json({ error: "密碼錯誤" }, { status: 401 });
  }

  // Remove password_hash from response
  const { password_hash, ...safeUser } = user;
  void password_hash;

  const res = NextResponse.json({
    user: safeUser,
    needsLineBind: !safeUser.line_user_id,
    mustChangePassword: password === "0000",
  });
  setUserSessionCookie(res, safeUser.email);
  return res;
}
