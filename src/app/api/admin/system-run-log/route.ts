import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { getAdminScope } from "@/lib/admin-scope";

/**
 * GET /api/admin/system-run-log
 *
 * N6 (2026-04-30 第三輪):cron + 系統 run log 健康度
 *
 * Query params:
 *   source?: filter by source (e.g. "cron:embedding-refresh")
 *   status?: ok / partial / fail / noop
 *   from?, to?: ISO timestamp range(default 過去 24h)
 *   limit?: default 200, max 500
 *
 * Response:
 *   {
 *     ok, rows: [...],
 *     by_source: { source: { runs, ok, partial, fail, noop, last_run_at, success_rate_pct, avg_duration_ms } },
 *   }
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RawLog {
  id: number;
  source: string;
  status: string;
  rows_in: number | null;
  rows_out: number | null;
  duration_ms: number | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  const scope = await getAdminScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Number(sp.get("limit") || 200), 500);
  const sourceFilter = sp.get("source");
  const statusFilter = sp.get("status");
  const from = sp.get("from") || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const to = sp.get("to") || new Date().toISOString();

  const sb = getSupabaseAdmin();
  let q = sb.from("system_run_log")
    .select("id, source, status, rows_in, rows_out, duration_ms, error_message, metadata, created_at")
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sourceFilter) q = q.eq("source", sourceFilter);
  if (statusFilter) q = q.eq("status", statusFilter);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []) as RawLog[];

  // group by source
  type Stat = {
    source: string;
    runs: number; ok: number; partial: number; fail: number; noop: number;
    last_run_at: string | null;
    last_status: string | null;
    last_error: string | null;
    avg_duration_ms: number;
    success_rate_pct: number;
  };
  const bySource: Record<string, Stat> = {};
  let totalDuration: Record<string, number> = {};

  for (const r of rows) {
    if (!bySource[r.source]) {
      bySource[r.source] = {
        source: r.source,
        runs: 0, ok: 0, partial: 0, fail: 0, noop: 0,
        last_run_at: null, last_status: null, last_error: null,
        avg_duration_ms: 0, success_rate_pct: 0,
      };
      totalDuration[r.source] = 0;
    }
    const s = bySource[r.source];
    s.runs++;
    (s as any)[r.status] = ((s as any)[r.status] || 0) + 1;
    if (!s.last_run_at || r.created_at > s.last_run_at) {
      s.last_run_at = r.created_at;
      s.last_status = r.status;
      s.last_error = r.error_message;
    }
    if (typeof r.duration_ms === "number") totalDuration[r.source] += r.duration_ms;
  }

  Object.values(bySource).forEach((s) => {
    s.avg_duration_ms = s.runs > 0 ? Math.round(totalDuration[s.source] / s.runs) : 0;
    s.success_rate_pct = s.runs > 0 ? Math.round((s.ok / s.runs) * 100) : 0;
  });

  // 排序:fail 多的優先 → 最後執行時間
  const bySourceArr = Object.values(bySource).sort((a, b) => {
    if (a.fail !== b.fail) return b.fail - a.fail;
    return (b.last_run_at || "").localeCompare(a.last_run_at || "");
  });

  return NextResponse.json({
    ok: true,
    range: { from, to },
    total: rows.length,
    rows,
    by_source: bySourceArr,
  });
}
