import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * LINE Login OAuth — 發起授權
 *
 * GET /api/line/oauth/start?mode=register|login&brand=hq|nschool|...
 *
 * 流程：
 *   1. 產生 state + nonce（防 CSRF）
 *   2. state 以 httpOnly cookie 存下，並同時把 mode/brand 帶在 state JSON 裡
 *   3. 302 redirect 到 LINE authorize 端點
 *
 * bot_prompt=aggressive：讓使用者在同一個授權流程中也能直接加入 墨宇小精靈 LINE@
 * 這要求本 LINE Login channel 與 Messaging API channel 在同一個 provider 下（已確認：墨宇）
 */

function randomToken(n = 32): string {
  return crypto.randomBytes(n).toString("base64url");
}

export async function GET(req: NextRequest) {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) {
    return new Response("LINE_LOGIN_CHANNEL_ID not set", { status: 500 });
  }

  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") || "login") as "login" | "register" | "bind";
  const brand = url.searchParams.get("brand") || "";
  const name = url.searchParams.get("name") || "";
  const bindEmail = url.searchParams.get("email") || ""; // mode=bind 用
  const registerEmail = url.searchParams.get("registerEmail") || ""; // mode=register 用

  // mode=register 要求必填 email + 姓名，避免 callback 建爛帳號
  if (mode === "register") {
    if (!registerEmail || !/@/.test(registerEmail)) {
      return new Response("register mode 需要 registerEmail", { status: 400 });
    }
    if (!name.trim()) {
      return new Response("register mode 需要 name", { status: 400 });
    }
  }
  if (mode === "bind" && !bindEmail) {
    return new Response("bind mode 需要 email", { status: 400 });
  }

  // state 同時兼 CSRF 與 intent carrier — 只把關鍵欄位放進去，不放敏感資料
  const stateRaw = {
    csrf: randomToken(24),
    mode,
    brand,
    name,
    bindEmail,
    registerEmail,
    ts: Date.now(),
  };
  const state = Buffer.from(JSON.stringify(stateRaw)).toString("base64url");
  const nonce = randomToken(16);

  // 動態推 callback URL — Zeabur / Vercel 代理後端看到的 req.url 是內部 host，
  // 需要從 x-forwarded-* headers 抓原始 public URL
  const fwdHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const fwdProto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "https";
  const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || `${fwdProto}://${fwdHost}`;
  const redirectUri = `${origin}/api/line/oauth/callback`;

  const authorizeUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", channelId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", "profile openid");
  authorizeUrl.searchParams.set("nonce", nonce);
  // bot_prompt=aggressive 會在授權畫面顯示「加為好友」選項
  authorizeUrl.searchParams.set("bot_prompt", "aggressive");

  // 用 NextResponse.cookies.set 保證兩個 Set-Cookie 都正確下發
  const response = NextResponse.redirect(authorizeUrl.toString(), 302);
  response.cookies.set("moyu_oauth_state", stateRaw.csrf, {
    path: "/",
    maxAge: 600,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
  response.cookies.set("moyu_oauth_nonce", nonce, {
    path: "/",
    maxAge: 600,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
  return response;
}
