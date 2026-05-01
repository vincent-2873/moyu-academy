import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/arbitrations
 * 對應 system-tree v2 §人類工作區 §仲裁紀錄(/admin/human/arbitration)
 * 從 Phase 4 schema D26 arbitration_records 撈
 */
export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("arbitration_records")
    .select("id, conflict_summary, parties, process_log, conclusion, claude_learnings, ingested_to_rag, arbitrated_at, created_at")
    .order("arbitrated_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    return NextResponse.json({
      ok: false,
      error: error.message,
      records: [],
      hint: "若是 'relation does not exist',表示 D26 SQL Phase 4 schema 還沒 apply",
    }, { status: 200 });
  }

  return NextResponse.json({
    ok: true,
    count: data?.length ?? 0,
    records: data ?? [],
  });
}
