/**
 * LINE 推播模組（墨宇小精靈 — 墨宇戰情中樞）
 *
 * 用途：把 Claude 指派的任務、警報、自動行動結果推播給用戶
 *
 * 環境變數：
 * - LINE_CHANNEL_ACCESS_TOKEN: LINE Messaging API token (來自 LINE Developers Console)
 * - LINE_CHANNEL_SECRET:       LINE webhook 簽名驗證用
 * - LINE_ADMIN_USER_ID:        老闆/管理者的 LINE userId（系統警報的預設收件人，例如 Claude 卡住時）
 *
 * 推播對象解析優先順序：
 *   1. opts.lineUserId 直接指定 → 用這個
 *   2. opts.userEmail 信箱 → 從 users.line_user_id 查
 *   3. 都沒給 → 用 LINE_ADMIN_USER_ID（管理者預設）
 *
 * Token 沒設定時自動進入 stub 模式：寫 console + line_push_log（result='stub'）
 */

import { getSupabaseAdmin } from "./supabase";

export type LinePushPriority = "critical" | "high" | "normal" | "low";

export interface LinePushOptions {
  title?: string;
  body: string;
  priority?: LinePushPriority;
  taskId?: string;
  link?: string;
  /** 直接指定 LINE userId（最優先） */
  lineUserId?: string;
  /** 用 email 查 users.line_user_id */
  userEmail?: string;
  /** 為什麼推播（blocked / task / alert / system / register） */
  reason?: string;
}

export interface LinePushResult {
  ok: boolean;
  mode: "live" | "stub";
  error?: string;
  resolvedUserId?: string;
}

const PRIORITY_EMOJI: Record<LinePushPriority, string> = {
  critical: "🔴🔴🔴",
  high: "🟠",
  normal: "🟡",
  low: "🔵",
};

function formatMessage(opts: LinePushOptions): string {
  const emoji = PRIORITY_EMOJI[opts.priority || "normal"];
  let msg = opts.title ? `${emoji} ${opts.title}\n\n${opts.body}` : `${emoji} ${opts.body}`;
  if (opts.link) msg += `\n\n🔗 ${opts.link}`;
  if (opts.taskId) msg += `\n\n#task-${opts.taskId.slice(0, 8)}`;
  return msg;
}

/**
 * 解析推播對象
 */
async function resolveTargetUserId(opts: LinePushOptions): Promise<string | null> {
  if (opts.lineUserId) return opts.lineUserId;
  if (opts.userEmail) {
    try {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from("users")
        .select("line_user_id")
        .eq("email", opts.userEmail)
        .maybeSingle();
      if (data?.line_user_id) return data.line_user_id;
    } catch {
      // fall through
    }
  }
  return process.env.LINE_ADMIN_USER_ID || null;
}

/**
 * 寫入推播紀錄
 */
async function logPush(
  opts: LinePushOptions,
  resolvedUserId: string | null,
  result: "success" | "failed" | "stub",
  error?: string
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("line_push_log").insert({
      line_user_id: resolvedUserId,
      user_email: opts.userEmail || null,
      title: opts.title || null,
      body: opts.body,
      priority: opts.priority || "normal",
      reason: opts.reason || null,
      result,
      error: error || null,
    });
  } catch {
    // best effort
  }
}

/**
 * 推播訊息到 LINE
 */
export async function linePush(opts: LinePushOptions): Promise<LinePushResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const message = formatMessage(opts);
  const resolvedUserId = await resolveTargetUserId(opts);

  // STUB MODE: 沒 token 或解析不到對象
  if (!token || !resolvedUserId) {
    console.log("[LINE STUB]", message, "→", resolvedUserId || "NO_TARGET");
    await logPush(opts, resolvedUserId, "stub", token ? "no_target_user" : "no_token");
    return { ok: true, mode: "stub", resolvedUserId: resolvedUserId || undefined };
  }

  // LIVE MODE
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: resolvedUserId,
        messages: [{ type: "text", text: message }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const errMsg = `HTTP ${res.status}: ${errText}`;
      await logPush(opts, resolvedUserId, "failed", errMsg);
      return { ok: false, mode: "live", error: errMsg, resolvedUserId };
    }

    await logPush(opts, resolvedUserId, "success");
    return { ok: true, mode: "live", resolvedUserId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    await logPush(opts, resolvedUserId, "failed", msg);
    return { ok: false, mode: "live", error: msg, resolvedUserId };
  }
}

/**
 * 回覆 LINE 訊息（用 reply token，比 push 便宜，5 分鐘內有效）
 */
export async function lineReply(replyToken: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.log("[LINE STUB reply]", text);
    return { ok: true };
  }
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${errText}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/**
 * Claude 卡住時推播給管理者（不能耽誤的緊急代辦）
 * 哲學：Claude 不該因為一個物理障礙就停下來等對話輪，而是把球丟出來繼續做別的
 */
export async function notifyBlocked(opts: {
  what: string;       // 卡在哪個動作
  why: string;        // 為什麼卡住
  needFromUser: string; // 需要使用者做什麼
  link?: string;      // 處理連結
}): Promise<void> {
  await linePush({
    title: "🚧 Claude 卡住了，需要你介入",
    body: `[卡在] ${opts.what}\n[原因] ${opts.why}\n[需要你做] ${opts.needFromUser}`,
    priority: "high",
    link: opts.link,
    reason: "blocked",
  });
}

/**
 * 推播 Claude 新任務通知
 */
export async function pushNewTask(task: {
  id: string;
  title: string;
  description: string;
  priority: LinePushPriority;
  why?: string | null;
  expected_input?: string | null;
  assignee_email?: string | null;
}): Promise<void> {
  let body = task.description;
  if (task.why) body += `\n\n[為什麼] ${task.why}`;
  if (task.expected_input) body += `\n\n[需要你提供] ${task.expected_input}`;
  body += `\n\n→ 進後台「🤖 Claude 指派」處理`;

  await linePush({
    title: `Claude 指派任務：${task.title}`,
    body,
    priority: task.priority,
    taskId: task.id,
    link: "https://moyusales.vercel.app/admin",
    userEmail: task.assignee_email || undefined,
    reason: "task",
  });
}
