import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  const supabase = getSupabaseAdmin();

  // Get all users with their progress
  let usersQuery = supabase
    .from("users")
    .select("id, name, email, brand, role, status, created_at")
    .order("created_at", { ascending: false });

  if (brand && brand !== "all") {
    usersQuery = usersQuery.eq("brand", brand);
  }

  const { data: users, error: usersErr } = await usersQuery;
  if (usersErr) return Response.json({ error: usersErr.message }, { status: 500 });
  if (!users || users.length === 0) return Response.json({ users: [] });

  const userIds = users.map((u) => u.id);

  // Fetch all progress data in parallel
  const [progressRes, quizRes, videoRes, kpiRes, sparringRes] = await Promise.all([
    supabase.from("user_progress").select("*").in("user_id", userIds),
    supabase.from("quiz_scores").select("*").in("user_id", userIds).order("created_at", { ascending: false }),
    supabase.from("video_watch_progress").select("*").in("user_id", userIds),
    supabase.from("kpi_entries").select("*").in("user_id", userIds).order("date", { ascending: false }),
    supabase.from("sparring_records").select("id, user_id, score, created_at").in("user_id", userIds).order("created_at", { ascending: false }),
  ]);

  // Build per-user data
  const enrichedUsers = users.map((user) => {
    const progress = progressRes.data?.find((p) => p.user_id === user.id);
    const quizzes = quizRes.data?.filter((q) => q.user_id === user.id) || [];
    const videos = videoRes.data?.filter((v) => v.user_id === user.id) || [];
    const kpis = kpiRes.data?.filter((k) => k.user_id === user.id) || [];
    const sparrings = sparringRes.data?.filter((s) => s.user_id === user.id) || [];

    const latestQuiz = quizzes[0];
    const latestSparring = sparrings[0];
    const avgQuizScore = quizzes.length > 0
      ? Math.round(quizzes.reduce((sum, q) => sum + q.score, 0) / quizzes.length)
      : null;
    const avgSparringScore = sparrings.length > 0
      ? Math.round(sparrings.reduce((sum, s) => sum + (s.score || 0), 0) / sparrings.length)
      : null;

    // Determine last activity
    const dates = [
      progress?.updated_at,
      latestQuiz?.created_at,
      latestSparring?.created_at,
      kpis[0]?.created_at,
      videos[0]?.last_watched_at,
    ].filter(Boolean);
    const lastActivity = dates.length > 0 ? new Date(Math.max(...dates.map((d) => new Date(d!).getTime()))).toISOString() : null;

    return {
      ...user,
      currentDay: progress?.current_day || 1,
      completedModules: progress?.completed_modules || [],
      progressPercent: progress?.progress || 0,
      quizCount: quizzes.length,
      avgQuizScore,
      latestQuizScore: latestQuiz?.score || null,
      latestQuizModule: latestQuiz?.module_id || null,
      videosWatched: videos.length,
      videosCompleted: videos.filter((v) => v.completed).length,
      sparringCount: sparrings.length,
      avgSparringScore,
      latestSparringScore: latestSparring?.score || null,
      totalCalls: kpis.reduce((sum, k) => sum + (k.calls || 0), 0),
      totalAppointments: kpis.reduce((sum, k) => sum + (k.appointments || 0), 0),
      lastActivity,
      // Detail data for modal
      quizzes: quizzes.slice(0, 20),
      kpis: kpis.slice(0, 30),
      sparrings: sparrings.slice(0, 10).map((s) => ({ id: s.id, score: s.score, date: s.created_at })),
    };
  });

  return Response.json({ users: enrichedUsers });
}
