import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * POST /api/activity — Heartbeat from client to track user activity
 * Body: { email: string, page: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { email, page } = await req.json();
    if (!email) return Response.json({ error: "Missing email" }, { status: 400 });

    const supabase = getSupabaseAdmin();

    // Upsert activity record
    const { error } = await supabase
      .from("user_activity")
      .upsert(
        {
          user_email: email,
          current_page: page || "unknown",
          last_heartbeat: new Date().toISOString(),
        },
        { onConflict: "user_email" }
      );

    if (error) {
      // Table might not exist yet — create it
      if (error.message.includes("user_activity")) {
        await supabase.rpc("exec_sql", {
          query: `CREATE TABLE IF NOT EXISTS user_activity (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            user_email text UNIQUE NOT NULL,
            current_page text DEFAULT 'unknown',
            last_heartbeat timestamptz DEFAULT now(),
            session_start timestamptz DEFAULT now(),
            total_time_today_seconds integer DEFAULT 0,
            created_at timestamptz DEFAULT now()
          );`,
        });
        // Retry
        await supabase.from("user_activity").upsert(
          { user_email: email, current_page: page || "unknown", last_heartbeat: new Date().toISOString() },
          { onConflict: "user_email" }
        );
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

/**
 * GET /api/activity — Get all user activity (admin use)
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("user_activity")
      .select("*")
      .order("last_heartbeat", { ascending: false });

    if (error) return Response.json({ activities: [] });
    return Response.json({ activities: data || [] });
  } catch {
    return Response.json({ activities: [] });
  }
}
