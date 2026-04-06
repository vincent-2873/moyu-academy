import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return Response.json({ error: "email required" }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, name, brand, role, status, created_at")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!user) {
    return Response.json({ error: "找不到此帳號" }, { status: 404 });
  }

  return Response.json({ user });
}
