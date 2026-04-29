import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/rag/embed-pending
 *
 * 撈 knowledge_chunks 裡 embedding IS NULL 的 row,batch embedding
 *
 * Embedding model: OpenAI text-embedding-3-small (1536 dim, $0.02/M token = 便宜)
 * Batch size: 100 chunks per call (OpenAI 限制 2048 inputs)
 * Run policy: 每次最多處理 200 chunks(避免 timeout),需重複呼叫直到全部 done
 *
 * Body:
 *   { batch_size?, max_chunks? }  defaults: 100, 200
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const startTs = Date.now();
  const sb = getSupabaseAdmin();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: "OPENAI_API_KEY not set",
      hint: "需在 Zeabur env 設 OPENAI_API_KEY",
    }, { status: 503 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(body.batch_size || 100, 100);
    const maxChunks = Math.min(body.max_chunks || 200, 500);

    const { data: pending } = await sb
      .from("knowledge_chunks")
      .select("id, content, title")
      .is("embedding", null)
      .is("deprecated_at", null)
      .order("created_at", { ascending: true })
      .limit(maxChunks);

    if (!pending || pending.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "no pending chunks",
        processed: 0,
        duration_ms: Date.now() - startTs,
      });
    }

    let totalProcessed = 0;
    const errors: string[] = [];

    // Batch 處理
    for (let i = 0; i < pending.length; i += batchSize) {
      const batch = pending.slice(i, i + batchSize);
      const inputs = batch.map(c => `${c.title || ""}\n\n${c.content || ""}`.slice(0, 8000));

      try {
        const res = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: inputs,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          errors.push(`batch ${i}: OpenAI ${res.status} ${errText.slice(0, 200)}`);
          continue;
        }

        const data = await res.json();
        const embeddings = data.data || [];

        for (let j = 0; j < batch.length; j++) {
          const emb = embeddings[j]?.embedding;
          if (!emb) continue;
          const { error } = await sb
            .from("knowledge_chunks")
            .update({
              embedding: emb,
              updated_at: new Date().toISOString(),
            })
            .eq("id", batch[j].id);
          if (error) {
            errors.push(`update ${batch[j].id}: ${error.message}`);
          } else {
            totalProcessed++;
          }
        }
      } catch (e: any) {
        errors.push(`batch ${i}: ${e.message}`);
      }
    }

    await sb.from("system_run_log").insert({
      source: "api:/api/admin/rag/embed-pending",
      status: errors.length === 0 ? "ok" : "partial",
      rows_in: pending.length,
      rows_out: totalProcessed,
      duration_ms: Date.now() - startTs,
      metadata: { errors: errors.slice(0, 3) },
    });

    return NextResponse.json({
      pending: pending.length,
      processed: totalProcessed,
      errors: errors.slice(0, 5),
      duration_ms: Date.now() - startTs,
      next_step: pending.length === maxChunks ? "still has more, call again" : "all done",
    });
  } catch (err: any) {
    await sb.from("system_run_log").insert({
      source: "api:/api/admin/rag/embed-pending",
      status: "fail",
      duration_ms: Date.now() - startTs,
      error_message: String(err?.message || err).slice(0, 500),
    });
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
