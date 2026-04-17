import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * GET /api/recruit/calendar-data?type=interviews&year=2026&month=4
 * GET /api/recruit/calendar-data?type=tasks&year=2026&month=4
 *
 * 回傳指定月份的面試 / 任務截止資料（給 /recruit/calendar 用）
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "interviews";
    const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()), 10);
    const month = parseInt(url.searchParams.get("month") || String(new Date().getMonth() + 1), 10);

    // 月份範圍（TPE timezone → UTC）
    const monthStart = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+08:00`);
    const monthEnd = new Date(year, month, 0, 23, 59, 59); // last day of month
    const monthEndTpe = new Date(`${year}-${String(month).padStart(2, "0")}-${String(monthEnd.getDate()).padStart(2, "0")}T23:59:59+08:00`);

    if (type === "interviews") {
      const { data, error } = await supabase
        .from("outreach_104_queue")
        .select("id, candidate_name, interview_scheduled_at, interview_location, candidate_phone, account")
        .not("interview_scheduled_at", "is", null)
        .gte("interview_scheduled_at", monthStart.toISOString())
        .lte("interview_scheduled_at", monthEndTpe.toISOString())
        .order("interview_scheduled_at", { ascending: true });

      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
      return Response.json({ ok: true, interviews: data || [] });
    }

    if (type === "tasks") {
      const { data, error } = await supabase
        .from("v3_commands")
        .select("id, title, deadline, severity, status, owner_email")
        .eq("pillar_id", "recruit")
        .not("deadline", "is", null)
        .gte("deadline", monthStart.toISOString())
        .lte("deadline", monthEndTpe.toISOString())
        .order("deadline", { ascending: true });

      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
      return Response.json({ ok: true, tasks: data || [] });
    }

    return Response.json({ ok: false, error: "type must be interviews or tasks" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
