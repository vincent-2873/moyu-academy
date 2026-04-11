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

  // 1) 寫 claude_tasks — 預設開 LINE channel + awaiting_line_reply 狀態
  //    這樣 Vincent 下次在 LINE 對墨宇小精靈打字，就會自動寫進這張任務的 user_response
  //    如果 migration 還沒跑 (awaiting_reply_at / channel 欄位缺)，降級用舊 schema
  const supabase = getSupabaseAdmin();
  const baseRow = {
    title: `🚧 卡住：${ctx.what}`,
    description: [
      `[卡在] ${ctx.what}`,
      `[原因] ${ctx.why}`,
      `[需要你做] ${ctx.needFromUser}`,
      ctx.details ? `\n[細節] ${ctx.details}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    category: "decision" as const,
    priority: severity,
    why: ctx.why,
    expected_input: ctx.needFromUser,
  };
  let task: { id: string } | null = null;
  let taskErr: { message?: string } | null = null;
  {
    const { data, error } = await supabase
      .from("claude_tasks")
      .insert({
        ...baseRow,
        channel: "line",
        status: "awaiting_line_reply",
        awaiting_reply_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (!error && data) {
      task = data as { id: string };
    } else if (error && /awaiting_reply_at|'channel'|"channel"/i.test(error.message || "")) {
      const retry = await supabase
        .from("claude_tasks")
        .insert({ ...baseRow, status: "pending" })
        .select("id")
        .single();
      task = (retry.data as { id: string } | null) || null;
      taskErr = retry.error;
    } else {
      taskErr = error;
    }
  }

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

// ─── askAdminViaLine — Claude 主動向 Vincent 發問，走 LINE 拿答案 ─────────
//
// 跟 notifyAdminBlocked 差別：
//   notifyAdminBlocked → 「我卡住了，來救我」（被動卡點）
//   askAdminViaLine   → 「我有個決定要你做」（主動提問，例如選 A 還是 B）
//
// 支援兩種模式：
//   1. fire-and-forget (pollMaxSeconds=0, default): 建任務、送 LINE、立即回 taskId
//      呼叫端之後自己 GET /api/claude/task-status?id=... 輪詢
//   2. 同步等待 (pollMaxSeconds>0): 最長等 N 秒，期間每 3 秒 query 一次，
//      拿到回覆就 return，逾時回 timedOut=true

export interface AskOverLineOptions {
  /** 要問 Vincent 什麼（1-2 句，直接當 LINE 訊息主體）*/
  question: string;
  /** 為什麼問、背景脈絡（可選，會附在 LINE 下方）*/
  context?: string;
  /** 快速選項（例 ["好,繼續", "先跳過", "停掉"]）— 純列出給人看，不是真正的 quick reply */
  options?: string[];
  /** 同步等待上限秒數，0 = 不等直接回 taskId。max 建議 180 (Vercel 函式 timeout) */
  pollMaxSeconds?: number;
  /** 優先度 — 影響 LINE 推播開頭 emoji */
  severity?: "critical" | "high" | "normal";
}

export interface AskOverLineResult {
  taskId: string | null;
  answered: boolean;
  answer?: string;
  timedOut?: boolean;
  error?: string;
}

export async function askAdminViaLine(
  opts: AskOverLineOptions
): Promise<AskOverLineResult> {
  const severity = opts.severity || "normal";
  const supabase = getSupabaseAdmin();

  const description = [
    `[Claude 的問題]`,
    opts.question,
    opts.context ? `\n[背景]\n${opts.context}` : "",
    opts.options && opts.options.length > 0
      ? `\n[建議回答]\n${opts.options.map((o, i) => `${i + 1}. ${o}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const baseRow = {
    title: `❓ ${opts.question.slice(0, 60)}`,
    description,
    category: "decision",
    priority: severity,
    expected_input: opts.question,
  };

  // 1) 建 task — 優先用新 schema (channel + awaiting_line_reply)，
  //    如果 migration 還沒跑，fallback 用舊 schema 以確保至少 LINE push 出得去
  let task: { id: string } | null = null;
  let taskErr: { message?: string } | null = null;
  let schemaDegraded = false;

  {
    const { data, error } = await supabase
      .from("claude_tasks")
      .insert({
        ...baseRow,
        channel: "line",
        status: "awaiting_line_reply",
        awaiting_reply_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (!error && data) {
      task = data as { id: string };
    } else if (error && /awaiting_reply_at|'channel'|"channel"/i.test(error.message || "")) {
      // schema 還沒 migrate → 降級再 insert
      schemaDegraded = true;
      const retry = await supabase
        .from("claude_tasks")
        .insert({ ...baseRow, status: "pending" })
        .select("id")
        .single();
      task = (retry.data as { id: string } | null) || null;
      taskErr = retry.error;
    } else {
      taskErr = error;
    }
  }

  if (!task) {
    // 即使 task 建失敗，還是推 LINE — 至少通知 Vincent「有問題」+ 帶 migration hint
    const fallbackBody = [
      `⚠️ Claude 想問問題但 claude_tasks 寫入失敗`,
      "",
      opts.question,
      "",
      `錯誤: ${taskErr?.message || "unknown"}`,
      "",
      `請到 Supabase 跑: supabase-migration-line-ask.sql`,
    ].join("\n");
    await linePush({
      title: "⚠️ Claude ask-via-line schema error",
      body: fallbackBody,
      priority: "high",
      reason: "blocked",
    });
    return {
      taskId: null,
      answered: false,
      error: taskErr?.message || "task insert failed",
    };
  }

  // 2) 推 LINE
  const emoji = severity === "critical" ? "🔴" : severity === "high" ? "🟠" : "❓";
  const bodyLines = [
    `${emoji} Claude 有個問題要你決定`,
    "",
    opts.question,
  ];
  if (opts.context) {
    bodyLines.push("", `[背景] ${opts.context}`);
  }
  if (opts.options && opts.options.length > 0) {
    bodyLines.push("");
    bodyLines.push("可選回覆：");
    opts.options.forEach((o, i) => bodyLines.push(`${i + 1}. ${o}`));
    bodyLines.push("");
    bodyLines.push("直接回字就好（不用打數字）");
  } else {
    bodyLines.push("", "直接回字，我會繼續");
  }
  if (schemaDegraded) {
    bodyLines.push(
      "",
      "⚠️ 注意：claude_tasks 新欄位還沒 migrate，LINE → 任務的自動綁定會不工作。",
      "請到 Supabase SQL Editor 跑 supabase-migration-line-ask.sql"
    );
  }

  await linePush({
    title: `❓ Claude 問題`,
    body: bodyLines.join("\n"),
    priority: severity,
    reason: "blocked",
    taskId: task.id,
  });

  // 3) 同步等待（可選）
  const maxSec = Math.max(0, Math.min(opts.pollMaxSeconds || 0, 180));
  if (maxSec === 0) {
    return { taskId: task.id, answered: false };
  }

  const started = Date.now();
  while ((Date.now() - started) / 1000 < maxSec) {
    await new Promise((r) => setTimeout(r, 3000));
    const { data: row } = await supabase
      .from("claude_tasks")
      .select("status, user_response")
      .eq("id", task.id)
      .maybeSingle();
    if (row && row.user_response) {
      return {
        taskId: task.id,
        answered: true,
        answer: row.user_response as string,
      };
    }
  }
  return { taskId: task.id, answered: false, timedOut: true };
}
