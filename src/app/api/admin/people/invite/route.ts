import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/people/invite — Wave 8 #3
 * Body: { email, name, persona_role, brand?, temp_password? }
 *
 * 邀請新成員 — 不發 email,直接建帳號 + 給臨時密碼
 * Vincent 把臨時密碼複製到 LINE / 內部分享給對方
 *
 * 注意:不發 email 因為 SMTP 沒接,且 magic link 對 demo 過頭。
 * 用法:Vincent 點「新增投資人」→ 填 email + name → 拿到 0000(預設)→ LINE 給對方
 */

const VALID_ROLES = ["human_ops", "board_audience", "employee_sales", "employee_legal", "claude_executive"];

export async function POST(req: NextRequest) {
  const sessionCookie = req.cookies.get("moyu_admin_session")?.value;
  if (!sessionCookie) {
    return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });
  }
  const callerEmail = sessionCookie.split("|")?.[0];

  const sb = getSupabaseAdmin();

  // 限制 human_ops
  const { data: caller } = await sb
    .from("users")
    .select("persona_role")
    .eq("email", callerEmail)
    .single();
  if (!caller || caller.persona_role !== "human_ops") {
    return NextResponse.json({ ok: false, error: "caller is not human_ops" }, { status: 403 });
  }

  let body: { email?: string; name?: string; persona_role?: string; brand?: string; temp_password?: string };
  try { body = await req.json(); } catch { body = {}; }

  const email = (body.email || "").trim().toLowerCase();
  const name = (body.name || "").trim();
  const role = body.persona_role || "board_audience";
  const brand = body.brand || null;
  const tempPassword = body.temp_password || "0000"; // 預設 0000(Vincent 偏好)

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "invalid email" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, error: `invalid role; must be ${VALID_ROLES.join("/")}` }, { status: 400 });
  }

  // 檢查重複
  const { data: existing } = await sb
    .from("users")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({
      ok: false,
      error: `email ${email} already exists`,
      existing_user_id: existing.id,
    }, { status: 409 });
  }

  // hash password
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  // INSERT
  const dbRole = role === "board_audience" ? "staff"
    : role === "human_ops" ? "admin"
    : role === "employee_sales" ? "sales_rep"
    : role === "employee_legal" ? "legal_staff"
    : "staff";

  const { data: newUser, error: insErr } = await sb
    .from("users")
    .insert({
      email,
      password_hash: passwordHash,
      name,
      role: dbRole,
      persona_role: role,
      brand,
      status: "active",
      is_active: true,
    })
    .select("id, email, name, persona_role, role")
    .single();

  if (insErr) {
    return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  }

  // audit log
  await sb.from("system_run_log").insert({
    source: "people-invite",
    status: "success",
    metadata: {
      caller: callerEmail,
      new_user_email: email,
      persona_role: role,
    },
  });

  return NextResponse.json({
    ok: true,
    user: newUser,
    temp_password: tempPassword,
    instruction: `把以下訊息複製給 ${name}:\n登入網址:https://moyusales.zeabur.app/admin\nEmail:${email}\n臨時密碼:${tempPassword}\n登入後請改密碼。`,
  });
}
