import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * LINE Login OAuth — 回呼
 *
 * GET /api/line/oauth/callback?code=...&state=...
 *
 * 流程：
 *   1. 驗證 state（跟 cookie 的 csrf 對比）
 *   2. 拿 code 換 access_token + id_token
 *   3. 用 access_token 打 /v2/profile 拿 userId + displayName
 *   4. 在 Supabase 寫入 / 更新 users.line_user_id
 *   5. 把 email 寫到臨時 cookie，302 回首頁完成登入
 *
 * 注意：LINE 不一定給 email（要申請 email scope 權限），這裡直接用 LINE userId 當身分。
 *       同一個 LINE userId 在系統裡對應同一組資料。
 */

interface LineStateRaw {
  csrf: string;
  mode: "login" | "register";
  brand: string;
  name: string;
  ts: number;
}

function decodeState(s: string): LineStateRaw | null {
  try {
    const json = Buffer.from(s, "base64url").toString("utf8");
    return JSON.parse(json) as LineStateRaw;
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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateStr = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const errDesc = url.searchParams.get("error_description");

  // 從代理 header 抓真正的 public origin（Zeabur 後端看到的是 localhost:8080）
  const fwdHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const fwdProto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "https";
  const origin = process.env.PUBLIC_APP_URL || `${fwdProto}://${fwdHost}`;

  if (err) {
    return Response.redirect(
      `${origin}/?line_oauth_error=${encodeURIComponent(errDesc || err)}`,
      302
    );
  }

  if (!code || !stateStr) {
    return new Response("missing code or state", { status: 400 });
  }

  const state = decodeState(stateStr);
  if (!state) return new Response("invalid state", { status: 400 });

  const cookies = parseCookies(req);
  const expectedCsrf = cookies["moyu_oauth_state"];
  if (!expectedCsrf || expectedCsrf !== state.csrf) {
    return new Response("state mismatch", { status: 400 });
  }

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
  if (!channelId || !channelSecret) {
    return new Response("LINE Login not configured", { status: 500 });
  }

  const redirectUri = `${origin}/api/line/oauth/callback`;

  // 1. 換 token
  const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: channelId,
      client_secret: channelSecret,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    return new Response(`token exchange failed: ${errText}`, { status: 502 });
  }
  const token = (await tokenRes.json()) as {
    access_token: string;
    id_token?: string;
    expires_in: number;
  };

  // 2. 拿 profile
  const profRes = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!profRes.ok) {
    return new Response("profile fetch failed", { status: 502 });
  }
  const profile = (await profRes.json()) as {
    userId: string;
    displayName: string;
    pictureUrl?: string;
  };

  // 3. 寫 Supabase — 先查是否已有同 line_user_id 的 user
  const supabase = getSupabaseAdmin();

  // 嘗試用 line_user_id 找既有帳號
  const { data: existingByLine } = await supabase
    .from("users")
    .select("id, email, name, brand, role, status")
    .eq("line_user_id", profile.userId)
    .maybeSingle();

  let userEmail: string;
  let userRecord: {
    id: string;
    email: string;
    name: string;
    brand: string;
    role: string;
    status: string;
  };

  if (existingByLine) {
    userEmail = existingByLine.email;
    userRecord = existingByLine;
  } else {
    // 新用戶 — 用 LINE userId 當 email-like identifier（LINE 沒給 email 的情況下）
    // 如果 state 裡有 brand / name，用那個；沒的話用 LINE profile
    const brand = state.brand || "nschool";
    const fallbackEmail = `line-${profile.userId}@moyu.line`;
    const insertPayload = {
      email: fallbackEmail,
      name: state.name || profile.displayName || "未命名",
      brand,
      role: brand === "hq" || brand === "legal" ? "super_admin" : "sales_rep",
      status: "active",
      line_user_id: profile.userId,
      line_bound_at: new Date().toISOString(),
    };
    const { data: newUser, error: insErr } = await supabase
      .from("users")
      .insert(insertPayload)
      .select("id, email, name, brand, role, status")
      .single();
    if (insErr || !newUser) {
      return new Response(`insert user failed: ${insErr?.message || "unknown"}`, { status: 500 });
    }
    userEmail = newUser.email;
    userRecord = newUser;
  }

  // 4. 把使用者資訊寫到短期 cookie，前端讀到就能完成本地 session bootstrap
  const sessionPayload = Buffer.from(
    JSON.stringify({
      email: userRecord.email,
      name: userRecord.name,
      brand: userRecord.brand,
      role: userRecord.role,
    })
  ).toString("base64url");

  const headers = new Headers();
  headers.append("Location", `${origin}/?line_oauth_success=1`);
  headers.append(
    "Set-Cookie",
    `moyu_oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
  );
  headers.append(
    "Set-Cookie",
    `moyu_oauth_nonce=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
  );
  // Non-httpOnly so frontend can read and bootstrap local session then delete it
  headers.append(
    "Set-Cookie",
    `moyu_oauth_session=${sessionPayload}; Path=/; Max-Age=120; Secure; SameSite=Lax`
  );
  // suppress string concat for unused var
  void userEmail;
  return new Response(null, { status: 302, headers });
}
