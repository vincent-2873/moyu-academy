import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createHmac } from "crypto";

/**
 * Google OAuth 2.0 — 回呼
 *
 * GET /api/auth/google/callback?code=...&state=...
 *
 * 流程:
 *   1. 驗 state(對 cookie csrf)
 *   2. code 換 access_token + id_token
 *   3. /v1/userinfo 拿 sub / email / name / picture
 *   4. upsert users.google_id / google_email
 *   5. mode=login → 設 session cookie 並 302 /admin or /
 *      mode=bind  → 綁到既有 email
 */

interface GoogleStateRaw {
  csrf: string;
  mode: "login" | "bind";
  bindEmail?: string;
  ts: number;
}

function decodeState(s: string): GoogleStateRaw | null {
  try {
    return JSON.parse(Buffer.from(s, "base64url").toString("utf8")) as GoogleStateRaw;
  } catch {
    return null;
  }
}

function parseCookies(req: NextRequest): Record<string, string> {
  const header = req.headers.get("cookie") || "";
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) out[k] = v.join("=");
  }
  return out;
}

function buildAdminSessionCookie(email: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30d
  const sig = createHmac("sha256", secret).update(`${email}|${expiry}`).digest("hex");
  return `${email}|${expiry}|${sig}`;
}

// 2026-05-02 Wave 8 cleanup:HR/招募 砍 recruiter / hr / recruit_manager
const ADMIN_ROLES = [
  "super_admin", "ceo", "coo", "cfo", "director",
  "brand_manager", "team_leader", "trainer",
  "sales_manager", "legal_manager",
];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateStr = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const fwdHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const fwdProto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "https";
  const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || `${fwdProto}://${fwdHost}`;

  if (err) return Response.redirect(`${origin}/?google_oauth_error=${encodeURIComponent(err)}`, 302);
  if (!code || !stateStr) return new Response("missing code or state", { status: 400 });

  const state = decodeState(stateStr);
  if (!state) return new Response("invalid state", { status: 400 });

  const cookies = parseCookies(req);
  if (!cookies["moyu_google_oauth_state"] || cookies["moyu_google_oauth_state"] !== state.csrf) {
    return new Response("state mismatch", { status: 400 });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    || "68172491156-ibt265pv98phsbmb3dl2qqeegf2q6ccb.apps.googleusercontent.com";
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientSecret) {
    return new Response("Google OAuth secret not configured (GOOGLE_OAUTH_CLIENT_SECRET)", { status: 500 });
  }

  const redirectUri = `${origin}/api/auth/google/callback`;

  // 1. 換 token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });
  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    return new Response(`google token exchange failed: ${t}`, { status: 502 });
  }
  const tokenJson = (await tokenRes.json()) as { access_token: string; id_token?: string };
  const accessToken = tokenJson.access_token;

  // 2. /v1/userinfo
  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userInfoRes.ok) return new Response("google userinfo failed", { status: 502 });
  const profile = (await userInfoRes.json()) as {
    id: string;
    email: string;
    verified_email?: boolean;
    name?: string;
    picture?: string;
  };

  if (!profile.email) return new Response("google profile no email", { status: 502 });

  const supabase = getSupabaseAdmin();

  // 3. mode=bind: 把 google_id 綁到既有 email
  if (state.mode === "bind" && state.bindEmail) {
    await supabase
      .from("users")
      .update({ google_id: profile.id, google_email: profile.email, avatar_url: profile.picture || null })
      .eq("email", state.bindEmail);
    return Response.redirect(`${origin}/account?google_bind=ok`, 302);
  }

  // 4. mode=login: upsert by email
  const { data: existing } = await supabase
    .from("users")
    .select("id, email, role, name")
    .eq("email", profile.email)
    .maybeSingle();

  let user = existing;
  if (!user) {
    // 自動建帳號(預設 sales_rep,後續主管可改 role)
    const { data: created, error: insertErr } = await supabase
      .from("users")
      .insert({
        email: profile.email,
        name: profile.name || profile.email.split("@")[0],
        role: "sales_rep",
        brand: "xuemi",
        status: "active",
        is_active: true,
        google_id: profile.id,
        google_email: profile.email,
        avatar_url: profile.picture || null,
      })
      .select("id, email, role, name")
      .single();
    if (insertErr) return new Response(`create user failed: ${insertErr.message}`, { status: 500 });
    user = created;
  } else {
    await supabase
      .from("users")
      .update({ google_id: profile.id, google_email: profile.email, avatar_url: profile.picture || null })
      .eq("id", user.id);
  }

  // 5. 設前台 session
  const res = NextResponse.redirect(`${origin}/`, 302);
  // 前台 user state 用 sessionStorage,這裡用一個 cookie 把 email 帶回去讓前端讀
  res.cookies.set("moyu_session_email", user!.email, {
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
    httpOnly: false, // 前端要讀
    secure: true,
    sameSite: "lax",
  });

  // 同時若 role 在 admin 名單,給 admin cookie
  if (ADMIN_ROLES.includes(user!.role)) {
    res.cookies.set("moyu_admin_session", buildAdminSessionCookie(user!.email), {
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
  }

  return res;
}
