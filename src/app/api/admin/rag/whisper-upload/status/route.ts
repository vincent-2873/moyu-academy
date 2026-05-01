import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/rag/whisper-upload/status?job_id=xxx
 * 給 client polling whisper_job 進度
 *
 * 回:{
 *   ok, status (pending/processing/done/failed),
 *   stage, segments_total, segments_done, transcript_chars, chunk_id, error
 * }
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("job_id");

  if (!jobId) {
    return NextResponse.json({ ok: false, error: "job_id required" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("whisper_jobs")
    .select("id, filename, brand, status, stage, segments_total, segments_done, transcript_chars, chunk_id, error, created_at, started_at, finished_at")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "job not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...data });
}
