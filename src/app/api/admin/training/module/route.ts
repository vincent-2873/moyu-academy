import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { getAdminScope, enforceWriteAccess } from "@/lib/admin-scope";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Vincent 2026-04-30 安全 #4: trainer/mentor read-only block
  const _scope = await getAdminScope(req);
  if (_scope) { const _ro = enforceWriteAccess(_scope, req.method); if (_ro) return _ro; }
  const body = await req.json();
  const { path_id, day_offset, sequence, module_type, title, description, content, duration_min, required, reward, unlock_condition } = body;
  if (!path_id || day_offset === undefined || sequence === undefined || !module_type || !title) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("training_modules").insert({
    path_id, day_offset, sequence, module_type, title, description,
    content: content || {},
    duration_min: duration_min || null,
    required: required ?? true,
    reward: reward || {},
    unlock_condition: unlock_condition || {},
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ module: data });
}

export async function PUT(req: NextRequest) {
  // Vincent 2026-04-30 安全 #4: trainer/mentor read-only block
  const _scope = await getAdminScope(req);
  if (_scope) { const _ro = enforceWriteAccess(_scope, req.method); if (_ro) return _ro; }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const body = await req.json();
  const updates: any = {};
  for (const k of ["module_type", "title", "description", "content", "duration_min", "required", "reward", "unlock_condition", "day_offset", "sequence"]) {
    if (k in body) updates[k] = body[k];
  }
  updates.updated_at = new Date().toISOString();

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("training_modules").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ module: data });
}

export async function DELETE(req: NextRequest) {
  // Vincent 2026-04-30 安全 #4: trainer/mentor read-only block
  const _scope = await getAdminScope(req);
  if (_scope) { const _ro = enforceWriteAccess(_scope, req.method); if (_ro) return _ro; }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("training_modules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
