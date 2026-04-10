import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 註冊 API
 *
 * 直接建立帳號並回傳 userId。LINE 綁定改為事後選用，
 * 不再阻擋註冊流程。
 */

export async function POST(req: NextRequest) {
  const { email, name, brand } = await req.json();
  if (!email) return Response.json({ ok: false, error: "email required" }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // Check if user exists
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    return Response.json({ ok: true, userId: existing.id, existed: true });
  }

  // Create new user
  const { data, error } = await supabase
    .from("users")
    .insert({
      email,
      name: name || email.split("@")[0],
      brand: brand || "nschool",
      role: brand === "hq" ? "ceo" : "sales_rep",
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, userId: data.id });
}
