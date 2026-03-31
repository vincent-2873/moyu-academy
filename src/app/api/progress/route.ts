import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { userId, completedModules, progress, currentDay } = await req.json();
  if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("user_progress")
    .upsert(
      {
        user_id: userId,
        completed_modules: completedModules || [],
        progress: progress || 0,
        current_day: currentDay || 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
