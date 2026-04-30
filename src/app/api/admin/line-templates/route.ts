import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("line_templates").select("*").order("category").order("code");
  if (error) return NextResponse.json({ items: [], note: error.message });
  return NextResponse.json({ items: data || [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, name, category, message_type, content, variables, example_payload, target_role, target_brand, is_active } = body;
  if (!code || !name || !content) return NextResponse.json({ error: "missing code/name/content" }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("line_templates").insert({
    code, name,
    category: category || "general",
    message_type: message_type || "text",
    content,
    variables: variables || [],
    example_payload,
    target_role, target_brand,
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
  for (const k of ["code", "name", "category", "message_type", "content", "variables", "example_payload", "target_role", "target_brand", "is_active"]) {
    if (k in body) updates[k] = body[k];
  }
  updates.updated_at = new Date().toISOString();
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("line_templates").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("line_templates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
