import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 候選人錄音/逐字稿分析 — 招聘員丟檔案或文字 Claude 幫你判斷
 *
 * POST /api/recruit/analyze-candidate (multipart or JSON)
 *
 * 支援兩種輸入:
 *   A. multipart: audio file + candidateName + position
 *      → Whisper 轉文字 → Claude 分析
 *   B. JSON: { candidateName, transcript, position, interviewNotes }
 *      → 直接 Claude 分析
 *
 * 分析維度 (墨宇面試 5 大面向):
 *   1. 事前準備與工作心態 (0-20)
 *   2. 核心溝通與邏輯能力 (0-20)
 *   3. 銷售潛力與實戰模擬 (0-20)
 *   4. 個人特質與軟實力 (0-20)
 *   5. 進階評估 (0-20)
 *
 * 額外輸出:
 *   - 錄取分數 (0-100) + 信心度
 *   - 不足在哪 + 為什麼 + 根據是什麼
 *   - 建議下一步 (錄取/二面/拒絕)
 *   - 跟其他候選人比較 (如果 DB 有歷史)
 */

export const maxDuration = 60;

const CANDIDATE_ANALYSIS_PROMPT = `你是墨宇戰情中樞的「候選人分析師」。你要像資深獵頭一樣精準判斷這個人值不值得錄。

墨宇的面試標準 5 大面向:
1. 事前準備與工作心態 (0-20): 有沒有研究公司(+1)、推銷自我(+2)、有備而來(+13)、解決問題意願(+2) / 沒做功課(-5)、被動(-3)
2. 核心溝通與邏輯能力 (0-20): 傾聽理解(+3)、同理心(+5)、清晰表達(+3) / 答非所問(-5)、邏輯混亂(-3)
3. 銷售潛力與實戰模擬 (0-20): 臨場反應(+5)、創造需求(+8)、銷售自己(+5) / 被考倒(-3)、無法推銷自己(-5)
4. 個人特質與軟實力 (0-20): 自信(+3)、聲音舒服(+3)、情感洞察力(+5) / 缺自信(-3)、語氣不專業(-2)
5. 進階評估 (0-20): 極端情境反應(+5)、真實個性(+3)、說服扭轉能力(+5) / 壓力回避(-5)、無法總結自身(-3)

鐵則:
1. 如果只有錄音逐字稿沒有面試筆記，你只能評估聲音表達、口條、邏輯 — 不要硬評「有沒有研究公司」
2. 每個面向都要引用原文作為證據 (「他在第 X 句話說了...」)
3. 不足的地方要說清楚為什麼不足 + 具體改善建議
4. 錄取分數 < 50 = 明確拒絕 + 原因
5. 錄取分數 50-65 = 保留 + 下次面試要追問什麼
6. 錄取分數 65-80 = 推薦 + 要注意什麼
7. 錄取分數 > 80 = 強烈推薦 + 為什麼

嚴格 JSON 輸出:
{
  "totalScore": 0-100,
  "sections": {
    "preparation": { "score": 0-20, "evidence": "引用原文", "gap": "不足在哪", "why": "為什麼不足" },
    "communication": { "score": 0-20, "evidence": "...", "gap": "...", "why": "..." },
    "salesPotential": { "score": 0-20, "evidence": "...", "gap": "...", "why": "..." },
    "personalTraits": { "score": 0-20, "evidence": "...", "gap": "...", "why": "..." },
    "advanced": { "score": 0-20, "evidence": "...", "gap": "...", "why": "..." }
  },
  "recommendation": "強烈推薦/推薦/保留/拒絕",
  "oneLiner": "一句話結論",
  "gaps": [
    { "dimension": "哪個面向", "issue": "不足什麼", "reason": "為什麼", "evidence": "根據" }
  ],
  "strengths": ["優勢 1", "優勢 2"],
  "nextStep": "建議下一步 (具體動作，不是「再觀察」)",
  "interviewSuggestions": ["如果要二面，該追問什麼問題"]
}`;

async function transcribe(audioBuffer: ArrayBuffer, filename: string): Promise<string | null> {
  // Try OpenAI → Groq
  for (const [envKey, url] of [
    ["OPENAI_API_KEY", "https://api.openai.com/v1/audio/transcriptions"],
    ["GROQ_API_KEY", "https://api.groq.com/openai/v1/audio/transcriptions"],
  ] as const) {
    const key = process.env[envKey];
    if (!key) continue;
    const form = new FormData();
    form.append("file", new Blob([audioBuffer]), filename);
    form.append("model", envKey === "GROQ_API_KEY" ? "whisper-large-v3" : "whisper-1");
    form.append("language", "zh");
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (res.ok) {
      const j = await res.json();
      if (j.text) return j.text;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const contentType = req.headers.get("content-type") || "";

  let candidateName: string;
  let position: string;
  let transcript: string | null = null;
  let interviewNotes: string | null = null;
  let recruiterEmail: string | null = null;

  if (contentType.includes("multipart")) {
    // Audio file upload
    const formData = await req.formData();
    candidateName = formData.get("candidateName")?.toString() || "";
    position = formData.get("position")?.toString() || "電銷業務";
    recruiterEmail = formData.get("recruiterEmail")?.toString() || null;
    interviewNotes = formData.get("interviewNotes")?.toString() || null;

    const audioFile = formData.get("audio") as File | null;
    if (audioFile) {
      if (audioFile.size > 25 * 1024 * 1024) {
        return Response.json({ ok: false, error: "檔案太大 (>25MB)" }, { status: 413 });
      }
      const buffer = await audioFile.arrayBuffer();
      // Upload to storage
      const filename = `candidates/${candidateName.replace(/[^a-zA-Z0-9]/g, "_")}/${Date.now()}_${audioFile.name}`;
      await supabase.storage.from("recordings").upload(filename, buffer, {
        contentType: audioFile.type || "audio/mpeg",
        upsert: true,
      });
      // Transcribe
      transcript = await transcribe(buffer, audioFile.name);
      if (!transcript) {
        return Response.json({
          ok: false,
          error: "無法轉文字 — 需要設定 OPENAI_API_KEY 或 GROQ_API_KEY 環境變數",
          storagePath: filename,
        });
      }
    }
  } else {
    // JSON input
    const body = await req.json();
    candidateName = body.candidateName || "";
    position = body.position || "電銷業務";
    transcript = body.transcript || null;
    interviewNotes = body.interviewNotes || null;
    recruiterEmail = body.recruiterEmail || null;
  }

  if (!candidateName) {
    return Response.json({ ok: false, error: "candidateName 必填" }, { status: 400 });
  }
  if (!transcript && !interviewNotes) {
    return Response.json({ ok: false, error: "需要 transcript 或 interviewNotes (至少一個)" }, { status: 400 });
  }

  // Call Claude
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ ok: false, error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const userContent = [
    `候選人: ${candidateName}`,
    `應徵職位: ${position}`,
    transcript ? `\n=== 通話/面試錄音逐字稿 ===\n${transcript}` : "",
    interviewNotes ? `\n=== 面試官筆記 ===\n${interviewNotes}` : "",
  ].filter(Boolean).join("\n");

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: CANDIDATE_ANALYSIS_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  let text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
  text = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();

  let analysis;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      let jsonStr = jsonMatch[0];
      // Brace recovery for truncated JSON
      const open = (jsonStr.match(/\{/g) || []).length;
      const close = (jsonStr.match(/\}/g) || []).length;
      if (open > close) {
        const lastComma = jsonStr.lastIndexOf(",");
        const lastColon = jsonStr.lastIndexOf(":");
        if (lastComma > lastColon) jsonStr = jsonStr.slice(0, lastComma);
        for (let i = 0; i < open - close; i++) jsonStr += "}";
      }
      analysis = JSON.parse(jsonStr);
    } else {
      analysis = { raw: text };
    }
  } catch {
    analysis = { raw: text };
  }

  // Store
  await supabase.from("claude_actions").insert({
    action_type: "recruit_candidate_full_analysis",
    target: candidateName,
    summary: analysis.oneLiner || `候選人分析: ${candidateName}`,
    details: {
      candidateName,
      position,
      recruiterEmail,
      totalScore: analysis.totalScore,
      recommendation: analysis.recommendation,
      analysis,
      hasTranscript: !!transcript,
      hasNotes: !!interviewNotes,
    },
    result: "success",
  });

  return Response.json({
    ok: true,
    candidateName,
    position,
    ...analysis,
  });
}
