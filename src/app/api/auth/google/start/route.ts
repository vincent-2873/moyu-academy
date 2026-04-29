import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Google OAuth 2.0 — 發起授權
 *
 * GET /api/auth/google/start?mode=login|bind&email=...
 *
 * 流程同 LINE OAuth start:
 *   1. 產 state(CSRF) + nonce
 *   2. state cookie 落地
 *   3. 302 → Google authorize endpoint
 */

function randomToken(n = 32): string {
  return crypto.randomBytes(n).toString("base64url");
}

export async function GET(req: NextRequest) {
  // Client ID 是 public(會出現在前端 JS / URL), hardcode fallback OK
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    || "68172491156-ibt265pv98phsbmb3dl2qqeegf2q6ccb.apps.googleusercontent.com";

  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") || "login") as "login" | "bind";
  const bindEmail = url.searchParams.get("email") || "";

  if (mode === "bind" && !bindEmail) {
    return new Response("bind mode 需要 email", { status: 400 });
  }

  const stateRaw = {
    csrf: randomToken(24),
    mode,
    bindEmail,
    ts: Date.now(),
  };
  const state = Buffer.from(JSON.stringify(stateRaw)).toString("base64url");

  const fwdHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const fwdProto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "https";
  const origin = process.env.PUBLIC_APP_URL || `${fwdProto}://${fwdHost}`;
  const redirectUri = `${origin}/api/auth/google/callback`;

  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "openid email profile");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("access_type", "offline");
  authorizeUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authorizeUrl.toString(), 302);
  response.cookies.set("moyu_google_oauth_state", stateRaw.csrf, {
    path: "/",
    maxAge: 600,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
  return response;
}
