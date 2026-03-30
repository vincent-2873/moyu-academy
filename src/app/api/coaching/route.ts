import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { messages, personaName, brandName, lastUserMsg, lastAiMsg } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "your-api-key-here") {
    // Offline fallback coaching tips
    const userMsgCount = messages.filter((m: { role: string }) => m.role === "user").length;
    const tips = [
      { emoji: "💡", tip: "開場不錯！試著用一個問題來引起對方興趣", suggested: "請問您平常有在關注理財方面的資訊嗎？" },
      { emoji: "👍", tip: "有在聽客戶說話，很好。可以再深入挖一下痛點", suggested: "您剛提到的擔心，能多說一點嗎？是什麼讓您猶豫呢？" },
      { emoji: "💡", tip: "記得把產品優勢跟客戶的痛點連結起來", suggested: "像您說的這個狀況，其實我們很多學員一開始也是這樣..." },
      { emoji: "🔥", tip: "異議處理得不錯！繼續推進到下一步", suggested: "那這樣好了，我先幫您安排一堂免費的體驗課，您看這週哪天方便？" },
      { emoji: "👍", tip: "快要收尾了，記得要有明確的 call to action", suggested: "今天聊得很開心，我幫您預留一個名額，方便的話留個 LINE 我把詳細資料傳給您？" },
    ];
    return Response.json(tips[Math.min(userMsgCount - 1, tips.length - 1)]);
  }

  try {
    const client = new Anthropic();
    const userMsgCount = messages.filter((m: { role: string }) => m.role === "user").length;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: `你是一位即時銷售教練，正在旁聽一位業務（${brandName}）和客戶「${personaName}」的對話。

你的工作是在每一輪對話後，即時給業務一句簡短、口語化的教練反饋。

規則：
1. 反饋必須非常簡短 — 最多 2 句話
2. 用口語化的方式說，像教練在旁邊小聲提醒你
3. 要具體指出「剛才哪裡做得好」或「下一句可以怎麼說」
4. 不要用書面語，要像朋友在耳邊提醒
5. 根據對話進展給不同類型的提醒：
   - 前 1-2 輪：關注開場和破冰
   - 中間：關注 SPIN 技巧、是否有挖痛點
   - 後段：關注異議處理和成交推進
6. 同時給出一個 emoji 表情代表表現：
   - 🔥 很棒
   - 👍 不錯
   - 💡 可以更好
   - ⚠️ 要注意

只回覆 JSON，格式：
{"emoji": "💡", "tip": "你的即時教練反饋", "suggested": "如果是我，下一句我會這樣說：..."}

目前是第 ${userMsgCount} 輪對話。`,
      messages: [
        {
          role: "user",
          content: `業務剛說：「${lastUserMsg}」\n客戶回覆：「${lastAiMsg}」\n\n請給業務即時反饋。`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";

    try {
      const coaching = JSON.parse(text);
      return Response.json(coaching);
    } catch {
      return Response.json({ emoji: "👍", tip: "繼續保持，注意聽客戶的回應", suggested: "" });
    }
  } catch (err) {
    console.error("Coaching API error:", err);
    return Response.json({ emoji: "💡", tip: "繼續加油，注意傾聽客戶需求", suggested: "" });
  }
}
