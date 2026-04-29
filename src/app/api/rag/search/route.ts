import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/rag/search
 *
 * RAG 即時檢索 — 給戰情官對話側欄用
 *
 * Body:
 *   { query: string, brand?, path_type?, stage_tag?, top_k? }
 *
 * Response:
 *   { results: [{ id, source_type, source_id, title, content, similarity }] }
 *
 * Flow:
 *   1. query → OpenAI text-embedding-3-small (1536)
 *   2. PostgreSQL search_knowledge() function (cosine similarity)
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
    const { query, brand, path_type, stage_tag, top_k } = body;
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "missing query" }, { status: 400 });
    }

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

    // 2. search_knowledge() RPC
    const { data: results, error } = await sb.rpc("search_knowledge", {
      query_embedding: queryEmbedding,
      match_count: top_k || 5,
      filter_brand: brand || null,
      filter_path_type: path_type || null,
      filter_stage_tag: stage_tag || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      query,
      filters: { brand, path_type, stage_tag, top_k },
      results: results || [],
      count: results?.length || 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
