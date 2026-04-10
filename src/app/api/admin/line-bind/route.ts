import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 管理員：LINE 綁定管理
 *
 * DELETE /api/admin/line-bind  body { email }
 *   → 清掉指定 email 的 line_user_id / line_bound_at，釋放該 LINE 給其他帳號
 *
 * GET /api/admin/line-bind?lineUserId=...
 *   → 查這個 LINE userId 目前綁在哪個帳號（debug 用）
 *
 * 目前沒加管理員權限檢查 — /admin 前台已經有 super_admin 保護
 * 需要的話可以在這裡再加一層從 body 傳入的 adminEmail + role check
 */

export async function DELETE(req: NextRequest) {
  const { email } = await req.json();
  if (!email) {
    return Response.json({ error: "email required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // 先查現狀
  const { data: before } = await supabase
    .from("users")
    .select("email, name, line_user_id")
    .eq("email", email)
    .maybeSingle();

  if (!before) {
    return Response.json({ error: `找不到帳號 ${email}` }, { status: 404 });
  }
  if (!before.line_user_id) {
    return Response.json({
      ok: true,
      message: `${email} 本來就沒有綁定 LINE`,
      alreadyEmpty: true,
    });
  }

  const { error: updErr } = await supabase
    .from("users")
    .update({ line_user_id: null, line_bound_at: null })
    .eq("email", email);

  if (updErr) {
    return Response.json({ error: updErr.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    email,
    previousLineUserId: before.line_user_id,
    message: `已解除 ${email} 的 LINE 綁定`,
  });
}

export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId");
  const email = req.nextUrl.searchParams.get("email");

  if (!lineUserId && !email) {
    return Response.json(
      { error: "lineUserId or email required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  if (lineUserId) {
    const { data } = await supabase
      .from("users")
      .select("id, email, name, brand, role, line_user_id, line_bound_at")
      .eq("line_user_id", lineUserId)
      .maybeSingle();
    return Response.json({ user: data || null });
  }

  const { data } = await supabase
    .from("users")
    .select("id, email, name, brand, role, line_user_id, line_bound_at")
    .eq("email", email!)
    .maybeSingle();
  return Response.json({ user: data || null });
}
