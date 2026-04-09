import { linePush, type LinePushPriority } from "@/lib/line-notify";
import { NextRequest } from "next/server";

/**
 * 推播 API
 *
 * POST /api/notify
 * Body:
 *   {
 *     to?: string,           // email 或 LINE userId（如果都沒傳，推給 LINE_ADMIN_USER_ID）
 *     toType?: "email"|"lineUserId",  // 預設 email
 *     title?: string,
 *     body: string,          // 必填
 *     priority?: "critical"|"high"|"normal"|"low",
 *     reason?: string,       // blocked / task / alert / system / register
 *     link?: string
 *   }
 *
 * 用途：
 *   - Claude 主動推播給管理者（卡住、警報）
 *   - 系統推送業務代辦給特定業務
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      to,
      toType = "email",
      title,
      body: messageBody,
      priority,
      reason,
      link,
    }: {
      to?: string;
      toType?: "email" | "lineUserId";
      title?: string;
      body: string;
      priority?: LinePushPriority;
      reason?: string;
      link?: string;
    } = body;

    if (!messageBody) {
      return Response.json({ ok: false, error: "body 必填" }, { status: 400 });
    }

    const result = await linePush({
      title,
      body: messageBody,
      priority,
      reason,
      link,
      lineUserId: toType === "lineUserId" ? to : undefined,
      userEmail: toType === "email" ? to : undefined,
    });

    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
