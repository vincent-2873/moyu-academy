import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/me — Wave 8 #3
 *
 * 回 caller 自己的 persona_role / role / brand
 * 給 admin layout 用,決定 read-only / approve-reject 是否顯示
 */

export async function GET(req: NextRequest) {
  const sessionCookie = req.cookies.get("moyu_admin_session")?.value;
  if (!sessionCookie) {
    return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });
  }
  const callerEmail = sessionCookie.split("|")?.[0];
  if (!callerEmail) {
    return NextResponse.json({ ok: false, error: "invalid session" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const { data: user, error } = await sb
    .from("users")
    .select("id, email, name, role, persona_role, brand")
    .eq("email", callerEmail)
    .maybeSingle();

  if (error || !user) {
    return NextResponse.json({ ok: false, error: "user not found" }, { status: 404 });
  }

  // 計算權限旗標
  const isHumanOps = user.persona_role === "human_ops";
  const isBoardAudience = user.persona_role === "board_audience";
  const canApprove = isHumanOps; // 只有 human_ops 能拍板
  const canManagePeople = isHumanOps;
  const canQueryBoard = isBoardAudience || isHumanOps;

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      persona_role: user.persona_role,
      brand: user.brand,
    },
    permissions: {
      is_human_ops: isHumanOps,
      is_board_audience: isBoardAudience,
      can_approve: canApprove,
      can_reject: canApprove,
      can_manage_people: canManagePeople,
      can_query_board: canQueryBoard,
    },
  });
}
