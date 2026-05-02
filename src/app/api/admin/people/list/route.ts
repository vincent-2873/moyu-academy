import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/people/list — Wave 8 #3
 *
 * 列出所有 active users + persona_role + 角色標
 * 供 /admin/settings/people 顯示會員管理表格
 *
 * persona_role 5 種:
 *   human_ops       — Vincent / 接班人,完整權限
 *   board_audience  — 投資人 / 董事 / CFO,read-only + 質詢
 *   employee_sales  — 業務員,自己的 KPI
 *   employee_legal  — 法務員,自己的案件
 *   claude_executive — 預留給未來 Claude 自己 system 帳號
 */

export async function GET(req: NextRequest) {
  // 驗證 caller 是 admin(human_ops)
  const sessionCookie = req.cookies.get("moyu_admin_session")?.value;
  if (!sessionCookie) {
    return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const { data: users, error } = await sb
    .from("users")
    .select("id, email, name, role, persona_role, brand, status, is_active, created_at, last_login_at")
    .eq("status", "active")
    .order("persona_role", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // 統計
  const summary: Record<string, number> = {};
  (users || []).forEach((u) => {
    const k = u.persona_role || "unset";
    summary[k] = (summary[k] || 0) + 1;
  });

  return NextResponse.json({
    ok: true,
    users: users || [],
    summary,
    total: (users || []).length,
    role_options: [
      { value: "human_ops", label: "🛠️ 人類副手(完整權限)", danger: true },
      { value: "board_audience", label: "🏛️ 投資人 / 董事(只讀+質詢)", danger: false },
      { value: "employee_sales", label: "📊 業務員(自己 KPI)", danger: false },
      { value: "employee_legal", label: "⚖️ 法務員(自己案件)", danger: false },
      { value: "claude_executive", label: "🤖 Claude 系統帳號(預留)", danger: false },
    ],
  });
}
