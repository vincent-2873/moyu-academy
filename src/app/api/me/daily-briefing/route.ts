import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 每日晨報 API — 給業務本人一份「今天要做什麼」的代辦清單
 *
 * GET /api/me/daily-briefing?email=<email>
 *
 * 內容包含：
 *   - 今日活動量目標（從 sales_alert_rules 動態取）
 *   - 缺口分析（目前已做 vs 應該做）
 *   - 3-5 條具體行動項（基於過去 3 天資料 + 品牌 + 等級 Claude 生成）
 *   - 今日重點 MVP 或警示同事（團隊資訊）
 *   - 目前所屬的違反人性警報 rule + shortfalls
 *
 * 資料來源透明：每條 action 都帶 reference (例如 "昨天你跟 Jasper 都沒約，本週剩 2 天")
 *
 * Caching：同一天同一人只計算一次，塞 claude_actions 表 (action_type='daily_briefing')
 */

function todayTaipei(): string {
  const now = new Date();
  const tp = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return tp.toISOString().slice(0, 10);
}

function yesterdayTaipei(): string {
  const now = new Date();
  const tp = new Date(now.getTime() + 8 * 60 * 60 * 1000 - 24 * 3600 * 1000);
  return tp.toISOString().slice(0, 10);
}

function weekStart(d: Date): Date {
  const r = new Date(d);
  const day = r.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  r.setUTCDate(r.getUTCDate() + delta);
  return r;
}

function monthStart(d: Date): Date {
  const r = new Date(d);
  r.setUTCDate(1);
  return r;
}

interface ActionItem {
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  detail: string;
  source: string;
  estimate?: string;
}

interface YesterdayMvp {
  name: string;
  deltaCalls: number;
  todayCalls: number;
}

interface MyImprovement {
  deltaCalls: number;
  deltaRevenue: number;
}

interface Briefing {
  ok: boolean;
  bound: boolean;
  email: string;
  generatedAt: string;
  profile?: {
    name: string;
    brand: string;
    team: string | null;
    org: string | null;
    level: string | null;
  };
  today: {
    calls: number;
    connected: number;
    raw_appointments: number;
    appointments_show: number;
    closures: number;
    net_revenue_daily: number;
  };
  rule: {
    name: string;
    severity: string;
    targets: { calls: number | null; call_minutes: number | null; raw_appointments: number | null };
  } | null;
  shortfalls: Array<{
    metric: string;
    actual: number;
    min: number;
    delta: number;
  }>;
  headlineSummary: string;
  actions: ActionItem[];
  teamContext?: {
    topPerformer: { name: string; revenue: number } | null;
    silent: Array<{ name: string; calls: number }>;
    yesterdayMvp: YesterdayMvp | null;
    myImprovement: MyImprovement | null;
  };
  message?: string;
  cached?: boolean;
}

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";
  if (!email) {
    return Response.json({ ok: false, error: "email required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const today = todayTaipei();
  const yest = yesterdayTaipei();
  const td = new Date(today + "T00:00:00Z");
  const wk = weekStart(td).toISOString().slice(0, 10);
  const mn = monthStart(td).toISOString().slice(0, 10);

  // 1. Check cache first
  const cacheKey = `daily_briefing|${email}|${today}`;
  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from("claude_actions")
      .select("details")
      .eq("action_type", "daily_briefing")
      .eq("target", cacheKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached?.details) {
      const details = cached.details as Briefing;
      return Response.json({ ...details, cached: true });
    }
  }

  // 2. Pull user's data
  const { data: userRows } = await supabase
    .from("sales_metrics_daily")
    .select("*")
    .eq("email", email)
    .gte("date", mn)
    .order("date", { ascending: false });

  const allRows = (userRows || []) as Record<string, unknown>[];

  if (allRows.length === 0) {
    return Response.json({
      ok: true,
      bound: false,
      email,
      generatedAt: new Date().toISOString(),
      today: {
        calls: 0,
        connected: 0,
        raw_appointments: 0,
        appointments_show: 0,
        closures: 0,
        net_revenue_daily: 0,
      },
      rule: null,
      shortfalls: [],
      headlineSummary: "這個信箱還沒有業務資料 — 可能是主管、新員工尚未綁定 Metabase，或 Metabase 沒同步到",
      actions: [],
      message: "無業務資料",
    } satisfies Briefing);
  }

  const latest = allRows[0];
  const profile = {
    name: (latest.name as string) || email,
    brand: (latest.brand as string) || "nschool",
    team: (latest.team as string) || null,
    org: (latest.org as string) || null,
    level: (latest.level as string) || null,
  };

  // 今日 metrics
  type TodayM = { calls: number; connected: number; call_minutes: number; raw_appointments: number; appointments_show: number; raw_demos: number; closures: number; net_revenue_daily: number };
  const todayRows = allRows.filter((r) => r.date === today);
  const todayM: TodayM = todayRows.reduce<TodayM>(
    (acc, r) => ({
      calls: acc.calls + (Number(r.calls) || 0),
      connected: acc.connected + (Number(r.connected) || 0),
      call_minutes: acc.call_minutes + (Number(r.call_minutes) || 0),
      raw_appointments: acc.raw_appointments + (Number(r.raw_appointments) || 0),
      appointments_show: acc.appointments_show + (Number(r.appointments_show) || 0),
      raw_demos: acc.raw_demos + (Number(r.raw_demos) || 0),
      closures: acc.closures + (Number(r.closures) || 0),
      net_revenue_daily: acc.net_revenue_daily + (Number(r.net_revenue_daily) || 0),
    }),
    { calls: 0, connected: 0, call_minutes: 0, raw_appointments: 0, appointments_show: 0, raw_demos: 0, closures: 0, net_revenue_daily: 0 }
  );

  // 昨日對比
  const yestRow = allRows.find((r) => r.date === yest);
  const yestM = yestRow
    ? {
        calls: Number(yestRow.calls) || 0,
        connected: Number(yestRow.connected) || 0,
        raw_appointments: Number(yestRow.raw_appointments) || 0,
        closures: Number(yestRow.closures) || 0,
        net_revenue_daily: Number(yestRow.net_revenue_daily) || 0,
      }
    : null;

  // 本週累計
  type WeekM = { calls: number; closures: number; net_revenue_daily: number };
  const weekM: WeekM = allRows
    .filter((r) => (r.date as string) >= wk)
    .reduce<WeekM>(
      (acc, r) => ({
        calls: acc.calls + (Number(r.calls) || 0),
        closures: acc.closures + (Number(r.closures) || 0),
        net_revenue_daily: acc.net_revenue_daily + (Number(r.net_revenue_daily) || 0),
      }),
      { calls: 0, closures: 0, net_revenue_daily: 0 }
    );

  // 3. Apply rule
  const { data: rulesData } = await supabase.from("sales_alert_rules").select("*").eq("enabled", true);
  type Rule = {
    id: string;
    brand: string;
    level: string;
    name: string;
    cond_attend_min: number | null;
    cond_attend_max: number | null;
    min_calls: number | null;
    min_call_minutes: number | null;
    min_appointments: number | null;
    severity: string;
  };
  const rules = (rulesData as Rule[] | null) || [];
  const matchedRule = rules
    .filter((r) => r.brand === profile.brand || r.brand === "all")
    .filter((r) => r.level === (profile.level || "default") || r.level === "default")
    .filter((r) => {
      const a = todayM.appointments_show;
      if (r.cond_attend_min != null && a < r.cond_attend_min) return false;
      if (r.cond_attend_max != null && a > r.cond_attend_max) return false;
      return true;
    })
    .sort((a, b) => {
      const aScore = (a.brand !== "all" ? 2 : 0) + (a.level !== "default" ? 1 : 0);
      const bScore = (b.brand !== "all" ? 2 : 0) + (b.level !== "default" ? 1 : 0);
      return bScore - aScore;
    })[0];

  const shortfalls: Array<{ metric: string; actual: number; min: number; delta: number }> = [];
  if (matchedRule) {
    if (matchedRule.min_calls != null && todayM.calls < matchedRule.min_calls) {
      shortfalls.push({
        metric: "calls",
        actual: todayM.calls,
        min: matchedRule.min_calls,
        delta: matchedRule.min_calls - todayM.calls,
      });
    }
    if (matchedRule.min_call_minutes != null && todayM.call_minutes < Number(matchedRule.min_call_minutes)) {
      shortfalls.push({
        metric: "call_minutes",
        actual: Math.round(todayM.call_minutes),
        min: Number(matchedRule.min_call_minutes),
        delta: Math.round(Number(matchedRule.min_call_minutes) - todayM.call_minutes),
      });
    }
    if (matchedRule.min_appointments != null && todayM.raw_appointments < matchedRule.min_appointments) {
      shortfalls.push({
        metric: "raw_appointments",
        actual: todayM.raw_appointments,
        min: matchedRule.min_appointments,
        delta: matchedRule.min_appointments - todayM.raw_appointments,
      });
    }
  }

  // 4. Team context (same brand today)
  const { data: teamRows } = await supabase
    .from("sales_metrics_daily")
    .select("name, team, calls, closures, net_revenue_daily")
    .eq("date", today)
    .eq("brand", profile.brand)
    .order("net_revenue_daily", { ascending: false });
  const teamData = (teamRows || []) as Array<{ name: string; team: string; calls: number; closures: number; net_revenue_daily: number }>;
  const topPerformer = teamData[0] ? { name: teamData[0].name, revenue: Number(teamData[0].net_revenue_daily) || 0 } : null;
  const silent = teamData
    .filter((r) => r.calls === 0)
    .slice(0, 3)
    .map((r) => ({ name: r.name, calls: r.calls }));

  // 4a. 昨日進步 MVP — 比較同組每個人「昨日 calls - 前日 calls」找進步最大的
  //     這是正回饋，不是折磨 — 告訴業務「昨天你 +30 通是同組最努力的」
  const dayBeforeYesterday = (() => {
    const d = new Date(yest);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  let yesterdayMvp: { name: string; deltaCalls: number; todayCalls: number } | null = null;
  let myImprovement: { deltaCalls: number; deltaRevenue: number } | null = null;
  const { data: histRows } = await supabase
    .from("sales_metrics_daily")
    .select("date, email, name, calls, net_revenue_daily")
    .eq("brand", profile.brand)
    .in("date", [yest, dayBeforeYesterday]);
  if (histRows && histRows.length > 0) {
    const byEmail: Record<string, { name: string; y: number; dby: number; yRev: number; dbyRev: number }> = {};
    for (const r of histRows) {
      const k = (r.email as string) || (r.name as string);
      if (!k) continue;
      const e = byEmail[k] || { name: (r.name as string) || k, y: 0, dby: 0, yRev: 0, dbyRev: 0 };
      if (r.date === yest) {
        e.y = Number(r.calls) || 0;
        e.yRev = Number(r.net_revenue_daily) || 0;
      }
      if (r.date === dayBeforeYesterday) {
        e.dby = Number(r.calls) || 0;
        e.dbyRev = Number(r.net_revenue_daily) || 0;
      }
      byEmail[k] = e;
    }
    // MVP 昨日進步最大的
    const deltas = Object.values(byEmail).map((v) => ({
      name: v.name,
      deltaCalls: v.y - v.dby,
      todayCalls: v.y,
    }));
    deltas.sort((a, b) => b.deltaCalls - a.deltaCalls);
    const top = deltas[0];
    if (top && top.deltaCalls > 0) {
      yesterdayMvp = { name: top.name, deltaCalls: top.deltaCalls, todayCalls: top.todayCalls };
    }
    // 自己的改善
    const mine = byEmail[email];
    if (mine) {
      myImprovement = {
        deltaCalls: mine.y - mine.dby,
        deltaRevenue: mine.yRev - mine.dbyRev,
      };
    }
  }

  // 5. Claude generates the actions
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let actions: ActionItem[] = [];
  let headlineSummary = "";

  if (apiKey) {
    const client = new Anthropic({ apiKey });
    const tw = new Date(Date.now() + 8 * 3600000);
    const hourTw = tw.getUTCHours();
    const hoursLeft = Math.max(0, 22 - hourTw);

    const systemPrompt = `你是墨宇戰情中樞的「戰情官」，每天早上給業務本人一份具體的「今天要做什麼」清單。

鐵則：
1. 絕對不說「加油」「努力」「相信自己」這類空話
2. 每個 action 必須帶：數字 + 具體對象/時段 + 預估耗時
3. source 欄位必填 — 說明這個 action 是根據哪個數據推出來的（例：「昨天你通次 60 比同組均值 120 少 50%」）
4. 3-5 個 action item，最重要的排第一
5. 如果某些 action 不是「今天必須做」而是「這週該做」，priority 標 medium 即可
6. 嚴格輸出 JSON，不要任何前後文字

輸出格式：
{
  "headlineSummary": "一句話總結今天最該幹的事 (帶數字)",
  "actions": [
    {
      "priority": "critical|high|medium|low",
      "title": "行動項一句話",
      "detail": "具體做什麼 (帶數字、時段、對象)",
      "source": "這個建議的資料依據",
      "estimate": "預估耗時 (例 30 分鐘)"
    }
  ]
}`;

    const userPrompt = `【業務本人】
姓名：${profile.name}
品牌：${profile.brand}
據點：${profile.org || "-"}
組別：${profile.team || "-"}
等級：${profile.level || "未分級"}

【今日到目前為止】(台北時間 ${hourTw}:00，剩 ${hoursLeft} 小時)
通次 ${todayM.calls} · 接通 ${todayM.connected} · 通時 ${Math.round(todayM.call_minutes)} 分
原始邀約 ${todayM.raw_appointments} · 出席 ${todayM.appointments_show}
DEMO ${todayM.raw_demos} · 成交 ${todayM.closures} · 淨業績 $${todayM.net_revenue_daily}

【昨天】
${
  yestM
    ? `通次 ${yestM.calls} · 接通 ${yestM.connected} · 邀約 ${yestM.raw_appointments} · 成交 ${yestM.closures} · 淨業績 $${yestM.net_revenue_daily}`
    : "無資料"
}

【本週累計】
通次 ${weekM.calls} · 成交 ${weekM.closures} · 淨業績 $${weekM.net_revenue_daily}

【套用的活動量規則】
${
  matchedRule
    ? `${matchedRule.name} (${matchedRule.severity})
  • 最低通次 ${matchedRule.min_calls ?? "-"}
  • 最低通時 ${matchedRule.min_call_minutes ?? "-"}
  • 最低邀約 ${matchedRule.min_appointments ?? "-"}
${shortfalls.length > 0 ? "未達標：" + shortfalls.map((s) => `${s.metric} 差 ${s.delta}`).join("、") : "✅ 已達標"}`
    : "無匹配規則"
}

【同組今日對比】
${topPerformer ? `本日 MVP：${topPerformer.name} $${topPerformer.revenue}` : ""}
${silent.length > 0 ? `掛蛋同事 (通次 0)：${silent.map((s) => s.name).join("、")}` : ""}

【昨日同組「進步 MVP」】(正回饋範例，如果你有用到可以提一下)
${yesterdayMvp ? `昨天進步最大的是 ${yesterdayMvp.name}，多打了 ${yesterdayMvp.deltaCalls} 通 (到 ${yesterdayMvp.todayCalls})` : "無前 2 天資料無法比"}
${myImprovement ? `你昨天自己 calls 變化 ${myImprovement.deltaCalls > 0 ? "+" : ""}${myImprovement.deltaCalls}，業績變化 ${myImprovement.deltaRevenue > 0 ? "+" : ""}${myImprovement.deltaRevenue}` : ""}

請依上面資料輸出 JSON。`;

    try {
      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          headlineSummary: string;
          actions: ActionItem[];
        };
        headlineSummary = parsed.headlineSummary;
        actions = parsed.actions || [];
      }
    } catch (err) {
      console.error("daily briefing claude error", err);
    }
  }

  // Fallback if Claude failed
  if (!headlineSummary) {
    if (shortfalls.length > 0) {
      const biggest = shortfalls.sort((a, b) => b.delta - a.delta)[0];
      headlineSummary = `${profile.name} 今天 ${biggest.metric === "calls" ? "通次" : biggest.metric === "call_minutes" ? "通時" : "邀約"} 還差 ${biggest.delta}`;
    } else {
      headlineSummary = `${profile.name} 今天活動量已達標，保持節奏`;
    }
  }
  if (actions.length === 0) {
    actions = shortfalls.map((s) => ({
      priority: "high" as const,
      title: `補足 ${s.metric === "calls" ? "通次" : s.metric === "call_minutes" ? "通時" : "邀約"}`,
      detail: `目前 ${s.actual} / 目標 ${s.min}，還差 ${s.delta}`,
      source: `規則「${matchedRule?.name || "default"}」`,
    }));
    if (actions.length === 0) {
      actions = [{
        priority: "medium",
        title: "維持目前節奏",
        detail: "今天活動量已達標，持續打即可",
        source: "所有規則項目都已達標",
      }];
    }
  }

  const briefing: Briefing = {
    ok: true,
    bound: true,
    email,
    generatedAt: new Date().toISOString(),
    profile,
    today: {
      calls: todayM.calls,
      connected: todayM.connected,
      raw_appointments: todayM.raw_appointments,
      appointments_show: todayM.appointments_show,
      closures: todayM.closures,
      net_revenue_daily: todayM.net_revenue_daily,
    },
    rule: matchedRule
      ? {
          name: matchedRule.name,
          severity: matchedRule.severity,
          targets: {
            calls: matchedRule.min_calls,
            call_minutes: matchedRule.min_call_minutes != null ? Number(matchedRule.min_call_minutes) : null,
            raw_appointments: matchedRule.min_appointments,
          },
        }
      : null,
    shortfalls,
    headlineSummary,
    actions,
    teamContext: { topPerformer, silent, yesterdayMvp, myImprovement },
    cached: false,
  };

  // Cache to claude_actions
  await supabase.from("claude_actions").insert({
    action_type: "daily_briefing",
    target: cacheKey,
    summary: headlineSummary,
    details: briefing,
    result: "success",
  });

  return Response.json(briefing);
}
