import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { userId, moduleId, score } = await req.json();
  if (!userId || moduleId === undefined || score === undefined) {
    return Response.json({ error: "userId, moduleId, score required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("quiz_scores").insert({
    user_id: userId,
    module_id: moduleId,
    score,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
