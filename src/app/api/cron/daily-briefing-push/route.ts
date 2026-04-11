import { getSupabaseAdmin } from "@/lib/supabase";
import { linePush, buildCommandsFlex } from "@/lib/line-notify";
import { NextRequest } from "next/server";

/*
 * 每日個人晨報 LINE 推播 (每位業務各收到屬於自己的)
 *
 * 排程建議：台灣時間 09:00 = UTC 01:00 → "0 1 * * *"
 *
 * 流程：
 *   1. 找所有 status=active 且 email 有出現在今日 sales_metrics_daily 的用戶
 *   2. 交叉比對 users 表，只對 line_user_id 不為空的 push (有綁定 LINE 的才推)
 *   3. 對每位呼叫 /api/me/daily-briefing?email=... 取得 headlineSummary + actions
 *   4. 組成精簡的 LINE 訊息推送
 *
 * 為什麼呼叫自己的 API 而不是直接 import briefing 邏輯：
 *   - 避免循環依賴
 *   - 重用 cache 邏輯 (同一人同一天只計算一次)
 *   - 失敗 fallback 可由 API 自己處理
 */

function todayTaipei(): string {
  const now = new Date();
  const tp = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return tp.toISOString().slice(0, 10);
}

interface BriefingData {
  ok: boolean;
  bound: boolean;
  profile?: { name: string; brand: string; team: string | null };
  headlineSummary?: string;
  today?: { calls: number; raw_appointments: number; appointments_show: number; closures: number; net_revenue_daily: number };
  rule?: { name: string; severity: string } | null;
  shortfalls?: Array<{ metric: string; actual: number; min: number; delta: number }>;
  actions?: Array<{ priority: string; title: string; detail: string }>;
  teamContext?: { topPerformer: { name: string; revenue: number } | null };
}

function formatBriefingMessage(b: BriefingData): string | null {
  if (!b.ok || !b.bound || !b.profile) return null;
  const lines: string[] = [];
  lines.push(`☀️ ${b.profile.name} 今日晨報`);
  if (b.profile.team) lines.push(`🎯 ${b.profile.team}`);
  lines.push("");
  if (b.headlineSummary) {
    lines.push(b.headlineSummary);
    lines.push("");
  }
  if (b.rule) {
    const sevIcon =
      b.rule.severity === "critical" ? "🔴" : b.rule.severity === "high" ? "🟠" : "🟡";
    lines.push(`${sevIcon} ${b.rule.name}`);
    if (b.shortfalls && b.shortfalls.length > 0) {
      for (const s of b.shortfalls) {
        const label = s.metric === "calls" ? "通次" : s.metric === "call_minutes" ? "通時" : "邀約";
        lines.push(`  · ${label} ${s.actual}/${s.min} (差 ${s.delta})`);
      }
    }
    lines.push("");
  }
  if (b.actions && b.actions.length > 0) {
    lines.push("【今日行動】");
    const priorityIcon: Record<string, string> = {
      critical: "🔴",
      high: "🟠",
      medium: "🟡",
      low: "🔵",
    };
    b.actions.slice(0, 5).forEach((a, i) => {
      lines.push(`${i + 1}. ${priorityIcon[a.priority] || "•"} ${a.title}`);
      if (a.detail) lines.push(`   ${a.detail}`);
    });
    lines.push("");
  }
  if (b.teamContext?.topPerformer && b.teamContext.topPerformer.revenue > 0) {
    lines.push(
      `🏆 今日 MVP：${b.teamContext.topPerformer.name} $${b.teamContext.topPerformer.revenue.toLocaleString()}`
    );
  }
  lines.push("");
  lines.push("→ 詳情進 https://moyusales.zeabur.app/me");
  return lines.join("\n");
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
  const today = todayTaipei();
  const started = Date.now();

  // 1. 撈今日 sales_metrics_daily 有資料的 email
  const { data: salesRows } = await supabase
    .from("sales_metrics_daily")
    .select("email")
    .eq("date", today);
  const salesEmails = new Set<string>();
  for (const r of salesRows || []) {
    if (r.email) salesEmails.add(r.email as string);
  }

  // 2. 撈所有綁定 LINE 的 active users
  const { data: usersData } = await supabase
    .from("users")
    .select("email, name, line_user_id")
    .eq("status", "active")
    .not("line_user_id", "is", null);

  const boundUsers = (usersData || []) as Array<{ email: string; name: string; line_user_id: string }>;

  // 3. 對每個綁定 LINE 且有今日 sales 資料的 user 推晨報
  const host = process.env.PUBLIC_APP_URL || "https://moyusales.zeabur.app";
  const results: Array<{ email: string; status: "pushed" | "no_data" | "error"; error?: string }> = [];

  for (const u of boundUsers) {
    // 跳過 TEMP 占位 line_user_id
    if (u.line_user_id.startsWith("TEMP_")) continue;
    if (!salesEmails.has(u.email)) {
      results.push({ email: u.email, status: "no_data" });
      continue;
    }

    try {
      // 呼叫自己的 daily-briefing API
      const bRes = await fetch(`${host}/api/me/daily-briefing?email=${encodeURIComponent(u.email)}&refresh=1`);
      const briefing = (await bRes.json()) as BriefingData;
      const msg = formatBriefingMessage(briefing);
      if (!msg) {
        results.push({ email: u.email, status: "no_data" });
        continue;
      }

      // 🆕 把 briefing.actions 寫進 v3_commands → 業務 /me 頁面看得到 + 主管 /admin 看得到
      //    這是「自動派任務」的核心邏輯 — Claude 不只建議，是直接指派
      let insertedCmds: Array<{ id: string; title: string; detail: string | null; severity: "info" | "normal" | "high" | "critical" }> = [];
      if (briefing.actions && briefing.actions.length > 0) {
        const priorityMap: Record<string, "critical" | "high" | "normal" | "info"> = {
          critical: "critical",
          high: "high",
          medium: "normal",
          low: "info",
        };
        // 清掉今天已經 insert 過的 (避免重跑 cron 重複)
        const todayIso = new Date().toISOString().slice(0, 10);
        await supabase
          .from("v3_commands")
          .delete()
          .eq("owner_email", u.email)
          .eq("ai_generated", true)
          .gte("created_at", todayIso + "T00:00:00Z")
          .lt("created_at", todayIso + "T23:59:59Z")
          .eq("pillar_id", "sales");
        // Bulk insert
        const rows = briefing.actions.slice(0, 8).map((a) => ({
          owner_email: u.email,
          pillar_id: "sales",
          title: a.title,
          detail: a.detail,
          severity: priorityMap[a.priority] || "normal",
          status: "pending",
          ai_generated: true,
          ai_reasoning: "daily_briefing auto-assigned",
          deadline: new Date(Date.now() + 12 * 3600 * 1000).toISOString(), // 12 hr from now
        }));
        const { data: inserted, error: cmdErr } = await supabase
          .from("v3_commands")
          .insert(rows)
          .select("id, title, detail, severity");
        if (cmdErr) {
          console.error("[daily-briefing-push] v3_commands insert failed:", cmdErr.message);
        } else if (inserted) {
          insertedCmds = inserted as typeof insertedCmds;
        }
      }

      // 📱 Push via LINE — 用 Flex Message carousel 讓業務可以在手機直接點完成/卡住/跳過
      // 第 1 則: 文字晨報 (headline + team context)
      // 第 2 則: Flex carousel (每個 action 一個 bubble + 3 個 postback 按鈕)
      let pushRes;
      if (insertedCmds.length > 0) {
        const flex = buildCommandsFlex(
          insertedCmds,
          `☀️ ${briefing.profile?.name || u.name} 今日 ${insertedCmds.length} 項任務`
        );
        pushRes = await linePush({
          title: `☀️ ${briefing.profile?.name || u.name} 今日晨報`,
          body: `☀️ ${briefing.profile?.name || u.name} 今日 ${insertedCmds.length} 項任務 — 點按鈕直接標記狀態`,
          flexMessage: flex,
          priority: briefing.rule?.severity === "critical" ? "critical" : "high",
          lineUserId: u.line_user_id,
          userEmail: u.email,
          reason: "daily_briefing",
        });
      } else {
        // fallback to text
        pushRes = await linePush({
          title: `☀️ ${briefing.profile?.name || u.name} 今日晨報`,
          body: msg,
          priority: briefing.rule?.severity === "critical" ? "critical" : "high",
          lineUserId: u.line_user_id,
          userEmail: u.email,
          reason: "daily_briefing",
        });
      }
      if (pushRes.ok) {
        results.push({ email: u.email, status: "pushed" });
      } else {
        results.push({ email: u.email, status: "error", error: pushRes.error });
      }
    } catch (err) {
      results.push({
        email: u.email,
        status: "error",
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  // 4. 寫 claude_actions log
  const pushed = results.filter((r) => r.status === "pushed").length;
  const errored = results.filter((r) => r.status === "error").length;
  await supabase.from("claude_actions").insert({
    action_type: "daily_briefing_push",
    target: today,
    summary: `推送 ${pushed} 位業務晨報 (${errored} 失敗)`,
    details: { results, duration_ms: Date.now() - started },
    result: errored > 0 ? "partial" : "success",
  });

  return Response.json({
    ok: true,
    date: today,
    bound_users: boundUsers.length,
    sales_emails_today: salesEmails.size,
    pushed,
    errored,
    results,
    duration_ms: Date.now() - started,
  });
}
