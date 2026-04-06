import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { messages, personaName, brandName, lastUserMsg, lastAiMsg } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "your-api-key-here") {
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

    // Build conversation summary for context
    const recentMessages = messages.slice(-6);
    const conversationContext = recentMessages
      .map((m: { role: string; content: string }) =>
        `${m.role === "user" ? "業務" : "客戶"}：${m.content}`
      )
      .join("\n");

    // Determine what to focus on based on stage
    let focusArea = "";
    if (userMsgCount <= 2) {
      focusArea = "重點觀察：開場破冰、自我介紹、是否讓客戶願意繼續聊。好的開場應該在 30 秒內建立信任和好奇心。";
    } else if (userMsgCount <= 4) {
      focusArea = "重點觀察：是否在用 SPIN 的 S（情境）和 P（問題）提問。業務是否在問開放式問題而不是封閉式問題。有沒有認真聽客戶說的話。";
    } else if (userMsgCount <= 6) {
      focusArea = "重點觀察：是否有 I（暗示影響）提問，讓客戶意識到問題的嚴重性。是否在做客製化的方案推薦而不是罐頭話術。";
    } else {
      focusArea = "重點觀察：異議處理能力（先同理再解決）、N（需求確認）提問、是否有明確的 call to action 推進成交。";
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      temperature: 0.6,
      system: `你是一位頂尖銷售教練，正在旁聽一位「${brandName}」業務和客戶「${personaName}」的即時通話。

你的角色：像站在業務旁邊的老師傅，在他耳邊小聲提醒。

【教練反饋原則】
1. 一次只給一個最關鍵的建議，不要貪多
2. 先肯定做得好的地方（具體指出哪句話好），再給一個改進方向
3. suggested 必須是一句完整的、可以直接說出口的話術
4. 語氣像老鳥帶新人：親切但直接，不要太學術
5. 如果業務犯了明顯錯誤（太急躁、沒聽客戶說話、用了罐頭話術），直接點出來
6. 評分要誠實：真的好才給🔥，不要每次都給👍

${focusArea}

目前是第 ${userMsgCount} 輪對話。

只回覆 JSON 格式：
{"emoji": "💡", "tip": "你的即時教練反饋（2句以內）", "suggested": "如果是我，下一句我會說：「具體話術」"}`,
      messages: [
        {
          role: "user",
          content: `最近的對話脈絡：
${conversationContext}

---
最新一輪：
業務說：「${lastUserMsg}」
客戶回：「${lastAiMsg}」

請給業務即時反饋。`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";

    try {
      // Extract JSON from potential markdown
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const coaching = JSON.parse(jsonMatch[0]);
        return Response.json(coaching);
      }
      return Response.json({ emoji: "👍", tip: "繼續保持節奏，注意聽客戶的回應", suggested: "" });
    } catch {
      return Response.json({ emoji: "👍", tip: "繼續保持，注意聽客戶的回應", suggested: "" });
    }
  } catch (err) {
    console.error("Coaching API error:", err);
    return Response.json({ emoji: "💡", tip: "繼續加油，注意傾聽客戶需求", suggested: "" });
  }
}
