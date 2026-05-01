import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/rag/backfill-pillar
 *
 * 修補 v12 ingest 後 pillar 誤判:
 *   - source_type='training_md' AND source_id LIKE 'training/sales/%'
 *     → pillar = 'sales'(原本被誤判 'common')
 *   - source_type='training_md' AND source_id LIKE 'training/legal/%'
 *     → pillar = 'legal'
 *
 * Bug root cause:rag-pillars.ts 的 inferPillarFromPath regex `/\/sales\//`
 *   對 relative path("sales/...")不 match,改成 `/(^|\/)sales(\/|$)/` 已修。
 *   但 v12 ingest 已跑過 → 532 個 chunks 進 common 池;backfill 修值不 re-ingest。
 */
export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const startTs = Date.now();

  // 1. sales 補 pillar
  const { data: salesData, error: salesErr } = await sb
    .from("knowledge_chunks")
    .update({ pillar: "sales" })
    .eq("source_type", "training_md")
    .eq("pillar", "common")
    .like("source_id", "training/sales/%")
    .select("id");

  // 2. legal 補 pillar
  const { data: legalData, error: legalErr } = await sb
    .from("knowledge_chunks")
    .update({ pillar: "legal" })
    .eq("source_type", "training_md")
    .eq("pillar", "common")
    .like("source_id", "training/legal/%")
    .select("id");

  // 3. by_pillar 統計
  const { data: countData } = await sb.from("knowledge_chunks")
    .select("pillar");
  const byPillar: Record<string, number> = {};
  for (const r of countData || []) {
    const p = (r as { pillar: string | null }).pillar || "null";
    byPillar[p] = (byPillar[p] || 0) + 1;
  }

  return NextResponse.json({
    ok: !salesErr && !legalErr,
    sales_updated: salesData?.length || 0,
    legal_updated: legalData?.length || 0,
    sales_error: salesErr?.message || null,
    legal_error: legalErr?.message || null,
    by_pillar: byPillar,
    duration_ms: Date.now() - startTs,
  });
}
