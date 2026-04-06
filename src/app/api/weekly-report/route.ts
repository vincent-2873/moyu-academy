import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get("brand");

    let query = supabase
      .from("weekly_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (brand) {
      query = query.eq("brand", brand);
    }

    const { data, error } = await query.single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ data });
  } catch (err) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
