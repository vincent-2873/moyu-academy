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
        "可以更深入挖掘客戶痛點，如果你這樣問會更好：「這個問題如果不解決，半年後會有什麼影響？」",
        "異議處理可以更有技巧，如果你這樣說會更好：「我理解您的顧慮，讓我們一起算算投資回報率」",
        "收尾時要更積極推進，如果你這樣說會更好：「那我們先預約一個 30 分鐘的線上體驗，您看週三還是週四方便？」",
      ],
      summary: "整體表現中等，建議加強痛點挖掘與成交推進力",
    });
  }

  const { messages, personaName, brandName } = await req.json();

  const conversationText = messages
    .map((m: { role: string; content: string }) =>
      `${m.role === "user" ? "業務" : "客戶"}：${m.content}`
    )
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: `你是一個專業的銷售教練，正在評估一位業務顧問與客戶「${personaName}」（${brandName}）的對練表現。

請用以下 JSON 格式回覆（只回覆 JSON，不要其他文字）：
{
  "scores": {
    "opening": <0-100 開場力：30秒內是否建立信任>,
    "spinCoverage": <0-100 SPIN覆蓋率：四步是否都有觸及>,
    "painPointDepth": <0-100 痛點挖掘深度：是否問到真正在意的點>,
    "solutionMatch": <0-100 方案匹配度：推薦是否對應需求>,
    "objectionHandling": <0-100 異議處理：遇到拒絕的應對>,
    "closingPush": <0-100 成交推進力：是否有明確下一步>
  },
  "highlights": ["做得好的 3 個具體行為"],
  "improvements": ["需要改進的 3 個具體建議，每個都包含「如果你這樣說會更好」的改寫範例"],
  "summary": "一段 50 字以內的整體評語"
}`,
    messages: [
      {
        role: "user",
        content: `以下是這次對練的完整對話紀錄：\n\n${conversationText}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "{}";

  try {
    const feedback = JSON.parse(text);
    const overall = Math.round(
      (feedback.scores.opening +
        feedback.scores.spinCoverage +
        feedback.scores.painPointDepth +
        feedback.scores.solutionMatch +
        feedback.scores.objectionHandling +
        feedback.scores.closingPush) /
        6
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
      highlights: ["繼續練習"],
      improvements: ["多使用 SPIN 提問技巧"],
      summary: "需要更多練習來提升整體銷售能力",
    });
  }
}
