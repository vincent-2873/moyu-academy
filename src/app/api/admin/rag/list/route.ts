import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/rag/list?pillar=legal&limit=50
 *
 * 撈 knowledge_chunks 列表(by pillar / brand / path_type),回 preview。
 * 對齊 system-tree v2 §AI 工作台/knowledge + 法務訓練頁狀態顯示。
 */
export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const url = new URL(req.url);
  const pillar = url.searchParams.get("pillar");
  const brand = url.searchParams.get("brand");
  const pathType = url.searchParams.get("path_type");
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);

  let q = sb.from("knowledge_chunks")
    .select("id, title, pillar, path_type, brand, source_type, content, token_count, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (pillar) q = q.eq("pillar", pillar);
  if (brand) q = q.eq("brand", brand);
  if (pathType) q = q.eq("path_type", pathType);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // count by pillar(整體統計,不分頁)
  const { data: countData } = await sb.from("knowledge_chunks")
    .select("pillar", { count: "exact" });

  const byPillar: Record<string, number> = {};
  for (const r of countData || []) {
    const p = (r as { pillar: string | null }).pillar || "common";
    byPillar[p] = (byPillar[p] || 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    total: data?.length || 0,
    by_pillar: byPillar,
    chunks: (data || []).map(c => ({
      id: c.id,
      title: c.title,
      pillar: c.pillar,
      path_type: c.path_type,
      brand: c.brand,
      source_type: c.source_type,
      token_count: c.token_count,
      content_preview: (c.content || "").slice(0, 200),
      created_at: c.created_at,
    })),
  });
}
