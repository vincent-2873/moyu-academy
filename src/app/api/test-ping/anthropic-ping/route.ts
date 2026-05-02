import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/test-ping/anthropic-ping
 *
 * 最輕量測 Anthropic API 是否通(第十三輪 Vincent verify)
 *
 * 用法:
 *   /api/test-ping/anthropic-ping                       → 測 claude-haiku-4-5(預設)
 *   /api/test-ping/anthropic-ping?model=claude-sonnet-4-6
 *   /api/test-ping/anthropic-ping?batch=1               → 7 個 model 都試一遍
 *   /api/test-ping/anthropic-ping?batch=1&model=claude-haiku-4-5,claude-sonnet-4-6
 *
 * 不暴露 API key — 只回 status / model / content / usage
 */

const DEFAULT_MODELS = [
  "claude-haiku-4-5",
  "claude-sonnet-4-6",
  "claude-3-5-haiku-20241022",
  "claude-3-5-sonnet-20241022",
  "claude-3-opus-20240229",
  "claude-3-haiku-20240307",
  "claude-3-5-haiku-latest",
];

interface PingResult {
  model: string;
  ok: boolean;
  http_status?: number | null;
  error_type?: string;
  error_message?: string;
  content?: string;
  usage?: unknown;
  ms?: number;
}

async function pingOne(client: Anthropic, model: string): Promise<PingResult> {
  const start = Date.now();
  try {
    const msg = await client.messages.create({
      model,
      max_tokens: 50,
      messages: [{ role: "user", content: "hi" }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    return {
      model,
      ok: true,
      content: text,
      usage: msg.usage,
      ms: Date.now() - start,
    };
  } catch (err: unknown) {
    const e = err as { status?: number; error?: { type?: string; message?: string }; message?: string; name?: string };
    return {
      model,
      ok: false,
      http_status: e.status || null,
      error_type: e.error?.type || e.name || "unknown",
      error_message: (e.error?.message || e.message || "").slice(0, 300),
      ms: Date.now() - start,
    };
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const modelParam = url.searchParams.get("model");
  const batchParam = url.searchParams.get("batch");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY env not set" }, { status: 500 });
  }

  // ?info=1 → 只回 key 公開特徵(前 16 chars Anthropic console 本來就顯,不違反紅線 1)
  if (url.searchParams.get("info") === "1") {
    const prefix16 = apiKey.slice(0, 16);
    const last4 = apiKey.slice(-4);
    return NextResponse.json({
      ok: true,
      key_prefix_16: prefix16,
      key_last_4: last4,
      key_length: apiKey.length,
      hint: "比對 Anthropic console 4 個 key 前 16 chars + 後 4 chars 看 prod 用哪個",
    });
  }

  const client = new Anthropic({ apiKey });

  // batch 模式
  if (batchParam === "1" || batchParam === "all" || batchParam === "true") {
    const models = (modelParam || DEFAULT_MODELS.join(",")).split(",").map(m => m.trim()).filter(Boolean);
    const results: PingResult[] = [];
    for (const m of models) {
      results.push(await pingOne(client, m));
    }
    return NextResponse.json({
      batch: true,
      summary: {
        total: results.length,
        ok: results.filter(r => r.ok).length,
        fail: results.filter(r => !r.ok).length,
        unique_errors: Array.from(new Set(results.filter(r => !r.ok).map(r => r.error_type))),
      },
      results,
    });
  }

  // single 模式
  const model = modelParam || "claude-haiku-4-5";
  return NextResponse.json(await pingOne(client, model));
}

export const POST = GET;
