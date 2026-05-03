import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

/**
 * Cron: /api/cron/embedding-refresh
 *
 * F1 (2026-04-30 接手第三輪):chunks update 後 embedding 不會自動重生
 * → 這個 cron 每 30 分掃一次 stale chunks(updated_at > embedded_at)+ NULL embedding
 *
 * 邏輯:
 *   1. 撈 chunks where deprecated_at IS NULL AND
 *      (embedding IS NULL OR embedded_at IS NULL OR updated_at > embedded_at)
 *   2. 對這些 batch 100 chunks per OpenAI call
 *   3. update embedding + embedded_at = now()
 *   4. 寫 system_run_log
 *
 * 觸發:GitHub Actions cron(.github/workflows/cron.yml 已加 schedule)
 *      手動:curl -X POST -H "Authorization: Bearer $CRON_SECRET" /api/cron/embedding-refresh
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHUNKS_PER_RUN = 200;
const BATCH_SIZE = 100;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startTs = Date.now();
  const sb = getSupabaseAdmin();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    await sb.from("system_run_log").insert({
      source: "cron:embedding-refresh",
      status: "fail",
      duration_ms: Date.now() - startTs,
      error_message: "OPENAI_API_KEY missing",
    });
    return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 503 });
  }

  try {
    // 1. 撈所有 active chunks(用 fetchAllRows 避免 1000 cap;但這邊上限 MAX_CHUNKS_PER_RUN 即可)
    const { data: chunks } = await sb
      .from("knowledge_chunks")
      .select("id, content, title, embedding, embedded_at, updated_at")
      .is("deprecated_at", null)
      .order("created_at", { ascending: true })
      .limit(2000); // 取夠多再 client-side filter

    if (!chunks || chunks.length === 0) {
      await sb.from("system_run_log").insert({
        source: "cron:embedding-refresh",
        status: "noop",
        duration_ms: Date.now() - startTs,
        metadata: { reason: "no chunks" },
      });
      return NextResponse.json({ ok: true, scanned: 0, processed: 0 });
    }

    // 2. filter stale + missing
    const candidates = chunks.filter((c: any) => {
      if (c.embedding === null) return true;             // 從沒 embed
      if (c.embedded_at === null) return true;           // 沒記錄 embed 時間 = 視為 stale
      if (c.updated_at && new Date(c.updated_at).getTime() > new Date(c.embedded_at).getTime()) {
        return true;                                      // content 改過 + embedding 沒刷新
      }
      return false;
    }).slice(0, MAX_CHUNKS_PER_RUN);

    if (candidates.length === 0) {
      await sb.from("system_run_log").insert({
        source: "cron:embedding-refresh",
        status: "noop",
        rows_in: chunks.length,
        rows_out: 0,
        duration_ms: Date.now() - startTs,
        metadata: { all_fresh: true },
      });
      return NextResponse.json({ ok: true, scanned: chunks.length, processed: 0, message: "all fresh" });
    }

    // 3. batch embed
    let processed = 0;
    const errors: string[] = [];

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      // OpenAI text-embedding-3-small max 8192 tokens per input
      // 中文 1 char ≈ 1 token,8000 chars 會超 → 改 4000 chars 留 headroom
      // (Vincent 2026-05-03 根本原因:整 batch 因 1 個過長 chunk 全失敗)
      const inputs = batch.map((c: any) => `${c.title || ""}\n\n${c.content || ""}`.slice(0, 4000));

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
          const nowIso = new Date().toISOString();
          const { error } = await sb
            .from("knowledge_chunks")
            .update({
              embedding: emb,
              embedded_at: nowIso,
              // 注意:不更新 updated_at — 避免 self-loop(updated_at > embedded_at 永遠 true)
            })
            .eq("id", (batch[j] as any).id);
          if (error) {
            errors.push(`update ${(batch[j] as any).id}: ${error.message}`);
          } else {
            processed++;
          }
        }
      } catch (e: any) {
        errors.push(`batch ${i}: ${e.message}`);
      }
    }

    await sb.from("system_run_log").insert({
      source: "cron:embedding-refresh",
      status: errors.length === 0 ? "ok" : "partial",
      rows_in: candidates.length,
      rows_out: processed,
      duration_ms: Date.now() - startTs,
      metadata: {
        scanned_total: chunks.length,
        candidates: candidates.length,
        errors: errors.slice(0, 3),
      },
    });

    return NextResponse.json({
      ok: true,
      scanned: chunks.length,
      candidates: candidates.length,
      processed,
      errors: errors.slice(0, 5),
      duration_ms: Date.now() - startTs,
    });
  } catch (err: any) {
    await sb.from("system_run_log").insert({
      source: "cron:embedding-refresh",
      status: "fail",
      duration_ms: Date.now() - startTs,
      error_message: String(err?.message || err).slice(0, 500),
    });
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

// GET = 簡易 health check(不需要 secret,但只回 status)
export async function GET() {
  return NextResponse.json({
    name: "embedding-refresh",
    method: "POST",
    note: "送 POST 配 Authorization: Bearer $CRON_SECRET",
  });
}
