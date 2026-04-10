import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * GET /api/line/binding-status?code=XXXXXX
 *
 * 前台註冊完拿到綁定碼後 poll 這支 API，偵測使用者是否已經在 LINE 輸入綁定碼。
 * 回應：
 *   - { bound: true, email, userId } → 前台可以完成自動登入
 *   - { bound: false, expired?: boolean } → 繼續等
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return Response.json({ bound: false, error: "code required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: binding, error } = await supabase
    .from("line_bindings")
    .select("email, user_id, used_at, expires_at")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (error) {
    return Response.json({ bound: false, error: error.message }, { status: 500 });
  }
  if (!binding) {
    return Response.json({ bound: false, error: "綁定碼不存在" }, { status: 404 });
  }

  if (!binding.used_at) {
    const expired = new Date(binding.expires_at) < new Date();
    return Response.json({ bound: false, expired });
  }

  // 已綁定 → 確認 users 表也有 line_user_id
  const { data: user } = await supabase
    .from("users")
    .select("id, email, name, brand, role, status, line_user_id")
    .eq("email", binding.email)
    .maybeSingle();

  if (!user?.line_user_id) {
    // 理論上不該發生，但保險起見
    return Response.json({ bound: false, error: "user not bound yet" });
  }

  return Response.json({ bound: true, user });
}
