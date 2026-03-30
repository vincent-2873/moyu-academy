import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const SYSTEM_PROMPT = `你是「墨宇學院」的 AI 客服助手「小墨」。墨宇學院是一個 AI 驅動的業務培訓系統，包含三個品牌：nSchool 財經學院、XUEMI 學米、OOschool 無限學院。

你需要幫助使用者解決以下問題：

## 系統功能介紹
- **儀表板**：查看學習進度、即時任務提醒
- **課程訓練**：每天一個模組（Day 1~7+），包含品牌知識、銷售技巧、SPIN 提問法等
- **AI 對練**：選擇 AI 客戶進行語音模擬銷售對話，系統會即時給予教練反饋和評分
- **聽 Call 逐字稿**：上傳真實通話錄音，AI 分析並給出改善建議
- **銷售工具箱**：常用話術模板、異議處理範本
- **報價方案**：各品牌方案的價格計算與比較
- **KPI 追蹤**：記錄每日進線數、成交數等業績指標
- **對練紀錄**：查看所有歷史對練的分數和改善趨勢
- **品牌知識庫**：各品牌的完整產品資訊和常見問題

## AI 對練使用方式
1. 進入「AI 對練」頁面
2. 選擇一位 AI 客戶（有不同難度：★ 到 ★★★）
3. 可以用語音（按麥克風按鈕）或打字和 AI 客戶對話
4. 右側會顯示即時教練反饋，告訴你哪裡做得好、怎麼改善
5. 對話結束後按「結束對練」獲得完整報告和六維度評分
6. 建議從 ★ 難度開始，逐步挑戰更高難度

## 常見問題
- **語音辨識不工作**：請使用 Chrome 瀏覽器，並允許麥克風權限
- **AI 回覆很慢**：可能是網路問題，請稍候重試
- **忘記密碼**：目前請聯繫管理員重置
- **邀請碼**：請向你的主管或培訓負責人索取

回答風格：
- 友善、親切、口語化
- 簡短扼要，用條列式回答
- 適時引導使用者去對應的功能頁面
- 如果不確定，建議使用者聯繫管理員`;

// Offline fallback responses
const OFFLINE_RESPONSES: Record<string, string> = {
  "怎麼用語音對練？": "語音對練很簡單！\n\n1. 點左側「AI 對練」\n2. 選一位 AI 客戶\n3. 按底部的麥克風按鈕 🎤 開始說話\n4. 說完後按停止鍵，系統會自動發送\n5. AI 客戶會用語音回覆你\n6. 右邊有即時教練在旁邊提醒你\n\n建議用 Chrome 瀏覽器效果最好！",
  "邀請碼在哪？": "邀請碼需要向你的主管或培訓負責人索取。\n\n每個品牌有專屬的邀請碼，註冊時需要輸入正確的邀請碼才能加入對應品牌。",
  "AI 評分標準？": "AI 對練的六維度評分：\n\n1. **開場破冰** — 第一印象和建立信任\n2. **需求挖掘** — 是否有用 SPIN 提問了解客戶\n3. **產品介紹** — 介紹是否切中痛點\n4. **異議處理** — 面對質疑的應對能力\n5. **成交推進** — 是否有推動下一步\n6. **整體表達** — 語氣、節奏、專業度\n\n每項 0-100 分，60 分及格，80 分以上為優秀！",
};

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  // Check if API key is configured
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "your-api-key-here") {
    // Use offline fallback
    const lastMsg = messages[messages.length - 1]?.content || "";
    const fallback = OFFLINE_RESPONSES[lastMsg];
    if (fallback) {
      return Response.json({ reply: fallback });
    }

    // Generic offline response
    return Response.json({
      reply: `收到你的問題！不過目前 AI 服務尚未啟用（需要設定 API Key）。\n\n你可以先看看這些常見操作：\n- **AI 對練**：點左邊選單「AI 對練」\n- **課程學習**：點「課程訓練」從 Day 1 開始\n- **查看成績**：點「對練紀錄」\n\n如需更多幫助，請聯繫管理員！`,
    });
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return Response.json({ reply: text });
  } catch (err) {
    console.error("Helpbot API error:", err);
    return Response.json({
      reply: "抱歉，小墨暫時開小差了 😅 請稍後再試，或直接聯繫管理員！",
    });
  }
}
