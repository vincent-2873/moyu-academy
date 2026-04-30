import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";
import { getAdminScope, enforceWriteAccess } from "@/lib/admin-scope";

/**
 * Pillar Managers Management API
 * 業務/法務/招聘 主管對應 email + line_user_id
 *
 * GET      /api/admin/pillar-managers?pillar=legal
 * POST     /api/admin/pillar-managers  body: { pillar_id, email, display_name?, line_user_id?, role?, priority? }
 * PATCH    /api/admin/pillar-managers  body: { id, ...updates }
 * DELETE   /api/admin/pillar-managers?id=xxx
 */

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const pillar = new URL(req.url).searchParams.get("pillar");
  let q = supabase.from("pillar_managers").select("*").eq("active", true).order("pillar_id").order("priority");
  if (pillar) q = q.eq("pillar_id", pillar);
  const { data, error } = await q;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, data: data || [] });
}

export async function POST(req: NextRequest) {
  // Vincent 2026-04-30 安全 #4: trainer/mentor read-only block
  const _scope = await getAdminScope(req);
  if (_scope) { const _ro = enforceWriteAccess(_scope, req.method); if (_ro) return _ro; }
  const supabase = getSupabaseAdmin();
  const body = await req.json();
  const { pillar_id, email, display_name, line_user_id, role, priority, notes } = body;
  if (!pillar_id || !email) return Response.json({ ok: false, error: "pillar_id + email required" }, { status: 400 });
  if (!["sales", "legal", "recruit"].includes(pillar_id)) {
    return Response.json({ ok: false, error: "pillar_id must be sales/legal/recruit" }, { status: 400 });
  }
  const { data, error } = await supabase.from("pillar_managers").upsert({
    pillar_id, email, display_name: display_name || email.split("@")[0],
    line_user_id: line_user_id || null,
    role: role || "manager",
    priority: priority ?? 100,
    notes: notes || null,
    active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "pillar_id,email" }).select().single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, manager: data });
}

export async function PATCH(req: NextRequest) {
  // Vincent 2026-04-30 安全 #4: trainer/mentor read-only block
  const _scope = await getAdminScope(req);
  if (_scope) { const _ro = enforceWriteAccess(_scope, req.method); if (_ro) return _ro; }
  const supabase = getSupabaseAdmin();
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return Response.json({ ok: false, error: "id required" }, { status: 400 });
  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from("pillar_managers").update(updates).eq("id", id).select().single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, manager: data });
}

export async function DELETE(req: NextRequest) {
  // Vincent 2026-04-30 安全 #4: trainer/mentor read-only block
  const _scope = await getAdminScope(req);
  if (_scope) { const _ro = enforceWriteAccess(_scope, req.method); if (_ro) return _ro; }
  const supabase = getSupabaseAdmin();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ ok: false, error: "id required" }, { status: 400 });
  // 軟刪除（active=false）
  const { error } = await supabase.from("pillar_managers").update({ active: false, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
