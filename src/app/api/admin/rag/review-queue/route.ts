import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";
import { getAdminScope } from "@/lib/admin-scope";

/**
 * GET /api/admin/rag/review-queue
 *
 * 撈 reviewed=false 的 chunks 給 admin 審
 *
 * Query:
 *   pillar?: hr | sales | legal | common
 *   limit? (max 200)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const scope = await getAdminScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Number(sp.get("limit") || 100), 200);
  const pillarFilter = sp.get("pillar");

  const sb = getSupabaseAdmin();

  const rows = await fetchAllRows<{
    id: string;
    title: string;
    content: string;
    source_type: string;
    pillar: string;
    visibility: string;
    uploaded_by_email: string;
    uploaded_at: string;
    source_mime: string;
    transcript_status: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>(() => {
    let q = sb.from("knowledge_chunks")
      .select("id, title, content, source_type, pillar, visibility, uploaded_by_email, uploaded_at, source_mime, transcript_status, metadata, created_at")
      .eq("reviewed", false)
      .order("created_at", { ascending: false });
    if (pillarFilter) q = q.eq("pillar", pillarFilter);
    return q;
  });

  const items = rows.slice(0, limit).map((r) => ({
    ...r,
    content_preview: (r.content || "").slice(0, 500),
    content: undefined,
    content_length: (r.content || "").length,
    pii_count: ((r.metadata as any)?.pii_found?.total) || 0,
  }));

  // 群組統計
  const stats: Record<string, number> = {};
  rows.forEach((r) => { stats[r.pillar] = (stats[r.pillar] || 0) + 1; });

  return NextResponse.json({
    ok: true,
    total: rows.length,
    items,
    stats,
  });
}
