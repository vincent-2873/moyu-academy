import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

/**
 * POST /api/admin/reset-password
 * 超級管理員重置他人密碼為 0000
 *
 * body: { adminEmail, adminPassword, targetEmail }
 * 驗證 adminEmail 是 super_admin + 密碼正確
 */
export async function POST(req: NextRequest) {
  const { adminEmail, adminPassword, targetEmail } = await req.json();
  if (!adminEmail || !adminPassword || !targetEmail) {
    return Response.json({ error: "adminEmail + adminPassword + targetEmail 必填" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // 1. 驗證 admin 身份
  const { data: admin, error: adminErr } = await supabase
    .from("users")
    .select("id, email, role, password_hash")
    .eq("email", adminEmail)
    .maybeSingle();

  if (adminErr || !admin) {
    return Response.json({ error: "找不到管理員帳號" }, { status: 404 });
  }
  if (!["super_admin", "ceo", "coo"].includes(admin.role)) {
    return Response.json({ error: "只有超級管理員可重置密碼" }, { status: 403 });
  }

  const adminOk = await bcrypt.compare(adminPassword, admin.password_hash || "");
  if (!adminOk) {
    return Response.json({ error: "管理員密碼錯誤" }, { status: 401 });
  }

  // 2. 找目標 user
  const { data: target } = await supabase
    .from("users")
    .select("id, email")
    .eq("email", targetEmail)
    .maybeSingle();

  if (!target) {
    return Response.json({ error: "找不到目標帳號" }, { status: 404 });
  }

  // 3. 重置為 0000
  const DEFAULT_HASH = await bcrypt.hash("0000", 10);
  const { error: updateError } = await supabase
    .from("users")
    .update({ password_hash: DEFAULT_HASH, password_updated_at: new Date().toISOString() })
    .eq("id", target.id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  // Log
  await supabase.from("claude_actions").insert({
    action_type: "password_reset_by_admin",
    target: targetEmail,
    summary: `管理員 ${adminEmail} 將 ${targetEmail} 密碼重置為 0000`,
    details: { adminEmail, targetEmail },
    result: "success",
  });

  return Response.json({ ok: true, message: `${targetEmail} 密碼已重置為 0000` });
}
