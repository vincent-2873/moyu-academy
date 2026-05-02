import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/people/role — Wave 8 #3
 * Body: { user_id: string, persona_role: string }
 *
 * 切換指定 user 的 persona_role
 * 僅限 human_ops 操作(防止 board_audience 自己升 human_ops)
 */

const VALID_ROLES = ["human_ops", "board_audience", "employee_sales", "employee_legal", "claude_executive"];

export async function POST(req: NextRequest) {
  // caller 驗證
  const sessionCookie = req.cookies.get("moyu_admin_session")?.value;
  if (!sessionCookie) {
    return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });
  }
  const callerEmail = sessionCookie.split("|")?.[0];
  if (!callerEmail) {
    return NextResponse.json({ ok: false, error: "invalid session" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();

  // caller 必須是 human_ops
  const { data: caller } = await sb
    .from("users")
    .select("persona_role")
    .eq("email", callerEmail)
    .single();
  if (!caller || caller.persona_role !== "human_ops") {
    return NextResponse.json({ ok: false, error: "caller is not human_ops" }, { status: 403 });
  }

  let body: { user_id?: string; persona_role?: string };
  try { body = await req.json(); } catch { body = {}; }

  if (!body.user_id || !body.persona_role) {
    return NextResponse.json({ ok: false, error: "user_id + persona_role required" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(body.persona_role)) {
    return NextResponse.json({ ok: false, error: `invalid role; must be ${VALID_ROLES.join("/")}` }, { status: 400 });
  }

  // 檢查 last human_ops 防呆 — 不能把唯一 human_ops 降級
  if (body.persona_role !== "human_ops") {
    const { data: target } = await sb.from("users").select("persona_role").eq("id", body.user_id).single();
    if (target && target.persona_role === "human_ops") {
      const { count: opsCount } = await sb
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("persona_role", "human_ops")
        .eq("status", "active");
      if ((opsCount || 0) <= 1) {
        return NextResponse.json({
          ok: false,
          error: "不能降級唯一的 human_ops — 系統至少要有一個",
        }, { status: 400 });
      }
    }
  }

  const { error: updErr } = await sb
    .from("users")
    .update({ persona_role: body.persona_role, updated_at: new Date().toISOString() })
    .eq("id", body.user_id);
  if (updErr) {
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  // audit log
  await sb.from("system_run_log").insert({
    source: "people-role-change",
    status: "success",
    metadata: {
      caller: callerEmail,
      target_user_id: body.user_id,
      new_role: body.persona_role,
    },
  });

  return NextResponse.json({ ok: true, user_id: body.user_id, persona_role: body.persona_role });
}
