import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { messages, systemPrompt, brandName, personaName } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "your-api-key-here") {
    // Offline fallback: simple scripted responses
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
    const fullSystem = `${systemPrompt}

重要規則：
1. 你正在進行一通銷售電話的角色扮演。你是客戶「${personaName}」。
2. 對方是「${brandName}」的業務顧問，正在練習銷售技巧。
3. 保持角色一致，像真實客戶一樣回應。
4. 每次回覆控制在 1-3 句話，要像真實電話對話那樣短促自然。大部分回覆只要 1-2 句。
5. 會根據對方的表現調整你的態度 — 如果對方問得好就更開放，問得差就更抗拒。
6. 偶爾主動提出異議或擔心，讓練習更真實。
7. 全程使用繁體中文、台灣口語化表達。常用語助詞：「嗯」「欸」「對」「嘿啊」「這樣喔」「好像...吧」「呃...」。
8. 不要透露你是 AI，保持角色扮演到底。
9. 不要主動推進話題或教育對方。你是客戶，你只回答被問的問題，偶爾反問或提出疑慮。
10. 語氣要自然隨性，像正在講電話的年輕台灣人。不要太正式或太有禮貌。`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
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
    return Response.json({ reply: "（系統暫時無法回應，請檢查 API Key 設定或稍後再試）" });
  }
}
