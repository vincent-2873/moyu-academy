import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";
import { getAdminScope, enforceWriteAccess } from "@/lib/admin-scope";

let brandColumnExists: boolean | null = null;

async function checkBrandColumn(): Promise<boolean> {
  if (brandColumnExists !== null) return brandColumnExists;
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("module_overrides").select("brand").limit(1);
    brandColumnExists = !error;
  } catch {
    brandColumnExists = false;
  }
  return brandColumnExists;
}

// GET /api/admin/module-overrides?brand=...
export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const brand = req.nextUrl.searchParams.get("brand");
  const hasBrand = await checkBrandColumn();

  let query = supabase
    .from("module_overrides")
    .select("*")
    .order("module_id", { ascending: true });

  if (brand && hasBrand) {
    query = query.eq("brand", brand);
  }

  const { data, error } = await query;

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ overrides: data || [] });
}

// POST /api/admin/module-overrides
export async function POST(req: NextRequest) {
  // Vincent 2026-04-30 安全 #4: trainer/mentor read-only block
  const _scope = await getAdminScope(req);
  if (_scope) { const _ro = enforceWriteAccess(_scope, req.method); if (_ro) return _ro; }
  const body = await req.json();
  const { moduleId, brand, ...fields } = body;
  if (!moduleId) return Response.json({ error: "moduleId required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const hasBrand = await checkBrandColumn();

  const record: Record<string, unknown> = {
    module_id: moduleId,
    updated_at: new Date().toISOString(),
  };

  if (hasBrand) {
    record.brand = brand || "nschool";
  }

  if (fields.description !== undefined) record.description_override = fields.description;
  if (fields.content !== undefined) record.content_override = fields.content;
  if (fields.keyPoints !== undefined) record.key_points_override = fields.keyPoints;
  if (fields.schedule !== undefined) record.schedule_override = fields.schedule;
  if (fields.resources !== undefined) record.resources_override = fields.resources;
  if (fields.trainerTips !== undefined) record.trainer_tips_override = fields.trainerTips;
  if (fields.practiceTask !== undefined) record.practice_task_override = fields.practiceTask;
  if (fields.updatedBy !== undefined) record.updated_by = fields.updatedBy;

  const onConflict = hasBrand ? "module_id,brand" : "module_id";
  const { data, error } = await supabase
    .from("module_overrides")
    .upsert(record, { onConflict })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ override: data });
}

// DELETE /api/admin/module-overrides?moduleId=...&brand=...
export async function DELETE(req: NextRequest) {
  // Vincent 2026-04-30 安全 #4: trainer/mentor read-only block
  const _scope = await getAdminScope(req);
  if (_scope) { const _ro = enforceWriteAccess(_scope, req.method); if (_ro) return _ro; }
  const moduleIdRaw = req.nextUrl.searchParams.get("moduleId");
  const brand = req.nextUrl.searchParams.get("brand");
  const moduleId = Number(moduleIdRaw);
  if (!moduleIdRaw || !Number.isInteger(moduleId) || moduleId <= 0) {
    return Response.json({ error: "moduleId must be a positive integer" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const hasBrand = await checkBrandColumn();

  let query = supabase
    .from("module_overrides")
    .delete()
    .eq("module_id", moduleId);

  if (brand && hasBrand) {
    query = query.eq("brand", brand);
  }

  const { error } = await query;

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
