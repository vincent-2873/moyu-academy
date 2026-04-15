import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/admin/worker-status
 * 讀 worker_heartbeat 表，判斷 moyu-worker 是否存活
 * 活著 = last_seen 在 3 分鐘內（worker 每 60 秒寫一次）
 */
export async function GET() {
  const s = getSupabaseAdmin();
  const { data, error } = await s
    .from("worker_heartbeat")
    .select("*")
    .order("last_seen", { ascending: false });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const now = Date.now();
  const services = (data || []).map((row) => {
    const lastSeenMs = row.last_seen ? new Date(row.last_seen).getTime() : 0;
    const ageSeconds = Math.floor((now - lastSeenMs) / 1000);
    const alive = ageSeconds < 180; // 3 分鐘內視為存活
    return {
      service: row.service,
      alive,
      age_seconds: ageSeconds,
      last_seen: row.last_seen,
      uptime_seconds: row.uptime_seconds,
      meta: row.meta,
    };
  });

  return Response.json({ ok: true, services, checked_at: new Date().toISOString() });
}
