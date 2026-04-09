import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/cohort — Returns current cohort start date
 * Used by frontend to calculate training day
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "cohort_start_date")
      .single();

    return Response.json({
      cohort_start_date: data?.value || new Date().toISOString().slice(0, 10),
    });
  } catch {
    return Response.json({
      cohort_start_date: new Date().toISOString().slice(0, 10),
    });
  }
}
