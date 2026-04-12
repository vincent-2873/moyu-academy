import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";
import { linePush, buildCommandsFlex } from "@/lib/line-notify";
import { NextRequest } from "next/server";

/**
 * 招聘員每日晨報 — 每天 09:15 TW = UTC 01:15
 *
 * 跟業務晨報不同:
 *   - 業務看的是通次/邀約/成交
 *   - 招聘員看的是發信/邀約/面試/到職
 *
 * 邏輯:
 *   1. 拉 recruit_daily_report 最近 7 天 (from claude_actions)
 *   2. 拉 recruits 表看 pipeline 狀態
 *   3. Claude 生成今日 3-5 個行動項
 *   4. 寫進 v3_commands + Flex LINE push
 */

export const maxDuration = 60;

function todayTaipei(): string {
  const now = new Date();
  const tp = new Date(now.getTime() + 8 * 3600 * 1000);
  return tp.toISOString().slice(0, 10);
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
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Find recruiters (users with role containing 'recruit' or specific emails)
  // For now, look at users who have filed recruit_daily_report
  const { data: reportActions } = await supabase
    .from("claude_actions")
    .select("target")
    .eq("action_type", "recruit_daily_report")
    .order("created_at", { ascending: false })
    .limit(100);

  const recruiterEmails = new Set<string>();
  for (const a of reportActions || []) {
    if (a.target) recruiterEmails.add(a.target as string);
  }

  if (recruiterEmails.size === 0) {
    return Response.json({ ok: true, message: "no recruiters found (no daily reports yet)", pushed: 0 });
  }

  const pushed: Array<{ email: string; mode: string }> = [];

  for (const email of recruiterEmails) {
    // Get last 7 days of reports
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: reports } = await supabase
      .from("claude_actions")
      .select("summary, details, created_at")
      .eq("action_type", "recruit_daily_report")
      .eq("target", email)
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    // Get pipeline
    const { data: pipeline } = await supabase
      .from("recruits")
      .select("name, stage, brand, created_at")
      .eq("owner_email", email)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!apiKey) continue;

    const context = [
      `招聘員: ${email}`,
      `今天: ${today}`,
      "",
      "最近 7 天活動:",
      ...(reports || []).map((r) => `  ${r.summary}`),
      "",
      `Pipeline (${(pipeline || []).length} 個候選人):`,
      ...(pipeline || []).map((p) => `  ${p.name} · ${p.stage} · ${p.brand}`),
    ].join("\n");

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: `你是墨宇戰情中樞的招聘教練。給招聘員今天的 3-5 個行動項。
規則:
1. 每個行動項帶數字 + 具體對象 + 預計耗時
2. 不說「繼續加油」這類廢話
3. 根據他最近 7 天的數據趨勢 + pipeline 狀態
4. 嚴格 JSON: { "actions": [{ "priority": "critical|high|normal", "title": "...", "detail": "...", "estimate": "X分鐘" }], "headline": "一句話總結今天重點" }`,
      messages: [{ role: "user", content: context }],
    });

    let text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    text = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
    let parsed: { headline?: string; actions?: Array<{ priority: string; title: string; detail: string; estimate?: string }> } = {};
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      /* ignore */
    }

    const actions = parsed.actions || [];
    if (actions.length === 0) continue;

    // Insert v3_commands
    const priorityMap: Record<string, string> = { critical: "critical", high: "high", normal: "normal" };
    const cmdRows = actions.slice(0, 5).map((a) => ({
      owner_email: email,
      pillar_id: "recruit",
      title: a.title,
      detail: a.detail + (a.estimate ? `\n⏱ ${a.estimate}` : ""),
      severity: priorityMap[a.priority] || "normal",
      status: "pending",
      ai_generated: true,
      ai_reasoning: "recruiter_daily_briefing",
      deadline: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    }));
    const { data: inserted } = await supabase
      .from("v3_commands")
      .insert(cmdRows)
      .select("id, title, detail, severity");

    if (inserted && inserted.length > 0) {
      const flex = buildCommandsFlex(
        inserted as Array<{ id: string; title: string; detail: string | null; severity: "info" | "normal" | "high" | "critical" }>,
        `📋 ${email} · 招聘今日 ${inserted.length} 項任務`
      );
      const res = await linePush({
        title: `📋 招聘員晨報`,
        body: `${parsed.headline || "今日招聘任務"}\n\n${inserted.length} 項任務，點按鈕標記狀態`,
        flexMessage: flex,
        userEmail: email,
        priority: "high",
        reason: "recruiter_briefing",
      });
      pushed.push({ email, mode: res.mode });
    }
  }

  return Response.json({ ok: true, date: today, pushed });
}
