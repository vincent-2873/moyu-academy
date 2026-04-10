/**
 * Claude 教練：針對警報觸發產生具體行動建議
 *
 * 哲學（違反人性監測）：
 *   - 不說「加油」「努力」「不要放棄」
 *   - 帶具體數字 + 剩餘時間 + 下一步動作
 *   - 製造 loss aversion：跟同儕 / 昨天的自己比
 *
 * 快取：同一天同一人同一 rule 只呼叫一次 Claude，結果塞 claude_actions 表。
 */

import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "./supabase";

export interface CoachContext {
  name: string;
  brand: string;
  team?: string | null;
  level?: string | null;
  rule: string;
  today: {
    calls: number;
    connected: number;
    call_minutes: number;
    raw_appointments: number;
    appointments_show: number;
    raw_demos: number;
    closures: number;
    net_revenue_daily: number;
  };
  yesterday?: Partial<CoachContext["today"]>;
  weekAvg?: Partial<CoachContext["today"]>;
  teamAvg?: Partial<CoachContext["today"]>;
  targetCalls?: number;
  hoursLeftToday?: number;
}

export interface CoachAdvice {
  diagnosis: string;
  action: string;
  cached: boolean;
}

const SYSTEM_PROMPT = `你是墨宇戰情中樞的電話行銷教練。風格：冷靜、直接、量化。

鐵則：
1. 絕對不說「加油」「努力」「不要放棄」「相信自己」這類空話
2. 不準出現感嘆詞、驚嘆號超過 1 個、鼓勵語氣
3. 每個回答必須包含：數字、時間限定、具體目標對象
4. 診斷要戳破自我安慰，action 要指名今天剩下的時間內做什麼

格式（嚴格 JSON，只回 JSON 不要任何前後文字）：
{
  "diagnosis": "一句話：這個人今天為什麼會卡住 / 掉球（帶數字）",
  "action": "一句話：下午 X 點前具體做什麼動作（不是抽象方向）"
}

範例：
{
  "diagnosis": "通次 25，比同組均值 112 少 77 通，開發動作只做了 22%",
  "action": "16:00 前回撥昨天 4 個沒接的 F 名單，拿 1 個 confirmed 邀約再下班"
}`;

function ruleHint(rule: string): string {
  const map: Record<string, string> = {
    daily_silent_0: "今天 0 通電話",
    daily_silent_2days: "連續 2 天 0 通電話",
    daily_low_calls: "今天通次遠低於目標",
    daily_no_appointment: "打了很多電話但 0 邀約",
    daily_no_show_3d: "連續 3 天邀約全跑票",
    weekly_behind: "本週進度落後",
    weekly_zero_revenue: "本週業績掛零",
    monthly_behind_mid: "月中業績 < 50%",
    monthly_behind_late: "月末倒數 5 天差太多",
    monthly_final_push: "最後 1 天還沒達標",
    too_comfortable_3days: "連續 3 天舒適度爆表",
  };
  return map[rule] || rule;
}

async function getCachedAdvice(ctx: CoachContext): Promise<CoachAdvice | null> {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("claude_actions")
    .select("details")
    .eq("action_type", "coach_advice")
    .eq("target", `${ctx.name}|${ctx.rule}|${today}`)
    .maybeSingle();
  if (!data) return null;
  const details = data.details as { diagnosis?: string; action?: string } | null;
  if (!details?.diagnosis || !details?.action) return null;
  return { diagnosis: details.diagnosis, action: details.action, cached: true };
}

async function saveAdvice(ctx: CoachContext, advice: CoachAdvice): Promise<void> {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  await supabase.from("claude_actions").insert({
    action_type: "coach_advice",
    target: `${ctx.name}|${ctx.rule}|${today}`,
    summary: `${ctx.name} · ${ruleHint(ctx.rule)}`,
    details: { diagnosis: advice.diagnosis, action: advice.action },
    result: "success",
  });
}

export async function generateCoachAdvice(ctx: CoachContext): Promise<CoachAdvice> {
  // Check cache
  const cached = await getCachedAdvice(ctx);
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback: 純 template，不依賴 Claude
    return {
      diagnosis: `${ctx.name} 觸發 ${ruleHint(ctx.rule)}（通次 ${ctx.today.calls}）`,
      action: "立刻補進度到目標，不補會繼續升級警報",
      cached: false,
    };
  }

  const client = new Anthropic({ apiKey });
  const userPrompt = [
    `業務：${ctx.name}`,
    `品牌：${ctx.brand}`,
    ctx.team ? `組別：${ctx.team}` : "",
    ctx.level ? `等級：${ctx.level}` : "",
    `觸發規則：${ruleHint(ctx.rule)}`,
    "",
    "【今日數字】",
    `通次 ${ctx.today.calls} / 接通 ${ctx.today.connected} / 通時 ${ctx.today.call_minutes.toFixed(0)} 分`,
    `原始邀約 ${ctx.today.raw_appointments} / 邀約出席 ${ctx.today.appointments_show}`,
    `DEMO ${ctx.today.raw_demos} / 成交 ${ctx.today.closures}`,
    `淨業績 ${ctx.today.net_revenue_daily}`,
    ctx.hoursLeftToday != null ? `今日剩 ${ctx.hoursLeftToday} 小時` : "",
    "",
    ctx.yesterday
      ? `【昨日對比】通次 ${ctx.yesterday.calls ?? "-"} / 成交 ${ctx.yesterday.closures ?? "-"}`
      : "",
    ctx.teamAvg
      ? `【同組均值】通次 ${ctx.teamAvg.calls ?? "-"} / 成交 ${ctx.teamAvg.closures ?? "-"}`
      : "",
    ctx.targetCalls ? `【目標】日通次 ${ctx.targetCalls}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    // Extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no json in response");
    const parsed = JSON.parse(jsonMatch[0]) as { diagnosis: string; action: string };
    const advice: CoachAdvice = {
      diagnosis: parsed.diagnosis,
      action: parsed.action,
      cached: false,
    };
    await saveAdvice(ctx, advice);
    return advice;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return {
      diagnosis: `${ctx.name} ${ruleHint(ctx.rule)} (coach error: ${msg.slice(0, 50)})`,
      action: "系統自動回退，請主管手動介入",
      cached: false,
    };
  }
}
