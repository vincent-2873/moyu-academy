import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const brand = searchParams.get("brand");

    const { data, error } = await getSupabaseAdmin()
      .from("videos")
      .select("id, title, url, drive_file_id, category, description, brands, status")
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let videos = data || [];

    // Filter by brand if specified
    if (brand) {
      videos = videos.filter(
        (v: { brands: string[] | null }) =>
          !v.brands || v.brands.length === 0 || v.brands.includes(brand)
      );
    }

    return NextResponse.json({ videos });
  } catch (err) {
    console.error("GET /api/videos error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
