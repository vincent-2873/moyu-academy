import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/admin/worker-status
 * 讀 system_secrets 中所有 worker_heartbeat:* 鍵，判斷各 worker 是否存活
 * 活著 = updated_at 在 3 分鐘內（worker 每 60 秒 upsert 一次）
 */
export async function GET() {
  const s = getSupabaseAdmin();
  const { data, error } = await s
    .from("system_secrets")
    .select("key, value, updated_at")
    .like("key", "worker_heartbeat:%");

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const now = Date.now();
  const services = (data || []).map((row) => {
    const service = row.key.replace(/^worker_heartbeat:/, "");
    let meta: Record<string, unknown> = {};
    try { meta = JSON.parse(row.value); } catch { /* noop */ }
    const lastSeen = (meta.last_seen as string) || row.updated_at;
    const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : 0;
    const ageSeconds = Math.floor((now - lastSeenMs) / 1000);
    return {
      service,
      alive: ageSeconds < 180,
      age_seconds: ageSeconds,
      last_seen: lastSeen,
      uptime_seconds: meta.uptime_seconds,
      jobs: meta.jobs,
      node: meta.node,
      pid: meta.pid,
    };
  });

  return Response.json({ ok: true, services, checked_at: new Date().toISOString() });
}
