import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { getRolePillars } from "@/lib/rag-pillars";

/**
 * POST /api/rag/search
 *
 * RAG 即時檢索 — 給戰情官對話側欄用
 *
 * Body:
 *   { query: string, brand?, path_type?, stage_tag?, top_k?, user_role? }
 *   user_role:RAG 三池 — caller 提供 user.role,自動 derive 該 role 可看的 pillar 清單
 *
 * Response:
 *   { results: [{ id, source_type, source_id, title, content, pillar, similarity }] }
 *
 * Flow:
 *   1. query → OpenAI text-embedding-3-small (1536)
 *   2. PostgreSQL search_knowledge() function (cosine similarity + pillar filter)
 *   3. Top-k chunks 回傳
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { query, brand, path_type, stage_tag, top_k, user_role, user_email } = body;
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "missing query" }, { status: 400 });
    }
    // RAG 三池:caller 帶 user_role 進來,自動 derive 可看 pillar 清單
    const allowedPillars = user_role ? getRolePillars(user_role) : null;

    // 1. embedding query
    const embRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: query.slice(0, 8000),
      }),
    });

    if (!embRes.ok) {
      const errText = await embRes.text();
      return NextResponse.json({ error: `OpenAI ${embRes.status}`, detail: errText.slice(0, 200) }, { status: 502 });
    }

    const embData = await embRes.json();
    const queryEmbedding = embData.data?.[0]?.embedding;
    if (!queryEmbedding) {
      return NextResponse.json({ error: "no embedding returned" }, { status: 502 });
    }

    // 2. search_knowledge() RPC (含 pillar + allowed_roles ACL + visibility=self)
    const matchCount = top_k || 5;
    const { data: vectorResults, error } = await sb.rpc("search_knowledge", {
      query_embedding: queryEmbedding,
      match_count: matchCount,
      filter_brand: brand || null,
      filter_path_type: path_type || null,
      filter_stage_tag: stage_tag || null,
      filter_pillars: allowedPillars,
      filter_user_role: user_role || null,
      filter_user_email: user_email || null,        // D16:visibility=self 必要
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let results = vectorResults || [];
    let usedFallback = false;

    // Keyword fallback:vector 沒命中(剛 INSERT 沒 embedding 的 chunk)→ ilike 模糊搜 content/title
    if (results.length < Math.min(3, matchCount)) {
      const seenIds = new Set(results.map((r: { id: string }) => r.id));
      const keywordPattern = `%${query.slice(0, 50).replace(/[%_]/g, "")}%`;

      let kwQuery = sb.from("knowledge_chunks")
        .select("id, source_type, source_id, title, content, brand, pillar, path_type, metadata")
        .is("deprecated_at", null)
        .or(`title.ilike.${keywordPattern},content.ilike.${keywordPattern}`)
        .limit(matchCount);

      if (allowedPillars && allowedPillars.length > 0) {
        kwQuery = kwQuery.in("pillar", allowedPillars);
      }
      if (brand) kwQuery = kwQuery.eq("brand", brand);
      if (path_type) kwQuery = kwQuery.eq("path_type", path_type);

      const { data: kwResults } = await kwQuery;
      const newOnes = (kwResults || []).filter(r => !seenIds.has(r.id))
        .map(r => ({ ...r, similarity: null, source: "keyword_fallback" }));

      if (newOnes.length > 0) {
        results = [...results, ...newOnes].slice(0, matchCount);
        usedFallback = true;
      }
    }

    return NextResponse.json({
      query,
      filters: { brand, path_type, stage_tag, top_k, pillars: allowedPillars, user_role },
      results,
      count: results.length,
      keyword_fallback_used: usedFallback,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
