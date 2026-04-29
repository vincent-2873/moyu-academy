import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("kpi_targets").select("*").order("applies_to_stage").order("period").order("name");
  if (error) return NextResponse.json({ items: [], note: error.message });
  return NextResponse.json({ items: data || [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, metric, target_value, period, applies_to_role, applies_to_stage, applies_to_brand, weight, is_active } = body;
  if (!name || !metric || target_value == null) return NextResponse.json({ error: "missing name/metric/target_value" }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("kpi_targets").insert({
    name, metric, target_value,
    period: period || "daily",
    applies_to_role, applies_to_stage, applies_to_brand,
    weight: weight ?? 1,
    is_active: is_active ?? true,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function PUT(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const body = await req.json();
  const updates: any = {};
  for (const k of ["name", "metric", "target_value", "period", "applies_to_role", "applies_to_stage", "applies_to_brand", "weight", "is_active"]) {
    if (k in body) updates[k] = body[k];
  }
  updates.updated_at = new Date().toISOString();
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("kpi_targets").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("kpi_targets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
