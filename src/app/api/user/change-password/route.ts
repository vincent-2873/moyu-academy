import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

/**
 * POST /api/user/change-password
 * 使用者自己改密碼（需提供舊密碼）
 *
 * body: { email, oldPassword, newPassword }
 */
export async function POST(req: NextRequest) {
  const { email, oldPassword, newPassword } = await req.json();
  if (!email || !oldPassword || !newPassword) {
    return Response.json({ error: "email + oldPassword + newPassword 必填" }, { status: 400 });
  }
  if (newPassword.length < 4) {
    return Response.json({ error: "新密碼至少 4 字" }, { status: 400 });
  }
  if (newPassword === "0000") {
    return Response.json({ error: "新密碼不可為預設 0000" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, password_hash")
    .eq("email", email)
    .maybeSingle();

  if (error || !user) {
    return Response.json({ error: "找不到此帳號" }, { status: 404 });
  }

  const ok = await bcrypt.compare(oldPassword, user.password_hash || "");
  if (!ok) {
    return Response.json({ error: "舊密碼錯誤" }, { status: 401 });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  const { error: updateError } = await supabase
    .from("users")
    .update({ password_hash: newHash, password_updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  // Log
  await supabase.from("claude_actions").insert({
    action_type: "password_change",
    target: email,
    summary: `${email} 自行變更密碼`,
    result: "success",
  });

  return Response.json({ ok: true });
}
