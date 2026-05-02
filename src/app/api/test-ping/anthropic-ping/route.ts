import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/_test/anthropic-ping
 *
 * 最輕量測 Anthropic API 是否通(Vincent 第十三輪 verify):
 *   model: claude-haiku-4-5(便宜)
 *   max_tokens: 50
 *   message: "hi"
 *
 * 不暴露 API key — 只回 status / model / 第一段 content / usage
 */

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const model = url.searchParams.get("model") || "claude-haiku-4-5";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY env not set" }, { status: 500 });
  }

  // 不 print key 也不回 key 任何片段(連 prefix 也不)
  // 只回:有沒設 / 通 / 不通 + 不通的原因(error type + message,不含 key)
  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model,
      max_tokens: 50,
      messages: [{ role: "user", content: "hi" }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    return NextResponse.json({
      ok: true,
      model: msg.model,
      content: text,
      stop_reason: msg.stop_reason,
      usage: msg.usage,
    });
  } catch (err: unknown) {
    // err 有可能是 Anthropic.APIError,有可能是 Error
    const e = err as { status?: number; error?: { type?: string; message?: string }; message?: string; name?: string };
    return NextResponse.json({
      ok: false,
      http_status: e.status || null,
      error_type: e.error?.type || e.name || "unknown",
      error_message: (e.error?.message || e.message || "").slice(0, 400),
    });
  }
}

export const POST = GET;
