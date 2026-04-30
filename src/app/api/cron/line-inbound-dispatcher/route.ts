import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";
import { linePush } from "@/lib/line-notify";
import { NextRequest } from "next/server";

/**
 * Phase B: Claude-from-LINE — Vincent 在 LINE 下指令 → 後端跑 Claude → 結果推回 LINE
 *
 * schedule: 每分鐘 "* * * * *"
 *
 * 流程：
 *   1. 撈最舊的 claude_actions where action_type='line_inbound_command' AND result='pending'
 *   2. 只處理 super_admin 的 (vincent@xuemi.co) — 安全閘門
 *   3. 先標 result='processing' 避免 race condition
 *   4. 撈 Vincent 需要的 context (今日業務總況、最近警報、awaiting tasks)
 *   5. 呼叫 Claude 模型，system prompt 把 Claude 變成「墨宇戰情中樞 CEO 助理」
 *   6. Claude 輸出純文字答案 → 透過 linePush 推回 Vincent
 *   7. 標記 result='success' + details.response = <claude 答案>
 *
 * 失敗處理：標記 result='failed' + details.error，下次 cron 不會再拿
 */

interface LineCommand {
  id: string;
  target: string;
  summary: string;
  details: { line_user_id?: string; raw?: string };
  created_at: string;
}

const SYSTEM_PROMPT = `你是墨宇戰情中樞的 CEO 助理 Claude，對象是 Vincent（這間公司的唯一管理員、super_admin）。

Vincent 從 LINE 下達命令，你要從後台撈實際資料後用「短、直接、有數字」的方式回他。

鐵則：
1. LINE 訊息 = 沒有排版空間，回答最多 8 行，關鍵數字一定帶（不要寫「大約很多」）
2. 如果你需要的資料在 context 裡沒有 → 直接說「我看不到這個資料，下次 Claude 卡點 API 要加上 X 欄位」
3. 絕對不說「讓我看一下...」、「根據你的請求...」這類客套話 — Vincent 在跑業務沒時間聽
4. 如果 Vincent 是問「今天表現」→ 開頭第一句就是結論（例：「今天只有 3 人有進 DEMO，其中 Tiffany 最強 $47k」），後面才是支持數字
5. 如果 Vincent 是下指令要做事（「推播給 Tiffany」）→ 因為你現在沒有 tool use 能力，直接告訴他「我還沒有做這個動作的能力，需要加 tool」
6. 禁 markdown 的 ** 和 # — LINE 不 render，只會變雜訊
7. 用 emoji 區隔不同段（📊 🔴 ✅ 💡 等）
8. 語氣是戰情官對 CEO 的 brief — 不是客服也不是老師

如果 Vincent 問的事情 context 不夠 → 用 ⚠️ 開頭承認並說你需要什麼`;

function todayTaipei(): string {
  const now = new Date();
  const tp = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return tp.toISOString().slice(0, 10);
}

async function gatherContext(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string> {
  const today = todayTaipei();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weekAgo = sevenDaysAgo.toISOString().slice(0, 10);

  // 今日業務總況 (fetchAllRows 繞 1000 cap)
  const { fetchAllRows } = await import("@/lib/supabase");
  const todayRows = await fetchAllRows<any>(() =>
    supabase.from("sales_metrics_daily")
      .select("email, name, brand, team, calls, call_minutes, raw_appointments, appointments_show, closures, net_revenue_daily")
      .eq("date", today)
  );

  // 本週業務總況 (用來算誰掉速度)
  const weekRows = await fetchAllRows<any>(() =>
    supabase.from("sales_metrics_daily")
      .select("email, name, calls, closures, net_revenue_daily")
      .gte("date", weekAgo)
      .lte("date", today)
  );

  // 最近的警報 (health_alerts 如果有)
  const { data: recentAlerts } = await supabase
    .from("claude_actions")
    .select("summary, created_at, action_type")
    .in("action_type", ["rule_alert", "daily_briefing_push", "metabase_sync"])
    .order("created_at", { ascending: false })
    .limit(5);

  // Awaiting tasks
  const { data: awaiting } = await supabase
    .from("claude_tasks")
    .select("id, title, expected_input, awaiting_reply_at")
    .eq("status", "awaiting_line_reply")
    .order("awaiting_reply_at", { ascending: false })
    .limit(3);

  // 總人數 / 有業務數據的人數
  const { data: usersCount } = await supabase
    .from("users")
    .select("email", { count: "exact", head: false })
    .eq("status", "active");

  // Aggregate
  const todayTotal = (todayRows || []).reduce(
    (acc, r) => ({
      calls: acc.calls + (Number(r.calls) || 0),
      closures: acc.closures + (Number(r.closures) || 0),
      revenue: acc.revenue + (Number(r.net_revenue_daily) || 0),
      shows: acc.shows + (Number(r.appointments_show) || 0),
      appointments: acc.appointments + (Number(r.raw_appointments) || 0),
    }),
    { calls: 0, closures: 0, revenue: 0, shows: 0, appointments: 0 }
  );

  // Top 5 今日 by revenue
  const topToday = [...(todayRows || [])]
    .sort((a, b) => (Number(b.net_revenue_daily) || 0) - (Number(a.net_revenue_daily) || 0))
    .slice(0, 5)
    .map(
      (r) =>
        `  ${r.name || r.email} (${r.brand}${r.team ? "/" + r.team : ""}): ${r.calls || 0}通 ${r.closures || 0}成交 $${Math.round(Number(r.net_revenue_daily) || 0).toLocaleString()}`
    )
    .join("\n");

  // 本週 aggregate by email
  const weekByEmail: Record<string, { name: string; calls: number; closures: number; revenue: number }> = {};
  for (const r of weekRows || []) {
    const email = r.email as string;
    if (!weekByEmail[email]) {
      weekByEmail[email] = { name: (r.name as string) || email, calls: 0, closures: 0, revenue: 0 };
    }
    weekByEmail[email].calls += Number(r.calls) || 0;
    weekByEmail[email].closures += Number(r.closures) || 0;
    weekByEmail[email].revenue += Number(r.net_revenue_daily) || 0;
  }
  const weekActiveCount = Object.keys(weekByEmail).length;

  const parts: string[] = [];
  parts.push(`【日期】${today} (Taipei)`);
  parts.push(`【今日業務數據】`);
  parts.push(`  進件業務數: ${(todayRows || []).length} 人`);
  parts.push(`  總通次: ${todayTotal.calls}`);
  parts.push(`  總邀約: ${todayTotal.appointments}, 出席: ${todayTotal.shows}`);
  parts.push(`  總成交: ${todayTotal.closures} 張`);
  parts.push(`  總淨業績: $${todayTotal.revenue.toLocaleString()}`);
  if (topToday) {
    parts.push(`【今日 Top 5 (by 淨業績)】`);
    parts.push(topToday);
  }
  parts.push(`【本週活躍業務】${weekActiveCount} 人有資料`);
  parts.push(`【系統狀態】active users=${(usersCount || []).length}`);
  if (awaiting && awaiting.length > 0) {
    parts.push(`【Claude 正在等的任務】`);
    for (const t of awaiting) {
      parts.push(`  · ${t.title}`);
    }
  }
  if (recentAlerts && recentAlerts.length > 0) {
    parts.push(`【最近系統事件】`);
    for (const a of recentAlerts.slice(0, 3)) {
      parts.push(`  · ${a.action_type}: ${a.summary}`);
    }
  }

  return parts.join("\n");
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    if (
      !req.headers.get("x-vercel-cron") &&
      !req.headers.get("x-zeabur-cron") &&
      req.nextUrl.searchParams.get("key") !== "manual-trigger"
    ) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  // 只處理 super_admin (vincent@xuemi.co) 的指令 — 安全閘門
  const { data: rows } = await supabase
    .from("claude_actions")
    .select("id, target, summary, details, created_at")
    .eq("action_type", "line_inbound_command")
    .eq("result", "pending")
    .eq("target", "vincent@xuemi.co")
    .order("created_at", { ascending: true })
    .limit(3);

  const commands = (rows || []) as LineCommand[];
  if (commands.length === 0) {
    return Response.json({ ok: true, processed: 0, date: todayTaipei() });
  }

  const results: Array<{ id: string; status: "success" | "failed"; error?: string; preview?: string }> = [];

  for (const cmd of commands) {
    // 先標 processing 避免下次重複處理
    await supabase
      .from("claude_actions")
      .update({ result: "processing" })
      .eq("id", cmd.id);

    try {
      const userText = cmd.details?.raw || cmd.summary;
      const lineUserId = cmd.details?.line_user_id;

      // 撈當下 context
      const context = await gatherContext(supabase);

      // 跑 Claude
      const client = new Anthropic({ apiKey });
      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: `${SYSTEM_PROMPT}\n\n【當下 context】\n${context}`,
        messages: [{ role: "user", content: userText }],
      });

      const responseText =
        msg.content[0]?.type === "text" ? msg.content[0].text : "(Claude 沒有回答文字)";

      // 推回 LINE
      const pushRes = await linePush({
        title: "🤖 Claude 回答",
        body: responseText,
        priority: "normal",
        reason: "system",
        lineUserId: lineUserId || undefined,
        userEmail: lineUserId ? undefined : cmd.target,
      });

      // 標 success + 存 response
      await supabase
        .from("claude_actions")
        .update({
          result: pushRes.ok ? "success" : "failed",
          details: {
            ...cmd.details,
            response: responseText,
            line_pushed: pushRes.ok,
            line_mode: pushRes.mode,
            processed_at: new Date().toISOString(),
          },
        })
        .eq("id", cmd.id);

      results.push({
        id: cmd.id,
        status: "success",
        preview: responseText.slice(0, 100),
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "unknown";
      await supabase
        .from("claude_actions")
        .update({
          result: "failed",
          details: {
            ...cmd.details,
            error: errMsg,
            processed_at: new Date().toISOString(),
          },
        })
        .eq("id", cmd.id);
      results.push({ id: cmd.id, status: "failed", error: errMsg });

      // 也推一個錯誤通知
      await linePush({
        title: "⚠️ Claude 處理指令失敗",
        body: `指令「${(cmd.details?.raw || cmd.summary).slice(0, 50)}」處理失敗：${errMsg}`,
        priority: "high",
        reason: "blocked",
        userEmail: cmd.target,
      });
    }
  }

  return Response.json({
    ok: true,
    processed: commands.length,
    results,
    date: todayTaipei(),
  });
}
