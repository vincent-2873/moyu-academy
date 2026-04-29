import { getSupabaseAdmin } from "@/lib/supabase";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

/**
 * Lynn 公版回信判斷
 *
 * Sheet:1gDztawLJIsbWVxQOVfA_BXYSbdNJy0W5DDfAgA5mwUY (Lynn 公版庫)
 * 用 Claude 比對求職者回覆 vs Lynn 公版,判斷意願 / 需要的下一步
 *
 * 跑頻率:每 30 min
 *
 * 流程:
 *   1. 讀 Lynn sheet(各情境公版)
 *   2. 撈 outreach_104_queue 最近 24h 求職者回覆但 status=pending
 *   3. Claude 比對 → 標記 willing / not_interested / needs_followup
 *   4. willing → 自動建議排面試(寫進 recruit_schedule)
 *   5. needs_followup → 加 task 到 lynn 處理清單
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const LYNN_SHEET_ID = process.env.LYNN_TEMPLATE_SHEET_ID || "1gDztawLJIsbWVxQOVfA_BXYSbdNJy0W5DDfAgA5mwUY";

function getGoogleAuth() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  if (b64) {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(Buffer.from(b64, "base64").toString("utf8")),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (email && key) {
    return new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: key },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
  }
  throw new Error("Google service account not configured");
}

async function getLynnTemplates(): Promise<Array<{ scenario: string; template: string }>> {
  const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: LYNN_SHEET_ID,
    range: "A2:C",
  });
  return (res.data.values || []).map((r) => ({ scenario: r[0] || "", template: r[1] || r[2] || "" }))
    .filter((t) => t.scenario && t.template);
}

async function judgeReply(reply: string, templates: Array<{ scenario: string; template: string }>): Promise<{
  intent: "willing" | "not_interested" | "needs_followup" | "uncertain";
  reasoning: string;
  matched_scenario?: string;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { intent: "uncertain", reasoning: "no ANTHROPIC_API_KEY" };

  const client = new Anthropic({ apiKey });
  const tplStr = templates.map((t, i) => `${i + 1}. [${t.scenario}] ${t.template.slice(0, 200)}`).join("\n");
  const prompt = `Lynn 招募公版庫:\n${tplStr}\n\n求職者回覆:「${reply}」\n\n判斷:意願 willing / 不感興趣 not_interested / 需追蹤 needs_followup / 不明 uncertain。
回 JSON:{"intent":"...","reasoning":"...","matched_scenario":"..."}。reasoning 50 字內。`;

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("");
  const m = text.match(/\{[\s\S]*?\}/);
  if (!m) return { intent: "uncertain", reasoning: "no JSON parse" };
  try {
    const j = JSON.parse(m[0]);
    return { intent: j.intent || "uncertain", reasoning: j.reasoning || "", matched_scenario: j.matched_scenario };
  } catch {
    return { intent: "uncertain", reasoning: "JSON parse fail" };
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    if (!req.headers.get("x-zeabur-cron")) return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const started = Date.now();

  try {
    const templates = await getLynnTemplates();
    if (templates.length === 0) return Response.json({ ok: false, error: "no Lynn templates" });

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: pending } = await supabase
      .from("outreach_104_queue")
      .select("id, candidate_name, last_reply_text, last_reply_at, status")
      .eq("status", "pending")
      .gte("last_reply_at", oneDayAgo)
      .limit(50);

    const judgements: Array<{ id: string; intent: string; matched?: string }> = [];
    for (const r of pending || []) {
      if (!r.last_reply_text) continue;
      const j = await judgeReply(r.last_reply_text, templates);
      const newStatus =
        j.intent === "willing" ? "interested"
        : j.intent === "not_interested" ? "rejected"
        : j.intent === "needs_followup" ? "followup"
        : "pending";
      await supabase.from("outreach_104_queue").update({
        status: newStatus,
        ai_judgment: j.intent,
        ai_reasoning: j.reasoning,
        ai_matched_scenario: j.matched_scenario,
        ai_judged_at: new Date().toISOString(),
      }).eq("id", r.id);
      judgements.push({ id: r.id, intent: j.intent, matched: j.matched_scenario });
    }

    return Response.json({
      ok: true,
      duration_ms: Date.now() - started,
      templates_count: templates.length,
      pending_count: pending?.length || 0,
      judgements,
    });
  } catch (e) {
    return Response.json({
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 200) : "unknown",
      duration_ms: Date.now() - started,
    }, { status: 500 });
  }
}
