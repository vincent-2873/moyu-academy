import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

/**
 * Supabase Auth callback — 走 Supabase 已配置好的 Google provider(client_id+secret 已存)
 *
 * Flow:
 *   1. Browser → /authorize?provider=google → Google → /v1/callback → Supabase 自己 exchange code
 *   2. Supabase 302 redirect_to=https://moyusales.zeabur.app/api/auth/supabase-callback?code=...
 *   3. 本路由用 supabase.auth.exchangeCodeForSession(code) 取 user
 *   4. upsert moyu users + 建立 moyu HMAC session cookie
 *   5. 302 / or /admin
 */

export const runtime = "nodejs";

function buildAdminSessionCookie(email: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const expiry = Date.now() + 24 * 60 * 60 * 1000;
  const sig = createHmac("sha256", secret).update(`${email}|${expiry}`).digest("hex");
  return `${email}|${expiry}|${sig}`;
}

const ADMIN_ROLES = [
  "super_admin", "ceo", "coo", "cfo", "director",
  "brand_manager", "team_leader", "trainer", "mentor", "hr",
  "sales_manager", "recruit_manager", "legal_manager",
];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  const errDesc = url.searchParams.get("error_description");

  const fwdHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const fwdProto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "https";
  const origin = process.env.PUBLIC_APP_URL || `${fwdProto}://${fwdHost}`;

  if (err) {
    return Response.redirect(`${origin}/?supabase_oauth_error=${encodeURIComponent(errDesc || err)}`, 302);
  }
  if (!code) return new Response("missing code", { status: 400 });

  // Exchange code for session via Supabase Auth REST API
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseUrl || !anon) return new Response("Supabase not configured", { status: 500 });

  // Supabase PKCE token endpoint(因 Supabase Auth 需 PKCE,但我們沒 verifier — 改用 implicit fragment 或 straightforward token exchange)
  // 改用 Supabase /auth/v1/token?grant_type=pkce(若不通,改 fragment-based fallback)
  const tokenRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": anon,
      "Authorization": `Bearer ${anon}`,
    },
    body: JSON.stringify({
      auth_code: code,
      // code_verifier 我們沒生 — Supabase 預設 PKCE 流程需要,若失敗 fallback
    }),
  });

  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    // 如果 PKCE 不通,可能 Supabase 是 implicit flow → token 在 fragment(server 看不到)
    // 提示 user fragment-based 該流程要 client-side 處理
    return new Response(
      `Supabase code exchange failed: ${t.slice(0, 200)}\n\n建議:Supabase Auth 預設 implicit flow,access_token 在 URL fragment(#),需 client-side JS 抓。改用 client-side processing 或開 Supabase PKCE flow。`,
      { status: 502 }
    );
  }

  const tokenJson = await tokenRes.json() as { access_token?: string; user?: { email?: string; user_metadata?: { full_name?: string; avatar_url?: string; provider_id?: string } } };
  const userEmail = tokenJson.user?.email;
  if (!userEmail) return new Response("no email in user info", { status: 502 });

  const supabase = getSupabaseAdmin();
  const meta = tokenJson.user?.user_metadata || {};

  // Upsert user
  const { data: existing } = await supabase
    .from("users")
    .select("id, email, role")
    .eq("email", userEmail)
    .maybeSingle();

  let userRow = existing;
  if (!userRow) {
    const { data: created } = await supabase
      .from("users")
      .insert({
        email: userEmail,
        name: meta.full_name || userEmail.split("@")[0],
        role: "sales_rep",
        brand: "xuemi",
        status: "active",
        is_active: true,
        google_id: meta.provider_id,
        google_email: userEmail,
        avatar_url: meta.avatar_url || null,
      })
      .select("id, email, role")
      .single();
    userRow = created;
  } else {
    await supabase
      .from("users")
      .update({
        google_id: meta.provider_id,
        google_email: userEmail,
        avatar_url: meta.avatar_url || null,
      })
      .eq("id", userRow.id);
  }

  if (!userRow) return new Response("user upsert failed", { status: 500 });

  const res = NextResponse.redirect(`${origin}/`, 302);
  res.cookies.set("moyu_session_email", userRow.email, {
    path: "/", maxAge: 24 * 60 * 60, httpOnly: false, secure: true, sameSite: "lax",
  });
  if (ADMIN_ROLES.includes(userRow.role)) {
    res.cookies.set("moyu_admin_session", buildAdminSessionCookie(userRow.email), {
      path: "/", maxAge: 24 * 60 * 60, httpOnly: true, secure: true, sameSite: "lax",
    });
  }
  return res;
}
