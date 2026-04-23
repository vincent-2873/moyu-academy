import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/training-units?series=HRBP_RECRUIT_V1&system=HR&unit=HR-053
 * 回傳訓練單元清單（公開單元）或單一單元詳細
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const series = searchParams.get("series");
    const system = searchParams.get("system");
    const unit = searchParams.get("unit");

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("training_units")
      .select(
        "unit_code, system, title, audience, priority, series, series_position, series_total, video_url, video_duration_seconds, interactive_html_url, handbook_md, prerequisite_units, learning_objectives, key_points, published"
      )
      .eq("published", true);

    if (unit) query = query.eq("unit_code", unit);
    if (system) query = query.eq("system", system);
    if (series) query = query.eq("series", series);

    query = query.order("series_position", { ascending: true, nullsFirst: false });

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ units: data || [] });
  } catch (err) {
    console.error("GET /api/training-units error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
