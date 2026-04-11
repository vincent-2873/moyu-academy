import { askAdminViaLine } from "@/lib/notify-admin";
import { NextRequest } from "next/server";

/**
 * POST /api/claude/ask-via-line
 *
 * 給 Claude Code (terminal) 用 — 想問 Vincent 一個問題、走 LINE channel。
 *
 * body:
 *   {
 *     question: string (必填, 1-2 句話要問什麼),
 *     context?: string (背景脈絡),
 *     options?: string[] (建議回答),
 *     pollMaxSeconds?: number (0 = 不等直接回 taskId, >0 = 同步等待最長 N 秒)
 *   }
 *
 * 回應:
 *   { ok, taskId, answered, answer?, timedOut?, error? }
 *
 * 呼叫範例 (fire-and-forget):
 *   curl -X POST https://moyusales.zeabur.app/api/claude/ask-via-line \
 *     -H 'Content-Type: application/json' \
 *     -d '{"question":"要不要 deploy 新版？","options":["yes","no"]}'
 *
 * 呼叫範例 (同步等 90 秒):
 *   curl -X POST ... -d '{"question":"...","pollMaxSeconds":90}'
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const question = body.question as string | undefined;
  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return Response.json({ ok: false, error: "question required (string)" }, { status: 400 });
  }

  const result = await askAdminViaLine({
    question: question.trim(),
    context: (body.context as string) || undefined,
    options: Array.isArray(body.options) ? (body.options as string[]) : undefined,
    pollMaxSeconds:
      typeof body.pollMaxSeconds === "number" ? (body.pollMaxSeconds as number) : 0,
    severity: (body.severity as "critical" | "high" | "normal") || "normal",
  });

  return Response.json({ ok: true, ...result });
}
