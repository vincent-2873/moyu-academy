import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";

/**
 * GET /api/me/uploads?email=...
 *
 * 員工看自己上傳的所有 chunks(個人 audit)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const sb = getSupabaseAdmin();

  const rows = await fetchAllRows<{
    id: string;
    title: string;
    content: string;
    source_type: string;
    pillar: string;
    visibility: string;
    reviewed: boolean;
    uploaded_at: string;
    source_mime: string;
    transcript_status: string;
    deprecated_at: string | null;
    rejection_reason: string | null;
    metadata: Record<string, unknown>;
  }>(() =>
    sb.from("knowledge_chunks")
      .select("id, title, content, source_type, pillar, visibility, reviewed, uploaded_at, source_mime, transcript_status, deprecated_at, rejection_reason, metadata")
      .eq("uploaded_by_email", email)
      .order("uploaded_at", { ascending: false })
  );

  const items = rows.map((r) => ({
    ...r,
    content_preview: (r.content || "").slice(0, 200),
    content: undefined,
    content_length: (r.content || "").length,
    status: r.deprecated_at ? "rejected" : (r.reviewed ? "approved" : "pending"),
  }));

  // 群組
  const stats = {
    total: rows.length,
    pending: rows.filter((r) => !r.reviewed && !r.deprecated_at).length,
    approved: rows.filter((r) => r.reviewed && !r.deprecated_at).length,
    rejected: rows.filter((r) => r.deprecated_at).length,
  };

  return NextResponse.json({ ok: true, items, stats });
}
