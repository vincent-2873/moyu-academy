import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { getAdminScope, enforceWriteAccess } from "@/lib/admin-scope";

export const runtime = "nodejs";

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("stamp_rules").select("*").order("display_order").order("rarity");
  if (error) return NextResponse.json({ items: [], note: error.message });

  // 統計每個 stamp 已蓋多少
  const { data: counts } = await sb
    .from("training_stamps")
    .select("stamp_code");
  const countMap: Record<string, number> = {};
  (counts || []).forEach((s: any) => {
    countMap[s.stamp_code] = (countMap[s.stamp_code] || 0) + 1;
  });

  const itemsWithCount = (data || []).map((r: any) => ({
    ...r,
    earned_count: countMap[r.code] || 0,
  }));

  return NextResponse.json({ items: itemsWithCount });
}

export async function POST(req: NextRequest) {
  // Vincent 2026-04-30 安全 #4: trainer/mentor read-only block
  const _scope = await getAdminScope(req);
  if (_scope) { const _ro = enforceWriteAccess(_scope, req.method); if (_ro) return _ro; }
  const body = await req.json();
  const { code, name, rarity, trigger_type, trigger_config, description, display_order, is_active } = body;
  if (!code || !name || !trigger_type) return NextResponse.json({ error: "missing code/name/trigger_type" }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("stamp_rules").insert({
    code, name,
    rarity: rarity || "common",
    trigger_type,
    trigger_config: trigger_config || {},
    description: description || null,
    display_order: display_order ?? 0,
    is_active: is_active ?? true,
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
  for (const k of ["code", "name", "rarity", "trigger_type", "trigger_config", "description", "display_order", "is_active"]) {
    if (k in body) updates[k] = body[k];
  }
  updates.updated_at = new Date().toISOString();
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("stamp_rules").update(updates).eq("id", id).select().single();
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
  const { error } = await sb.from("stamp_rules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
