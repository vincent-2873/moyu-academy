import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/help-requests
 * 對應 system-tree v2 §人類工作區 §SOS 求救清單(/admin/human/sos)
 *
 * 從 D18 既有 claude_help_requests table 撈
 * 排序:critical 優先,然後 high,normal 最後
 */
export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("claude_help_requests")
    .select("id, category, source, related_user_id, related_progress_id, title, description, claude_attempts, claude_recommendation, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message, requests: [] }, { status: 500 });
  }

  // 分組:pending / resolved / others
  const pending = (data ?? []).filter(r => r.status === "pending" || r.status === "in_progress");
  const resolved = (data ?? []).filter(r => r.status === "resolved" || r.status === "done");
  const others = (data ?? []).filter(r => !["pending", "in_progress", "resolved", "done"].includes(r.status ?? ""));

  return NextResponse.json({
    ok: true,
    counts: {
      total: data?.length ?? 0,
      pending: pending.length,
      resolved: resolved.length,
      others: others.length,
    },
    pending,
    resolved,
    others,
  });
}
