import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

const CATEGORIES = [
  "sales_technique",
  "mindset",
  "industry_trend",
  "negotiation",
  "client_management",
] as const;

type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  sales_technique: "銷售技巧",
  mindset: "心態與自我成長",
  industry_trend: "產業趨勢",
  negotiation: "談判與溝通",
  client_management: "客戶經營",
};

interface GeneratedArticle {
  title: string;
  category: Category;
  summary: string;
  content: string;
  source: string;
  source_url: string;
  source_language: string;
  key_takeaways: string[];
  tags: string[];
  ai_analysis: string;
}

/**
 * Search the web for recent free sales/business articles and videos,
 * then use AI to analyze and summarize them in Traditional Chinese.
 */
async function searchAndAnalyze(): Promise<GeneratedArticle[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    // Pick 3-5 categories for this batch
    const shuffled = [...CATEGORIES].sort(() => Math.random() - 0.5);
    const batchSize = 3 + Math.floor(Math.random() * 3); // 3-5
    const todayCategories = shuffled.slice(0, batchSize);

    const searchQueries = [
      // English sources
      "best sales techniques 2026 free course",
      "B2B sales strategies article",
      "negotiation skills tips free video",
      "client relationship management best practices",
      "sales mindset growth motivation",
      "cold calling tips 2026",
      "consultative selling techniques free",
      "objection handling sales training",
      // Chinese sources
      "業務銷售技巧 2026 免費課程",
      "銷售心態 成長 文章",
      "談判技巧 免費影片 教學",
      "客戶經營 策略 分享",
      "頂尖業務員 成功經驗",
      "SPIN 銷售法 實戰",
      "電話行銷 技巧 教學",
      "保險業務 理財顧問 銷售",
    ];

    // Pick random queries matching our categories
    const selectedQueries = searchQueries
      .sort(() => Math.random() - 0.5)
      .slice(0, batchSize);

    const articles: GeneratedArticle[] = [];

    for (let i = 0; i < todayCategories.length; i++) {
      const cat = todayCategories[i];
      const query = selectedQueries[i] || selectedQueries[0];

      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: `你是一位資深業務培訓專家和內容策展人。你的任務是根據搜尋主題，產出一篇高品質的業務力課程文章。

規則：
1. 文章必須是繁體中文，即使參考來源是英文
2. 內容要實用、具體、可操作，不要空泛的理論
3. 包含真實可用的技巧和步驟
4. 如果是來自國外的概念，要用台灣業務情境來舉例說明
5. AI 分析部分要深入，指出為什麼這個技巧有效、在什麼場景適用、常見的誤用
6. 給出具體的話術範例和情境模擬
7. 標註來源語言和適用場景`,
        messages: [
          {
            role: "user",
            content: `搜尋主題：「${query}」
類別：${CATEGORY_LABELS[cat]}

請搜集並分析相關的免費業務課程/影片/文章內容，然後以 JSON 格式回覆：
{
  "title": "吸引人的繁體中文標題",
  "summary": "80字以內摘要",
  "content": "Markdown 格式的完整文章，500-800字，要有：\\n1. 核心概念說明\\n2. 具體操作步驟（至少3步）\\n3. 實戰話術範例（至少2個場景）\\n4. 常見錯誤提醒",
  "source": "參考來源名稱（如 HubSpot Blog、業務力學院等）",
  "source_url": "來源 URL 或 'AI 綜合分析'",
  "source_language": "en 或 zh-TW",
  "key_takeaways": ["重點1", "重點2", "重點3", "重點4"],
  "tags": ["標籤1", "標籤2", "標籤3"],
  "ai_analysis": "200字的 AI 深度分析：為什麼這個技巧有效、適用場景、與台灣業務環境的關聯、進階應用建議"
}

只回覆 JSON，不要其他文字。`,
          },
        ],
      });

      const text =
        message.content[0].type === "text" ? message.content[0].text : "";

      try {
        // Extract JSON from potential markdown code blocks
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) continue;
        const parsed = JSON.parse(jsonMatch[0]);

        articles.push({
          title: parsed.title,
          category: cat,
          summary: parsed.summary,
          content: parsed.content,
          source: parsed.source || "AI 綜合分析",
          source_url: parsed.source_url || "AI 綜合分析",
          source_language: parsed.source_language || "zh-TW",
          key_takeaways: parsed.key_takeaways || [],
          tags: parsed.tags || [],
          ai_analysis: parsed.ai_analysis || "",
        });
      } catch {
        // Skip articles that fail to parse
        continue;
      }
    }

    return articles.length > 0 ? articles : null;
  } catch (err) {
    console.error("Article generation failed:", err);
    return null;
  }
}

function getPlaceholderArticles(): GeneratedArticle[] {
  return [
    {
      title: "SPIN 銷售法完全攻略：用提問取代推銷",
      category: "sales_technique",
      summary:
        "掌握 SPIN 四步驟提問法，讓客戶自己說服自己。從情境探詢到需求確認，每一步都有具體話術範例。",
      content:
        "## 什麼是 SPIN 銷售法？\n\nSPIN 是由 Neil Rackham 提出的銷售方法論，透過四種問題類型引導客戶：\n\n### S — Situation（情境問題）\n了解客戶現況，建立對話基礎。\n\n**話術範例：**\n> 「請問您目前在理財方面有做什麼規劃嗎？」\n\n### P — Problem（問題探詢）\n挖掘客戶的痛點和困擾。\n\n**話術範例：**\n> 「在投資過程中，您覺得最讓您頭痛的是什麼？」\n\n### I — Implication（暗示影響）\n讓客戶理解問題不解決的後果。\n\n**話術範例：**\n> 「如果這個問題持續下去，半年後您覺得會有什麼影響？」\n\n### N — Need-payoff（需求確認）\n引導客戶想像解決後的好處。\n\n**話術範例：**\n> 「如果有個方法能幫您每月多存 5000 元，您覺得怎麼樣？」\n\n## 常見錯誤\n\n1. ❌ 跳過 S 直接問 P — 客戶會覺得突兀\n2. ❌ I 階段太輕描淡寫 — 要讓客戶「感受到」問題的嚴重性\n3. ❌ 過早進入推銷模式 — 先完成四步再介紹方案",
      source: "業務力學院",
      source_url: "AI 綜合分析",
      source_language: "zh-TW",
      key_takeaways: [
        "先問情境問題建立信任感",
        "痛點挖掘要夠深才有效",
        "暗示影響是成交關鍵",
        "讓客戶自己說出需要",
      ],
      tags: ["SPIN", "銷售技巧", "提問法", "成交"],
      ai_analysis:
        "SPIN 銷售法之所以有效，是因為它符合人類決策心理：人們更容易被自己的結論說服。在台灣業務環境中，客戶普遍對「被推銷」有抗拒感，但對「被關心」是開放的。SPIN 的妙處在於把推銷轉化為諮詢，業務員的角色從銷售員變成顧問。進階應用上，可以在 I 階段加入同業案例，讓暗示更具體。",
    },
  ];
}

export async function GET(req: NextRequest) {
  // Vercel Cron sends a GET request; secure it with CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const articles =
      (await searchAndAnalyze()) ?? getPlaceholderArticles();

    const supabase = getSupabaseAdmin();
    const inserted: unknown[] = [];
    const errors: string[] = [];

    for (const article of articles) {
      const { data, error } = await supabase
        .from("articles")
        .insert({
          title: article.title,
          category: article.category,
          summary: article.summary,
          content: article.content,
          source: article.source,
          source_url: article.source_url,
          source_language: article.source_language,
          key_takeaways: article.key_takeaways,
          tags: article.tags,
          ai_analysis: article.ai_analysis,
          is_ai_generated: true,
        })
        .select()
        .single();

      if (error) {
        errors.push(`${article.title}: ${error.message}`);
      } else {
        inserted.push(data);
      }
    }

    return Response.json({
      ok: true,
      generated: articles.length,
      inserted: inserted.length,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
