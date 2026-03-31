import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { email, name, brand } = await req.json();
  if (!email) return Response.json({ error: "email required" }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // Check if user exists
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    return Response.json({ userId: existing.id });
  }

  // Create new user
  const { data, error } = await supabase
    .from("users")
    .insert({
      email,
      name: name || email.split("@")[0],
      brand: brand || "nschool",
      role: "sales_rep",
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ userId: data.id });
}
