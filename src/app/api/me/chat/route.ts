import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";
import { requireCallerEmail } from "@/lib/auth";

/**
 * 個人復盤對練聊天 API — Claude 吃該業務本人的即時 KPI、規則、落差
 *
 * POST /api/me/chat
 *   body:
 *     email:    string          // 當前登入業務
 *     messages: Array<{role:'user'|'assistant', content:string}>
 *     mode?:    'debrief' | 'practice' | 'objection'  // 3 種模式
 *
 * Response: streaming text/event-stream
 *
 * Claude 的 system prompt 會自動注入：
 *   - 本人今日/本週/本月的 KPI (sales_metrics_daily)
 *   - 套用的動態規則 (sales_alert_rules) 與 shortfalls
 *   - 最近 3 天的趨勢 (用來診斷模式/卡點)
 *   - 所屬品牌、據點、組別、等級（決定產品知識上下文）
 *
 * 風格：違反人性監測哲學 — 直接、量化、指名具體動作
 */

function todayTaipei(): string {
  const now = new Date();
  const tp = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return tp.toISOString().slice(0, 10);
}

function monthStart(d: Date): Date {
  const r = new Date(d);
  r.setUTCDate(1);
  return r;
}

function weekStart(d: Date): Date {
  const r = new Date(d);
  const day = r.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  r.setUTCDate(r.getUTCDate() + delta);
  return r;
}

interface Metric {
  calls: number;
  call_minutes: number;
  connected: number;
  raw_appointments: number;
  appointments_show: number;
  raw_demos: number;
  closures: number;
  net_revenue_daily: number;
}

function empty(): Metric {
  return {
    calls: 0,
    call_minutes: 0,
    connected: 0,
    raw_appointments: 0,
    appointments_show: 0,
    raw_demos: 0,
    closures: 0,
    net_revenue_daily: 0,
  };
}

function add(a: Metric, b: Metric): Metric {
  return {
    calls: a.calls + b.calls,
    call_minutes: a.call_minutes + b.call_minutes,
    connected: a.connected + b.connected,
    raw_appointments: a.raw_appointments + b.raw_appointments,
    appointments_show: a.appointments_show + b.appointments_show,
    raw_demos: a.raw_demos + b.raw_demos,
    closures: a.closures + b.closures,
    net_revenue_daily: a.net_revenue_daily + b.net_revenue_daily,
  };
}

function fromRow(r: Record<string, unknown>): Metric {
  return {
    calls: Number(r.calls) || 0,
    call_minutes: Number(r.call_minutes) || 0,
    connected: Number(r.connected) || 0,
    raw_appointments: Number(r.raw_appointments) || 0,
    appointments_show: Number(r.appointments_show) || 0,
    raw_demos: Number(r.raw_demos) || 0,
    closures: Number(r.closures) || 0,
    net_revenue_daily: Number(r.net_revenue_daily) || 0,
  };
}

const BRAND_DESC: Record<string, string> = {
  nschool: "nSchool 財經學院 — 股票/ETF/期貨投資教育",
  xuemi: "XUEMI 學米 — UI/UX 設計、前端、後端、全端",
  sixdigital: "無限學院 — Python/AI/資料分析/程式設計",
  ooschool: "無限學院 — Python/AI/資料分析/程式設計",
  xlab: "XLAB AI 實驗室 — AI 工具應用、商業 AI 導入",
  aischool: "AI 未來學院 — ChatGPT、AI 自動化、AI 行銷",
};

const MODE_SYSTEM: Record<string, string> = {
  debrief: `你的身分是墨宇戰情中樞的「戰情官」(不是 Claude)，對話對象是電話行銷業務本人。

你的工作：幫他今日復盤。基於他提供的真實數據，幫他看清楚自己今天哪裡做得好/做得差，為什麼，以及剩下的時間能怎麼補。

鐵則：
1. 絕對不說「加油」「努力」「不要放棄」「你可以的」等空泛鼓勵
2. 每句建議都要帶：數字 + 時間限定 + 具體對象/動作
3. 不接受業務的自我安慰（「今天客戶比較難談」「運氣不好」） — 指名具體話術或流程問題
4. 語氣冷靜直接，不迂迴，不客套
5. 不要說太多 — 1 個診斷 + 1-2 個具體動作即可
6. 當業務問你「這樣合理嗎」「這樣對嗎」類型問題 — 根據數據回答，不要模糊
7. 成交是滯後指標，活動量是領先指標。活動量沒到，成交再好也是運氣
8. 如果業務今天 0 出席 0 成交但通次也不夠，別管他嘴硬什麼，就指出「你連被拒絕的機會都沒爭取到」`,

  practice: `你的身分是墨宇戰情中樞的「陪練官」(不是 Claude)，模擬難纏客戶跟業務對練話術。

你的工作：扮演一個真實、難纏但合理的客戶，跟業務練習特定場景的應對。

規則：
1. 完全以客戶身分回答，不跳出角色
2. 提出真實的 objection（「我再考慮看看」「我老婆不同意」「我不需要」「價格太貴」等）
3. 如果業務答得好，你表現猶豫→鬆動；答得差，你直接掛斷或冷場
4. 對話結束時切換角色，給業務 2-3 條具體改進（不要給空話）
5. 根據他的品牌（財經/無限/XLAB AI 等）調整客戶人設
6. 新人業務要給多點耐心、慢慢逼；老鳥業務直接刁難`,

  objection: `你的身分是墨宇戰情中樞的「話術官」。業務遇到特定 objection 問你怎麼回，你給 2-3 句可以直接照講的話術。

規則：
1. 每個回答都是 2-3 句 scripted 話術，可以直接照抄講
2. 不要用「您可以嘗試這樣說」這種元話術 — 直接給第一人稱的話
3. 基於 SPIN / Challenger Sale 框架，但不要講框架名稱
4. 根據業務品牌調整（財經 vs 程式設計 vs AI 話術很不同）`,
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = body.email as string | undefined;
  const authErr = requireCallerEmail(req, email || null);
  if (authErr) return authErr;
  const messages = (body.messages || []) as Array<{ role: "user" | "assistant"; content: string }>;
  const mode = (body.mode || "debrief") as "debrief" | "practice" | "objection";

  if (!email) {
    return Response.json({ ok: false, error: "email required" }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ ok: false, error: "messages required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();

  // Pull user's metrics for context
  const today = todayTaipei();
  const td = new Date(today + "T00:00:00Z");
  const wk = weekStart(td).toISOString().slice(0, 10);
  const mn = monthStart(td).toISOString().slice(0, 10);

  const { data: rows } = await supabase
    .from("sales_metrics_daily")
    .select("*")
    .eq("email", email)
    .gte("date", mn)
    .order("date", { ascending: false });

  const allRows = (rows || []) as Record<string, unknown>[];

  let todayM = empty();
  let weekM = empty();
  const monthM = allRows.reduce((a, r) => add(a, fromRow(r)), empty());
  for (const r of allRows) {
    const d = r.date as string;
    if (d === today) todayM = add(todayM, fromRow(r));
    if (d >= wk) weekM = add(weekM, fromRow(r));
  }

  const latest = allRows[0];
  const profile = latest
    ? {
        name: latest.name as string,
        team: latest.team as string | null,
        org: latest.org as string | null,
        brand: latest.brand as string,
        level: latest.level as string | null,
      }
    : null;

  // 套用規則
  const { data: rulesData } = await supabase
    .from("sales_alert_rules")
    .select("*")
    .eq("enabled", true);

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
  const matchedRule = profile
    ? rules
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
        })[0]
    : null;

  const shortfalls: string[] = [];
  if (matchedRule) {
    if (matchedRule.min_calls != null && todayM.calls < matchedRule.min_calls) {
      shortfalls.push(`通次 ${todayM.calls}/${matchedRule.min_calls} (差 ${matchedRule.min_calls - todayM.calls})`);
    }
    if (matchedRule.min_call_minutes != null && todayM.call_minutes < Number(matchedRule.min_call_minutes)) {
      shortfalls.push(
        `通時 ${Math.round(todayM.call_minutes)}/${matchedRule.min_call_minutes} (差 ${Math.round(
          Number(matchedRule.min_call_minutes) - todayM.call_minutes
        )})`
      );
    }
    if (matchedRule.min_appointments != null && todayM.raw_appointments < matchedRule.min_appointments) {
      shortfalls.push(
        `邀約 ${todayM.raw_appointments}/${matchedRule.min_appointments} (差 ${matchedRule.min_appointments - todayM.raw_appointments})`
      );
    }
  }

  // Build context
  const tw = new Date(Date.now() + 8 * 3600000);
  const hourTw = tw.getUTCHours();
  const context = profile
    ? [
        `### 對話對象資料（來源：Metabase 每 10 分同步）`,
        `姓名：${profile.name}`,
        `品牌：${BRAND_DESC[profile.brand] || profile.brand}`,
        profile.org ? `據點：${profile.org}` : "",
        profile.team ? `組別：${profile.team}` : "",
        `等級：${profile.level || "未分級"}`,
        "",
        `### 今天 (${today}, 台灣時間 ${hourTw}:00)`,
        `通次 ${todayM.calls} · 接通 ${todayM.connected} · 通時 ${Math.round(todayM.call_minutes)}分`,
        `原始邀約 ${todayM.raw_appointments} · 邀約出席 ${todayM.appointments_show}`,
        `DEMO ${todayM.raw_demos} · 成交 ${todayM.closures} · 淨業績 $${todayM.net_revenue_daily}`,
        "",
        `### 本週累計 (Mon-${today})`,
        `通次 ${weekM.calls} · 成交 ${weekM.closures} · 淨業績 $${weekM.net_revenue_daily}`,
        "",
        `### 本月累計`,
        `通次 ${monthM.calls} · 成交 ${monthM.closures} · 淨業績 $${monthM.net_revenue_daily}`,
        "",
        matchedRule
          ? [
              `### 今天套用的規則：${matchedRule.name} (${matchedRule.severity})`,
              shortfalls.length > 0 ? `未達標項目：${shortfalls.join("｜")}` : `✅ 已達標`,
            ].join("\n")
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : `### 無業務資料 — 這個 email 不在 Metabase 名單中，可能是主管或新員工尚未綁定。`;

  const systemPrompt = `${MODE_SYSTEM[mode]}

${context}

請根據以上真實數據跟業務對話。所有你給的數字必須來自上面的 context，不要編造。`;

  const client = new Anthropic({ apiKey });

  // Streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const iter = await client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });

        for await (const chunk of iter) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk.delta.text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
    },
  });
}
