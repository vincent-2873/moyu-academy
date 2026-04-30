import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { getAdminScope, enforceWriteAccess } from "@/lib/admin-scope";
import { writeAuditLog } from "@/lib/audit-log";
import type { Pillar } from "@/lib/rag-pillars";

/**
 * PATCH /api/admin/rag/update-chunk
 *
 * F3 (2026-04-30 接手第三輪):24 chunks 仍 common(GPT-4o-mini auto-classify confidence < 0.7 fallback)
 * → Vincent 在 KnowledgeEngineEditor detail panel 用 dropdown 手動 re-tag pillar
 *
 * Body:
 *   { id: string, pillar?: Pillar, allowed_roles?: string[] | null }
 *
 * 注意:改 pillar 不會 reset embedding(retrieval filter 是 pillar IN (...) 不影響 embedding)
 *      但 embedded_at 不變 → 不觸發 F1 refresh
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PILLARS: Pillar[] = ["hr", "legal", "sales", "common"];

export async function PATCH(req: NextRequest) {
  const scope = await getAdminScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ro = enforceWriteAccess(scope, req.method);
  if (ro) return ro;

  try {
    const body = await req.json();
    const { id, pillar, allowed_roles } = body || {};

    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    if (pillar && !VALID_PILLARS.includes(pillar)) {
      return NextResponse.json({ error: `invalid pillar: ${pillar}` }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

    // 撈 before snapshot for audit
    const { data: before } = await sb
      .from("knowledge_chunks")
      .select("id, title, pillar, allowed_roles")
      .eq("id", id)
      .maybeSingle();

    if (!before) return NextResponse.json({ error: "chunk not found" }, { status: 404 });

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (pillar !== undefined) update.pillar = pillar;
    if (allowed_roles !== undefined) update.allowed_roles = allowed_roles;

    const { data: after, error } = await sb
      .from("knowledge_chunks")
      .update(update)
      .eq("id", id)
      .select("id, title, pillar, allowed_roles")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await writeAuditLog({
      actor_email: scope.email,
      actor_role: scope.role,
      action: "update",
      resource_type: "knowledge_chunk",
      resource_id: id,
      endpoint: "/api/admin/rag/update-chunk",
      method: "PATCH",
      ip_address: req.headers.get("x-forwarded-for") || null,
      before_data: before,
      after_data: after,
    });

    return NextResponse.json({ ok: true, chunk: after });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
