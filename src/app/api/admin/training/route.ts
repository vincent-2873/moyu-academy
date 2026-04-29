import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

/**
 * /admin 訓練管理 — paths + modules CRUD API
 *
 * GET  /api/admin/training                       -> { paths: [...], modules_by_path: {...} }
 * POST /api/admin/training/path                  -> create path
 * PUT  /api/admin/training/path?id=xxx           -> update path
 * POST /api/admin/training/module                -> create module
 * PUT  /api/admin/training/module?id=xxx         -> update module
 * DELETE /api/admin/training/module?id=xxx       -> soft delete
 *
 * 認證: middleware.ts 已驗 admin HMAC cookie
 */

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();

  const [{ data: paths }, { data: modules }] = await Promise.all([
    sb.from("training_paths").select("*").order("path_type").order("name"),
    sb.from("training_modules").select("*").order("path_id").order("day_offset").order("sequence"),
  ]);

  // group modules by path_id
  const modules_by_path: Record<string, any[]> = {};
  (modules || []).forEach((m) => {
    if (!modules_by_path[m.path_id]) modules_by_path[m.path_id] = [];
    modules_by_path[m.path_id].push(m);
  });

  return NextResponse.json({
    paths: paths || [],
    modules_by_path,
  });
}
