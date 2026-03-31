import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return Response.json({ error: "email required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (!data) return Response.json({ userId: null });
  return Response.json({ userId: data.id });
}
