/**
 * Claude → 管理員「卡住了」通知幫手
 *
 * 任何時候系統遇到 Claude 自己無法解決、必須人介入的情況，呼叫 notifyAdminBlocked()。
 * 會同時：
 *   1. LINE push 到 LINE_ADMIN_USER_ID（vincent）
 *   2. 寫一筆 claude_tasks (category='decision', priority='critical') 進後台
 *   3. 回傳兩邊的操作結果
 *
 * 用在：Metabase token 過期、缺 env var、某個 brand 的 question id 還沒填、
 *        違反 schema 的資料格式、AI coach call 失敗等任何 Claude 需要人類補救的場景。
 */

import { linePush } from "./line-notify";
import { getSupabaseAdmin } from "./supabase";

export interface AdminBlockContext {
  /** 卡在哪個功能 / 模組 */
  what: string;
  /** 為什麼卡（技術上的根因，1-2 句）*/
  why: string;
  /** 需要管理員做什麼（具體動作，不要模糊）*/
  needFromUser: string;
  /** 嚴重度，影響 claude_tasks.priority 與 LINE 推播語氣 */
  severity?: "critical" | "high" | "normal";
  /** 可選：處理連結（後台頁面 / 外部文檔）*/
  link?: string;
  /** 可選：補充細節會寫進 claude_tasks.description */
  details?: string;
}

export interface AdminBlockResult {
  linePushed: boolean;
  linePushError?: string;
  taskId?: string;
  taskError?: string;
}

export async function notifyAdminBlocked(
  ctx: AdminBlockContext
): Promise<AdminBlockResult> {
  const severity = ctx.severity || "critical";

  // 1) 寫 claude_tasks
  const supabase = getSupabaseAdmin();
  const { data: task, error: taskErr } = await supabase
    .from("claude_tasks")
    .insert({
      title: `🚧 卡住：${ctx.what}`,
      description: [
        `[卡在] ${ctx.what}`,
        `[原因] ${ctx.why}`,
        `[需要你做] ${ctx.needFromUser}`,
        ctx.details ? `\n[細節] ${ctx.details}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      category: "decision",
      priority: severity,
      why: ctx.why,
      expected_input: ctx.needFromUser,
    })
    .select("id")
    .single();

  // 2) LINE push
  const emoji = severity === "critical" ? "🔴🔴🔴" : severity === "high" ? "🟠" : "🟡";
  const body = [
    `${emoji} Claude 卡住了，需要你介入`,
    "",
    `[卡在] ${ctx.what}`,
    `[原因] ${ctx.why}`,
    `[需要你做] ${ctx.needFromUser}`,
    ctx.link ? `\n🔗 ${ctx.link}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const pushRes = await linePush({
    title: `🚧 卡點：${ctx.what}`,
    body,
    priority: severity,
    link: ctx.link,
    reason: "blocked",
    // 不指定 userEmail / lineUserId → 會走 LINE_ADMIN_USER_ID 預設
  });

  return {
    linePushed: pushRes.ok && pushRes.mode === "live",
    linePushError: pushRes.error,
    taskId: task?.id,
    taskError: taskErr?.message,
  };
}
