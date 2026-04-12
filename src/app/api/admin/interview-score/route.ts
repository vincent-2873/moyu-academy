import { getSupabaseAdmin } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

/**
 * 面試評分 API — 依【集團】招募紀錄表的「面試評估標準」
 *
 * POST /api/admin/interview-score
 *   body: { candidateName, interviewNotes, interviewerEmail }
 *
 * 5 大面向 (from 招募紀錄表「面試評估標準」sheet):
 *   1. 事前準備與工作心態 — 主動研究公司? 積極推銷自我? 對職位有備而來?
 *   2. 核心溝通與邏輯能力 — 傾聽理解? 換位思考? 答非所問?
 *   3. 銷售潛力與實戰模擬 — 臨場反應? 創造需求? 銷售自己?
 *   4. 個人特質與軟實力 — 自信? 聲音舒服? 情感洞察力?
 *   5. 進階評估與深度提問 — 極端情境反應? 私下個性? 扭轉能力?
 *
 * Claude 會根據面試筆記做出客觀打分 + 錄取建議
 */

export const maxDuration = 60;

const SCORING_PROMPT = `你是墨宇戰情中樞的「面試評分官」，根據面試筆記為候選人評分。

5 大評估面向（from 集團招募紀錄表的面試評估標準）:

1. 事前準備與工作心態 (Preparation & Mindset)
   加分: 主動研究公司背景(+1)、積極推銷自我價值(+2)、對職位有備而來(+13)、展現解決問題意願(+2)
   扣分: 完全未做功課(-5)、被動心態(-3)、缺乏對職位的了解(-2)

2. 核心溝通與邏輯能力 (Communication & Logic)
   加分: 良好傾聽理解(+3)、換位思考與同理心(+5)、表達清晰有條理(+3)
   扣分: 答非所問(-5)、邏輯混亂(-3)、缺乏同理心(-2)

3. 銷售潛力與實戰模擬 (Sales Potential)
   加分: 臨場反應好(+5)、能創造需求(+8)、懂得銷售自己(+5)
   扣分: 被情境考倒(-3)、無法推銷自己(-5)

4. 個人特質與軟實力 (Personal Traits)
   加分: 自信態度(+3)、聲音讓人舒服(+3)、情感洞察力(+5)
   扣分: 缺乏自信(-3)、語氣不專業(-2)

5. 進階評估 (Advanced Assessment)
   加分: 極端情境反應好(+5)、私下個性與工作一致(+3)、有說服扭轉經驗(+5)
   扣分: 遇到壓力回避(-5)、無法總結自身價值(-3)

規則:
1. 每個面向給 0-20 分 + 具體依據（引用面試筆記中的原話）
2. 總分 100 分制
3. 最後給錄取建議: "強烈推薦" / "推薦" / "保留" / "不推薦"
4. 如果面試筆記太少，直接說「資訊不足，無法完整評分」而不是亂猜
5. 嚴格 JSON 輸出

{
  "totalScore": 75,
  "sections": {
    "preparation": { "score": 15, "maxScore": 20, "details": "加分項+扣分項說明" },
    "communication": { "score": 18, "maxScore": 20, "details": "..." },
    "salesPotential": { "score": 12, "maxScore": 20, "details": "..." },
    "personalTraits": { "score": 15, "maxScore": 20, "details": "..." },
    "advanced": { "score": 15, "maxScore": 20, "details": "..." }
  },
  "recommendation": "推薦 / 保留 / 不推薦",
  "keyStrengths": ["...", "..."],
  "keyRisks": ["...", "..."],
  "oneLiner": "一句話總結這個人"
}`;

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await req.json();
  const { candidateName, interviewNotes, interviewerEmail, recruitId } = body;

  if (!candidateName || !interviewNotes) {
    return Response.json(
      { ok: false, error: "candidateName + interviewNotes 必填" },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: SCORING_PROMPT,
    messages: [
      {
        role: "user",
        content: `候選人: ${candidateName}\n面試官: ${interviewerEmail || "未知"}\n\n面試筆記:\n${interviewNotes}`,
      },
    ],
  });

  let text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
  text = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
  let score;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    score = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
  } catch {
    score = { raw: text };
  }

  // Store in claude_actions
  await supabase.from("claude_actions").insert({
    action_type: "interview_score",
    target: candidateName,
    summary: score.oneLiner || `面試評分: ${candidateName}`,
    details: {
      candidateName,
      interviewerEmail,
      recruitId,
      score,
    },
    result: "success",
  });

  // If recruitId provided, update recruit's notes with score summary
  if (recruitId) {
    const { data: existing } = await supabase
      .from("recruits")
      .select("notes")
      .eq("id", recruitId)
      .maybeSingle();
    const existingNotes = (existing?.notes as string) || "";
    const scoreNote = `\n\n--- Claude 面試評分 (${new Date().toISOString().slice(0, 10)}) ---\n總分: ${score.totalScore}/100 · ${score.recommendation}\n${score.oneLiner || ""}\n優勢: ${(score.keyStrengths || []).join(", ")}\n風險: ${(score.keyRisks || []).join(", ")}`;
    await supabase
      .from("recruits")
      .update({ notes: existingNotes + scoreNote })
      .eq("id", recruitId);
  }

  return Response.json({ ok: true, candidateName, score });
}
