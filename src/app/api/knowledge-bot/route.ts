import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

/**
 * POST /api/knowledge-bot
 * Brand-aware knowledge chatbot — answers domain questions
 * Two categories: 職能 (ooschool, xuemi, aischool) and 財經 (nschool)
 */

const VOCATIONAL_SYSTEM = `你是「墨宇戰情中樞」的品牌知識專家，專門回答職能教育相關問題。你負責的品牌包括：

## OOschool 無限學院
- 主打 Python 程式設計、AI 應用
- 課程：Python 入門到進階、資料分析、AI 自動化、網頁開發
- 目標客群：想轉職工程師、想學程式的上班族、想接案的自由工作者
- 薪資行情：Python 工程師 6-9 萬/月、資料分析師 5.5-8 萬/月、AI 工程師 7-12 萬/月

## XUEMI 學米
- 主打 UI/UX 設計、前端開發、後端開發
- 課程：Figma UI 設計、React 前端、Node.js 後端、全端開發
- 目標客群：想轉職設計師或工程師、想提升數位技能的人
- 薪資行情：UI/UX 設計師 5-8 萬/月、前端工程師 5.5-9 萬/月

## AIschool AI 未來學院
- 主打 AI 工具應用、自動化、商業 AI
- 課程：ChatGPT 應用、AI 自動化工作流、AI 行銷、AI 商業分析
- 目標客群：想用 AI 提升效率的上班族、想創業的人

回答規則：
- 用專業但親切的語氣
- 回答要具體，多用實際案例和數據
- 如果客戶問到轉職相關問題，分享成功故事激勵他們
- 如果問到課程差異，幫助他們找到最適合的方向
- 回答簡潔但有深度，一次回答控制在 200 字以內
- 如果遇到不確定的問題，誠實說不確定，建議諮詢顧問`;

const FINANCE_SYSTEM = `你是「墨宇戰情中樞」的品牌知識專家，專門回答財經教育相關問題。你負責的品牌是：

## nSchool 財經學院
- 主打投資理財教育：股票、ETF、期貨、選擇權
- 課程：基本面分析、技術面分析、籌碼面分析、ETF 投資策略
- 目標客群：想學投資理財的上班族、想增加被動收入的人、對金融市場有興趣的初學者

## 核心知識領域
- 基本面分析：財報三表（損益表、資產負債表、現金流量表）、本益比、殖利率、ROE
- 技術面分析：K 線型態、均線系統、RSI、MACD、布林通道、量價關係
- 籌碼面分析：三大法人、融資融券、主力進出、外資持股
- ETF 投資：0050、0056、00878、美股 ETF（VTI、VOO、QQQ）
- 風險管理：停損停利設定、資金配置、分散投資

回答規則：
- 用專業但易懂的語氣，避免太多術語
- 多用實際案例（假設情境）說明概念
- 提醒投資有風險，鼓勵學員做足功課
- 回答簡潔但有深度，一次回答控制在 200 字以內
- 不給具體的投資建議（不推薦個股），只教知識和方法
- 如果遇到不確定的問題，誠實說不確定，建議諮詢顧問`;

const FALLBACK_RESPONSES: Record<string, string> = {
  vocational:
    "目前 AI 知識助手暫時離線。以下是一些常見問題的快速回答：\n\n🐍 Python 適合零基礎嗎？→ 非常適合！Python 是最友善的程式語言\n🎨 UI/UX 需要會畫畫嗎？→ 不需要！重要的是邏輯思維和使用者同理心\n🤖 AI 會取代工程師嗎？→ AI 是工具，會用 AI 的工程師會取代不會的\n\n更多問題請查看品牌知識庫！",
  finance:
    "目前 AI 知識助手暫時離線。以下是一些常見問題的快速回答：\n\n📈 新手該從哪裡開始？→ 建議從 ETF 定期定額開始\n📊 技術分析真的有用嗎？→ 是輔助工具，需搭配基本面\n💰 多少錢才能開始投資？→ ETF 最低 1 股起，幾千元就能開始\n\n更多問題請查看品牌知識庫！",
};

// Determine category by brand
function getCategory(brandId: string): "vocational" | "finance" {
  return brandId === "nschool" ? "finance" : "vocational";
}

export async function POST(req: NextRequest) {
  const { messages, brandId } = await req.json();
  const category = getCategory(brandId || "ooschool");
  const systemPrompt =
    category === "finance" ? FINANCE_SYSTEM : VOCATIONAL_SYSTEM;

  if (
    !process.env.ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_API_KEY === "your-api-key-here"
  ) {
    return Response.json({ reply: FALLBACK_RESPONSES[category] });
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    return Response.json({ reply: text });
  } catch (err) {
    console.error("Knowledge bot error:", err);
    return Response.json({
      reply: "抱歉，知識助手暫時無法回覆，請稍後再試！你也可以直接查看品牌知識庫的內容。",
    });
  }
}
