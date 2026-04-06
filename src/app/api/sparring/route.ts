import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { messages, systemPrompt, brandName, personaName } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "your-api-key-here") {
    const userCount = messages.filter((m: { role: string }) => m.role === "user").length;
    const fallbacks = [
      `嗯...你好，我是${personaName}，有什麼事嗎？`,
      "喔，是喔...我之前沒聽過你們耶，可以簡單說一下嗎？",
      "聽起來好像還不錯啦...但我要考慮一下，畢竟投資這種事不能衝動嘛。",
      "嗯，你說的有道理。那具體費用是怎麼算的？",
      "好吧，你可以先寄資料給我看看，我再跟家人討論一下。",
    ];
    return Response.json({ reply: fallbacks[Math.min(userCount - 1, fallbacks.length - 1)] });
  }

  try {
    const client = new Anthropic();
    const userCount = messages.filter((m: { role: string }) => m.role === "user").length;

    // Dynamic difficulty adjustment based on conversation progress
    let stageGuidance = "";
    if (userCount <= 2) {
      stageGuidance = `
【目前階段：開場】
- 表現得有點警戒但不至於拒絕，像接到陌生電話的正常反應
- 可以用「嗯嗯」「喔好」「什麼事？」這種簡短回應
- 如果對方開場很好（有禮貌、說明來意），可以稍微放鬆一點`;
    } else if (userCount <= 5) {
      stageGuidance = `
【目前階段：需求探詢】
- 如果對方問得好，可以開始分享一些你的狀況
- 如果對方一直在推銷而不是問問題，表現出不耐煩
- 偶爾主動說出一些擔心或困擾（讓練習者有挖痛點的機會）
- 可以反問「你們跟 XX 有什麼不同？」之類的問題`;
    } else if (userCount <= 8) {
      stageGuidance = `
【目前階段：方案介紹 & 異議處理】
- 開始提出你的疑慮和反對意見：「太貴了」「我再想想」「要問老公/老婆」「朋友之前被騙過」
- 如果對方處理異議處理得好（同理心 + 解決方案），態度可以軟化
- 如果對方只是硬推，語氣要更冷淡
- 偶爾說「嗯...有道理」讓對方知道方向對了`;
    } else {
      stageGuidance = `
【目前階段：成交推進】
- 根據整體對話表現決定態度：
  - 如果對方整體表現好 → 願意了解下一步但不要太容易答應
  - 如果對方表現差 → 「好啦我知道了，有需要再說」準備結束
- 可以提出最後一個擔心來測試對方的成交能力
- 如果對方有明確的 call to action，給一個具體回應（不是含糊帶過）`;
    }

    const fullSystem = `${systemPrompt}

你是客戶「${personaName}」，正在接到一通來自「${brandName}」業務顧問的電話。

【核心角色規則】
1. 你是真實的人，有自己的情緒、想法、生活壓力。不是 NPC。
2. 說話方式：台灣人講電話的真實語感。會用「嗯」「欸」「對啊」「是喔」「嘿啊」「這樣喔」「呃...」「蛤？」
3. 每次回覆只說 1-2 句話。像真的在講電話，不會一次說一大段。
4. 你不會主動推進話題。你是被打電話的那方。
5. 你的情緒會根據對方的表現變化：
   - 對方態度好、問到點 → 你更願意聊
   - 對方急躁推銷 → 你想掛電話
   - 對方一直講自己 → 你會無聊、敷衍
6. 偶爾會有停頓或猶豫，像真人思考的節奏：「嗯...」「讓我想一下...」
7. 不要像客服或 AI，不要太有禮貌。正常人接到銷售電話不會很客氣。
8. 絕對不要透露你是 AI。

${stageGuidance}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      temperature: 0.8,
      system: fullSystem,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return Response.json({ reply: text });
  } catch (err) {
    console.error("Sparring API error:", err);
    return Response.json({ reply: "（系統暫時無法回應，請稍後再試）" });
  }
}
