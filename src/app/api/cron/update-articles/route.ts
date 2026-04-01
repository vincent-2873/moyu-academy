import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

const CATEGORIES = [
  "financial_news",
  "sales_technique",
  "mindset",
  "industry_trend",
  "success_story",
] as const;

type Category = (typeof CATEGORIES)[number];

interface GeneratedArticle {
  title: string;
  category: Category;
  summary: string;
  content: string;
  source: string;
  key_takeaways: string[];
  tags: string[];
}

// Placeholder articles used when no AI API key is available
const PLACEHOLDER_ARTICLES: GeneratedArticle[] = [
  {
    title: "2026年Q2金融市場展望：利率走向與投資策略",
    category: "financial_news",
    summary:
      "隨著全球央行政策分化，Q2金融市場面臨新的機遇與挑戰。本文分析關鍵趨勢並提供實用的客戶溝通策略。",
    content:
      "## 市場概況\n\n2026年第二季度，全球金融市場持續受到各國央行貨幣政策分化的影響。美聯儲維持觀望態度，而歐洲央行已開始新一輪降息週期。\n\n## 對理財顧問的啟示\n\n1. **資產配置建議**：在利率不確定性中，建議客戶採取多元化策略\n2. **溝通要點**：用簡單易懂的語言向客戶解釋市場變化\n3. **機會發現**：低利率環境下，固定收益產品的需求可能增加\n\n## 行動建議\n\n- 主動聯繫高淨值客戶，分享市場觀點\n- 準備Q2產品推薦清單\n- 關注新興市場債券機會",
    source: "摸魚學院每日財經",
    key_takeaways: [
      "央行政策分化帶來配置機會",
      "主動溝通是建立信任的關鍵",
      "多元化配置降低風險",
    ],
    tags: ["市場分析", "利率", "資產配置", "Q2展望"],
  },
  {
    title: "頂尖理財顧問的5個成交心法",
    category: "sales_technique",
    summary:
      "研究顯示，頂尖理財顧問的成交率是平均水平的3倍。他們的秘訣不在話術，而在於真正理解客戶需求。",
    content:
      '## 心法一：先聽後說\n\n頂尖顧問在首次會面中，80%的時間都在傾聽。他們使用開放式問題引導客戶表達真實需求。\n\n## 心法二：痛點優先\n\n不要急著推薦產品。先幫客戶釐清他們面臨的財務挑戰，再提供解決方案。\n\n## 心法三：數據說話\n\n用具體的數字和案例來說明方案的價值，而非抽象的承諾。\n\n## 心法四：創造急迫感\n\n幫助客戶理解「不行動」的成本，但避免施壓式銷售。\n\n## 心法五：持續跟進\n\n成交後才是關係的開始。定期回顧和調整，建立長期信任。',
    source: "摸魚學院銷售研究",
    key_takeaways: [
      "傾聽比說服更重要",
      "用數據而非話術建立信任",
      "成交後的跟進決定長期業績",
    ],
    tags: ["銷售技巧", "成交心法", "客戶關係", "理財顧問"],
  },
  {
    title: "逆境中的成長心態：從挫折到突破",
    category: "mindset",
    summary:
      "面對業績壓力和市場波動，保持正確的心態是持續成功的基石。學習如何將挫折轉化為成長動力。",
    content:
      "## 為什麼心態如此重要？\n\n在金融銷售領域，拒絕是常態。研究顯示，成功的理財顧問平均需要接觸7次才能成交一位客戶。\n\n## 成長心態的三個實踐\n\n### 1. 重新定義「失敗」\n\n每次被拒絕都是學習的機會。記錄每次會面的反思，找出可以改進的地方。\n\n### 2. 設定過程目標\n\n不要只看業績數字。設定「每週接觸10位潛在客戶」這樣的過程目標，結果自然會跟上。\n\n### 3. 建立支持系統\n\n找到志同道合的同事，組成互助小組。分享經驗、互相鼓勵，共同成長。\n\n## 每日心態重置\n\n- 早晨：花5分鐘設定當日意圖\n- 中午：快速回顧上午表現\n- 晚上：記錄三件值得感恩的事",
    source: "摸魚學院心態教練",
    key_takeaways: [
      "拒絕是成交的必經之路",
      "過程目標比結果目標更可控",
      "每日反思是持續進步的關鍵",
    ],
    tags: ["心態", "成長", "抗壓", "自我管理"],
  },
];

async function generateWithAnthropic(): Promise<GeneratedArticle[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    // Pick 2-3 random categories for today
    const shuffled = [...CATEGORIES].sort(() => Math.random() - 0.5);
    const todayCategories = shuffled.slice(0, 2 + Math.floor(Math.random() * 2));

    const categoryLabels: Record<Category, string> = {
      financial_news: "財經新聞分析",
      sales_technique: "銷售技巧",
      mindset: "心態與自我成長",
      industry_trend: "產業趨勢",
      success_story: "成功案例",
    };

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const articles: GeneratedArticle[] = [];

    for (const cat of todayCategories) {
      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: `你是一位專業的金融銷售培訓內容編輯。請生成一篇「${categoryLabels[cat]}」類別的繁體中文文章，目標讀者是銀行/保險業的理財顧問。

請以JSON格式回覆，包含以下欄位：
{
  "title": "文章標題",
  "summary": "50字以內摘要",
  "content": "Markdown格式的文章內容，約300-500字",
  "key_takeaways": ["重點1", "重點2", "重點3"],
  "tags": ["標籤1", "標籤2", "標籤3"]
}

只回覆JSON，不要其他文字。`,
          },
        ],
      });

      const text =
        message.content[0].type === "text" ? message.content[0].text : "";
      const parsed = JSON.parse(text);

      articles.push({
        title: parsed.title,
        category: cat,
        summary: parsed.summary,
        content: parsed.content,
        source: "摸魚學院AI編輯",
        key_takeaways: parsed.key_takeaways,
        tags: parsed.tags,
      });
    }

    return articles;
  } catch (err) {
    console.error("Anthropic generation failed:", err);
    return null;
  }
}

function getPlaceholderArticles(): GeneratedArticle[] {
  // Pick 2-3 random placeholder articles
  const shuffled = [...PLACEHOLDER_ARTICLES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2 + Math.floor(Math.random() * 2));
}

export async function GET(req: NextRequest) {
  // Vercel Cron sends a GET request; secure it with CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Try AI generation first, fall back to placeholders
    const articles =
      (await generateWithAnthropic()) ?? getPlaceholderArticles();

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
          key_takeaways: article.key_takeaways,
          tags: article.tags,
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
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
