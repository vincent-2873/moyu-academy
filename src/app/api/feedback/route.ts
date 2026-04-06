import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "your-api-key-here") {
    return Response.json({
      scores: {
        opening: 72,
        spinCoverage: 68,
        painPointDepth: 65,
        solutionMatch: 70,
        objectionHandling: 60,
        closingPush: 55,
        overall: 65,
      },
      highlights: [
        "開場自然，能快速建立信任感",
        "提問技巧不錯，有嘗試了解客戶需求",
        "態度親切有禮貌",
      ],
      improvements: [
        "可以更深入挖掘客戶痛點，試試這樣問：「這個問題如果不解決，半年後會有什麼影響？」",
        "異議處理可以更有技巧，試試這樣說：「我理解您的顧慮，讓我們一起算算投資回報率」",
        "收尾時要更積極推進，試試這樣說：「那我們先預約一個 30 分鐘的線上體驗，您看週三還是週四方便？」",
      ],
      summary: "整體表現中等，建議加強痛點挖掘與成交推進力",
    });
  }

  const { messages, personaName, brandName } = await req.json();

  const conversationText = messages
    .map((m: { role: string; content: string }, i: number) =>
      `[第${Math.ceil((i+1)/2)}輪] ${m.role === "user" ? "業務" : "客戶"}：${m.content}`
    )
    .join("\n");

  const totalRounds = Math.ceil(messages.filter((m: { role: string }) => m.role === "user").length);

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      temperature: 0.3,
      system: `你是一位擁有 15 年經驗的銷售培訓總監，正在評估一位「${brandName}」業務顧問與客戶「${personaName}」的對練表現。

這通電話共 ${totalRounds} 輪對話。

【評分標準 — 請嚴格按照以下標準打分】

1. **opening（開場力）0-100**
   - 90+: 30秒內建立信任、引起好奇、自然過渡到提問
   - 70-89: 有禮貌的開場，但缺少記憶點或客製化
   - 50-69: 太制式或太急躁，沒有建立信任就開始推銷
   - <50: 開場就讓客戶想掛電話

2. **spinCoverage（SPIN覆蓋率）0-100**
   - 90+: S→P→I→N 四步完整且自然串接
   - 70-89: 有 3 步以上但轉接不夠自然
   - 50-69: 只有 S+P，沒有深入到 I 或 N
   - <50: 基本沒有用提問引導

3. **painPointDepth（痛點挖掘）0-100**
   - 90+: 找到客戶真正在意的深層痛點，客戶有「被理解」的感覺
   - 70-89: 有問到痛點但沒有深入追問
   - 50-69: 只是表面了解，沒有觸及情感層面
   - <50: 完全沒有嘗試了解客戶痛點

4. **solutionMatch（方案匹配度）0-100**
   - 90+: 推薦完全對應客戶需求，有客製化說明
   - 70-89: 推薦方向正確但說明不夠具體
   - 50-69: 罐頭式推薦，沒有連結客戶痛點
   - <50: 完全沒有推薦或推薦不相關

5. **objectionHandling（異議處理）0-100**
   - 90+: 先同理→再重構→最後解決，客戶態度明顯軟化
   - 70-89: 有回應但缺少同理心或重構步驟
   - 50-69: 直接反駁或忽略異議
   - <50: 被異議嚇到不知如何回應

6. **closingPush（成交推進力）0-100**
   - 90+: 有明確 call to action + 二選一法 + 創造急迫感
   - 70-89: 有提出下一步但不夠具體
   - 50-69: 含糊收尾，沒有明確邀約
   - <50: 完全沒有嘗試推進

【回覆格式 — 只回覆 JSON】
{
  "scores": {
    "opening": <分數>,
    "spinCoverage": <分數>,
    "painPointDepth": <分數>,
    "solutionMatch": <分數>,
    "objectionHandling": <分數>,
    "closingPush": <分數>
  },
  "highlights": [
    "✅ [具體指出第幾輪] 做得好的行為 + 為什麼好",
    "✅ [具體指出第幾輪] 做得好的行為 + 為什麼好",
    "✅ [具體指出第幾輪] 做得好的行為 + 為什麼好"
  ],
  "improvements": [
    "💡 [具體指出第幾輪的問題] + 改寫範例：「具體話術」",
    "💡 [具體指出第幾輪的問題] + 改寫範例：「具體話術」",
    "💡 [具體指出第幾輪的問題] + 改寫範例：「具體話術」"
  ],
  "summary": "50字整體評語，要有鼓勵也有具體改進方向"
}`,
      messages: [
        {
          role: "user",
          content: `以下是完整對話紀錄：\n\n${conversationText}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "{}";

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      const feedback = JSON.parse(jsonMatch[0]);
      const overall = Math.round(
        (feedback.scores.opening * 0.1 +
          feedback.scores.spinCoverage * 0.25 +
          feedback.scores.painPointDepth * 0.2 +
          feedback.scores.solutionMatch * 0.15 +
          feedback.scores.objectionHandling * 0.15 +
          feedback.scores.closingPush * 0.15)
      );
      feedback.scores.overall = overall;
      return Response.json(feedback);
    } catch {
      return Response.json({
        scores: {
          opening: 50,
          spinCoverage: 50,
          painPointDepth: 50,
          solutionMatch: 50,
          objectionHandling: 50,
          closingPush: 50,
          overall: 50,
        },
        highlights: ["繼續練習，你已經在進步的路上了"],
        improvements: ["多使用 SPIN 提問技巧，從情境問題開始"],
        summary: "需要更多練習來提升整體銷售能力，加油！",
      });
    }
  } catch (err) {
    console.error("Feedback API error:", err);
    return Response.json({
      scores: {
        opening: 50,
        spinCoverage: 50,
        painPointDepth: 50,
        solutionMatch: 50,
        objectionHandling: 50,
        closingPush: 50,
        overall: 50,
      },
      highlights: ["系統暫時無法分析，請稍後再試"],
      improvements: ["請重新進行一次對練"],
      summary: "分析暫時不可用",
    });
  }
}
