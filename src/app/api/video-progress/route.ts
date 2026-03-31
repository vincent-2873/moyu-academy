import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { userId, videoId, watchSeconds, totalSeconds } = await req.json();
  if (!userId || !videoId) return Response.json({ error: "userId, videoId required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("video_watch_progress")
    .upsert(
      {
        user_id: userId,
        video_id: videoId,
        watch_seconds: watchSeconds || 0,
        total_seconds: totalSeconds || null,
        completed: totalSeconds ? watchSeconds >= totalSeconds * 0.9 : false,
        last_watched_at: new Date().toISOString(),
      },
      { onConflict: "user_id,video_id" }
    );

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
