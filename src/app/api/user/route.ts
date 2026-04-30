/**
 * /api/user — 給前端 fetch 使用者 role / brand / 基本資訊
 *
 * 2026-04-30 v4 補上 — RagUploadPanel.tsx + 其他 component 期待這個 endpoint 但之前沒實作
 *                       導致 Vincent (super_admin) 看不到「知識上傳」UI(權限 fallback null)
 *
 * 用法:
 *   GET /api/user?email=vincent@xuemi.co
 *
 * 回傳:
 *   {
 *     user: { id, email, role, name, brand, status, is_active, module_role, team },
 *     role: "super_admin"   // top-level alias (RagUploadPanel 同時讀 d.user.role 跟 d.role)
 *   }
 *
 * Auth:無(public read,只回非敏感欄位)
 *   - 不回 password_hash / phone(避免遭 enumeration)
 *   - role / brand / status 算半敏感但 admin 後台需要,目前接受 trade-off
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("users")
    .select("id, email, role, name, brand, status, is_active, module_role, team")
    .ilike("email", email)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message, role: null }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "user not found", role: null, user: null },
      { status: 404 }
    );
  }

  return NextResponse.json({
    user: data,
    role: data.role,
  });
}
