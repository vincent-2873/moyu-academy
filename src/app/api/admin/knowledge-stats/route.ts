import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const sb = getSupabaseAdmin();

  const [chunks, sourcesLog] = await Promise.all([
    sb.from("knowledge_chunks").select("source_type, source_id, title, content, token_count, embedding, pillar, allowed_roles, created_at, updated_at").order("created_at", { ascending: false }).limit(500),
    sb.from("knowledge_sources_log").select("*").order("last_synced_at", { ascending: false }).limit(50),
  ]);

  const items = (chunks.data || []).map((c: any) => ({
    ...c,
    has_embedding: !!c.embedding,
    embedding: undefined,                    // 不回傳 embedding 大資料
    content_preview: (c.content || "").slice(0, 300),
    content: undefined,
  }));

  const sourceCounts: Record<string, { total: number; embedded: number }> = {};
  const pillarCounts: Record<string, { total: number; embedded: number }> = {};
  items.forEach((i: any) => {
    if (!sourceCounts[i.source_type]) sourceCounts[i.source_type] = { total: 0, embedded: 0 };
    sourceCounts[i.source_type].total++;
    if (i.has_embedding) sourceCounts[i.source_type].embedded++;
    // RAG 三池 pillar 統計 (Vincent 反饋#1)
    const p = i.pillar || "common";
    if (!pillarCounts[p]) pillarCounts[p] = { total: 0, embedded: 0 };
    pillarCounts[p].total++;
    if (i.has_embedding) pillarCounts[p].embedded++;
  });

  return NextResponse.json({
    total_chunks: items.length,
    total_embedded: items.filter((i: any) => i.has_embedding).length,
    source_counts: sourceCounts,
    pillar_counts: pillarCounts,
    chunks: items,
    sync_log: sourcesLog.data || [],
  });
}
