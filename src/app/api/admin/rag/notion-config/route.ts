import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { getAdminScope, enforceWriteAccess } from "@/lib/admin-scope";
import { writeAuditLog } from "@/lib/audit-log";

/**
 * F2 (2026-04-30 第三輪):rag_notion_config CRUD
 *
 * GET — 列出 hr / sales / legal 三筆 config(notion_database_id, enabled, last_synced_at)
 * PATCH — 更新 db_id / enabled
 *
 * Body (PATCH):
 *   { id: 'hr'|'sales'|'legal', notion_database_id?: string, enabled?: boolean }
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PILLARS = new Set(["hr", "sales", "legal"]);

export async function GET(req: NextRequest) {
  const scope = await getAdminScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("rag_notion_config")
    .select("id, notion_database_id, enabled, last_synced_at, last_synced_count, updated_at")
    .order("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data || [] });
}

export async function PATCH(req: NextRequest) {
  const scope = await getAdminScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ro = enforceWriteAccess(scope, req.method);
  if (ro) return ro;

  try {
    const body = await req.json();
    const { id, notion_database_id, enabled } = body || {};

    if (!id || !VALID_PILLARS.has(id)) {
      return NextResponse.json({ error: "id must be hr|sales|legal" }, { status: 400 });
    }

    // Notion database_id 通常 32 hex 或 dashed UUID(36 chars 含 dash)
    if (notion_database_id !== undefined && notion_database_id !== null && notion_database_id !== "") {
      const cleaned = String(notion_database_id).replace(/-/g, "").trim();
      if (!/^[0-9a-fA-F]{32}$/.test(cleaned)) {
        return NextResponse.json({
          error: "notion_database_id 格式錯,應為 32 位 hex(可帶 dash)",
          hint: "從 Notion 開該 database → 右上 ... → Copy link → URL 末段就是 db_id",
        }, { status: 400 });
      }
    }

    const sb = getSupabaseAdmin();

    const { data: before } = await sb
      .from("rag_notion_config")
      .select("id, notion_database_id, enabled")
      .eq("id", id)
      .maybeSingle();

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (notion_database_id !== undefined) update.notion_database_id = notion_database_id;
    if (enabled !== undefined) update.enabled = !!enabled;

    const { data: after, error } = await sb
      .from("rag_notion_config")
      .update(update)
      .eq("id", id)
      .select("id, notion_database_id, enabled, last_synced_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await writeAuditLog({
      actor_email: scope.email,
      actor_role: scope.role,
      action: "update",
      resource_type: "rag_notion_config",
      resource_id: id,
      endpoint: "/api/admin/rag/notion-config",
      method: "PATCH",
      ip_address: req.headers.get("x-forwarded-for") || null,
      before_data: before,
      after_data: after,
    });

    return NextResponse.json({ ok: true, config: after });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
