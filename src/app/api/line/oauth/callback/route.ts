import { NextRequest, NextResponse } from "next/server";
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
  mode: "login" | "register" | "bind";
  brand: string;
  name: string;
  bindEmail?: string;
  registerEmail?: string;
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

  // 3. 寫 Supabase — 根據 mode 分岔
  const supabase = getSupabaseAdmin();

  let userRecord: {
    id: string;
    email: string;
    name: string;
    brand: string;
    role: string;
    status: string;
  };

  // ── mode=bind：補綁既有帳號 ──
  if (state.mode === "bind" && state.bindEmail) {
    // 找既有 email 的 user
    const { data: existingByEmail, error: fetchErr } = await supabase
      .from("users")
      .select("id, email, name, brand, role, status, line_user_id")
      .eq("email", state.bindEmail)
      .maybeSingle();

    if (fetchErr || !existingByEmail) {
      return new Response(
        `補綁失敗：找不到帳號 ${state.bindEmail}`,
        { status: 404 }
      );
    }

    // 確認這個 LINE userId 還沒被別人綁走
    if (existingByEmail.line_user_id && existingByEmail.line_user_id !== profile.userId) {
      return new Response(
        `此帳號已經綁定過另一個 LINE，無法覆蓋`,
        { status: 409 }
      );
    }
    const { data: collision } = await supabase
      .from("users")
      .select("id, email")
      .eq("line_user_id", profile.userId)
      .neq("email", state.bindEmail)
      .maybeSingle();
    if (collision) {
      return new Response(
        `這個 LINE 已經綁到另一個帳號 ${collision.email}`,
        { status: 409 }
      );
    }

    const { data: updated, error: updErr } = await supabase
      .from("users")
      .update({
        line_user_id: profile.userId,
        line_bound_at: new Date().toISOString(),
      })
      .eq("id", existingByEmail.id)
      .select("id, email, name, brand, role, status")
      .single();

    if (updErr || !updated) {
      return new Response(
        `補綁失敗：${updErr?.message || "unknown"}`,
        { status: 500 }
      );
    }
    userRecord = updated;
    return buildRedirect(origin, userRecord);
  }

  // ── mode=login：只查既有帳號，找不到不建新，避免搶走別人 email ──
  if (state.mode === "login") {
    const { data: existingByLine } = await supabase
      .from("users")
      .select("id, email, name, brand, role, status")
      .eq("line_user_id", profile.userId)
      .maybeSingle();

    if (!existingByLine) {
      return Response.redirect(
        `${origin}/?line_oauth_error=${encodeURIComponent(
          "這個 LINE 還沒綁定任何帳號。請先用 email 登入既有帳號再綁定 LINE，或用『註冊』流程建立新帳號。"
        )}`,
        302
      );
    }
    userRecord = existingByLine;
    return buildRedirect(origin, userRecord);
  }

  // ── mode=register：必須帶真 email 進來，不接受亂造 ──
  if (state.mode === "register") {
    // 先查同 line_user_id 是否已有人綁走
    const { data: existingByLine } = await supabase
      .from("users")
      .select("id, email, name, brand, role, status")
      .eq("line_user_id", profile.userId)
      .maybeSingle();
    if (existingByLine) {
      // 這個 LINE 已經綁過某個帳號 → 直接當登入處理
      userRecord = existingByLine;
      return buildRedirect(origin, userRecord);
    }

    // 必須帶 email 進 state（新的前台強制先填）
    const registerEmail = state.registerEmail || "";
    if (!registerEmail || !/@/.test(registerEmail)) {
      return Response.redirect(
        `${origin}/?line_oauth_error=${encodeURIComponent(
          "註冊需要先填寫 email 與姓名，請回到註冊頁重新操作。"
        )}`,
        302
      );
    }

    // 檢查這個 email 是否已存在 — 若存在就改為補綁（避免重複建帳號）
    const { data: existingByEmail } = await supabase
      .from("users")
      .select("id, email, name, brand, role, status, line_user_id")
      .eq("email", registerEmail)
      .maybeSingle();

    if (existingByEmail) {
      if (existingByEmail.line_user_id && existingByEmail.line_user_id !== profile.userId) {
        return Response.redirect(
          `${origin}/?line_oauth_error=${encodeURIComponent(
            `email ${registerEmail} 已綁定另一個 LINE，請改用 email 登入後再解除重新綁定。`
          )}`,
          302
        );
      }
      // 補綁既有帳號
      const { data: updated } = await supabase
        .from("users")
        .update({
          line_user_id: profile.userId,
          line_bound_at: new Date().toISOString(),
        })
        .eq("id", existingByEmail.id)
        .select("id, email, name, brand, role, status")
        .single();
      if (updated) {
        userRecord = updated;
        return buildRedirect(origin, userRecord);
      }
    }

    // 建新 user — 用前台填的 email / name，而不是 fake line-*@moyu.line
    const brand = state.brand || "nschool";
    const insertPayload = {
      email: registerEmail,
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
      return Response.redirect(
        `${origin}/?line_oauth_error=${encodeURIComponent(
          "建立帳號失敗：" + (insErr?.message || "unknown")
        )}`,
        302
      );
    }
    userRecord = newUser;
    return buildRedirect(origin, userRecord);
  }

  // 未知 mode
  return Response.redirect(
    `${origin}/?line_oauth_error=${encodeURIComponent("未知的登入模式")}`,
    302
  );
}

/** 共用：302 回首頁 + 清 oauth cookie + 放 session cookie 讓前台 bootstrap */
function buildRedirect(
  origin: string,
  userRecord: { email: string; name: string; brand: string; role: string }
): Response {
  const sessionPayload = Buffer.from(
    JSON.stringify({
      email: userRecord.email,
      name: userRecord.name,
      brand: userRecord.brand,
      role: userRecord.role,
    })
  ).toString("base64url");

  const response = NextResponse.redirect(`${origin}/?line_oauth_success=1`, 302);
  // 清 CSRF cookies
  response.cookies.set("moyu_oauth_state", "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
  response.cookies.set("moyu_oauth_nonce", "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
  // 短期 session cookie (non-httpOnly 讓前台 bootstrap)
  response.cookies.set("moyu_oauth_session", sessionPayload, {
    path: "/",
    maxAge: 120,
    httpOnly: false,
    secure: true,
    sameSite: "lax",
  });
  return response;
}
