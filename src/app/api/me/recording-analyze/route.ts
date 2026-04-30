import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";
import { requireCallerEmail } from "@/lib/auth";

/**
 * 通話錄音/逐字稿分析 — 業務貼通話逐字稿 → Claude 診斷
 *
 * POST /api/me/recording-analyze
 *   body:
 *     email:     string
 *     transcript: string  (必填 — 業務自己打逐字稿或從錄音轉寫後貼進來)
 *     scenario?: string   (例：「邀約電話」「成交通話」「C 級客戶」)
 *     customerOutcome?: 'rejected' | 'follow_up' | 'booked' | 'closed' | 'ghosted'
 *
 * Claude 會從 6 個面向打分 + 指出具體時點的問題 + 給替代話術
 *
 * 結果存 claude_actions (action_type='recording_analysis') 供歷史查閱
 *
 * 設計為 non-streaming (只 call 一次，結果一次性回) — 因為分析本來就要整段看過才有意義
 */

const SYSTEM_PROMPT = `你是墨宇戰情中樞的「通話診斷官」，對象是電話行銷業務本人。

你的工作：看完業務提供的通話逐字稿，給出具體、可執行的改進建議。

鐵則：
1. 絕對不說「整體不錯」「還可以」這類模糊話
2. 所有評分都要有根據 (引用原文某段)
3. 每個缺點必須附上「替代話術」— 第一人稱可以直接照念的一句話
4. 禁空泛鼓勵 ("加油" "繼續努力" 等)
5. 如果業務在某段做得好，也要指名並解釋為什麼 — 這樣他才知道要保持什麼

輸出嚴格 JSON，不要任何前後文字：
{
  "overall_score": 1-10 整數,
  "one_liner": "一句話診斷 (帶數字、帶具體時點，不要空話)",
  "scores": {
    "opening": { "score": 1-10, "evidence": "引用原文一段證明評分" },
    "rapport": { "score": 1-10, "evidence": "..." },
    "discovery": { "score": 1-10, "evidence": "..." },
    "pitch": { "score": 1-10, "evidence": "..." },
    "objection_handling": { "score": 1-10, "evidence": "..." },
    "close": { "score": 1-10, "evidence": "..." }
  },
  "critical_moments": [
    {
      "timestamp": "大約在逐字稿第 X 行 / 第 X 分鐘",
      "quote": "原文引用 (不要超過 50 字)",
      "problem": "這句話/這個時點出了什麼問題",
      "better_script": "可以直接照念的替代話術 (第一人稱, 30 字內)",
      "reasoning": "為什麼這樣改比較好 (1 句)"
    }
  ],
  "wins": [
    { "quote": "原文引用", "why": "這邊做得好的原因" }
  ],
  "next_actions": [
    "下一通電話必須做的 1 個具體動作 (帶對象)",
    "下次遇到類似客戶的 1 個改進點"
  ]
}`;

interface AnalysisResponse {
  ok: boolean;
  error?: string;
  analysis?: unknown;
  savedAt?: string;
}

export async function POST(req: NextRequest): Promise<Response> {
  const body = await req.json();
  const email = body.email as string | undefined;
  const authErr = requireCallerEmail(req, email || null);
  if (authErr) return authErr;
  const transcript = body.transcript as string | undefined;
  const scenario = (body.scenario as string | undefined) || "一般通話";
  const customerOutcome = body.customerOutcome as string | undefined;

  if (!email) {
    return Response.json({ ok: false, error: "email required" }, { status: 400 });
  }
  if (!transcript || transcript.trim().length < 50) {
    return Response.json(
      { ok: false, error: "transcript too short (至少 50 字逐字稿)" },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();

  // Pull user profile for brand context
  const { data: salesData } = await supabase
    .from("sales_metrics_daily")
    .select("name, brand, team, level")
    .eq("email", email)
    .order("date", { ascending: false })
    .limit(1);
  const profile = (salesData && salesData[0]) as
    | { name: string; brand: string; team: string | null; level: string | null }
    | undefined;

  const brandContext: Record<string, string> = {
    nschool: "nSchool 財經學院 — 主打股票/ETF/期貨/選擇權教學，客戶多是 25-55 歲想學投資的上班族",
    xuemi: "XUEMI 學米 — UI/UX 設計、前端、後端、全端課程，客戶多是想轉職/提升數位技能者",
    sixdigital: "無限學院 — Python/AI/資料分析/程式設計，客戶多是工程師轉職/上班族提升",
    xlab: "XLAB AI 實驗室 — AI 工具應用、商業 AI 導入，客戶多是想用 AI 提升工作效率者",
    aischool: "AI 未來學院 — ChatGPT 應用、AI 自動化、AI 行銷，客戶多是小企業主/行銷人",
  };

  const userPrompt = `【業務本人】
${profile ? `姓名：${profile.name}` : ""}
${profile ? `品牌：${brandContext[profile.brand] || profile.brand}` : ""}
${profile?.team ? `組別：${profile.team}` : ""}
${profile?.level ? `等級：${profile.level}` : ""}

【通話場景】
${scenario}

【客戶結果】
${customerOutcome || "業務未標註"}

【逐字稿開始】
${transcript.trim().slice(0, 8000)}
【逐字稿結束】

依你的 system prompt 輸出分析 JSON。`;

  const client = new Anthropic({ apiKey });

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no JSON in Claude response");
    const analysis = JSON.parse(jsonMatch[0]);

    // Save to claude_actions
    const { data: inserted } = await supabase
      .from("claude_actions")
      .insert({
        action_type: "recording_analysis",
        target: email,
        summary: (analysis as { one_liner?: string }).one_liner || "通話分析",
        details: { analysis, transcript: transcript.slice(0, 500), scenario, customerOutcome },
        result: "success",
      })
      .select("id, created_at")
      .single();

    return Response.json({
      ok: true,
      analysis,
      savedAt: inserted?.created_at,
    } satisfies AnalysisResponse);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return Response.json(
      { ok: false, error: `Claude analysis failed: ${msg}` } satisfies AnalysisResponse,
      { status: 500 }
    );
  }
}

// GET: 返回該 email 的歷史分析紀錄
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return Response.json({ ok: false, error: "email required" }, { status: 400 });
  const authErr = requireCallerEmail(req, email);
  if (authErr) return authErr;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("claude_actions")
    .select("id, summary, details, created_at")
    .eq("action_type", "recording_analysis")
    .eq("target", email)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  return Response.json({
    ok: true,
    history: (data || []).map((d) => ({
      id: d.id,
      summary: d.summary,
      createdAt: d.created_at,
      scenario: (d.details as { scenario?: string })?.scenario,
      analysis: (d.details as { analysis?: unknown })?.analysis,
    })),
  });
}
