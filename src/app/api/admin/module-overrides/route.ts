import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("module_overrides")
    .select("*")
    .order("module_id", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ overrides: data || [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { moduleId, ...fields } = body;
  if (!moduleId) return Response.json({ error: "moduleId required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const record: Record<string, unknown> = {
    module_id: moduleId,
    updated_at: new Date().toISOString(),
  };

  if (fields.description !== undefined) record.description_override = fields.description;
  if (fields.content !== undefined) record.content_override = fields.content;
  if (fields.keyPoints !== undefined) record.key_points_override = fields.keyPoints;
  if (fields.schedule !== undefined) record.schedule_override = fields.schedule;
  if (fields.resources !== undefined) record.resources_override = fields.resources;
  if (fields.trainerTips !== undefined) record.trainer_tips_override = fields.trainerTips;
  if (fields.practiceTask !== undefined) record.practice_task_override = fields.practiceTask;
  if (fields.updatedBy !== undefined) record.updated_by = fields.updatedBy;

  const { data, error } = await supabase
    .from("module_overrides")
    .upsert(record, { onConflict: "module_id" })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ override: data });
}

export async function DELETE(req: NextRequest) {
  const moduleId = req.nextUrl.searchParams.get("moduleId");
  if (!moduleId) return Response.json({ error: "moduleId required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("module_overrides")
    .delete()
    .eq("module_id", parseInt(moduleId));

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
