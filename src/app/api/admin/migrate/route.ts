import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

// POST /api/admin/migrate — run pending migrations
export async function POST() {
  const supabase = getSupabaseAdmin();
  const results: string[] = [];

  // 1. Add brand column to module_overrides if missing
  try {
    const { error } = await supabase
      .from("module_overrides")
      .select("brand")
      .limit(1);

    if (error && error.message?.includes("brand")) {
      // Column doesn't exist — need to add it via raw SQL
      // Since Supabase client can't run DDL, we'll handle it differently:
      // Try inserting a record with brand field to see if column exists
      results.push("NEEDS_MIGRATION: module_overrides needs 'brand' column. Run in Supabase SQL editor:");
      results.push("ALTER TABLE module_overrides ADD COLUMN brand TEXT NOT NULL DEFAULT 'nschool';");
      results.push("ALTER TABLE module_overrides DROP CONSTRAINT IF EXISTS module_overrides_module_id_key;");
      results.push("CREATE UNIQUE INDEX IF NOT EXISTS module_overrides_module_brand_idx ON module_overrides(module_id, brand);");
    } else {
      results.push("OK: module_overrides.brand column exists");
    }
  } catch (err) {
    results.push(`ERROR checking brand column: ${err}`);
  }

  // 2. Create training-files storage bucket if missing
  try {
    const { error } = await supabase.storage.getBucket("training-files");
    if (error) {
      const { error: createErr } = await supabase.storage.createBucket("training-files", { public: true });
      results.push(createErr ? `ERROR creating bucket: ${createErr.message}` : "CREATED: training-files bucket");
    } else {
      results.push("OK: training-files bucket exists");
    }
  } catch (err) {
    results.push(`ERROR checking bucket: ${err}`);
  }

  return NextResponse.json({ results });
}
