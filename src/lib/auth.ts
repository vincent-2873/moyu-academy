/**
 * 前台用戶 session HMAC cookie helpers (對應 admin auth 同 pattern)
 *
 * Cookie 名:`moyu_user_session`
 * 格式:    `${email}|${expiry_ms}|${hex_hmac_sha256}`
 * 簽章 key:`SUPABASE_SERVICE_ROLE_KEY` (跟 admin session 同 secret)
 *
 * 用途:防 `/api/me/*` 被任意 ?email= 串偷別人資料
 *
 * 修復:Vincent 2026-04-30 安全反饋 #1 (PERMISSIONS.md TODO)
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

const COOKIE_NAME = "moyu_user_session";
const SESSION_DAYS = 14;

function getSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function buildUserSessionCookie(email: string): string {
  const secret = getSecret();
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  const expiry = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const sig = createHmac("sha256", secret).update(`${email}|${expiry}`).digest("hex");
  return `${email}|${expiry}|${sig}`;
}

export function setUserSessionCookie(res: NextResponse, email: string): NextResponse {
  res.cookies.set(COOKIE_NAME, buildUserSessionCookie(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });
  return res;
}

export function getCallerEmail(req: NextRequest): string | null {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return null;
  const parts = cookie.split("|");
  if (parts.length !== 3) return null;
  const [email, expiry, sig] = parts;
  if (!email || !expiry || !sig) return null;
  if (Date.now() > Number(expiry)) return null;
  if (!/^[0-9a-f]{64}$/.test(sig)) return null;
  const secret = getSecret();
  if (!secret) return null;
  const expectedSig = createHmac("sha256", secret).update(`${email}|${expiry}`).digest("hex");
  if (sig !== expectedSig) return null;
  return email;
}

/**
 * 驗證 ?email= (or any claimed email) 是否與 cookie session email 相符。
 * - 沒 cookie → 401(請先登入)
 * - cookie 與 claimed mismatch → 403(身份不符)
 * - 相符 → null (continue)
 *
 * 使用:
 *   const auth = requireCallerEmail(req, claimedEmail);
 *   if (auth) return auth;
 */
export function requireCallerEmail(req: NextRequest, claimedEmail: string | null): NextResponse | null {
  const sessionEmail = getCallerEmail(req);
  if (!sessionEmail) {
    return NextResponse.json({ error: "未登入或 session 過期", code: "NO_SESSION" }, { status: 401 });
  }
  if (claimedEmail && claimedEmail.toLowerCase() !== sessionEmail.toLowerCase()) {
    return NextResponse.json(
      { error: "身份不符 — session email 不等於 ?email= 參數", code: "EMAIL_MISMATCH" },
      { status: 403 }
    );
  }
  return null;
}

export function clearUserSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, maxAge: 0, path: "/" });
  return res;
}
