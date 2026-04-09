import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/work-schedule — Returns work schedule settings
 * Two team types: 職能 (vocational) and 財經 (finance)
 */

// Default schedules if not configured in DB
const DEFAULT_SCHEDULES: Record<string, WorkSchedule> = {
  vocational: {
    type: "vocational",
    label: "職能組（無限/學米/AI未來）",
    startTime: "09:30",
    endTime: "18:30",
    workDays: [1, 2, 3, 4, 5], // Mon-Fri
  },
  finance: {
    type: "finance",
    label: "財經組（nSchool）",
    startTime: "09:00",
    endTime: "18:00",
    workDays: [1, 2, 3, 4, 5], // Mon-Fri
  },
};

interface WorkSchedule {
  type: string;
  label: string;
  startTime: string;
  endTime: string;
  workDays: number[];
}

function getTeamType(brandId: string): "vocational" | "finance" {
  return brandId === "nschool" ? "finance" : "vocational";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get("brand") || "";

    const supabase = getSupabaseAdmin();

    // Try to get schedule settings from system_settings
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .like("key", "schedule_%");

    const schedules = { ...DEFAULT_SCHEDULES };

    // Override with DB settings if available
    if (settings) {
      for (const s of settings) {
        try {
          const val = typeof s.value === "string" ? JSON.parse(s.value) : s.value;
          if (s.key === "schedule_vocational" && val) {
            schedules.vocational = { ...schedules.vocational, ...val };
          }
          if (s.key === "schedule_finance" && val) {
            schedules.finance = { ...schedules.finance, ...val };
          }
        } catch {
          // Invalid JSON, skip
        }
      }
    }

    // If brand specified, return just that team's schedule
    if (brandId) {
      const teamType = getTeamType(brandId);
      return Response.json({ schedule: schedules[teamType] });
    }

    // Return all schedules (for admin)
    return Response.json({ schedules });
  } catch {
    return Response.json({ schedules: DEFAULT_SCHEDULES });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json();
    const { type, startTime, endTime, workDays, updated_by } = body;

    if (!type || !["vocational", "finance"].includes(type)) {
      return Response.json({ error: "Invalid team type" }, { status: 400 });
    }

    const key = `schedule_${type}`;
    const value = JSON.stringify({ startTime, endTime, workDays });

    // Upsert into system_settings
    const { data: existing } = await supabase
      .from("system_settings")
      .select("key")
      .eq("key", key)
      .single();

    if (existing) {
      await supabase
        .from("system_settings")
        .update({ value, updated_by, updated_at: new Date().toISOString() })
        .eq("key", key);
    } else {
      await supabase.from("system_settings").insert({
        key,
        value,
        description: type === "vocational" ? "職能組工作時間" : "財經組工作時間",
        updated_by,
        updated_at: new Date().toISOString(),
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
