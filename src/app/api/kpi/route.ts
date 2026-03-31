import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { userId, date, calls, validCalls, appointments, closures } = await req.json();
  if (!userId || !date) return Response.json({ error: "userId, date required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("kpi_entries")
    .upsert(
      {
        user_id: userId,
        date,
        calls: calls || 0,
        valid_calls: validCalls || 0,
        appointments: appointments || 0,
        closures: closures || 0,
      },
      { onConflict: "user_id,date" }
    );

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
