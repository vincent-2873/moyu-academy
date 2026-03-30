export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
}

export interface TrainingModule {
  id: number;
  day: number;
  title: string;
  subtitle: string;
  description: string;
  content: string[];
  keyPoints: string[];
  videos?: string[];
  hasSparring: boolean;
  sparringType?: string;
  quiz: QuizQuestion[];
}

export const modules: TrainingModule[] = [
  {
    id: 1,
    day: 1,
    title: "新人報到",
    subtitle: "品牌認識、系統操作、目標設定",
    description: "認識你即將服務的品牌，了解我們的教育理念、產品體系，並設定你的學習目標。",
    content: [
      "品牌介紹：了解你所屬品牌的故事、願景與核心價值",
      "產品體系：熟悉所有課程方案、價格與目標受眾",
      "系統操作：學會使用培訓系統的各項功能",
      "目標設定：制定你的第一週學習計畫與 KPI 目標",
    ],
    keyPoints: [
      "每個品牌有不同的客群和銷售策略",
      "了解產品是銷售的第一步",
      "設定具體可衡量的目標",
    ],
    videos: ["v-backend-tutorial", "v-company-org"],
    hasSparring: false,
    quiz: [
      {
        question: "墨宇集團旗下有幾個主要教育品牌？",
        options: ["2 個", "3 個", "4 個", "5 個"],
        answer: 1,
      },
      {
        question: "新人第一週最重要的目標是什麼？",
        options: ["立刻成交", "熟悉產品與流程", "打最多電話", "背話術"],
        answer: 1,
      },
      {
        question: "KPI 追蹤應該多久記錄一次？",
        options: ["每週", "每天", "每月", "有空再記"],
        answer: 1,
      },
    ],
  },
  {
    id: 2,
    day: 2,
    title: "GROW 銷售模型",
    subtitle: "Goal → Reality → Options → Will",
    description: "掌握 GROW 教練式銷售模型，學會用提問引導客戶發現需求並做出決定。",
    content: [
      "G - Goal（目標）：幫助客戶釐清他們想達成的目標",
      "R - Reality（現實）：了解客戶目前的處境與挑戰",
      "O - Options（選項）：一起探索可能的解決方案",
      "W - Will（意願）：確認行動計畫與承諾",
    ],
    keyPoints: [
      "GROW 是教練式對話，不是推銷",
      "多問開放式問題，少做陳述",
      "讓客戶自己說出需求",
    ],
    hasSparring: true,
    sparringType: "grow",
    quiz: [
      {
        question: "GROW 模型中的 R 代表什麼？",
        options: ["Result 結果", "Reality 現實", "Reason 原因", "Review 回顧"],
        answer: 1,
      },
      {
        question: "在 GROW 的哪個階段，我們幫客戶釐清目標？",
        options: ["Reality", "Options", "Goal", "Will"],
        answer: 2,
      },
      {
        question: "教練式銷售最重要的技巧是？",
        options: ["說服力", "提問力", "話術背誦", "價格優惠"],
        answer: 1,
      },
    ],
  },
  {
    id: 3,
    day: 3,
    title: "OKR 目標管理",
    subtitle: "Objective → Key Results",
    description: "學會用 OKR 框架設定銷售目標，並拆解成可執行的每日行動。",
    content: [
      "O - Objective：設定一個有挑戰性的質化目標",
      "KR - Key Results：定義 3-5 個可量化的關鍵結果",
      "如何從月目標拆解到週目標再到日行動",
      "用 OKR 管理你的銷售漏斗",
    ],
    keyPoints: [
      "好的 O 是鼓舞人心的方向",
      "好的 KR 是具體可衡量的數字",
      "每天追蹤進度才能及時調整",
    ],
    hasSparring: false,
    quiz: [
      {
        question: "OKR 中的 KR 必須符合什麼條件？",
        options: ["主觀判斷", "可量化衡量", "越多越好", "老闆決定"],
        answer: 1,
      },
      {
        question: "一個好的 Objective 應該是？",
        options: ["容易達成的", "有挑戰性且鼓舞人心的", "純數字的", "模糊的"],
        answer: 1,
      },
      {
        question: "每個 Objective 建議配幾個 Key Results？",
        options: ["1 個", "3-5 個", "10 個以上", "不限"],
        answer: 1,
      },
    ],
  },
  {
    id: 4,
    day: 4,
    title: "SPIN 電話行銷",
    subtitle: "Situation → Problem → Implication → Need-Payoff",
    description: "掌握 SPIN 銷售提問法，學會在電話中挖掘客戶痛點並引導成交。",
    content: [
      "S - Situation（情境）：開場確認客戶背景資訊",
      "P - Problem（問題）：發現客戶面臨的問題與困擾",
      "I - Implication（暗示）：讓客戶意識到問題不解決的後果",
      "N - Need-Payoff（需求回報）：引導客戶看到解決方案的好處",
    ],
    keyPoints: [
      "S 階段不要問太多，快速進入 P",
      "I 是最關鍵的階段，讓客戶自己感受緊迫性",
      "N 階段讓客戶說出解決方案的好處",
    ],
    hasSparring: true,
    sparringType: "spin",
    quiz: [
      {
        question: "SPIN 中哪個階段最容易被新手跳過？",
        options: ["Situation", "Problem", "Implication", "Need-Payoff"],
        answer: 2,
      },
      {
        question: "Implication 問題的目的是什麼？",
        options: ["收集資訊", "讓客戶感受問題嚴重性", "推薦產品", "談價格"],
        answer: 1,
      },
      {
        question: "Need-Payoff 問題應該由誰來回答好處？",
        options: ["業務自己說", "讓客戶自己說", "主管說", "不用回答"],
        answer: 1,
      },
    ],
  },
  {
    id: 5,
    day: 5,
    title: "黃金圈理論",
    subtitle: "Why → How → What (Simon Sinek)",
    description: "學會用黃金圈理論建構有說服力的銷售敘事，從「為什麼」開始打動客戶。",
    content: [
      "Why（為什麼）：你/品牌為什麼做這件事？核心信念是什麼？",
      "How（怎麼做）：你們用什麼獨特方法實現這個信念？",
      "What（做什麼）：具體的產品和服務是什麼？",
      "從 Why 開始說，客戶買的是你的「為什麼」",
    ],
    keyPoints: [
      "人們不買你做什麼，而是買你為什麼做",
      "先建立情感連結，再談產品",
      "用黃金圈來做自我介紹和品牌介紹",
    ],
    hasSparring: true,
    sparringType: "golden_circle",
    quiz: [
      {
        question: "黃金圈理論建議從哪裡開始溝通？",
        options: ["What 產品", "How 方法", "Why 為什麼", "Price 價格"],
        answer: 2,
      },
      {
        question: "「人們買的不是你做什麼，而是你為什麼做」這句話是誰說的？",
        options: ["Steve Jobs", "Simon Sinek", "Peter Drucker", "Philip Kotler"],
        answer: 1,
      },
      {
        question: "用黃金圈做品牌介紹時，What 層應該放在什麼位置？",
        options: ["最前面", "中間", "最後面", "不需要"],
        answer: 2,
      },
    ],
  },
  {
    id: 6,
    day: 6,
    title: "架構對練",
    subtitle: "Call 架構 6 步驟實戰練習",
    description: "整合前幾天學到的技巧，練習完整的電話銷售架構 6 步驟。",
    content: [
      "Step 1 - 開場破冰：建立信任，確認通話目的",
      "Step 2 - 需求探詢：用 SPIN 挖掘客戶真實需求",
      "Step 3 - 痛點放大：用 Implication 讓客戶感受緊迫性",
      "Step 4 - 方案呈現：用黃金圈 + GROW 呈現解決方案",
      "Step 5 - 異議處理：處理價格、時間、猶豫等常見異議",
      "Step 6 - 推進成交：確認下一步行動，預約 DEMO 或成交",
    ],
    keyPoints: [
      "6 步驟是完整的銷售流程框架",
      "每個步驟都有明確的目標",
      "練習越多，自然反應越快",
    ],
    hasSparring: true,
    sparringType: "full_call",
    quiz: [
      {
        question: "完整電話架構共有幾個步驟？",
        options: ["4 步", "5 步", "6 步", "8 步"],
        answer: 2,
      },
      {
        question: "在「痛點放大」階段應該用什麼技巧？",
        options: ["GROW", "Implication", "Golden Circle", "直接報價"],
        answer: 1,
      },
      {
        question: "異議處理時客戶說「太貴了」，最佳策略是？",
        options: ["直接打折", "計算 ROI 回報", "放棄這個客戶", "不回應"],
        answer: 1,
      },
    ],
  },
  {
    id: 7,
    day: 7,
    title: "聽 Call Review",
    subtitle: "3 優化 + 2 維持系統",
    description: "學會分析銷售通話錄音，用「3 優化 + 2 維持」系統持續進步。",
    content: [
      "聽 Call 的標準流程：先整體感受，再逐段分析",
      "3 優化：找出 3 個可以做得更好的地方",
      "2 維持：確認 2 個做得好要繼續保持的地方",
      "逐字稿分析：標記關鍵話術、客戶反應、轉折點",
    ],
    keyPoints: [
      "每次聽完 Call 都要寫下 3+2",
      "關注客戶的語氣變化和回應長度",
      "好的話術要記錄到個人話術庫",
    ],
    hasSparring: false,
    quiz: [
      {
        question: "聽 Call Review 的「3+2」系統是什麼？",
        options: ["3 個電話 + 2 個 DEMO", "3 優化 + 2 維持", "3 分鐘 + 2 分鐘", "3 個問題 + 2 個答案"],
        answer: 1,
      },
      {
        question: "聽 Call 時最應該注意什麼？",
        options: ["業務說了什麼", "客戶的反應和語氣變化", "通話時長", "背景噪音"],
        answer: 1,
      },
      {
        question: "發現好的話術後應該怎麼做？",
        options: ["只記在腦中", "記錄到話術庫並練習", "告訴同事", "不需要特別處理"],
        answer: 1,
      },
    ],
  },
  {
    id: 8,
    day: 8,
    title: "DEMO 銷售",
    subtitle: "螢幕分享、產品展示、成交話術",
    description: "學會如何進行線上 DEMO，用產品展示打動客戶並推進成交。",
    content: [
      "DEMO 前準備：確認客戶需求、準備對應展示內容",
      "開場 2 分鐘：快速回顧需求、說明 DEMO 流程",
      "展示技巧：先展示客戶最在意的功能，用故事包裝",
      "收尾成交：總結價值、提供方案選擇、確認下一步",
    ],
    keyPoints: [
      "DEMO 不是功能展示，是解決方案展示",
      "永遠從客戶的需求開始，不是從產品開始",
      "收尾時給 2-3 個方案選擇，不要問「要不要」",
    ],
    videos: ["v-xlab-flow", "v-xuemi-flow", "v-ooschool-flow"],
    hasSparring: true,
    sparringType: "demo",
    quiz: [
      {
        question: "DEMO 時應該先展示什麼？",
        options: ["所有功能", "最便宜的方案", "客戶最在意的部分", "公司介紹"],
        answer: 2,
      },
      {
        question: "DEMO 收尾時最佳做法是？",
        options: ["問客戶要不要買", "提供 2-3 個方案選擇", "等客戶主動開口", "直接報最低價"],
        answer: 1,
      },
      {
        question: "DEMO 本質上是什麼？",
        options: ["產品功能展示", "解決方案展示", "價格談判", "技術教學"],
        answer: 1,
      },
    ],
  },
  {
    id: 9,
    day: 9,
    title: "實戰考核",
    subtitle: "模擬客戶電話、綜合評分",
    description: "綜合前 8 天所學，進行完整的模擬客戶電話考核，獲得全面評分。",
    content: [
      "考核形式：AI 模擬真實客戶，完整走完一通銷售電話",
      "評分維度：開場力、SPIN 覆蓋、痛點挖掘、方案匹配、異議處理、成交推進",
      "及格標準：綜合分數 70 分以上",
      "考核後會生成完整的分析報告和改善建議",
    ],
    keyPoints: [
      "這是綜合考核，不是單一技巧測試",
      "把它當作真實客戶來應對",
      "考核可以重複進行，每次都會有不同客戶",
    ],
    hasSparring: true,
    sparringType: "exam",
    quiz: [
      {
        question: "實戰考核的及格標準是？",
        options: ["60 分", "70 分", "80 分", "90 分"],
        answer: 1,
      },
      {
        question: "考核的評分維度有幾個？",
        options: ["3 個", "4 個", "5 個", "6 個"],
        answer: 3,
      },
      {
        question: "考核可以重複進行嗎？",
        options: ["不行，只有一次機會", "可以，每次客戶不同", "最多 3 次", "需要主管同意"],
        answer: 1,
      },
    ],
  },
];
