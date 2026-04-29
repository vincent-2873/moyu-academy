import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, path_type, brand, name, description } = body;
  if (!code || !path_type || !name) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("training_paths").insert({
    code, path_type, brand, name, description,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ path: data });
}

export async function PUT(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const body = await req.json();
  const updates: any = {};
  for (const k of ["name", "description", "brand", "is_active"]) {
    if (k in body) updates[k] = body[k];
  }
  updates.updated_at = new Date().toISOString();

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("training_paths").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ path: data });
}
