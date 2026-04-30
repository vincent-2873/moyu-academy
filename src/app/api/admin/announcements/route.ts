import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { getAdminScope, enforceWriteAccess } from "@/lib/admin-scope";

export const runtime = "nodejs";

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(req: NextRequest) {
  // Vincent 2026-04-30 安全 #4: trainer/mentor read-only block
  const _scope = await getAdminScope(req);
  if (_scope) { const _ro = enforceWriteAccess(_scope, req.method); if (_ro) return _ro; }
  const body = await req.json();
  const { title, content, category, severity, target_brand, target_role, is_active, expires_at } = body;
  if (!content) return NextResponse.json({ error: "missing content" }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("announcements").insert({
    title, content, category, severity,
    target_brand, target_role,
    is_active: is_active ?? true,
    expires_at,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
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
  for (const k of ["title", "content", "category", "severity", "target_brand", "target_role", "is_active", "expires_at"]) {
    if (k in body) updates[k] = body[k];
  }
  updates.updated_at = new Date().toISOString();
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("announcements").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest) {
  // Vincent 2026-04-30 安全 #4: trainer/mentor read-only block
  const _scope = await getAdminScope(req);
  if (_scope) { const _ro = enforceWriteAccess(_scope, req.method); if (_ro) return _ro; }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("announcements").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
