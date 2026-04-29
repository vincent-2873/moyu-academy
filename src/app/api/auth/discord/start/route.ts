import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Discord OAuth — 發起授權
 *
 * GET /api/auth/discord/start?mode=login|bind&email=...
 */

function randomToken(n = 32): string {
  return crypto.randomBytes(n).toString("base64url");
}

export async function GET(req: NextRequest) {
  // Client ID 是 public(會出現在前端 URL),hardcode fallback 到既有 MoyuNotifier app
  const clientId = process.env.DISCORD_OAUTH_CLIENT_ID || "1498878028095426713";

  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") || "login") as "login" | "bind";
  const bindEmail = url.searchParams.get("email") || "";

  if (mode === "bind" && !bindEmail) return new Response("bind 需 email", { status: 400 });

  const stateRaw = { csrf: randomToken(24), mode, bindEmail, ts: Date.now() };
  const state = Buffer.from(JSON.stringify(stateRaw)).toString("base64url");

  const fwdHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const fwdProto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "https";
  const origin = process.env.PUBLIC_APP_URL || `${fwdProto}://${fwdHost}`;
  const redirectUri = `${origin}/api/auth/discord/callback`;

  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "identify email");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "consent");

  const response = NextResponse.redirect(authorizeUrl.toString(), 302);
  response.cookies.set("moyu_discord_oauth_state", stateRaw.csrf, {
    path: "/", maxAge: 600, httpOnly: true, secure: true, sameSite: "lax",
  });
  return response;
}
