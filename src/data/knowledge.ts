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
  /** 心理學記憶技巧 / 圖像化說明 */
  memoryTips?: string[];
  /** 補充影片連結 */
  videoLinks?: { title: string; url: string; duration?: string }[];
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
        id: "commercial-design",
        title: "商業設計",
        icon: "🎨",
        description: "平面設計、品牌視覺、商業攝影",
        topics: [
          {
            id: "design-overview",
            title: "商業設計是什麼？",
            content: [
              "商業設計 = 用視覺幫品牌說故事。舉凡你看到的 Logo、包裝、廣告海報、名片、社群貼文，都是商業設計的範疇。",
              "跟藝術不同，商業設計的目的是「讓客戶買單」。好的設計 = 消費者看到就想點、想買、想分享。",
              "OOschool 的教練制模式：不是看影片自學，而是有業界設計師 1 對 1 帶你做專案，做出來的東西直接放作品集。",
            ],
          },
          {
            id: "design-jobs",
            title: "工作機會與薪資",
            content: [
              "📌 工作需要：平面設計師、品牌視覺設計師、社群設計師、包裝設計師",
              "🛠️ 需要技能：Photoshop、Illustrator、InDesign、品牌識別系統、排版美學、印刷知識",
              "⏰ 學習時間：3-6 個月可入行（有作品集即可面試），1 年熟練",
            ],
            memoryTips: [
              "🧠【圖像記憶】把設計工具想成廚房器具：Photoshop = 食物調理機（處理照片）、Illustrator = 模具（畫向量圖形）、InDesign = 擺盤（排版出版物）",
              "🎯【錨定效應】跟客戶說薪資時，先說設計總監 15 萬，再說 Junior 3.2 萬起。客戶會覺得「成長空間好大」，更有動力投資自己。",
            ],
            videoLinks: [
              { title: "薛零六 — Illustrator 入門完整教學", url: "https://www.youtube.com/results?search_query=薛零六+Illustrator+入門教學", duration: "每集 10-20 分鐘" },
              { title: "巨匠電腦 — Photoshop 基礎教學", url: "https://www.youtube.com/results?search_query=Photoshop+入門教學+中文+2025", duration: "約 20 分鐘" },
            ],
            salaryInfo: [
              { position: "平面設計師（Junior）", salary: "NT$ 32,000-42,000/月", skills: "PS/AI/排版" },
              { position: "品牌視覺設計師", salary: "NT$ 42,000-60,000/月", skills: "品牌識別/CIS" },
              { position: "資深設計師/AD", salary: "NT$ 60,000-90,000/月", skills: "團隊管理/提案" },
              { position: "設計總監", salary: "NT$ 90,000-150,000/月", skills: "策略/品牌規劃" },
            ],
            freelanceInfo: [
              { type: "Logo 設計", income: "NT$ 5,000-30,000/案" },
              { type: "社群圖 / 海報設計", income: "NT$ 1,000-5,000/張" },
              { type: "品牌整體視覺（CIS）", income: "NT$ 30,000-150,000/案" },
              { type: "包裝設計", income: "NT$ 10,000-50,000/案" },
            ],
          },
          {
            id: "design-story",
            title: "實戰案例",
            content: [],
            examples: [
              { scenario: "客戶說「設計要有天份吧？」", solution: "「設計是技能，不是天份。我們有學員是倉管出身，學了 4 個月後接到第一個 Logo 案子賺了 8000 元。商業設計有公式——配色有理論、排版有規則，教練會一步一步教你。」" },
              { scenario: "客戶問「學設計找得到工作嗎？」", solution: "「104 上設計相關職缺超過 5000 個。重點是作品集，不是學歷。我們的教練會帶你做 3-5 個業界水準的專案，直接拿去面試。有學員結業後一週就拿到 offer。」" },
              { scenario: "客戶說「我想接案但不知道從哪開始」", solution: "「很多人先從朋友的案子開始——幫朋友設計名片、社群圖。建立口碑後就會有轉介。我們教練也會教你怎麼在接案平台上架、怎麼報價、怎麼跟客戶溝通。」" },
            ],
          },
        ],
      },
      {
        id: "influencer",
        title: "網紅多媒體",
        icon: "📹",
        description: "影片剪輯、自媒體經營、內容創作",
        topics: [
          {
            id: "influencer-overview",
            title: "網紅多媒體是什麼？",
            content: [
              "這個領域涵蓋影片剪輯、YouTube/短影音經營、Podcast 製作、直播等。現在每間公司都需要會做影片的人。",
              "不是只有當網紅才需要這技能——行銷部門、電商、品牌公關、教育機構都大量需要影音人才。",
              "核心能力：拍攝、剪輯（Premiere Pro/Final Cut）、腳本企劃、社群經營、數據分析。",
            ],
          },
          {
            id: "influencer-jobs",
            title: "工作機會與薪資",
            content: [
              "📌 工作需要：影片剪輯師、社群企劃、內容創作者、短影音專員、直播企劃",
              "🛠️ 需要技能：Premiere Pro、After Effects、腳本撰寫、社群數據分析、基礎攝影",
              "⏰ 學習時間：2-4 個月可接案，6 個月可轉職",
            ],
            salaryInfo: [
              { position: "影片剪輯師", salary: "NT$ 30,000-45,000/月", skills: "Pr/AE/剪輯" },
              { position: "社群企劃/短影音專員", salary: "NT$ 35,000-50,000/月", skills: "腳本/拍攝/數據" },
              { position: "資深影音製作", salary: "NT$ 50,000-75,000/月", skills: "動態設計/專案管理" },
              { position: "內容總監", salary: "NT$ 75,000-120,000/月", skills: "策略/團隊/品牌" },
            ],
            freelanceInfo: [
              { type: "短影音剪輯（Reels/TikTok）", income: "NT$ 1,500-5,000/支" },
              { type: "YouTube 影片剪輯", income: "NT$ 3,000-15,000/支" },
              { type: "企業形象影片", income: "NT$ 20,000-100,000/案" },
              { type: "婚禮/活動紀錄", income: "NT$ 10,000-50,000/場" },
            ],
          },
        ],
      },
      {
        id: "product-design",
        title: "產品設計",
        icon: "🖥️",
        description: "UI/UX 設計、App 介面、產品規劃",
        topics: [
          {
            id: "uiux-overview",
            title: "UI/UX 產品設計是什麼？",
            content: [
              "UI = 介面長什麼樣（按鈕、配色、排版）。UX = 用起來順不順（流程、邏輯、體驗）。",
              "產品設計師 = UI + UX + 商業思維。不只是畫圖，還要理解用戶需求和商業目標。",
              "主要工具：Figma（業界主流，免費好上手）、Sketch、Adobe XD。",
            ],
          },
          {
            id: "uiux-jobs",
            title: "工作機會與薪資",
            content: [
              "📌 工作需要：UI 設計師、UX 設計師、產品設計師、互動設計師",
              "🛠️ 需要技能：Figma、使用者研究、Wireframe、Prototype、Design System",
              "⏰ 學習時間：4-6 個月（需累積 3-5 個作品集專案）",
            ],
            memoryTips: [
              "🧠【故事記憶法】UI vs UX 怎麼分？想像你去餐廳——UI 是菜單的排版和裝潢（看起來漂不漂亮），UX 是點餐流程順不順暢（等多久、服務好不好、會不會迷路找不到廁所）。",
              "🎯【對比記憶】Figma vs Canva：Canva 像超商便當（快速方便但都差不多），Figma 像廚師做菜（客製化、專業、能賣高價）。",
              "💡【數字錨點】記住這組數字：3-5-50。3 個月學工具、5 個作品集專案、50K 起薪。跟客戶講這組數字超好用。",
            ],
            videoLinks: [
              { title: "犬哥網站 — Figma 完整中文教學", url: "https://www.youtube.com/results?search_query=犬哥+Figma+教學", duration: "每集 20-30 分鐘" },
              { title: "Figma 官方教學", url: "https://www.youtube.com/@Figma", duration: "每集 5-20 分鐘" },
            ],
            salaryInfo: [
              { position: "UI 設計師", salary: "NT$ 38,000-55,000/月", skills: "Figma/視覺設計" },
              { position: "UX 設計師", salary: "NT$ 45,000-70,000/月", skills: "用戶研究/原型" },
              { position: "產品設計師（Sr.）", salary: "NT$ 70,000-100,000/月", skills: "產品策略/系統" },
              { position: "設計主管/Head", salary: "NT$ 100,000-160,000/月", skills: "團隊/策略/流程" },
            ],
            freelanceInfo: [
              { type: "App UI 設計", income: "NT$ 30,000-100,000/案" },
              { type: "網站 UI/UX 設計", income: "NT$ 20,000-80,000/案" },
              { type: "Design System 建置", income: "NT$ 50,000-200,000/案" },
            ],
            examples: [
              { scenario: "客戶說「設計不是要美術系嗎？」", solution: "「UI/UX 不是畫畫，是邏輯思維 + 同理心。104 上 UI/UX 職缺超過 3000 個，面試看的是作品集不是學歷。我們有學員是工廠作業員，4 個月後做出旅遊 App UI，直接拿到 offer。」" },
              { scenario: "客戶問「Canva 不就能做設計了？」", solution: "「Canva 做社群圖，UI/UX 做的是 App 和網站介面——完全不同層級。一個 Canva 模板幾百塊，一個 App 介面設計案 5-20 萬。」" },
            ],
          },
        ],
      },
      {
        id: "ai-coding",
        title: "AI 程式設計",
        icon: "🤖",
        description: "Python、AI 應用、資料分析、機器學習",
        topics: [
          {
            id: "python-overview",
            title: "Python 與 AI 是什麼？",
            content: [
              "Python 是目前最熱門的程式語言，語法簡單、應用超廣：資料分析、AI、爬蟲、自動化、後端開發。",
              "一句話：Python 是軟體世界的瑞士刀——什麼都能做，而且上手門檻最低。",
              "OOschool 的 AI 程式課程包含 160+ 小時影音內容，加上無限次 1 對 1 教練指導，從零到能找工作。",
            ],
          },
          {
            id: "python-jobs",
            title: "工作機會與薪資",
            content: [
              "📌 工作需要：資料分析師、AI 工程師、後端工程師、自動化工程師、資料科學家",
              "🛠️ 需要技能：Python、pandas、NumPy、SQL、機器學習（scikit-learn）、深度學習（PyTorch）",
              "⏰ 學習時間：3-6 個月可入行資料分析，6-12 個月可轉職 AI/後端工程師",
            ],
            memoryTips: [
              "🧠【比喻記憶】Python 像樂高積木——你用簡單的小方塊（語法）拼出超複雜的東西（AI、網站、自動化）。別的程式語言像手工雕刻，Python 像樂高。",
              "🎯【漏斗記憶法】Python 的職涯路徑想成金字塔：底層最多人（資料分析 5-8 萬）→ 中層（AI/後端 7-12 萬）→ 頂層最少人最高薪（AI 總監 20 萬+）。越往上技能越稀缺、薪水越高。",
              "💡【類比法跟客戶溝通】「Python 是軟體界的英文——全世界都在用，而且是最好學的語言。就像你不需要背 5000 個單字也能跟老外溝通，Python 幾行程式碼就能做出很厲害的東西。」",
            ],
            videoLinks: [
              { title: "我阿嬤都會 — 4小時 Python 完整入門", url: "https://www.youtube.com/watch?v=zdMUJJKFdsU", duration: "4 小時" },
              { title: "彭彭的課程 — Python 入門教學系列", url: "https://www.youtube.com/watch?v=wqRlKVRUV_k&list=PL-g0fdC5RMboYEyt6QS2iLb_1m7QcgfHk", duration: "每集 10-20 分鐘" },
            ],
            salaryInfo: [
              { position: "資料分析師", salary: "NT$ 50,000-80,000/月", skills: "Python/SQL/報表" },
              { position: "後端工程師", salary: "NT$ 55,000-90,000/月", skills: "Django/FastAPI/API" },
              { position: "AI 工程師", salary: "NT$ 70,000-120,000/月", skills: "ML/DL/模型部署" },
              { position: "資料科學家", salary: "NT$ 80,000-140,000/月", skills: "統計/建模/洞察" },
              { position: "AI 技術主管", salary: "NT$ 120,000-200,000/月", skills: "團隊/架構/策略" },
            ],
            freelanceInfo: [
              { type: "資料爬蟲 / 清洗", income: "NT$ 5,000-20,000/案" },
              { type: "自動化腳本開發", income: "NT$ 10,000-50,000/案" },
              { type: "AI 模型開發專案", income: "NT$ 50,000-300,000/案" },
              { type: "資料儀表板建置", income: "NT$ 20,000-100,000/案" },
            ],
            examples: [
              { scenario: "客戶說「寫程式很難吧？」", solution: "「Python 被設計成『像英文一樣好讀』。我們有學員是護士，完全零基礎，3 個月就學會用 Python 自動整理排班表。重點是有教練帶，卡住了馬上問，不用自己撞牆。」" },
              { scenario: "客戶問「學 Python 真的能轉職嗎？」", solution: "「AI 相關職缺年增 38%，中位年薪 80 萬。我們有學員從行政轉資料分析師，薪水從 3 萬跳到 5.5 萬。關鍵是你有沒有實際專案經驗，這就是教練制的優勢——帶你做真實專案。」" },
            ],
          },
        ],
      },
      {
        id: "webdev",
        title: "網站開發",
        icon: "🌐",
        description: "前端、後端、全端工程師養成",
        topics: [
          {
            id: "webdev-overview",
            title: "網站開發是什麼？",
            content: [
              "前端 = 你看到的（畫面、按鈕、動畫）。後端 = 看不到的（資料庫、邏輯、API）。全端 = 兩個都會。",
              "每間公司都需要網站。電商、訂票、外送、網銀、內部系統⋯⋯全部都是 Web 開發的範疇。",
              "前端技術：HTML + CSS + JavaScript → React/Vue。後端：Node.js / Python + 資料庫。",
            ],
          },
          {
            id: "webdev-jobs",
            title: "工作機會與薪資",
            content: [
              "📌 工作需要：前端工程師、後端工程師、全端工程師、Web 架構師",
              "🛠️ 需要技能：HTML/CSS/JS → React/Vue（前端）；Node.js/Python + SQL/NoSQL（後端）",
              "⏰ 學習時間：前端 3-5 個月可求職，全端 6-10 個月",
            ],
            salaryInfo: [
              { position: "前端工程師", salary: "NT$ 45,000-75,000/月", skills: "React/Vue/RWD" },
              { position: "後端工程師", salary: "NT$ 55,000-90,000/月", skills: "API/資料庫/部署" },
              { position: "全端工程師", salary: "NT$ 65,000-110,000/月", skills: "前端+後端+DevOps" },
              { position: "Web 技術主管", salary: "NT$ 110,000-180,000/月", skills: "架構/團隊/決策" },
            ],
            freelanceInfo: [
              { type: "Landing Page", income: "NT$ 5,000-20,000/頁" },
              { type: "企業官網", income: "NT$ 30,000-100,000/案" },
              { type: "電商網站 / Web App", income: "NT$ 80,000-300,000/案" },
              { type: "客製化系統（會員/金流/後台）", income: "NT$ 100,000-500,000/案" },
            ],
          },
        ],
      },
      {
        id: "success-stories",
        title: "學員成功故事",
        icon: "⭐",
        description: "OOschool 學員轉職實例",
        topics: [
          {
            id: "stories",
            title: "真實案例分享",
            content: [
              "【倉管 → 平面設計師】阿偉在物流公司當倉管 6 年，月薪 2.8 萬。利用下班時間學商業設計，4 個月做出 5 個作品集專案。教練幫他模擬面試 3 次，結業後進了一間行銷公司當設計師，月薪 4.2 萬。他說：「教練比補習班老師好太多，每次都針對我的弱點給建議。」",
              "【餐飲業 → 前端工程師】小凱在餐廳當廚師 4 年，決定轉職。從零學 HTML/CSS/JS，教練每週 1 對 1 帶他做專案。6 個月後進入新創公司，月薪 5 萬，一年後加薪到 6.5 萬。他說：「最難的是前兩週，但教練一直鼓勵我。」",
              "【全職媽媽 → 遠端接案設計師】美玲離開職場 8 年，學了 UI/UX 設計後從遠端接案開始。現在每月穩定接到 3-5 個案子，月收入 4-6 萬，同時照顧兩個小孩。她說：「不用進辦公室也能養活自己，這是最大的改變。」",
              "【行政 → AI 資料分析師】小芳當行政 5 年月薪 3.2 萬，學了 Python + 資料分析後，轉職到科技公司當資料分析師，月薪 5.5 萬。她說：「以前覺得寫程式是天才的事，其實有教練帶完全不一樣。」",
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
        title: "投資理財知識",
        icon: "📈",
        description: "股票、ETF、技術面、基本面、籌碼面",
        topics: [
          {
            id: "fundamental",
            title: "基本面分析",
            content: [
              "基本面 = 研究公司的「體質」好不好。就像買房子要看地段、屋況，買股票要看公司賺不賺錢。",
              "📌 核心指標：EPS（每股盈餘）→ 公司幫你賺多少錢 / PE（本益比）→ 股價貴不貴 / ROE（股東報酬率）→ 公司用你的錢賺錢的效率",
              "🛠️ 需要技能：看懂財報三表（損益表、資產負債表、現金流量表）、計算 PE/PB、判斷成長股 vs 價值股",
              "⏰ 學習時間：1-2 個月可學會基礎選股，3-6 個月建立完整分析能力",
            ],
            memoryTips: [
              "🧠【體檢報告比喻】財報就像公司的「體檢報告」——損益表 = 你今年賺多少（收入）、資產負債表 = 你有多少家當和欠多少錢（資產 vs 負債）、現金流量表 = 你口袋裡真的有多少現金（流動性）。",
              "🎯【記憶公式】PE = 股價 ÷ EPS。想像成「要幾年回本」。PE 20 倍 = 用現在的獲利要 20 年才賺回來。PE 越低越「便宜」（但也可能代表沒人看好）。",
              "💡【巴菲特名言法】跟客戶溝通可以用這句：「巴菲特說：『用合理的價格買進好公司，勝過用便宜的價格買進普通公司。』基本面就是教你分辨什麼是好公司。」",
              "📊【3 個關鍵數字】跟客戶強調記住 3 個指標就好：EPS > 3（會賺錢）、ROE > 15%（效率高）、PE < 20（不太貴）。這是入門篩選的黃金三角。",
            ],
            videoLinks: [
              { title: "慢活夫妻 — 基本面分析 15 個必看指標", url: "https://www.youtube.com/results?search_query=慢活夫妻+基本面分析+指標", duration: "20-30 分鐘" },
              { title: "柴鼠兄弟 — 股票入門 FQ 系列", url: "https://www.youtube.com/results?search_query=柴鼠兄弟+股票入門", duration: "每集 10-15 分鐘" },
            ],
            examples: [
              { scenario: "客戶問「台積電現在可以買嗎？」", solution: "「我們不報明牌。但你知道怎麼用 PE 判斷嗎？台積電 PE 在 20 倍左右，代表用現在的獲利要 20 年回本。我們教你自己判斷『值不值得等 20 年』這件事。」" },
              { scenario: "客戶說「看新聞買股票」", solution: "「新聞出來的時候，法人早就佈局好了。基本面分析讓你走在新聞前面——看懂財報就知道哪些公司明年會大賺。」" },
              { scenario: "客戶說「投資很難，數學不好」", solution: "「基本面只需要加減乘除。PE = 股價 ÷ EPS，這就是判斷貴不貴的公式。我們學員有護士、老師、業務，各行各業都有。」" },
            ],
          },
          {
            id: "technical",
            title: "技術面分析",
            content: [
              "技術面 = 看股價走勢圖來判斷「什麼時候買、什麼時候賣」。基本面選股，技術面選時。",
              "📌 核心工具：K 棒（紅漲綠跌）、均線（MA5/MA20/MA60）、成交量、RSI、MACD、布林通道",
              "🛠️ 需要技能：看懂 K 線型態、判斷支撐壓力、設定停損停利、辨識趨勢",
              "⏰ 學習時間：2-3 個月學會基礎看盤，6 個月能獨立操作",
            ],
            memoryTips: [
              "🧠【天氣預報比喻】技術分析就像看天氣圖——K 線是今天的天氣（晴、雨）、均線是氣候趨勢（春夏秋冬）、成交量是風力大小。三個合在一起看，才能判斷明天會不會下雨。",
              "🎯【紅綠燈記憶法】均線系統想成紅綠燈：股價在均線上方 = 綠燈（可以考慮買）、均線走平 = 黃燈（觀望）、股價在均線下方 = 紅燈（注意風險）。",
              "💡【手勢記憶】K 棒怎麼看？紅色 = 收漲（想像紅包，賺錢開心）。上影線長 = 「有人在上面壓」（想像天花板）。下影線長 = 「有人在下面撐」（想像地板）。",
            ],
            videoLinks: [
              { title: "慢活夫妻 — K 線怎麼看？7 大型態", url: "https://www.youtube.com/results?search_query=慢活夫妻+K線怎麼看", duration: "15-25 分鐘" },
              { title: "柴鼠兄弟 — 技術分析入門系列", url: "https://www.youtube.com/results?search_query=柴鼠兄弟+技術分析+K線", duration: "每集 10-15 分鐘" },
            ],
            examples: [
              { scenario: "客戶說「我有在看 K 線」", solution: "「那紅 K 上影線很長代表什麼？看得懂跟看得對差很多。我們教你不只看線，還能判斷主力在幹嘛。」" },
              { scenario: "客戶問「什麼時候進場」", solution: "「股價站上 20 日均線 + 量增，就是短線多頭訊號。但這只是入門，進階還有 MACD 金叉、RSI 背離，課程都會教。」" },
            ],
          },
          {
            id: "chip",
            title: "籌碼面分析",
            content: [
              "籌碼面 = 追蹤「聰明錢」在哪裡。不用聽明牌，直接看大戶在買什麼。",
              "📌 核心概念：三大法人（外資/投信/自營商）買賣超、融資融券變化、主力進出",
              "🛠️ 需要技能：解讀法人買賣超、判斷主力吃貨/倒貨、融資融券判讀",
              "⏰ 學習時間：1-2 個月學會基本追蹤，3 個月能搭配技術面使用",
            ],
            examples: [
              { scenario: "客戶說「聽朋友報明牌」", solution: "「朋友的消息是二三手的。籌碼面讓你直接看到外資和投信在買什麼——這才是真正的聰明錢。」" },
              { scenario: "客戶問「怎麼知道主力在哪」", solution: "「每天收盤後三大法人買賣超都是公開的。外資連 5 天買超同一檔股票代表什麼？這就是我們教的實戰技巧。」" },
            ],
          },
          {
            id: "etf-strategy",
            title: "ETF 投資策略",
            content: [
              "ETF = 一籃子股票的組合包。0050 就是台灣前 50 大公司的集合。最適合新手入門。",
              "📌 常見 ETF：0050（台灣50）/ 0056（高股息）/ 00878（國泰永續高息）/ 美股 VOO、QQQ",
              "🛠️ 需要技能：定期定額 vs 擇時策略、配息再投入、資產配置觀念",
              "⏰ 學習時間：1 個月就能開始定期定額，3 個月學會進階配置",
              "💰 最低門檻：1 股就能買，幾千元就能開始投資",
            ],
            examples: [
              { scenario: "客戶說「定期定額 0050 就好，不用學」", solution: "「0050 很好！但大跌時加碼、高點時減碼，同樣本金可多賺 20-30%。有學員從純定期定額改用擇時策略，報酬率從 10% 提升到 25%。」" },
            ],
          },
          {
            id: "finance-career",
            title: "投資理財的職涯價值",
            content: [
              "學投資不只是賺錢，更是一種終身技能。市場上的理財相關機會：",
              "📌 工作需要：理財規劃師、證券分析師、投資顧問、基金經理人",
              "🛠️ 需要技能：基本面+技術面+籌碼面分析、資產配置、風險管理、財報解讀",
              "💰 市場薪資：理財規劃師 NT$ 40,000-80,000/月 / 證券分析師 NT$ 60,000-120,000/月",
              "📊 被動收入目標：學會投資後，3-5 年可建立穩定的被動收入來源",
            ],
          },
          {
            id: "nschool-stories",
            title: "學員成功故事",
            content: [
              "【護士小美】月薪 4 萬，錢都放定存。上完課學會基本面選股 + ETF 配置，半年建立 50 萬投資組合，年化報酬 18%。現在開始教同事投資了。",
              "【工程師阿傑】聽明牌虧了 30 萬。來 nSchool 學技術面和籌碼面，用停損紀律和系統化選股，一年回本還多賺 15 萬。「最大改變是不再靠感覺做決定。」",
              "【行政小雯】零基礎、數學差、一開始很害怕。從 ETF 入門，三個月後嘗試個股。現在每月被動收入 3000 元，目標 5 年內每月 2 萬。「投資不難，難的是踏出第一步。」",
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
        id: "design",
        title: "設計領域",
        icon: "🎨",
        description: "UI/UX 設計、平面設計、動畫製作",
        topics: [
          {
            id: "uiux",
            title: "UI/UX 設計",
            content: [
              "UI = 介面長什麼樣（按鈕、配色、排版）。UX = 用起來順不順（流程、邏輯、體驗）。",
              "📌 工作需要：UI 設計師、UX 設計師、產品設計師、互動設計師",
              "🛠️ 需要技能：Figma（業界主流）、使用者研究、Wireframe、Prototype、設計系統",
              "⏰ 學習時間：4-6 個月（需累積 3-5 個作品集專案），學米的 4 師 1 學員制確保不會半途放棄",
              "💰 市場薪資：Junior UI 設計師 NT$ 38,000-50,000/月，Senior UX 設計師 NT$ 60,000-90,000/月",
              "💼 接案行情：App UI 設計 NT$ 30,000-100,000/案、網站 UX 規劃 NT$ 20,000-80,000/案",
            ],
            examples: [
              { scenario: "客戶說「設計要天份」", solution: "「設計 80% 是方法，20% 是美感。我們有學員是工廠作業員，零基礎，4 個月做出旅遊 App UI，直接拿到 offer。作品集決定一切，不是天份。」" },
              { scenario: "客戶說「Canva 就能設計了」", solution: "「Canva 做海報，UI/UX 做的是 App 和網站介面——完全不同等級。Canva 模板幾百塊，一個 App 介面設計案 5-20 萬。」" },
            ],
          },
          {
            id: "graphic",
            title: "平面設計",
            content: [
              "平面設計涵蓋 Logo、海報、名片、包裝、社群圖——每間公司都需要的視覺溝通能力。",
              "📌 工作需要：平面設計師、品牌設計師、包裝設計師、社群視覺設計師",
              "🛠️ 需要技能：Photoshop、Illustrator、InDesign、配色理論、排版、印刷知識",
              "⏰ 學習時間：3-4 個月可開始接案，6 個月可轉職",
              "💰 市場薪資：平面設計師 NT$ 32,000-50,000/月，資深設計師 NT$ 50,000-75,000/月",
              "💼 接案行情：Logo 設計 NT$ 5,000-30,000/案、品牌 CIS NT$ 30,000-150,000/案",
            ],
          },
          {
            id: "animation",
            title: "2D/3D 動畫",
            content: [
              "動畫不只是卡通——廣告動態、產品展示、MG 動畫、遊戲特效都是動畫領域。",
              "📌 工作需要：動態設計師（Motion Designer）、3D 建模師、動畫師、特效師",
              "🛠️ 需要技能：After Effects（2D 動態）、Cinema 4D / Blender（3D）、Spine（遊戲動畫）",
              "⏰ 學習時間：2D 動態 3-4 個月上手，3D 建模 6-8 個月",
              "💰 市場薪資：動態設計師 NT$ 40,000-65,000/月，3D 建模師 NT$ 45,000-80,000/月",
              "💼 接案行情：MG 動畫 NT$ 5,000-30,000/支、3D 產品渲染 NT$ 10,000-50,000/案",
            ],
          },
        ],
      },
      {
        id: "dev",
        title: "開發領域",
        icon: "💻",
        description: "前端開發、Python、影音自媒體",
        topics: [
          {
            id: "frontend",
            title: "前端開發",
            content: [
              "前端工程師 = 打造使用者看到的一切。網頁畫面、按鈕互動、動畫效果、手機適配。",
              "📌 工作需要：前端工程師、React/Vue 開發者、Web App 開發",
              "🛠️ 需要技能：HTML + CSS + JavaScript → React 或 Vue 框架 → TypeScript",
              "⏰ 學習時間：3-5 個月可求職（學米有 4 師指導，完成率高達 93%）",
              "💰 市場薪資：Junior NT$ 40,000-55,000/月，Mid NT$ 55,000-80,000/月，Senior NT$ 80,000-120,000/月",
              "💼 接案行情：Landing Page NT$ 5,000-20,000/頁、企業官網 NT$ 30,000-100,000/案",
            ],
            memoryTips: [
              "🧠【房子比喻】網站像蓋房子：HTML = 磚塊結構、CSS = 油漆裝潢、JavaScript = 電路水管（讓東西能動）。三個合在一起 = 一間完整的房子。React = 預鑄工法，蓋得更快更標準。",
              "🎯【薪資成長故事】跟客戶強調：「前端起薪 4 萬不算高，但成長超快。因為你做的東西看得見，老闆秒懂你的價值。很多人 1-2 年就從 4 萬跳到 7 萬。」",
            ],
            videoLinks: [
              { title: "彭彭的課程 — 前端/JavaScript 入門", url: "https://www.youtube.com/results?search_query=彭彭+JavaScript+入門+教學", duration: "每集 10-15 分鐘" },
              { title: "六角學院 — React 入門教學", url: "https://www.youtube.com/results?search_query=六角學院+React+入門", duration: "約 20-30 分鐘" },
            ],
            examples: [
              { scenario: "客戶說「寫程式很難」", solution: "「我們有文組英文系學員，之前當行政月薪 3 萬，學了 5 個月進新創當前端，月薪 5.5 萬。最難的是前兩週，之後越來越上手。有顧問帶差很多。」" },
              { scenario: "客戶問「前端好還是後端好？」", solution: "「喜歡看到成果選前端——做出漂亮網頁很有成就感。喜歡邏輯思考選後端。不確定就先前端——上手快、需求大。」" },
            ],
          },
          {
            id: "python",
            title: "Python 程式設計",
            content: [
              "Python = 最適合新手的程式語言，語法像英文，學一次可以用在非常多領域。",
              "📌 工作需要：資料分析師、後端工程師、爬蟲工程師、自動化工程師",
              "🛠️ 需要技能：Python 基礎語法、pandas、SQL、API 串接、機器學習入門",
              "⏰ 學習時間：2-4 個月學會基礎應用，6 個月可轉職資料分析師",
              "💰 市場薪資：資料分析師 NT$ 50,000-80,000/月，後端工程師 NT$ 55,000-90,000/月",
              "💼 接案行情：資料爬蟲 NT$ 5,000-20,000/案、自動化腳本 NT$ 10,000-50,000/案",
            ],
          },
          {
            id: "video",
            title: "影音 / 自媒體",
            content: [
              "現在每間公司都缺會做影片的人。短影音爆發讓影片剪輯師成為超搶手職缺。",
              "📌 工作需要：影片剪輯師、短影音創作者、社群企劃、自媒體經營者",
              "🛠️ 需要技能：Premiere Pro、After Effects、腳本撰寫、社群數據分析",
              "⏰ 學習時間：2-3 個月可接案，4-6 個月可轉職",
              "💰 市場薪資：剪輯師 NT$ 30,000-45,000/月，資深影音製作 NT$ 50,000-75,000/月",
              "💼 接案行情：短影音 NT$ 1,500-5,000/支、YouTube 剪輯 NT$ 3,000-15,000/支、形象影片 NT$ 20,000-100,000/案",
            ],
          },
        ],
      },
      {
        id: "xuemi-stories",
        title: "學員成功故事",
        icon: "⭐",
        description: "學米學員轉職實例",
        topics: [
          {
            id: "xuemi-success",
            title: "真實案例分享",
            content: [
              "【行政 → UI 設計師】小芳在保險公司當行政 5 年月薪 3.2 萬。4 師 1 學員制讓她下班也能學，4 個月做出作品集，面試官說「比科班的還紮實」，月薪直接跳到 4.8 萬。",
              "【廚師 → 前端工程師】阿凱在餐廳當廚師，從零學 HTML/CSS/JS。學米的導師每週檢視他的進度，6 個月後接到第一個案子賺了 3 萬。現在正職 + 接案月收超過 7 萬。",
              "【全職媽媽 → 遠端接案】美玲離開職場 8 年，學了前端後從遠端接案開始。照顧小孩的同時每月穩定收入 4 萬。她說：「學米的完成率 93% 不是說假的，4 個老師盯著你，想偷懶都難。」",
              "【上班族 → 動態設計師】阿偉原本在科技公司當業務，利用週末學 After Effects 動態設計。學米的業界導師幫他對接了第一個案子。3 個月後成功轉職動態設計師，薪水差不多但做的是自己喜歡的事。",
            ],
          },
        ],
      },
    ],
  },

  // ===================== AIschool AI 未來學院（XLAB 進階版）=====================
  {
    brandId: "aischool",
    sections: [
      {
        id: "ai-landing",
        title: "AI 落地師",
        icon: "🚀",
        description: "104 夯職缺！企業 AI 導入與落地實戰",
        topics: [
          {
            id: "ai-landing-what",
            title: "AI 落地師是什麼？",
            content: [
              "AI 落地師 = 讓 AI 從「聽過」變成「用在工作上」的專業人才。現在 104 上最夯的新職缺！",
              "不是要你寫程式、訓練模型，而是要你懂得：分析企業痛點 → 選擇合適 AI 工具 → 設計自動化流程 → 讓公司真正用起來。",
              "AI 未來學院是 XLAB 的進階版。XLAB 教你基礎 AI 自動化（n8n、GAS），AI 未來學院教你成為能獨當一面的 AI 落地專家。",
              "為什麼現在很夯？因為企業都知道要用 AI，但不知道怎麼用。會把 AI 「落地」到業務流程的人，市場上嚴重缺乏。",
            ],
          },
          {
            id: "ai-landing-jobs",
            title: "工作機會與薪資",
            content: [
              "📌 工作需要：AI 落地師、AI 應用規劃師、數位轉型顧問、AI 專案經理、企業 AI 教練",
              "🛠️ 需要技能：n8n 自動化、GAS 腳本、AI 工具串接、流程設計、需求分析、專案管理",
              "⏰ 學習時間：2-3 個月學會基礎（XLAB 階段），4-6 個月可獨立接案或轉職（AI 未來學院）",
              "📊 市場趨勢：AI 相關職缺年增 38%，中位年薪 80 萬（104 數據），75% 企業願意為 AI 人才加薪 9.5%",
            ],
            memoryTips: [
              "🧠【橋樑比喻】AI 落地師 = 老闆和 AI 之間的「翻譯官」。老闆說「我要省人力」，你翻譯成 AI 能懂的自動化流程。技術人說「這個模型準確率 95%」，你翻譯給老闆聽「每月省 5 萬人力成本」。",
              "🎯【稀缺性心理】「AI 落地師現在就像 2005 年的社群行銷人——大家都知道需要，但會的人超少。先學的人直接卡位，等滿街都是的時候就不值錢了。」",
              "💡【記憶口訣】AI 落地 4 步驟：痛（找痛點）→ 選（選工具）→ 做（做流程）→ 教（教員工用）。「痛選做教」，記住這四個字就能跟客戶解釋你在幹嘛。",
              "📊【數據衝擊法】「104 數據：AI 職缺年增 38%、年薪中位數 80 萬、75% 企業願意加薪搶人。這三個數字記起來，跟客戶講超有說服力。」",
            ],
            videoLinks: [
              { title: "AI 自動化企業應用入門", url: "https://www.youtube.com/results?search_query=AI+自動化+企業+n8n+中文", duration: "20-30 分鐘" },
              { title: "雷蒙 — AI 工作流自動化系列", url: "https://www.youtube.com/results?search_query=雷蒙+AI+自動化+工作流", duration: "15-30 分鐘" },
            ],
            salaryInfo: [
              { position: "AI 應用專員", salary: "NT$ 40,000-60,000/月", skills: "AI 工具/自動化基礎" },
              { position: "AI 落地師 / 規劃師", salary: "NT$ 60,000-95,000/月", skills: "n8n/GAS/流程設計" },
              { position: "數位轉型顧問", salary: "NT$ 80,000-130,000/月", skills: "AI 策略/專案管理" },
              { position: "AI 技術總監", salary: "NT$ 120,000-200,000/月", skills: "團隊/架構/商業策略" },
            ],
            freelanceInfo: [
              { type: "企業 AI 自動化導入", income: "NT$ 30,000-100,000/案" },
              { type: "n8n 流程設計 + 建置", income: "NT$ 10,000-50,000/案" },
              { type: "AI 企業培訓（半天）", income: "NT$ 15,000-50,000/場" },
              { type: "AI 數位轉型顧問", income: "NT$ 50,000-200,000/案" },
            ],
            examples: [
              { scenario: "客戶問「AI 落地師到底在幹嘛？」", solution: "「簡單說，老闆想用 AI 省人力但不知道從哪開始，你就是那個幫他搞定的人。你不用寫程式，用 n8n 拖拉就能做出自動化流程。我們有學員幫客戶做了一個自動客服系統，一個案子收了 8 萬。」" },
              { scenario: "客戶說「AI 不是工程師才能學嗎？」", solution: "「AI 落地師重點是『懂業務 + 懂 AI 工具』，不是寫程式。我們 80% 學員是非技術背景——行銷、業務、行政都有。最重要的是你懂得怎麼分析問題、設計流程。」" },
              { scenario: "客戶說「學這個真的有人請嗎？」", solution: "「104 上 AI 相關職缺年增 38%，而且很多公司找不到人。因為這是全新的領域，科班生也沒學過。你現在學，等於搶先卡位。我們有學員學完後直接被老闆指派為公司的 AI 負責人，加薪 20%。」" },
            ],
          },
        ],
      },
      {
        id: "n8n-automation",
        title: "N8N 自動化",
        icon: "⚡",
        description: "XLAB 核心技能 — 企業級工作流程自動化",
        topics: [
          {
            id: "n8n-what",
            title: "n8n 是什麼？",
            content: [
              "n8n（讀作 n-eight-n）= 開源的工作流程自動化工具。你可以把它想像成一個「數位機器人管家」。",
              "不用寫程式！用拖拉方式連接各種服務：Gmail、LINE、Notion、Google Sheets、ChatGPT⋯⋯自動串在一起。",
              "跟 Zapier 類似，但 n8n 可以自己架設（省 90% 費用），而且功能更強大，能連接 AI 模型。",
              "台灣已有 12,000+ 社群成員、1,000+ 企業採用。台大、中央大學都開設 n8n 課程。",
            ],
          },
          {
            id: "n8n-use-cases",
            title: "n8n 能做什麼？（實戰案例）",
            content: [
              "📌 工作需要：自動化工程師、RPA 專員、數位轉型顧問、AI 流程設計師",
              "🛠️ 需要技能：n8n 節點操作、API 基礎概念、JSON 格式、AI 串接（OpenAI/Claude）",
              "⏰ 學習時間：1-2 個月學會基礎自動化，3 個月可獨立設計複雜流程",
            ],
            memoryTips: [
              "🧠【水管工比喻】n8n 就像在接水管——每個服務是一個水龍頭（Gmail、LINE、Notion⋯），n8n 是中間的管子，把水（資料）從這頭自動送到那頭。你不用懂水怎麼流的（程式碼），只要會接管子（拖拉節點）。",
              "🎯【省時計算法跟客戶溝通】「假設你每天花 1 小時做重複的事，一年就是 365 小時。學 n8n 花 2 個月，之後每天自動省 1 小時。等於用 60 小時的學習換回 300 小時的自由。」",
              "💡【對比價格法】「Zapier 每月要 NT$2,000+，n8n 自己架設幾乎免費。同樣的自動化，省 90% 的費用。」",
            ],
            videoLinks: [
              { title: "雷蒙 — n8n 自動化入門教學", url: "https://www.youtube.com/results?search_query=雷蒙+n8n+自動化+教學", duration: "30-60 分鐘" },
              { title: "n8n 官方教學頻道", url: "https://www.youtube.com/@n8n-io", duration: "每集 5-15 分鐘" },
            ],
            examples: [
              { scenario: "每天手動整理客戶 Email", solution: "n8n 自動監控 Gmail → AI 分類信件 → 重要的轉到 Slack 通知 → 自動回覆常見問題。每天省 2 小時。" },
              { scenario: "電商每天要手動更新庫存", solution: "n8n 自動從 ERP 拉庫存 → 同步到 Shopee/蝦皮 → 低庫存自動 LINE 通知老闆。零人工作業。" },
              { scenario: "社群小編每天要發文", solution: "n8n + AI 自動生成文案 → 排程發佈到 IG/FB/LINE → 自動追蹤互動數據 → 每週自動產生報表。" },
              { scenario: "業務每天要手動填報表", solution: "n8n 自動從 CRM 抓通話紀錄 → 統計今日數據 → 自動更新 Google Sheets → 每天 6 點自動發 LINE 日報給主管。" },
              { scenario: "客戶諮詢來了沒人即時回覆", solution: "n8n + ChatGPT 建立 AI 客服 → 自動回答常見問題 → 遇到複雜問題自動轉真人 → 對話紀錄自動存到 Notion。" },
            ],
          },
          {
            id: "n8n-salary",
            title: "薪資與接案行情",
            content: [],
            salaryInfo: [
              { position: "RPA / 自動化專員", salary: "NT$ 40,000-60,000/月", skills: "n8n/Zapier/流程" },
              { position: "自動化工程師", salary: "NT$ 55,000-85,000/月", skills: "n8n/API/AI串接" },
              { position: "AI 自動化顧問", salary: "NT$ 70,000-120,000/月", skills: "需求分析/架構設計" },
            ],
            freelanceInfo: [
              { type: "基礎自動化流程", income: "NT$ 5,000-15,000/案" },
              { type: "AI 客服機器人", income: "NT$ 20,000-80,000/案" },
              { type: "企業自動化全套導入", income: "NT$ 50,000-200,000/案" },
              { type: "n8n 企業培訓", income: "NT$ 10,000-30,000/場" },
            ],
          },
        ],
      },
      {
        id: "gas-automation",
        title: "GAS 自動化",
        icon: "📊",
        description: "Google Apps Script — 免費的辦公室自動化神器",
        topics: [
          {
            id: "gas-what",
            title: "GAS 是什麼？",
            content: [
              "GAS = Google Apps Script，Google 內建的自動化腳本工具。完全免費！",
              "可以自動化所有 Google 服務：Sheets（自動報表）、Gmail（自動回信）、Calendar（自動排程）、Drive（自動整理）。",
              "用 JavaScript 語法寫，但不用從頭學——現在有 AI 幫你寫程式碼，你只要會描述需求就好。",
              "最大優勢：零成本。只要有 Google 帳號就能用。很多中小企業就靠 GAS 搞定 80% 的日常自動化。",
            ],
          },
          {
            id: "gas-use-cases",
            title: "GAS 能做什麼？（實戰案例）",
            content: [
              "📌 工作需要：行政效率提升、報表自動化、流程優化、數據整合",
              "🛠️ 需要技能：JavaScript 基礎、Google Sheets 函數、API 概念、ChatGPT 輔助撰寫程式",
              "⏰ 學習時間：2-4 週學會基礎（搭配 AI 輔助），2 個月可獨立開發",
            ],
            memoryTips: [
              "🧠【管家比喻】GAS 就像你的 Google 全家桶裡養了一個隱形管家。你在 Google Sheets 按下一個按鈕，管家就自動幫你寄信、整理資料、更新日曆。",
              "🎯【成本效益法】「GAS 完全免費——有 Google 帳號就有。花 2 週學會，每天自動省 1-2 小時。一年省下 300-500 小時，等於多出 1.5 個月可以打電話開發客戶。」",
              "💡【3 步驟記憶】GAS 開發只要 3 步：① 打開 Google Sheets → 工具 → Apps Script ② 描述你要什麼功能給 ChatGPT ③ 貼上程式碼、按執行。完成！",
            ],
            videoLinks: [
              { title: "Google Apps Script 入門中文教學", url: "https://www.youtube.com/results?search_query=Google+Apps+Script+入門+中文+教學", duration: "15-30 分鐘" },
            ],
            examples: [
              { scenario: "每月要手動整理各部門報表", solution: "GAS 自動從各部門的 Google Sheets 抓資料 → 合併計算 → 自動生成月報 → 定時 Email 寄給老闆。從 4 小時縮短到 0 秒。" },
              { scenario: "客戶填了表單要手動回覆", solution: "GAS 監控 Google Form → 收到新填寫自動發確認信 → 資料自動寫入 CRM Sheets → LINE 通知業務跟進。" },
              { scenario: "每天要手動發提醒信", solution: "GAS 定時檢查日曆 → 自動發出會議提醒 / 任務到期通知 → 未讀的再發 LINE 推播。" },
              { scenario: "GA4 數據要手動複製貼上", solution: "GAS 自動從 GA4 API 拉數據 → 寫入 Google Sheets → 自動產生圖表 → 每週一早上自動寄出。" },
            ],
          },
          {
            id: "gas-value",
            title: "GAS 的職涯價值",
            content: [
              "GAS 不是一個獨立的職缺，而是一個「加值技能」。會 GAS 的人在任何崗位都更有價值。",
              "📌 適合：行政人員、行銷人員、業務主管、財務人員、人資、任何需要用 Google 工具的人",
              "💰 效益：平均每天省 1-2 小時重複工作 → 一年省下 300-500 小時 → 等於多出 1.5 個月的工作時間",
              "💼 接案行情：GAS 自動化腳本 NT$ 3,000-15,000/案、報表自動化 NT$ 5,000-30,000/案",
              "🎯 組合技：GAS + n8n + AI = 超強的自動化三件套，能解決 90% 企業的流程自動化需求",
            ],
          },
        ],
      },
      {
        id: "ai-business",
        title: "AI 商業應用",
        icon: "🧠",
        description: "AI 在行銷、客服、數據分析的實戰應用",
        topics: [
          {
            id: "ai-marketing",
            title: "AI 行銷應用",
            content: [
              "📌 工作需要：AI 行銷專員、內容行銷主管、社群經營者、廣告投放優化",
              "🛠️ 需要技能：ChatGPT/Claude 進階 Prompt、Midjourney/DALL-E 圖像生成、AI 文案生成、數據分析",
              "⏰ 學習時間：1-2 個月（非技術背景也能學）",
              "💰 效益：原本寫一篇文案 2 小時 → 用 AI 30 分鐘搞定。效率提升 4-8 倍。",
              "💼 接案行情：AI 社群代操 NT$ 15,000-40,000/月、AI 內容生成 NT$ 5,000-20,000/案",
            ],
            examples: [
              { scenario: "客戶說「ChatGPT 免費版不就夠了？」", solution: "「免費版像 Google 地圖，大家都能用。企業需要的是專屬 AI，能連接公司資料、自動化流程。學完之後你能幫老闆省 2 個人力的成本。」" },
              { scenario: "客戶說「AI 會取代我」", solution: "「會用 AI 的人取代不會的人。就像 Excel 出現時，會用的人效率是 10 倍。AI 是新一代的 Excel。越早學越有優勢。」" },
            ],
          },
          {
            id: "ai-agent",
            title: "AI Agent 建置",
            content: [
              "AI Agent = 能自主執行任務的 AI 助手。不只是聊天，還能幫你完成完整的工作流程。",
              "📌 工作需要：AI Agent 設計師、AI 產品經理、自動化架構師",
              "🛠️ 需要技能：n8n + AI API 串接、Prompt Engineering、RAG（知識庫串接）、MCP 協議",
              "⏰ 學習時間：3-4 個月（需要先有 n8n 和 GAS 基礎）",
              "💰 市場薪資：AI Agent 開發 NT$ 60,000-100,000/月",
              "💼 接案行情：AI 客服 Agent NT$ 30,000-100,000/案、AI 業務助理 NT$ 50,000-200,000/案",
            ],
          },
        ],
      },
      {
        id: "aischool-stories",
        title: "學員成功故事",
        icon: "⭐",
        description: "AI 未來學院學員實例",
        topics: [
          {
            id: "aischool-success",
            title: "真實案例分享",
            content: [
              "【行銷主管小李】每天花 4 小時寫文案和社群貼文，學了 AI + n8n 後自動化整個流程，每天只花 30 分鐘。老闆直接加薪 15%。",
              "【房仲阿明】用 n8n + AI 自動分析區域房價、自動生成物件文案、AI 客服回覆看屋諮詢。月業績從 1 件到 3-4 件。「AI 讓我把時間花在真正需要人脈的地方。」",
              "【餐廳老闆娘】完全不懂技術，但學會 GAS + n8n 自動處理訂單、庫存提醒、月報。省下一個工讀生的費用。「原來 AI 不是科幻片的東西。」",
              "【業務小陳】用 GAS 自動整理 CRM 報表、n8n 串接 LINE 自動追蹤客戶。每天省 2 小時行政工作，多打了 30 通電話。三個月後被指派為公司的 AI 專案負責人。",
              "【行政人員小雯】學了 GAS 後幫公司自動化了 10 個 Google Sheets 報表流程。老闆驚呆，直接幫她轉職為數位轉型專員，薪水從 3.2 萬跳到 4.5 萬。",
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
