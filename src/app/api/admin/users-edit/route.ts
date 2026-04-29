import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

/**
 * /api/admin/users-edit
 *
 * 主管手動改員工:capability_scope / role / module_role / stage / stage_path / brand / business_line / location_id
 * 階段 / 角色升降留 stage_history(C2 trigger 自動)
 */

export const runtime = "nodejs";

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data: users } = await sb
    .from("users")
    .select("id, email, name, role, module_role, capability_scope, brand, stage, stage_path, location_id, business_line_id, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  return NextResponse.json({ users: users || [] });
}

export async function PUT(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const body = await req.json();
  const updates: any = {};
  for (const k of [
    "name", "role", "module_role", "capability_scope",
    "brand", "stage", "stage_path",
    "location_id", "business_line_id",
    "is_active", "stage_note",
  ]) {
    if (k in body) updates[k] = body[k];
  }
  if (body.stage_set_by) updates.stage_set_by = body.stage_set_by;
  updates.updated_at = new Date().toISOString();
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("users").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}
