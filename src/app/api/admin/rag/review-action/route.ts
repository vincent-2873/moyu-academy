import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getAdminScope, enforceWriteAccess } from "@/lib/admin-scope";
import { writeAuditLog } from "@/lib/audit-log";
import type { Pillar } from "@/lib/rag-pillars";

/**
 * POST /api/admin/rag/review-action
 *
 * Body:
 *   { id, action: 'approve' | 'reject', pillar?, visibility?, rejection_reason? }
 *
 *   approve:設 reviewed=true,可順手改 pillar / visibility
 *   reject:設 deprecated_at + rejection_reason(soft delete)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PILLARS: Pillar[] = ["hr", "legal", "sales", "common"];
const VALID_VISIBILITY = ["public", "pillar", "brand", "role", "self"];

export async function POST(req: NextRequest) {
  const scope = await getAdminScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ro = enforceWriteAccess(scope, req.method);
  if (ro) return ro;

  try {
    const body = await req.json();
    const { id, action } = body || {};

    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const { data: before } = await sb
      .from("knowledge_chunks")
      .select("id, title, pillar, visibility, reviewed, uploaded_by_email")
      .eq("id", id)
      .maybeSingle();

    if (!before) return NextResponse.json({ error: "chunk not found" }, { status: 404 });

    let update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (action === "approve") {
      update.reviewed = true;
      if (body.pillar !== undefined && VALID_PILLARS.includes(body.pillar)) update.pillar = body.pillar;
      if (body.visibility !== undefined && VALID_VISIBILITY.includes(body.visibility)) update.visibility = body.visibility;
    } else {
      // reject:soft delete
      update.deprecated_at = new Date().toISOString();
      update.rejection_reason = String(body.rejection_reason || "未說明").slice(0, 500);
    }

    const { data: after, error } = await sb
      .from("knowledge_chunks")
      .update(update)
      .eq("id", id)
      .select("id, title, pillar, visibility, reviewed, deprecated_at, rejection_reason")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await writeAuditLog({
      actor_email: scope.email,
      actor_role: scope.role,
      action: action === "approve" ? "update" : "delete",
      resource_type: "knowledge_chunk",
      resource_id: id,
      endpoint: "/api/admin/rag/review-action",
      method: "POST",
      ip_address: req.headers.get("x-forwarded-for") || null,
      before_data: before,
      after_data: after,
      metadata: { review_action: action },
    });

    return NextResponse.json({ ok: true, action, chunk: after });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
