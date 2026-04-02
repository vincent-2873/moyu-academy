/**
 * 品牌知識庫 — 各品牌的領域知識內容
 * 從 Notion 訓練文件整理而來
 */

export interface KnowledgeSection {
  id: string;
  title: string;
  icon: string;
  description: string;
  topics: KnowledgeTopic[];
}

export interface KnowledgeTopic {
  id: string;
  title: string;
  subtitle?: string;
  content: string[];
  examples?: { scenario: string; solution: string }[];
  salaryInfo?: { position: string; salary: string; skills: string }[];
  freelanceInfo?: { type: string; income: string }[];
}

export interface BrandKnowledge {
  brandId: string;
  sections: KnowledgeSection[];
}

export const brandKnowledgeData: BrandKnowledge[] = [
  // ===================== OOschool 無限學院 =====================
  {
    brandId: "ooschool",
    sections: [
      {
        id: "python",
        title: "Python 領域知識",
        icon: "🐍",
        description: "Python 程式語言核心知識 — 給業務顧問的深度理解手冊",
        topics: [
          {
            id: "python-what",
            title: "Python 是什麼？",
            content: [
              "Python 是一種非常簡單、功能超廣的程式語言。語法好讀、好寫，各領域都能用：資料分析、AI、爬蟲自動化、後端、金融、機器學習。",
              "一句話說明：學 Python 是用在軟體的程式碼（對比 C 語言用在硬體）。",
              "Python 背後的日常應用：網站推薦系統、股票爬蟲自動抓資料、LINE Bot 自動回覆、電商後台自動報表、AI 問答系統。",
              "目前產業標準：語法簡單上手快、套件生態強大（NumPy/pandas/PyTorch/FastAPI）、跨平台、科技業/AI新創/資料團隊/金融業/自動化系統整合都用它。",
            ],
          },
          {
            id: "python-how",
            title: "Python 怎麼運作？",
            content: [
              "Python 開發流程：資料收集（爬蟲/API）→ 資料清洗整理 → 資料分析與視覺化 → AI 模型應用 → 自動化任務處理",
              "像在建一個機器人助理，你決定它要做什麼、怎麼做。",
              "你不需要很強的數學就能開始。最大優勢是：學一次，可以用在非常多領域。",
              "企業大量使用：金融、科技、行銷、資料、電商、AI、政府專案、創業團隊。",
            ],
          },
          {
            id: "python-examples",
            title: "實際應用案例",
            examples: [
              { scenario: "想每天自動抓台股資料", solution: "寫爬蟲 + 自動排程" },
              { scenario: "想知道商品價格何時變便宜", solution: "建立價格追蹤通知 Bot" },
              { scenario: "公司資料整理太痛苦", solution: "用 pandas 一鍵清洗整理" },
              { scenario: "想做一個聊天 AI", solution: "用 LLM API 打造自己的 Chatbot" },
              { scenario: "想做投資回測", solution: "用 Python 模擬策略、計算報酬率" },
            ],
            content: [],
          },
          {
            id: "python-deep",
            title: "AI 業界深度知識",
            content: [
              "DATA（資料）— 產品的事實基礎：資料收集、清洗、特徵、表結構。沒有資料就沒有能學習的 AI 模型。",
              "ML（機器學習）— 規則自動生成：抓出規律、建模、預測、評估。你定義資料怎麼用，ML 讓模型自動找規則。",
              "NN（神經網路）— AI 的大腦結構：多層結構、前向/反向傳播、深度學習。能處理影像/文字/語音等多模態。",
            ],
          },
          {
            id: "python-salary",
            title: "薪資與接案行情",
            content: [],
            salaryInfo: [
              { position: "資料分析師", salary: "NT$ 60,000-90,000/月", skills: "DATA / PANDAS / Matplotlib" },
              { position: "資料工程師", salary: "NT$ 80,000-120,000/月", skills: "DATA / Numpy / Selenium" },
              { position: "機器學習工程師", salary: "NT$ 90,000-130,000/月", skills: "Model Training / Feature Engineering" },
              { position: "深度學習工程師", salary: "NT$ 110,000-150,000/月", skills: "PyTorch / Neural Networks" },
              { position: "AI 顧問", salary: "NT$ 120,000-200,000/月", skills: "Business Case Design / AI Strategy" },
              { position: "AI Director 總監", salary: "NT$ 250,000-450,000/月", skills: "全部技能 + 團隊管理 + 技術決策" },
            ],
            freelanceInfo: [
              { type: "爬蟲 / 資料分析", income: "NT$ 5,000-10,000" },
              { type: "模型訓練 / 架構建立", income: "NT$ 10,000-100,000" },
              { type: "自動化 / 系統架構專案", income: "NT$ 100,000-500,000+" },
            ],
          },
        ],
      },
      {
        id: "webdev",
        title: "網站開發領域知識",
        icon: "🌐",
        description: "Web 開發核心知識 — 前端、後端、全端完整說明",
        topics: [
          {
            id: "web-what",
            title: "網站開發是什麼？",
            content: [
              "Web 是數位世界的基礎建設 + 商業自動化工具 + 24小時不打烊的業務員。",
              "前端（Frontend）：使用者看得到的部分 — HTML(結構)、CSS(樣式)、JavaScript(靈魂)。網站的「面子」。",
              "後端（Backend）：處理看不見的邏輯 — Python(Django/FastAPI)、Node.js。網站的「大腦」。",
              "日常應用：社群平台、訂票系統、外送App、網銀系統、公司內部管理系統。",
            ],
          },
          {
            id: "web-how",
            title: "開發流程",
            content: [
              "介面製作 → 切版實作 → 串接API → 資料庫管理 → 部署上線",
              "前端框架：React（功能強大、組件化）、Vue（上手簡單、易讀性高）",
              "後端技術：Python + Django/FastAPI、Node.js + Express",
              "資料庫：SQL（MySQL，規則嚴謹適合銀行/訂單）、NoSQL（MongoDB，格式自由適合社群/廣告）",
              "部署：Docker + AWS/GCP + CI/CD 自動化",
            ],
          },
          {
            id: "web-examples",
            title: "實際應用案例",
            examples: [
              { scenario: "想賣東西不被平台抽成", solution: "建立品牌官網 + 購物車系統" },
              { scenario: "想自動化預約客戶", solution: "做出線上預約月曆串接 Google 日曆" },
              { scenario: "公司報表混亂", solution: "開發內部數據儀表板" },
              { scenario: "想打造數位工具", solution: "製作像 Notion 或 Trello 的協作軟體" },
              { scenario: "想讓服務結合 AI", solution: "製作網頁版 AI 助理介面" },
            ],
            content: [],
          },
          {
            id: "web-salary",
            title: "薪資與接案行情",
            content: [],
            salaryInfo: [
              { position: "前端工程師", salary: "NT$ 70,000-100,000/月", skills: "HTML/CSS/RWD/JS/React" },
              { position: "後端工程師", salary: "NT$ 85,000-130,000/月", skills: "Node.js/Express/API/資料庫" },
              { position: "全端工程師", salary: "NT$ 100,000-150,000/月", skills: "部署/雲端/高併發/安全架構" },
              { position: "Web 架構師", salary: "NT$ 200,000-400,000/月", skills: "全部 + 團隊管理 + 技術決策" },
            ],
            freelanceInfo: [
              { type: "網頁製作 (Landing Page)", income: "NT$ 1,000/頁" },
              { type: "電商平台 / 應用功能網站", income: "NT$ 50,000-100,000" },
              { type: "客製化系統（含會員/金流/後台）", income: "NT$ 100,000-500,000+" },
            ],
          },
        ],
      },
    ],
  },

  // ===================== nSchool 財經學院 =====================
  {
    brandId: "nschool",
    sections: [
      {
        id: "finance-basics",
        title: "財經基礎知識",
        icon: "📈",
        description: "投資理財核心概念 — 基本面、技術面、籌碼面",
        topics: [
          {
            id: "fundamental",
            title: "基本面分析",
            content: [
              "基本面分析是研究公司的財務狀況、營運能力、產業前景來判斷股票價值。",
              "核心指標：EPS（每股盈餘）、PE（本益比）、ROE（股東權益報酬率）、營收成長率。",
              "業務角度：客戶最常問「現在買什麼好？」→ 用基本面思維回答：好公司 + 好價格 = 好投資。",
            ],
          },
          {
            id: "technical",
            title: "技術面分析",
            content: [
              "技術面是透過股價走勢圖表來判斷買賣時機。",
              "核心工具：K棒（紅漲綠跌）、均線（MA5/MA20/MA60）、成交量。",
              "業務角度：很多客戶說「我會看一點技術線」但其實不太會 → 用 10%/-10% 考題測試理解。",
            ],
          },
          {
            id: "chip",
            title: "籌碼面分析",
            content: [
              "籌碼面是追蹤「誰在買、誰在賣」來判斷趨勢。",
              "核心概念：三大法人（外資/投信/自營商）、融資融券、主力買賣超。",
              "業務角度：客戶常說「我朋友報的牌」→ 籌碼面就是看「聰明錢」在哪，不用靠朋友。",
            ],
          },
        ],
      },
    ],
  },

  // ===================== XUEMI 學米 =====================
  {
    brandId: "xuemi",
    sections: [
      {
        id: "design-dev",
        title: "設計與開發知識",
        icon: "🎨",
        description: "UI/UX 設計與前後端開發核心概念",
        topics: [
          {
            id: "uiux",
            title: "UI/UX 設計",
            content: [
              "UI（User Interface）= 介面設計：按鈕長什麼樣、顏色搭配、排版。",
              "UX（User Experience）= 使用者體驗：用起來順不順、流程合不合理、會不會迷路。",
              "工具：Figma（業界主流）、Adobe XD、Sketch。",
              "業務角度：客戶想轉職設計 → 強調作品集是關鍵，課程有專案可以直接放進作品集。",
            ],
          },
          {
            id: "frontend",
            title: "前端開發",
            content: [
              "前端 = 使用者看到的一切：網頁畫面、按鈕互動、動畫效果。",
              "核心技術：HTML + CSS + JavaScript → React/Vue 框架。",
              "就業市場：前端工程師是需求量最大的技術職缺之一。",
            ],
          },
          {
            id: "backend",
            title: "後端開發",
            content: [
              "後端 = 看不見的邏輯：會員系統、資料庫、API 串接。",
              "核心技術：Node.js + Express 或 Python + Django/FastAPI。",
              "全端 = 前端 + 後端都會 → 薪資更高、就業彈性更大。",
            ],
          },
        ],
      },
    ],
  },

  // ===================== AIschool AI 未來學院 =====================
  {
    brandId: "aischool",
    sections: [
      {
        id: "ai-tools",
        title: "AI 工具應用知識",
        icon: "🤖",
        description: "AI 工具實戰與商業應用核心概念",
        topics: [
          {
            id: "llm",
            title: "大型語言模型 (LLM)",
            content: [
              "LLM = 大型語言模型，像是 ChatGPT、Claude、Gemini 背後的技術。",
              "應用：文案生成、客服自動化、知識問答、程式碼生成。",
              "業務角度：客戶最常問「ChatGPT 免費的不就好了？」→ 免費版有限制，企業應用需要客製化。",
            ],
          },
          {
            id: "automation",
            title: "AI 自動化",
            content: [
              "AI + 自動化 = 讓重複性工作由機器處理。",
              "常見應用：自動生成報告、郵件分類、庫存預測、品質檢測。",
              "工具：Make、Zapier、n8n + AI API 串接。",
            ],
          },
          {
            id: "business-ai",
            title: "AI 商業應用",
            content: [
              "行銷：AI 文案生成、社群管理、廣告投放優化。",
              "客服：AI 聊天機器人、智能工單分類、情緒分析。",
              "數據：商業智能儀表板、銷售預測、客戶行為分析。",
              "業務角度：老闆最在意 ROI → 用具體案例說明「省多少人力」「提升多少效率」。",
            ],
          },
        ],
      },
    ],
  },
];

export function getKnowledgeForBrand(brandId: string): BrandKnowledge | undefined {
  return brandKnowledgeData.find((k) => k.brandId === brandId);
}
