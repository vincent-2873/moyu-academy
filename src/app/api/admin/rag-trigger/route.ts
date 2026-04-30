import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

/**
 * /api/admin/rag-trigger — 一鍵觸發 RAG ingest + embedding
 *
 * Body: { action: "ingest_local" | "ingest_notion" | "embed_pending" | "all" }
 *
 * 內部 call 既有 endpoint(server-side fetch with cookie pass-through)
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const cookie = req.headers.get("cookie") || "";
  const baseUrl = req.nextUrl.origin;
  const body = await req.json().catch(() => ({}));
  const action = body.action || "all";

  const results: Record<string, any> = {};

  async function callEndpoint(path: string, payload: any = {}) {
    try {
      const r = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      return { status: r.status, ...d };
    } catch (e: any) {
      return { error: String(e?.message || e) };
    }
  }

  if (action === "ingest_local" || action === "all") {
    results.ingest_local = await callEndpoint("/api/admin/rag/ingest-local-training", {});
  }

  if (action === "embed_pending" || action === "all") {
    results.embed_pending = await callEndpoint("/api/admin/rag/embed-pending", { max_chunks: 200, batch_size: 50 });
  }

  if (action === "ingest_notion" || action === "all") {
    results.ingest_notion = await callEndpoint("/api/admin/rag/ingest-notion", {});
  }

  return NextResponse.json({ ok: true, action, results });
}
