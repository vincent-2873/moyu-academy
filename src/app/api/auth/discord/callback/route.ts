import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createHmac } from "crypto";

interface DiscordStateRaw {
  csrf: string;
  mode: "login" | "bind";
  bindEmail?: string;
  ts: number;
}

function decodeState(s: string): DiscordStateRaw | null {
  try {
    return JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function parseCookies(req: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) out[k] = v.join("=");
  }
  return out;
}

function buildAdminSessionCookie(email: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const expiry = Date.now() + 24 * 60 * 60 * 1000;
  const sig = createHmac("sha256", secret).update(`${email}|${expiry}`).digest("hex");
  return `${email}|${expiry}|${sig}`;
}

const ADMIN_ROLES = [
  "super_admin", "ceo", "coo", "cfo", "director",
  "brand_manager", "team_leader", "trainer", "recruiter", "hr",
  "sales_manager", "recruit_manager", "legal_manager",
];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateStr = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const fwdHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const fwdProto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "https";
  const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || `${fwdProto}://${fwdHost}`;

  if (err) return Response.redirect(`${origin}/?discord_oauth_error=${encodeURIComponent(err)}`, 302);
  if (!code || !stateStr) return new Response("missing code or state", { status: 400 });

  const state = decodeState(stateStr);
  if (!state) return new Response("invalid state", { status: 400 });

  // 2026-04-30 Wave E:state ts 過期檢查(5 min) — 防重放
  const STATE_MAX_AGE_MS = 5 * 60 * 1000;
  if (typeof state.ts !== "number" || Date.now() - state.ts > STATE_MAX_AGE_MS) {
    return new Response("state expired (replay protection — 重新發起 OAuth)", { status: 400 });
  }

  const cookies = parseCookies(req);
  if (!cookies["moyu_discord_oauth_state"] || cookies["moyu_discord_oauth_state"] !== state.csrf) {
    return new Response("state mismatch", { status: 400 });
  }

  const clientId = process.env.DISCORD_OAUTH_CLIENT_ID || "1498878028095426713";
  const clientSecret = process.env.DISCORD_OAUTH_CLIENT_SECRET;
  if (!clientSecret) return new Response("Discord OAuth secret not configured (DISCORD_OAUTH_CLIENT_SECRET)", { status: 500 });

  const redirectUri = `${origin}/api/auth/discord/callback`;

  // 1. 換 token
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
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
    return new Response(`discord token exchange failed: ${t}`, { status: 502 });
  }
  const tokenJson = (await tokenRes.json()) as { access_token: string };

  // 2. /users/@me
  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!userRes.ok) return new Response("discord user fetch failed", { status: 502 });
  const profile = (await userRes.json()) as {
    id: string;
    username: string;
    global_name?: string;
    email?: string;
    avatar?: string;
  };

  if (!profile.email) return new Response("discord profile no email (verified email scope required)", { status: 502 });

  const supabase = getSupabaseAdmin();
  const avatarUrl = profile.avatar
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
    : null;

  if (state.mode === "bind" && state.bindEmail) {
    await supabase
      .from("users")
      .update({ discord_id: profile.id, discord_username: profile.username, avatar_url: avatarUrl })
      .eq("email", state.bindEmail);
    return Response.redirect(`${origin}/account?discord_bind=ok`, 302);
  }

  const { data: existing } = await supabase
    .from("users")
    .select("id, email, role, name")
    .eq("email", profile.email)
    .maybeSingle();

  let user = existing;
  if (!user) {
    const { data: created, error: insertErr } = await supabase
      .from("users")
      .insert({
        email: profile.email,
        name: profile.global_name || profile.username,
        role: "sales_rep",
        brand: "xuemi",
        status: "active",
        is_active: true,
        discord_id: profile.id,
        discord_username: profile.username,
        avatar_url: avatarUrl,
      })
      .select("id, email, role, name")
      .single();
    if (insertErr) return new Response(`create user failed: ${insertErr.message}`, { status: 500 });
    user = created;
  } else {
    await supabase
      .from("users")
      .update({ discord_id: profile.id, discord_username: profile.username })
      .eq("id", user.id);
  }

  const res = NextResponse.redirect(`${origin}/`, 302);
  res.cookies.set("moyu_session_email", user!.email, {
    path: "/", maxAge: 24 * 60 * 60, httpOnly: false, secure: true, sameSite: "lax",
  });
  // 清掉 oauth_state cookie 防重放
  res.cookies.set("moyu_discord_oauth_state", "", { path: "/", maxAge: 0 });
  if (ADMIN_ROLES.includes(user!.role)) {
    res.cookies.set("moyu_admin_session", buildAdminSessionCookie(user!.email), {
      path: "/", maxAge: 24 * 60 * 60, httpOnly: true, secure: true, sameSite: "lax",
    });
  }
  return res;
}
