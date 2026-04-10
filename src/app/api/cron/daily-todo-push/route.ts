import { getSupabaseAdmin } from "@/lib/supabase";
import { linePush } from "@/lib/line-notify";
import { NextRequest } from "next/server";

/**
 * 每日代辦 LINE 推播（墨宇小精靈 → 每位綁定用戶）
 *
 * 排程：vercel.json / Zeabur cron 每天早上推一次（建議台灣時間 09:00 = UTC 01:00）
 *
 * 邏輯：
 *   1. 抓所有 status='active' 且 line_user_id 不為空的 users
 *   2. 對每個 user：
 *      a. 查 claude_tasks 中 assigned_to = user.email 且 status in (pending, in_progress, blocked) 的任務
 *      b. 把它們組成一則「今日必做」訊息，用 linePush 推給該 line_user_id
 *   3. 沒有綁定 LINE 的人直接跳過（他們連系統都登入不了）
 *   4. 所有「沒有 email 指定」的通用任務（assigned_to='user' 或 null）→ 丟給 LINE_ADMIN_USER_ID
 *
 * 安全：只允許帶 CRON_SECRET 或 Vercel Cron 自帶的 header 呼叫
 */

const PRIORITY_LABEL: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  normal: "🟡",
  low: "🔵",
};

interface ClaudeTask {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  why: string | null;
  expected_input: string | null;
  created_at: string;
}

function formatTaskList(tasks: ClaudeTask[]): string {
  return tasks
    .slice(0, 10)
    .map((t, i) => {
      const emoji = PRIORITY_LABEL[t.priority] || "⚪";
      return `${i + 1}. ${emoji} ${t.title}`;
    })
    .join("\n");
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    // 允許 Vercel Cron header 繞過（Vercel 會在 header 加 x-vercel-cron）
    if (!request.headers.get("x-vercel-cron")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();
  const startedAt = Date.now();

  try {
    // 1. 撈所有綁定 LINE 的 active 用戶
    const { data: users, error: userErr } = await supabase
      .from("users")
      .select("id, email, name, brand, line_user_id")
      .eq("status", "active")
      .not("line_user_id", "is", null);

    if (userErr) {
      return Response.json({ error: userErr.message }, { status: 500 });
    }

    const boundUsers = users || [];

    // 2. 一次撈所有未完成的 claude_tasks，之後在記憶體分組
    const { data: tasks, error: taskErr } = await supabase
      .from("claude_tasks")
      .select("id, title, description, priority, status, assigned_to, why, expected_input, created_at")
      .in("status", ["pending", "in_progress", "blocked"])
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });

    if (taskErr) {
      return Response.json({ error: taskErr.message }, { status: 500 });
    }

    const allTasks = (tasks || []) as ClaudeTask[];

    // 3. 每個用戶推播自己的任務
    let pushedUsers = 0;
    let skippedUsers = 0;
    const perUserResults: Array<{ email: string; taskCount: number; ok: boolean; error?: string }> = [];

    for (const user of boundUsers) {
      const myTasks = allTasks.filter((t) => t.assigned_to === user.email);

      if (myTasks.length === 0) {
        skippedUsers++;
        continue;
      }

      const greeting = `⚔️ ${user.name || user.email}，今天有 ${myTasks.length} 件必做`;
      const list = formatTaskList(myTasks);
      const footer =
        myTasks.length > 10
          ? `\n\n…還有 ${myTasks.length - 10} 件\n\n→ 進「我的命令」處理`
          : `\n\n→ 進「我的命令」處理`;

      const result = await linePush({
        title: greeting,
        body: `${list}${footer}`,
        priority: myTasks.some((t) => t.priority === "critical") ? "critical" : "high",
        lineUserId: user.line_user_id!,
        userEmail: user.email,
        reason: "daily_todo",
      });

      if (result.ok) pushedUsers++;
      perUserResults.push({
        email: user.email,
        taskCount: myTasks.length,
        ok: result.ok,
        error: result.error,
      });
    }

    // 4. 通用任務（assigned_to = 'user' 或 null）→ 推給 admin
    const adminTasks = allTasks.filter(
      (t) => !t.assigned_to || t.assigned_to === "user" || t.assigned_to === ""
    );
    let adminPushed = false;
    if (adminTasks.length > 0) {
      const greeting = `⚔️ 集團戰情：今天有 ${adminTasks.length} 件必決`;
      const list = formatTaskList(adminTasks);
      const footer =
        adminTasks.length > 10
          ? `\n\n…還有 ${adminTasks.length - 10} 件\n\n→ 進後台「🤖 Claude 指派」處理`
          : `\n\n→ 進後台「🤖 Claude 指派」處理`;

      const result = await linePush({
        title: greeting,
        body: `${list}${footer}`,
        priority: adminTasks.some((t) => t.priority === "critical") ? "critical" : "high",
        reason: "daily_todo_admin",
      });
      adminPushed = result.ok;
    }

    // 5. 日誌
    await supabase.from("claude_actions").insert({
      action_type: "daily_todo_push",
      target: "all_bound_users",
      summary: `推播 ${pushedUsers}/${boundUsers.length} 位（${skippedUsers} 人今日無任務）；集團任務 ${adminTasks.length} 件`,
      details: {
        boundUsers: boundUsers.length,
        pushedUsers,
        skippedUsers,
        adminTasks: adminTasks.length,
        adminPushed,
        perUserResults,
      },
      result: "success",
    });

    return Response.json({
      ok: true,
      duration_ms: Date.now() - startedAt,
      boundUsers: boundUsers.length,
      pushedUsers,
      skippedUsers,
      adminTasks: adminTasks.length,
      adminPushed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    await supabase.from("claude_actions").insert({
      action_type: "daily_todo_push",
      target: "all_bound_users",
      summary: `推播失敗：${msg}`,
      result: "failed",
    });
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
