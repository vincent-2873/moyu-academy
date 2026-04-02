export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
}

export interface TrainingResource {
  title: string;
  type: 'video' | 'notion' | 'recording' | 'document';
  driveFileId?: string;
  url?: string;
  description?: string;
}

export interface KpiTargets {
  calls?: string;
  talkTime?: string;
  invites?: string;
}

export interface DailyScheduleItem {
  time: string;
  task: string;
  description?: string;
}

export interface ModuleTask {
  id: string;
  title: string;
  description?: string;
  type: 'info' | 'watch' | 'listen' | 'practice' | 'note' | 'review' | 'call' | 'quiz';
  time?: string;
  resourceIndex?: number;
  tip?: string;
}

export const TASK_ICONS: Record<ModuleTask['type'], string> = {
  info: '📋', watch: '🎬', listen: '🎧', practice: '🗣',
  note: '✏️', review: '🔍', call: '📞', quiz: '✅',
};

export interface TrainingModule {
  id: number;
  day: number;
  title: string;
  subtitle: string;
  /** 品牌歸屬：空陣列或不設 = 全品牌通用，指定品牌ID則僅該品牌可見 */
  brand?: string;
  /** 前言：告訴新人今天要做什麼、為什麼做 */
  description: string;
  /** 每日行程表 */
  schedule?: DailyScheduleItem[];
  content: string[];
  keyPoints: string[];
  resources?: TrainingResource[];
  trainerTips?: string[];
  kpiTargets?: KpiTargets;
  practiceTask?: string;
  callRecordingIds?: string[];
  hasSparring: boolean;
  sparringType?: string;
  quiz: QuizQuestion[];
  /** 任務清單：遊戲化步驟引導 */
  tasks: ModuleTask[];
}

/** 依品牌取得模組：有品牌專屬版就用專屬版，否則用通用版 */
export function getModulesForBrand(brandId: string): TrainingModule[] {
  const brandModules = modules.filter(m => m.brand === brandId);
  const genericModules = modules.filter(m => !m.brand || m.brand === 'nschool');
  // 如果該品牌有專屬模組，用專屬的；否則 fallback 到通用（nschool）
  if (brandModules.length > 0) {
    // 用品牌模組覆蓋對應的 day，沒有的 day 用通用版
    const dayMap = new Map<number, TrainingModule>();
    genericModules.forEach(m => dayMap.set(m.day, m));
    brandModules.forEach(m => dayMap.set(m.day, m));
    return Array.from(dayMap.values()).sort((a, b) => a.day - b.day);
  }
  return genericModules;
}

export const modules: TrainingModule[] = [
  // ===================== DAY 1 =====================
  {
    id: 1,
    day: 1,
    title: "新人報到｜開發學習",
    subtitle: "合約導讀、品牌認識、聽 Call、逐字稿對練",
    description:
      "歡迎加入 nSchool！今天是你的第一天，我們會先帶你認識公司環境和集團介紹，然後進入最重要的部分——聽 8 段真實的開發 Call 錄音。這些錄音是你未來打電話的範本，請仔細聽語氣口吻、語調和受眾差異。下午會進行線上 Review 會議，討論你聽到的內容，之後開始兩人一組的逐字稿對練。今天的目標：熟悉開發架構，開始練習表達。",
    schedule: [
      { time: "10:00-11:00", task: "新人合約導讀", description: "了解合約內容與公司規範" },
      { time: "11:00-11:30", task: "公司環境、集團介紹", description: "認識墨宇集團三大品牌：nSchool 財經、XUEMI 學米、OOschool 無限" },
      { time: "12:00-13:00", task: "午休" },
      { time: "13:00-16:00", task: "【業訓】開發學習", description: "聽 8 段真實開發 Call 錄音逐字稿，邊聽邊筆記受眾特徵" },
      { time: "16:00-18:00", task: "【業訓】聽 Call Review", description: "線上會議，分享聽 Call 心得、教學制度說明（線上+實體課程優劣勢、理論→實作→實戰教學核心）" },
      { time: "18:00-19:00", task: "【業訓】逐字稿對練", description: "兩人一組，對練 1-1 到 1-4 逐字稿，裝話機互 Call" },
    ],
    content: [
      "【教學制度認識】nSchool 提供兩種教學形式：",
      "　• 線上課程 — 優勢：時間彈性、可重複觀看、不限地點；劣勢：自律性要求高、缺乏即時互動",
      "　• 實體課程 — 優勢：即時互動、現場氛圍好、講師一對一指導；劣勢：時間固定、需要到場",
      "　➜ 教學核心：理論（影片由淺入深學習）→ 實作（財經教練帶你看市場解題）→ 實戰（模擬交易 APP 練手感）",
      "",
      "【開發 Call 學習】13:00 開始聽開發 Call 錄音（8段），邊聽邊記錄：",
      "　• 聽 Call 重點：語氣口吻、語調變化、受眾辨識（學生/在職/待業）",
      "　• 14:30 回報進度，聽到第幾段",
      "　• 15:00 受眾分析：學生可以聊什麼？在職可以聊什麼？列越多越好",
      "",
      "【受眾分析】你會遇到的客戶主要是 18-30 歲：",
      "　• 學生 — 可以聊：念哪間大學？什麼科系？同學都在做什麼？對未來有什麼規劃？",
      "　• 上班族 — 可以聊：在什麼產業？薪水滿意嗎？目前職位做多久了？有沒有想過其他可能？",
      "　• 待業中 — 可以聊：之前做什麼工作？現在想轉什麼方向？有在看什麼機會嗎？",
      "　➜ 客戶說的話信 50% 就好，重點是觀察他的真實需求",
      "",
      "【開發制度要點】",
      "　• 絕對不要問「想不想了解」→ 客戶一定說「不要不要」",
      "　• 正確做法：用「好不好」或直接引導時間 → 「今天？明天？上午？下午？10:00/11:00/14:00/16:00/18:00/20:00」",
      "　• 遇到有經驗的客戶：用請益方式 → 「0-10 分你覺得自己了解幾分？剩下幾分差在哪？」",
      "",
      "【聽 Call Review + 逐字稿對練】",
      "　• 16:00 線上 Review 會議：分享聽 Call 心得、教學制度說明",
      "　• 17:30 開始逐字稿對練：一人扮客戶、一人扮業務，照逐字稿念",
      "　• 18:30 聽自己的對練錄音，標記卡住、不熟的地方，心裡默念幾次",
    ],
    keyPoints: [
      "架構是固定的，在穩定架構上展現個人風格。電話行銷跟實體銷售不一樣——實體見面三分情，電話一分情都不到，靠的是聲音起伏",
      "練習核心三要素：①有無順暢（表達、溝通）②有條理邏輯（照架構順序走）③別人聽不聽得懂（語氣、語速、語調）",
      "一通 Call 大約落在 12-15 分鐘，多或少都要去找原因",
      "教學核心：理論（影片由淺入深）→ 實作（財經教練帶你看市場實況）→ 實戰（APP 模擬交易練手感）",
      "邀約技巧：不問「想不想」，直接引導時間 →「今天？明天？上午？下午？幾點？」",
      "受眾以 18-30 歲為主，大多無投資經驗。客戶話信 50% 就好，觀察真實需求",
    ],
    resources: [
      { title: "nSchool 財經訓練中心", type: "notion", url: "https://rattle-notify-a6d.notion.site/nSchool-v-2-2b5b581c6726801cb7d5f4f57f4b97fc", description: "所有訓練資源的入口" },
      { title: "開發 Call 逐字稿（8段）", type: "notion", url: "https://rattle-notify-a6d.notion.site/nschool-2025-c-03", description: "聽 Call 和對練用的逐字稿" },
      { title: "公司組織說明影片", type: "video", driveFileId: "1mFY5_pCtsuvDV0KiO2Ferh0SCJIflsZx", description: "墨宇集團組織架構與各部門介紹" },
    ],
    trainerTips: [
      "開發 Call 記得仔細去聽，語氣口吻和語調是關鍵",
      "有些夥伴可能不知道怎麼筆記，建議按受眾分類：學生可以聊什麼？在職可以聊什麼？",
      "電話行銷跟實體銷售不一樣，實體見面三分情，電話一分情都不到，透過聲音的起伏來調整",
      "如果學習快，有機會這周就學到 Demo，開始獨立作業和成交。但不逼，一步一步原則來走最重要",
    ],
    practiceTask: "逐字稿對練 1-1 到 1-4，兩人一組對練。對練完聽自己的錄音，標記卡住不熟的地方，心裡默念幾次",
    hasSparring: true,
    sparringType: "transcript_practice",
    tasks: [
      { id: "d1t1", title: "新人合約導讀", type: "info", time: "10:00-11:00", description: "了解公司合約內容與新人權益，有問題直接問" },
      { id: "d1t2", title: "公司環境、集團介紹", type: "info", time: "11:00-11:30", description: "認識墨宇集團三大品牌：nSchool 財經、XUEMI 學米、OOschool 無限" },
      { id: "d1t3", title: "聽開發 Call 錄音（8段）", type: "listen", time: "13:00-14:30", description: "邊聽邊筆記！重點聽：語氣口吻、語調變化、怎麼辨識受眾（學生/在職/待業）", resourceIndex: 1 },
      { id: "d1t4", title: "筆記：受眾分類分析", type: "note", description: "分三類整理 → 學生可以聊什麼（科系/同學/未來）？上班族可以聊什麼（產業/薪水/職位）？待業可以聊什麼（轉職方向）？列越多越好", tip: "這些是你未來打電話最常用的話題" },
      { id: "d1t5", title: "回報目前進度", type: "review", time: "14:30", description: "向業訓回報聽到第幾段了" },
      { id: "d1t6", title: "了解教學制度", type: "info", description: "線上課程 vs 實體課程各有優劣。教學核心：理論（影片）→ 實作（教練帶看市場）→ 實戰（模擬交易 APP）", tip: "這是你跟客戶說明課程時最核心的邏輯" },
      { id: "d1t7", title: "了解開發制度", type: "info", description: "不要問「想不想了解」→ 客戶會說「不要」。正確做法：用「好不好」或直接引導時間 →「今天？明天？上午？下午？幾點？」", tip: "有經驗客戶用請益法：0-10 你了解幾分？" },
      { id: "d1t8", title: "線上 Review 會議", type: "review", time: "16:00", description: "參加線上 Review 會議，分享聽 Call 心得、討論學習重點" },
      { id: "d1t9", title: "逐字稿對練 1-1 到 1-4", type: "practice", time: "17:30-18:30", description: "兩人一組，一人扮客戶、一人扮業務，照著逐字稿念。裝話機互 Call", resourceIndex: 1 },
      { id: "d1t10", title: "聽自己的對練錄音", type: "listen", description: "標記卡住不熟的地方，心裡默念幾次直到順暢" },
      { id: "d1t11", title: "完成每日測驗", type: "quiz", description: "通過測驗解鎖 Day 2", tip: "及格線 60 分" },
    ],
    quiz: [
      {
        question: "練習核心三要素不包括下列哪項？",
        options: ["有無順暢（表達、溝通）", "有條理邏輯（照架構順序走）", "別人聽不聽得懂（語氣語速語調）", "話術完整背誦"],
        answer: 3,
      },
      {
        question: "nSchool 的教學核心是什麼？",
        options: ["理論→考試→畢業", "理論→實作→實戰", "看影片→背話術→打電話", "聽課→交報告→結業"],
        answer: 1,
      },
      {
        question: "一通開發 Call 正常應落在多少分鐘？",
        options: ["5-8 分鐘", "12-15 分鐘", "20-25 分鐘", "30 分鐘以上"],
        answer: 1,
      },
      {
        question: "聽 Call 時最重要的是聽什麼？",
        options: ["產品價格", "語氣口吻、語調、受眾辨識", "客戶的收入水平", "通話時長"],
        answer: 1,
      },
      {
        question: "邀約客戶時的正確做法是？",
        options: ["問客戶「想不想了解」", "直接引導時間：今天？明天？上午？下午？", "等客戶主動問", "發訊息就好不用打電話"],
        answer: 1,
      },
      {
        question: "面對有投資經驗的客戶，應該怎麼做？",
        options: ["直接介紹課程", "用請益方式：0-10 你了解幾分？剩下差在哪？", "跳過這個客戶", "說我們比較專業"],
        answer: 1,
      },
    ],
  },

  // ===================== DAY 2 =====================
  {
    id: 2,
    day: 2,
    title: "架構對練｜後台學習",
    subtitle: "逐字稿對練、架構對練、據點主管考試、後台操作",
    description:
      "今天的重點是從「念逐字稿」升級到「架構對練」。早上先完成逐字稿對練，接著學習打卡系統。下午進入架構對練——不再照著念，而是用自己的話走完整個開發架構（受眾分上班族/學生/待業）。練完後會調你的 Call 出來一起 Review，找出 3 個優化點和 2 個可維持的地方。傍晚進行據點主管考試，通過後學習後台（CRM）操作。今天的目標：架構流程內化，通過考試。",
    schedule: [
      { time: "上午", task: "【業訓】逐字稿對練（續）", description: "完成 Day 1 未完成的逐字稿對練" },
      { time: "13:00-13:30", task: "【業訓】確認打卡信件", description: "打卡 APP 安裝、操作說明（12:30 準時打卡，12:31 算遲到）" },
      { time: "13:30-17:15", task: "【業訓】架構對練 + 聽 Call Review", description: "用自己的話走架構，受眾分上班族/學生/待業。對練完聽錄音寫 3 優化 + 2 維持" },
      { time: "17:15-18:15", task: "【業訓】據點主管考試", description: "撥打據點主管分機進行考試，通過才能學後台" },
      { time: "18:15-19:00", task: "【業訓】後台學習、加入經辦", description: "後台操作影片（看到 48 分），登入 CRM 系統，加入經辦 LINE" },
    ],
    content: [
      "架構對練 TA 受眾：上班族 / 學生 / 待業，客戶方自行設定輪廓",
      "對練記得受眾的個性和內容，不用特別跟對方說，當作真正上機一樣",
      "STEP2-STEP3 可以多聊天，講不出技術內容沒關係，聊客戶本身的狀況",
      "對練完後聽自己每通 Call，列出 3 個優化 + 2 個可維持的地方",
      "據點主管考試通過後，觀看後台操作影片（看到 48 分即可，後面會另外教學）",
      "用個人信箱註冊官網 nschool.tw，後續會掛權限",
    ],
    keyPoints: [
      "架構對練三大核心：①順暢表達 ②有條理邏輯（照架構走）③別人聽得懂",
      "試著在 STEP2-STEP3 多聊天，了解客戶背景和需求",
      "不用特別刁鑽，主要是循序著架構去跑和執行",
      "後台操作影片看到 48 分就好，後面不要看，後續會教學",
    ],
    resources: [
      { title: "架構對練參考稿", type: "notion", url: "https://rattle-notify-a6d.notion.site/XPL_AI_dev-ver_cinv-1-23eb581c6726818b8916f9977edcba1f", description: "開發架構完整對練參考" },
      { title: "後台操作教學影片（Notion版，看到48分）", type: "video", driveFileId: "1879B7t_dR4_f94tkX8Nv1EYMULYFltmU", description: "CRM 後台操作教學（看到 48 分即可）" },
      { title: "後台操作完整教學", type: "video", driveFileId: "1kn-z8VXrTFhc0J5mPTlSj6IhtUBovT2r", description: "完整系統後台操作教學，新人必看" },
      { title: "開發 Call 逐字稿", type: "notion", url: "https://rattle-notify-a6d.notion.site/nschool-2025-c-03", description: "逐字稿對練和架構對練用" },
    ],
    trainerTips: [
      "在開發階段，無須去說服，重點在引導",
      "引導是幫他戴帽子，讓他覺得「我行、我可以、這就是我要的路」",
      "大家聲音偏緊繃的話，放輕鬆。語氣語調都很重要，越緊張會越卡。太沉悶就站起來念",
      "STEP2 偶爾會卡住或趕快進入 STEP3，記得學會開話題→延伸→引導",
      "架構考試一次過就會讓你們上機了，基底訓練好很多新人業務都能做到",
    ],
    practiceTask: "架構對練（上班族/學生），兩人一組。練完聽 Call 寫 3 優化 + 2 維持。然後準備據點主管考試",
    hasSparring: true,
    sparringType: "structure_practice",
    tasks: [
      { id: "d2t1", title: "逐字稿對練（續）", type: "practice", time: "上午", description: "延續 Day 1 的逐字稿練習，加強不熟的段落" },
      { id: "d2t2", title: "確認打卡信件", type: "info", time: "13:00-13:30", description: "確認打卡信件已寄出" },
      { id: "d2t3", title: "架構對練（上班族/學生/待業）", type: "practice", time: "13:30-17:15", description: "記得受眾的個性和內容，STEP2-STEP3 可以多聊天" },
      { id: "d2t4", title: "聽 Call 寫 3 優化 + 2 維持", type: "note", description: "對練完後聽自己每通 Call，列出改善項目" },
      { id: "d2t5", title: "據點主管考試", type: "review", time: "17:15-18:15", description: "架構考試一次過就會讓你們上機！" },
      { id: "d2t6", title: "觀看後台操作影片（看到 48 分）", type: "watch", time: "18:15-19:00", description: "後台操作影片看到 48 分就好，後面不要看", resourceIndex: 1 },
      { id: "d2t7", title: "個人信箱註冊官網 nschool.tw", type: "info", description: "用個人信箱註冊" },
      { id: "d2t8", title: "完成每日測驗", type: "quiz", description: "通過測驗解鎖 Day 3", tip: "及格線 60 分" },
    ],
    quiz: [
      {
        question: "架構對練和逐字稿對練的差別是？",
        options: ["完全一樣", "架構對練用自己的話走架構，不照念逐字稿", "架構對練不需要練習", "逐字稿對練比較難"],
        answer: 1,
      },
      {
        question: "對練完聽自己的 Call 後，應該列出什麼？",
        options: ["5 個優化點", "3 個優化 + 2 個可維持的地方", "只寫做得好的", "不需要分析"],
        answer: 1,
      },
      {
        question: "後台操作影片要看到第幾分鐘？",
        options: ["全部看完", "48 分", "30 分", "20 分"],
        answer: 1,
      },
      {
        question: "架構對練時 STEP2-STEP3 應該怎麼做？",
        options: ["快速帶過進入 STEP4", "多聊天了解客戶，不急著進入銷售", "直接介紹產品", "跳過不練"],
        answer: 1,
      },
    ],
  },

  // ===================== DAY 3 =====================
  {
    id: 3,
    day: 3,
    title: "正式上機｜開發實戰",
    subtitle: "上機前會議、名單制度、CRM 操作、正式撥打",
    description:
      "今天你要正式上機打電話了！早上先完成上機前會議，了解名單制度（結案單/新單）、CRM 操作方式、名單管理原則。這些是你日後每天都會用到的工作習慣。下午開始正式撥打，今天目標是 150 通次、120 分鐘通時、3-5 個邀約。遇到任何問題都直接群組提問——你們遇過的問題我們都遇過了。邀約到客戶但不會做 Demo 沒關係，先 Pass 給學長姐協助。",
    schedule: [
      { time: "10:00-12:00", task: "【業訓】上機前會議、強心針", description: "名單制度、CRM操作、KPI標準、成交率說明" },
      { time: "12:00-13:00", task: "午休" },
      { time: "13:00-19:00", task: "【業訓_財經】上機開發", description: "正式撥打！用 CRM 管理名單，邀約後操作 4 步驟" },
    ],
    content: [
      "【名單制度】",
      "　• 新單：一天 3 筆新單。開發量足夠＋邀約穩定（3-5 個/天）→ 加碼到 3-5 筆",
      "　• 結案單：過去被隱性拒絕的名單，按新單方式打，不要預設立場",
      "　• 新單不要亂打！亂打 ＝ 開頭沒有引導就直接下拒絕紀錄。名單 1000 元/筆，亂打等於浪費公司資源",
      "",
      "【撥打原則】",
      "　• 建立日期從近→遠開始打（越新的名單越熱）",
      "　• 撥打次數從少→多開始打（被打越多次的越難接）",
      "　• 一筆單打 6-7 次就不用打了，按拒絕回結案池",
      "　• 客戶明確拒絕一次 → 直接丟拒絕，不浪費時間",
      "",
      "【KPI 標準（依出席數調整）】",
      "　• 0 出席（還沒有 Demo 出席）→ 通次 130-160 通 / 通時 100-150 分鐘 / 邀約 4-5 個",
      "　• 1 出席 → 通次 100-140 通 / 通時 100-120 分鐘 / 邀約 3-4 個",
      "　• 2 出席以上 → 通次 80-120 通 / 通時 80-100 分鐘 / 邀約 2-3 個",
      "　➜ 出席越多，撥打量可以適度降低，因為你要花時間做 Demo",
      "",
      "【成交率參考】",
      "　• 新人業務：5-6 個 Demo 出席 ＝ 1 成交",
      "　• 正式業務：4-5 個 ＝ 1 成交",
      "　• 資深業務：3-4 個 ＝ 1 成交",
      "",
      "【CRM 聯絡紀錄模板】邀約成功後，複製這個模板填寫：",
      "　① 學習目標：客戶想學什麼？（例：學投資理財/學技術分析/想增加收入）",
      "　② 身分：學生/上班族/待業？幾歲？什麼科系或產業？",
      "　③ 學習動機＋經驗：為什麼想學？有沒有投資經驗？",
      "　④ 是否給予價值：有沒有在電話中讓客戶感受到學習價值？",
      "　⑤ 學習時間：客戶每天/每週可以學多少時間？",
      "　⑥ 門檻：預算考量、家人意見、時間問題？",
      "　⑦ 裝置：手機/電腦/平板？（影響上課方式建議）",
      "",
      "【邀約後 4 步驟】",
      "　STEP1. 下 CRM 聯絡紀錄（照上面模板填寫）",
      "　STEP2. 建立待辦清單，預約 Demo 時間",
      "　STEP3. 官方 LINE 客戶名字改為：預約時間/客戶姓名/顧問英文名",
      "　STEP4. 官方 LINE 記事本新增客戶 CRM 資訊（方便 Demo 前快速回顧）",
    ],
    keyPoints: [
      "KPI 循環：通次 → 通時 → 邀約 → 出席 → 成交。活動量是一切的基礎",
      "遇到問題直接群組提出：「今天客戶說 ○○，怎麼回應？」你們遇過的問題我們都遇過了",
      "一開始邀約到不會做 Demo 沒關係，先 Pass 給學長姐協助（1-3 次），學完 Demo 就自己做",
      "新人成交率：5-6 個 Demo 出席 ＝ 1 成交。不要灰心，這是正常數字",
      "CRM 紀錄很重要！每通有效 Call 都要記錄：學習目標/身分/動機經驗/給予價值/學習時間/門檻/裝置",
      "不要預設立場！CRM 上面寫拒絕的都稱之為狗屁判斷，沒有親自打過都不算",
    ],
    resources: [
      { title: "開發 Call 逐字稿", type: "notion", url: "https://rattle-notify-a6d.notion.site/nschool-2025-c-03", description: "上機開發時架構參考" },
      { title: "銷售小工具（一鍵複製客戶資訊）", type: "notion", url: "https://nschool-gif.github.io/notion-interactive/", description: "傳送給客戶的資訊工具" },
      { title: "業務 LINE 群（問題即時回報）", type: "notion", url: "https://line.me/R/ti/g/fh2GKN86gb", description: "遇到問題直接在群組提問，業訓會即時回覆" },
    ],
    trainerTips: [
      "遇到問題直接群組提出，你們遇過的問題我們都遇過了",
      "不管是操作、客戶對應不知道怎麼說，直接提問就好。用最快方式解決才會成長",
      "不要預設立場！CRM 上面寫拒絕的都稱之為狗屁判斷，沒有親自打過都不算",
      "業務不是天生就會，是可學習的技能。不要怕被拒絕，要怕沒有策略",
      "第一週最快第二天、第三天就會有邀約，一開始邀約到先 Pass 給學長姐",
    ],
    kpiTargets: {
      calls: "150",
      talkTime: "120 分鐘",
      invites: "3-5",
    },
    practiceTask: "正式上機撥打，目標 150 通次 / 120 分鐘通時 / 3-5 個邀約。下班時把有約到 Demo 的客戶資訊貼給業訓",
    hasSparring: true,
    sparringType: "live_call",
    tasks: [
      { id: "d3t1", title: "上機前會議、強心針", type: "review", time: "10:00-12:00", description: "了解名單制度、CRM 操作、KPI 標準、成交率。這些是每天都要用的工作習慣" },
      { id: "d3t2", title: "了解名單制度", type: "info", description: "新單一天 3 筆、結案單不預設立場、撥打順序：日期近→遠、次數少→多、6-7 次就不打", tip: "名單 1000 元/筆，不要亂打浪費" },
      { id: "d3t3", title: "學會 CRM 紀錄模板", type: "info", description: "每通有效 Call 都要記錄 7 項：學習目標/身分/動機經驗/給予價值/學習時間/門檻/裝置", tip: "複製模板填寫最快，不用自己想格式" },
      { id: "d3t4", title: "了解 KPI 標準", type: "info", description: "0出席→130-160通/100-150分鐘/邀約4-5；1出席→100-140通/100-120分鐘/邀約3-4；2出席→80-120通/80-100分鐘/邀約2-3" },
      { id: "d3t5", title: "加入業務 LINE 群", type: "info", description: "掃 QR code 或點連結加入，遇到問題直接在群裡問", resourceIndex: 2 },
      { id: "d3t6", title: "正式上機開發", type: "call", time: "13:00-19:00", description: "第一天上機！用 CRM 管理名單，照撥打順序開始打。目標：150 通次 / 120 分鐘通時 / 3-5 邀約", tip: "不要預設立場！CRM 上面寫拒絕的都是狗屁判斷" },
      { id: "d3t7", title: "邀約成功 → 執行邀約後 4 步驟", type: "info", description: "①下 CRM 紀錄 ②建待辦預約 Demo ③LINE 改名（時間/姓名/英文名）④LINE 記事本存 CRM 資訊" },
      { id: "d3t8", title: "記錄今日 KPI 數據", type: "note", description: "記錄通次、通時、邀約數，回報到群組" },
      { id: "d3t9", title: "回報 Demo 客戶資訊", type: "info", description: "有邀約到 Demo 的客戶，把 CRM 資訊貼給業訓" },
      { id: "d3t10", title: "完成每日測驗", type: "quiz", description: "通過測驗解鎖 Day 4", tip: "及格線 60 分" },
    ],
    quiz: [
      {
        question: "一筆名單打幾次後就不用再打了？",
        options: ["3 次", "4-5 次", "6-7 次", "10 次"],
        answer: 2,
      },
      {
        question: "客戶明確拒絕一次，應該怎麼做？",
        options: ["再打三次試試", "直接丟拒絕，不浪費時間", "放到暫緩區等一週", "轉給同事"],
        answer: 1,
      },
      {
        question: "撥打名單的正確順序是？",
        options: ["隨機撥打", "建立日期從近到遠、撥打次數從少到多", "從老名單開始", "只打新名單"],
        answer: 1,
      },
      {
        question: "邀約後的第一步是？",
        options: ["通知主管", "下 CRM 聯絡紀錄", "傳 LINE 給客戶", "安排 Demo"],
        answer: 1,
      },
      {
        question: "CRM 紀錄模板要記錄哪 7 項？",
        options: [
          "姓名/電話/地址/職業/收入/興趣/備註",
          "學習目標/身分/動機經驗/給予價值/學習時間/門檻/裝置",
          "年齡/性別/學歷/婚姻/小孩/房產/車",
          "品牌/產品/價格/優惠/付款/物流/售後",
        ],
        answer: 1,
      },
      {
        question: "0 出席時的通次 KPI 標準是？",
        options: ["50-80 通", "80-100 通", "130-160 通", "200 通以上"],
        answer: 2,
      },
    ],
  },

  // ===================== DAY 4 =====================
  {
    id: 4,
    day: 4,
    title: "學習 Demo",
    subtitle: "業訓日會、Demo 影片觀看、成交錄音分析",
    description:
      "今天開始學習 Demo（產品說明會）。Demo 是透過 Google Meet 螢幕分享，1 對 1 帶客戶了解課程內容。你會先觀看 Demo 訓練影片，學習 Demo 的架構和流程，然後聽 3 段過往成交錄音來理解實戰怎麼做。Demo 要看三大重點：①架構——每個環節該說什麼話 ②信任感——如何搭建起來 ③反對問題——客戶提出的問題如何化解。看完後思考：如果你做 Demo，該怎麼做會更好？",
    schedule: [
      { time: "10:45-12:00", task: "【業訓】業訓日會/據點日會", description: "收斂昨日開發狀況、問題交流" },
      { time: "12:00-13:00", task: "午休" },
      { time: "13:00-17:00", task: "【業訓】學習 Demo", description: "觀看 Demo 影片、逐字稿、成交錄音（3段），分析三大重點" },
      { time: "17:00-19:00", task: "【業訓】學習 Demo（續）", description: "繼續消化 Demo 內容，做筆記" },
    ],
    content: [
      "【Demo 是什麼？】",
      "　• Demo ＝ 產品說明會，透過 Google Meet 螢幕分享，1 對 1 帶客戶了解課程",
      "　• 不是在「賣課程」，是在幫客戶「規劃學習路徑」——從他的現況出發，找到適合的學習方式",
      "",
      "【Demo 流程架構】",
      "　• P1-P3 引言破冰：從「你是誰」開始聊，不要直接進產品",
      "　• P4-P5 放大市場環境：讓客戶看到學習的必要性",
      "　• P6-P9 學習服務價值：務必給客戶看兩個課程影片（1+1 > 2 的學習效果）",
      "　• P9-P12 客製化規劃與收尾：短期(3個月)/中期(6個月)/長期(1年) 學習計畫",
      "",
      "【Demo 訓練影片觀看】認識完整 Demo 流程",
      "【Demo 逐字稿學習】了解每個環節的說法",
      "",
      "【過往成交錄音分析（3段）】",
      "　• 譚睦懷（17歲學生，爸媽最後刷卡）→ 重點看：信心建立的過程",
      "　• 楊燿銓（學生）→ 重點看：信心建立",
      "　• Terry Li（怕學不好）→ 重點看：反對問題處理技巧",
      "",
      "【Demo 三大重點（一定要筆記）】",
      "　① 架構：每個環節該說什麼話、怎麼銜接",
      "　② 信任感：如何搭建起來、如何每次破冰",
      "　③ 反對問題處理：客戶提出的問題往往是表面，要挖掘背後真正顧慮",
    ],
    keyPoints: [
      "Demo 流程：P1-P3 引言破冰 → P4-P5 放大市場環境 → P6-P9 學習服務價值 → P9-P12 客製化規劃與收尾",
      "Demo 教學核心：理論（影片由淺入深）→ 實作（財經教練帶市場實況）→ 實戰（APP 模擬交易）",
      "務必給客戶看兩個課程影片，不是只單獨給他要什麼——要讓他感受 1+1 > 2 的學習效果",
      "收尾三次確認：複利觀念、為什麼投資、什麼時候開始→帶入個人學習計畫",
    ],
    resources: [
      { title: "Demo 訓練影片", type: "video", driveFileId: "1L4hmylxNv5j6BR9pAFH6L0EnEkGl6u7h", description: "完整 Demo 流程錄影" },
      { title: "Demo 逐字稿", type: "notion", url: "https://rattle-notify-a6d.notion.site/230b581c6726800b8684c2098c604735", description: "Demo 每個環節的完整說法" },
      { title: "譚睦懷成交錄音（17歲，信心建立）", type: "recording", driveFileId: "1DeG0MKBjhrjPG7e33BtaB5twCtno3x-6", description: "17歲學生，爸媽最後刷卡" },
      { title: "楊燿銓成交錄音（學生，信心建立）", type: "recording", driveFileId: "1XX2xB0Z4bsp9I-a1UeMnuXNAd6dM078D", description: "學生客戶成交過程" },
      { title: "Terry Li 成交錄音（反對問題處理）", type: "recording", driveFileId: "11jlteuLlhODzJFsD811oATACDmtS_MrF", description: "客戶怕學不好，如何化解" },
      { title: "K 棒組合白話版", type: "document", url: "https://docs.google.com/document/d/1uecWnU7cHNWNJsaVMyFIxosX_oq140vc7tw0Oyw_4wM/edit", description: "技術面教學輔助，Demo 時可帶客戶看" },
    ],
    trainerTips: [
      "先把 Demo 資訊記得去把每個銷售點和問題給記錄",
      "筆記很重要，你自己能吸收不能吸收會是重點",
      "Demo 要去看：①架構每個環節該說什麼 ②信任感如何搭建 ③反對問題如何化解",
      "看完後思考：如果我做 Demo，該怎麼做會更好",
      "不是在賣課程，是在幫客戶規劃學習路徑——從他的現況出發，找到適合的學習方式",
    ],
    practiceTask: "觀看 Demo 影片和 3 段成交錄音，針對三大重點（架構、信任感、反對問題）做筆記。每段錄音各寫出 1 個學到的技巧",
    hasSparring: false,
    tasks: [
      { id: "d4t1", title: "業訓日會 / 據點日會", type: "review", time: "10:45-12:00", description: "參加日會，了解今日訓練重點" },
      { id: "d4t2", title: "觀看 Demo 訓練影片", type: "watch", time: "13:00-15:00", description: "仔細看 Demo 的完整流程", resourceIndex: 0 },
      { id: "d4t3", title: "學習 Demo 逐字稿", type: "note", description: "對照影片和逐字稿，理解每個銷售點", resourceIndex: 1 },
      { id: "d4t4", title: "聽成交錄音 1：譚睦懷", type: "listen", description: "17歲客戶，學習信心建立技巧", resourceIndex: 2 },
      { id: "d4t5", title: "聽成交錄音 2：楊燿銓", type: "listen", description: "學生客戶，信心建立", resourceIndex: 3 },
      { id: "d4t6", title: "聽成交錄音 3：Terry Li", type: "listen", description: "反對問題處理技巧", resourceIndex: 4 },
      { id: "d4t7", title: "Demo 三大重點筆記", type: "note", description: "針對架構、信任感、反對問題做筆記", tip: "每段錄音各寫出 1 個學到的技巧" },
      { id: "d4t8", title: "完成每日測驗", type: "quiz", description: "通過測驗解鎖 Day 5", tip: "及格線 60 分" },
    ],
    quiz: [
      {
        question: "Demo 的三大重點不包括哪項？",
        options: ["架構每個環節該說什麼", "信任感如何搭建", "反對問題如何化解", "快速報價成交"],
        answer: 3,
      },
      {
        question: "Demo 時為什麼要給客戶看兩個課程影片？",
        options: ["影片越多越好", "讓客戶感受 1+1 > 2 的學習效果", "湊時間", "公司規定"],
        answer: 1,
      },
      {
        question: "Demo 教學核心「理論→實作→實戰」中，「實作」指的是？",
        options: ["看更多影片", "財經教練帶你到市場看現況、解決問題", "自己上網查資料", "背誦筆記"],
        answer: 1,
      },
      {
        question: "Demo 收尾時的三次確認順序是？",
        options: ["價格→付款→簽約", "複利觀念→為什麼投資→什麼時候開始", "介紹課程→報價→成交", "提問→回答→結束"],
        answer: 1,
      },
    ],
  },

  // ===================== DAY 5 =====================
  {
    id: 5,
    day: 5,
    title: "持續開發｜流程整合",
    subtitle: "業訓日會、成交後流程、銷售方案、持續上機",
    description:
      "今天早上的業訓日會會收斂昨天 Demo 學習中看到的問題，然後教學成交後流程、銷售方案、課程結構和金流申辦——這些是你成交後需要操作的完整流程。學完之後繼續上機開發，把這幾天學到的全部整合起來。你現在已經具備了開發架構 + Demo 知識，目標是穩定出邀約，有 Demo 就開始自己做！",
    schedule: [
      { time: "09:45-11:00", task: "【業訓】業訓日會", description: "收斂 Demo 問題、教學成交後流程/銷售方案/課程結構/金流申辦" },
      { time: "11:00-12:00", task: "【業訓】上機開發" },
      { time: "12:00-13:00", task: "午休" },
      { time: "13:00-16:00", task: "【業訓_財經】上機", description: "持續撥打，整合開發架構 + Demo 知識" },
    ],
    content: [
      "【業訓日會內容】",
      "　• 收斂昨日 Demo 影片學到的問題",
      "　• 成交後流程教學 → 簽約後的完整操作流程",
      "　• 銷售方案說明 → 各方案內容、價格邏輯、選課建議",
      "　• 課程結構說明 → 五大領域：理財投資核心/基本面/技術面/籌碼面/ETF",
      "　• 金流申辦 → 簽約後金流處理方式（刷卡/匯款/分期）",
      "",
      "【課程五大領域（Demo 時要能跟客戶說明）】",
      "　① 理財投資核心：投資觀念、風險管理、資產配置基礎",
      "　② 基本面分析：看懂財報、產業分析、公司價值評估",
      "　③ 技術面分析：K 棒、均線、型態、指標判讀",
      "　④ 籌碼面分析：法人動向、主力進出、籌碼集中度",
      "　⑤ ETF 投資：ETF 選擇、配置策略、定期定額",
      "",
      "【持續上機開發】",
      "　• 整合這幾天學到的開發架構，穩定通時通次",
      "　• 有邀約就開始嘗試自己做 Demo（學長姐旁聽輔助）",
      "　• 1-3 次 Pass 之後就要自己來",
      "　• 下班前回報今日邀約和 Demo 狀況",
    ],
    keyPoints: [
      "第一週 → 訓練開發、練熟架構 → 第三天或第四天開始有邀約 → Pass 給學長 → 出單 → 學習 Demo",
      "課程五大領域：理財投資核心、基本面、技術面、籌碼面、ETF",
      "新人成交率：5-6 個 Demo 出席 = 1 成交；正式業務 4-5 個；資深業務 3-4 個",
      "業績好的不一定很聰明，但一定自律、努力、正面、積極、抗壓性強",
    ],
    resources: [
      { title: "成交後流程", type: "notion", url: "https://rattle-notify-a6d.notion.site/230b581c672680ddb1bee3d18728f630", description: "簽約後的完整操作流程" },
      { title: "銷售方案", type: "notion", url: "https://rattle-notify-a6d.notion.site/230b581c672680468487d038103613a7", description: "各方案內容與價格" },
      { title: "課程結構", type: "notion", url: "https://rattle-notify-a6d.notion.site/230b581c672680abb6d3e407f152b50c", description: "五大領域課程大綱" },
      { title: "金流申辦", type: "notion", url: "https://rattle-notify-a6d.notion.site/230b581c6726805b920ee0cd49a01954", description: "簽約後金流處理方式" },
      { title: "銷售小工具", type: "notion", url: "https://nschool-gif.github.io/notion-interactive/", description: "一鍵複製客戶資訊，傳送給客戶用" },
    ],
    trainerTips: [
      "學完 Demo 之後就可以自己做了，1-3 次 Pass 之後就要自己來",
      "持續穩定通時通次，這是一切成交的基礎",
      "Demo 時記得前後呼應：開頭問他為什麼來、中間帶學習方式、收尾拉回他的初衷",
      "強者則強，弱者恆弱。未來你們學完一定可以的，加油！",
    ],
    kpiTargets: {
      calls: "130-160",
      talkTime: "100-150 分鐘",
      invites: "4-5",
    },
    practiceTask: "持續上機開發。有 Demo 出席就嘗試自己做，旁邊有學長姐輔助。下班前回報今日通次/通時/邀約/Demo 狀況",
    hasSparring: true,
    sparringType: "live_call",
    tasks: [
      { id: "d5t1", title: "業訓日會", type: "review", time: "09:45-11:00", description: "收斂 Demo 問題、學習成交後流程/銷售方案/課程結構/金流" },
      { id: "d5t2", title: "看懂成交後流程", type: "info", description: "簽約後的完整操作流程（開帳號、寄 Welcome Mail、加入學習群）", resourceIndex: 0 },
      { id: "d5t3", title: "了解銷售方案和課程結構", type: "info", description: "五大領域：理財核心/基本面/技術面/籌碼面/ETF。了解各方案價格邏輯", resourceIndex: 1 },
      { id: "d5t4", title: "了解金流申辦", type: "info", description: "刷卡/匯款/分期的處理方式", resourceIndex: 3 },
      { id: "d5t5", title: "上機開發", type: "call", time: "11:00-19:00", description: "目標：130-160 通次 / 100-150 分鐘通時 / 4-5 邀約", tip: "整合這幾天學到的所有架構知識" },
      { id: "d5t6", title: "嘗試自己做 Demo", type: "practice", description: "有 Demo 出席就嘗試自己做，旁邊有學長姐輔助", tip: "1-3 次 Pass 之後就要自己來！記得 Demo 前看客戶的 CRM 資訊" },
      { id: "d5t7", title: "回報今日數據", type: "note", description: "下班前回報通次/通時/邀約/Demo 狀況到群組" },
      { id: "d5t8", title: "完成每日測驗", type: "quiz", description: "通過測驗解鎖 Day 6", tip: "及格線 60 分" },
    ],
    quiz: [
      {
        question: "nSchool 課程的五大領域不包括？",
        options: ["理財投資核心", "基本面", "技術面", "房地產分析"],
        answer: 3,
      },
      {
        question: "新人業務的成交率大約是？",
        options: ["每 2 個 Demo 出席 1 成交", "每 5-6 個 Demo 出席 1 成交", "每 10 個 Demo 出席 1 成交", "每 1 個 Demo 就成交"],
        answer: 1,
      },
      {
        question: "第一週的重點進程是？",
        options: [
          "只練習不上機",
          "訓練開發→練熟架構→有邀約→Pass學長→出單→學Demo",
          "直接做 Demo",
          "背完話術就上機",
        ],
        answer: 1,
      },
      {
        question: "KPI 循環的起點是什麼？",
        options: ["成交", "邀約", "通次（撥打量）", "出席"],
        answer: 2,
      },
    ],
  },

  // ===================== DAY 6-9: 進階訓練 =====================
  {
    id: 6,
    day: 6,
    title: "進階開發｜架構精進",
    subtitle: "深度架構對練、受眾分析、引導技巧",
    description:
      "你已經完成第一週的訓練了！從今天開始進入進階階段——不再只是走完架構，而是要把架構內化到可以自然對話。重點練習 STEP2-STEP3 的深度聊天能力，以及根據不同受眾（學生/在職/高資產）調整引導方式。",
    content: [
      "【深度架構對練】不再照架構念，要做到自然對話",
      "",
      "【受眾分析進階】不同受眾的切入點、痛點、關注點完全不同：",
      "　• 學生（大學生）→ 聊科系、同學在做什麼、未來規劃、零用錢怎麼管理",
      "　• 上班族 → 聊產業現況、薪水瓶頸、同事有沒有在投資、退休規劃",
      "　• 待業中 → 聊之前做什麼工作、為什麼離開、想轉什麼方向、有沒有想過多一個技能",
      "　• 高資產 → 聊目前的投資組合、有沒有遇到瓶頸、想不想有系統地學",
      "",
      "【引導技巧深化】",
      "　• 三步法：開話題 → 延伸（深入了解）→ 引導（帶到學習需求）",
      "　• 引導 ＝ 幫客戶戴帽子，讓他覺得「我行、我可以、這就是我要的路」",
      "　• 引導 ≠ 說服。不要去說服客戶，要讓他自己說出需求",
      "",
      "【複習】聽自己上週的 Call 錄音，找出與成交錄音的差距",
    ],
    keyPoints: [
      "架構是骨幹，語氣和引導才是靈魂",
      "STEP2 不要急著進入 STEP3，多花時間了解客戶背景",
      "引導 ≠ 說服，幫客戶找到他沒看到的可能性",
      "開發制度：避免說「想不想」→「不要不要」，改用「好不好」或直接引導時間",
    ],
    trainerTips: [
      "受眾分析：學生聊科系、同學、未來規劃；在職聊產業、薪水、同事；待業聊轉職方向",
      "邀約不是問對方有沒有空，是直接引導：今天？明天？上午？下午？幾點？",
      "年齡 18-30 為主，大多無經驗，客戶話信 50% 就好",
      "有經驗的客戶用請益方式：「0-10 你了解幾分？剩下幾分差在哪？」",
    ],
    practiceTask: "進階架構對練，按受眾分（學生/上班族/待業），全程自然對話不看稿。對練完聽錄音，對比成交錄音找差距",
    hasSparring: true,
    sparringType: "full_call",
    tasks: [
      { id: "d6t1", title: "聽自己上週的 Call 錄音", type: "listen", description: "找出與成交錄音的差距" },
      { id: "d6t2", title: "受眾分析進階", type: "note", description: "學生聊科系/同學；在職聊產業/薪水；待業聊轉職方向" },
      { id: "d6t3", title: "進階架構對練（不看稿）", type: "practice", description: "按受眾分（學生/上班族/待業），全程自然對話", tip: "STEP2 不要急著進入 STEP3，多花時間了解客戶" },
      { id: "d6t4", title: "對練完聽錄音找差距", type: "listen", description: "對比成交錄音，找出可以優化的地方" },
      { id: "d6t5", title: "完成每日測驗", type: "quiz", description: "通過測驗解鎖 Day 7", tip: "及格線 60 分" },
    ],
    quiz: [
      {
        question: "面對有經驗的客戶，應該用什麼方式？",
        options: ["直接教他", "請益方式：0-10 你了解幾分？剩下差在哪？", "跳過背景探索", "直接報價"],
        answer: 1,
      },
      {
        question: "邀約時的正確做法是？",
        options: ["問客戶有沒有空", "直接引導時間：今天？明天？上午？下午？", "說「你想不想了解」", "等客戶主動約"],
        answer: 1,
      },
      {
        question: "「引導」的正確描述是？",
        options: ["用道理說服客戶", "幫客戶戴帽子，讓他覺得我行、我可以", "告訴客戶他錯了", "快速進入成交"],
        answer: 1,
      },
    ],
  },
  {
    id: 7,
    day: 7,
    title: "Demo 實戰練習",
    subtitle: "模擬 Demo 對練、反對問題處理、成交技巧",
    description:
      "今天專注練習 Demo 實戰。兩人一組模擬完整 Demo 流程——從引言破冰到客製化規劃到收尾成交。重點練習反對問題處理：「太貴了」「我要想想」「我沒時間」等常見異議。記得 Demo 不是在賣課程，是在幫客戶規劃學習路徑。",
    content: [
      "Demo 完整對練：一人扮業務做完整 Demo，一人扮客戶提異議",
      "反對問題處理專項練習",
      "財報解讀練習：帶客戶看營建股財報，找合約負債",
      "客製化規劃練習：短期(3個月)/中期(6個月)/長期(1年) 學習計畫",
    ],
    keyPoints: [
      "反對問題的表面≠真正顧慮，要挖掘背後原因",
      "客製化規劃要具象化：Key 出來讓客戶看到自己的學習軌跡",
      "收尾三次確認：複利觀念→為什麼投資→什麼時候開始",
      "不會從「你錯了」的角度說話，而是從「我們一起怎麼走得更輕鬆」引導",
    ],
    resources: [
      { title: "Demo 訓練影片", type: "video", driveFileId: "1L4hmylxNv5j6BR9pAFH6L0EnEkGl6u7h", description: "完整 Demo 流程錄影" },
      { title: "Demo 逐字稿", type: "notion", url: "https://rattle-notify-a6d.notion.site/230b581c6726800b8684c2098c604735", description: "Demo 每個環節的完整說法" },
      { title: "學米 DEMO 流程示範", type: "video", driveFileId: "1K6EPCzIz9wxjze15_3Tl3s-Lp226UVKh", description: "標準學米 DEMO 流程完整示範" },
      { title: "嵇映甯 DEMO 實戰（學米）", type: "video", driveFileId: "1wYq0ycCDY_wvruMVEyr05Ttd2jY1eUGR", description: "學米實戰 DEMO 錄影" },
      { title: "林錫昌 DEMO 實戰（學米）", type: "video", driveFileId: "1K4zHCwxguc3sHMKLwfciWHsh6tywrkvX", description: "學米實戰 DEMO 錄影" },
      { title: "林佳霖 DEMO 實戰（學米）", type: "video", driveFileId: "1zFn5BjV5eJJEibwnZk3zwFtzEUoab619", description: "學米實戰 DEMO 錄影" },
      { title: "無限 DEMO 流程示範", type: "video", driveFileId: "1ABlZjToGKz1FEzDpj7oRx3A3W23-i4zL", description: "標準無限 DEMO 流程完整示範" },
      { title: "楊祤豪 DEMO 實戰（無限）", type: "video", driveFileId: "1CCwbb1arrWqhF0NieSZH01D-ujEHqsXI", description: "無限實戰 DEMO 錄影" },
      { title: "陳紀志 DEMO 實戰（無限）", type: "video", driveFileId: "1zo5VwssmVCjSAJPFbRrEpwKB9SrtGh14", description: "無限實戰 DEMO 錄影" },
      { title: "洪楷雯 DEMO 實戰（無限）", type: "video", driveFileId: "1F51tnaY5bJUE1bs2iCxA-qmQcqiw-n5M", description: "無限實戰 DEMO 錄影" },
    ],
    trainerTips: [
      "Demo 的引言就是重新開發：先從「他是誰」開始聊，不要直接進產品",
      "從職涯拉到生活的壓力點與隱藏的焦慮，這裡是關鍵",
      "記下客戶說的話，後面介紹課程時回扣他親口說的——讓他自己看見現況",
      "投資風險屬性評估問卷：蒐集客戶學習領域、學習預算，做初步篩選",
    ],
    practiceTask: "兩人一組模擬完整 Demo，一人設定客戶異議（太貴/沒時間/怕學不好）。對練完互評三大重點，再對換角色",
    hasSparring: true,
    sparringType: "demo",
    tasks: [
      { id: "d7t1", title: "觀看 Demo 流程示範影片", type: "watch", description: "學米 + 無限的標準 Demo 流程", resourceIndex: 2 },
      { id: "d7t2", title: "觀看 Demo 實戰影片（6支）", type: "watch", description: "學米 3 支 + 無限 3 支實戰錄影", resourceIndex: 3 },
      { id: "d7t3", title: "Demo 完整對練", type: "practice", description: "一人扮業務做完整 Demo，一人扮客戶提異議" },
      { id: "d7t4", title: "反對問題處理練習", type: "practice", description: "練習處理「太貴/沒時間/怕學不好」", tip: "反對問題的表面≠真正顧慮" },
      { id: "d7t5", title: "客製化規劃練習", type: "note", description: "短期(3個月)/中期(6個月)/長期(1年) 學習計畫" },
      { id: "d7t6", title: "互評三大重點", type: "review", description: "架構、信任感、反對問題 — 互相給回饋" },
      { id: "d7t7", title: "完成每日測驗", type: "quiz", description: "通過測驗解鎖 Day 8", tip: "及格線 60 分" },
    ],
    quiz: [
      {
        question: "Demo 引言的正確做法是？",
        options: ["直接介紹課程", "先從「他是誰」開始聊，重新開發", "播放公司介紹影片", "讀簡報"],
        answer: 1,
      },
      {
        question: "客戶說「太貴了」時，應該？",
        options: ["馬上打折", "了解背後真正顧慮，化解表面異議", "結束 Demo", "說「不買你會後悔」"],
        answer: 1,
      },
      {
        question: "客製化規劃要包含哪些時間段？",
        options: ["1個月/2個月/3個月", "短期3個月/中期6個月/長期1年", "只規劃第一週", "按客戶要求"],
        answer: 1,
      },
    ],
  },
  {
    id: 8,
    day: 8,
    title: "綜合實戰",
    subtitle: "開發 + Demo 全流程整合",
    description:
      "把這段時間學到的所有技能整合——從第一通開發電話到邀約到 Demo 到成交的完整閉環。今天的重點是模擬真實客戶的全流程：開發 Call → 邀約 → Demo → 處理異議 → 收尾。用 AI 對練或跟夥伴練習，把每個環節串起來。",
    content: [
      "全流程模擬：開發 Call → 邀約 → Demo → 反對問題 → 收尾",
      "開發架構 7 步驟完整走一遍",
      "Demo 架構從引言到客製化規劃完整走一遍",
      "時間管理：開發 Call 控制在 12-15 分鐘，Demo 控制在 60 分鐘",
    ],
    resources: [
      { title: "開發 Call 逐字稿", type: "notion", url: "https://rattle-notify-a6d.notion.site/nschool-2025-c-03", description: "開發架構參考" },
      { title: "Demo 逐字稿", type: "notion", url: "https://rattle-notify-a6d.notion.site/230b581c6726800b8684c2098c604735", description: "Demo 流程參考" },
      { title: "Demo 訓練影片", type: "video", driveFileId: "1L4hmylxNv5j6BR9pAFH6L0EnEkGl6u7h", description: "完整 Demo 流程錄影" },
      { title: "學米 DEMO 流程示範", type: "video", driveFileId: "1K6EPCzIz9wxjze15_3Tl3s-Lp226UVKh", description: "學米 DEMO 完整示範" },
      { title: "無限 DEMO 流程示範", type: "video", driveFileId: "1ABlZjToGKz1FEzDpj7oRx3A3W23-i4zL", description: "無限 DEMO 完整示範" },
    ],
    keyPoints: [
      "全流程：開發→邀約→Demo→結單，每個環節都要有意識地練習",
      "開發 Call 12-15 分鐘是健康範圍",
      "Demo 60 分鐘內完成",
      "通時通次才會有邀約數，訓練業務力才會有成交",
    ],
    trainerTips: [
      "把模擬當作真實客戶，不要因為是練習就鬆懈",
      "每完成一次全流程，寫出 3 個做得好的 + 3 個要優化的",
      "業務就是敢去做敢去衝，不是預設立場最後瘋狂修補",
    ],
    practiceTask: "完成至少一次完整的全流程模擬（開發→邀約→Demo→收尾），記錄自己每個環節的表現",
    hasSparring: true,
    sparringType: "full_call",
    tasks: [
      { id: "d8t1", title: "開發架構 7 步驟完整走一遍", type: "practice", description: "開發 Call 控制在 12-15 分鐘" },
      { id: "d8t2", title: "Demo 架構完整走一遍", type: "practice", description: "從引言到客製化規劃，控制在 60 分鐘" },
      { id: "d8t3", title: "全流程模擬", type: "practice", description: "開發→邀約→Demo→反對問題→收尾", tip: "把模擬當作真實客戶，不要鬆懈" },
      { id: "d8t4", title: "寫出 3 優 + 3 優化", type: "note", description: "每完成一次全流程，記錄做得好和要改進的" },
      { id: "d8t5", title: "完成每日測驗", type: "quiz", description: "通過測驗解鎖 Day 9", tip: "及格線 60 分" },
    ],
    quiz: [
      {
        question: "完整銷售流程的順序是？",
        options: ["Demo→開發→成交", "開發→邀約→Demo→結單", "邀約→開發→收尾", "Demo→收尾→開發"],
        answer: 1,
      },
      {
        question: "開發 Call 的健康時長是？",
        options: ["5 分鐘", "12-15 分鐘", "30 分鐘", "60 分鐘"],
        answer: 1,
      },
      {
        question: "「通時通次才會有邀約數」的意思是？",
        options: ["打越多電話就越好", "撥打量和通話時間是邀約的基礎，要先穩定活動量", "只要有邀約就好", "時間不重要"],
        answer: 1,
      },
    ],
  },
  {
    id: 9,
    day: 9,
    title: "實戰考核",
    subtitle: "模擬客戶電話、綜合評分",
    description:
      "最終考核！你會面對一位模擬客戶，完整走完一通開發 Call 的 7 步驟架構。這不是背誦考試——而是看你能不能像真實打電話一樣自然地引導客戶。評分看的是：開場力、背景探索深度、引導技巧、架構完整性、異議處理、成交推進。70 分及格。",
    content: [
      "考核形式：模擬真實客戶，完整走完一通開發 Call",
      "評分維度：開場力、背景探索深度、引導技巧、架構完整性、異議處理、成交推進",
      "及格標準：綜合分數 70 分以上",
      "考核後生成完整分析報告",
    ],
    keyPoints: [
      "把考核當作真實的一通開發 Call，不要因為考試就緊張過頭",
      "記得引導不是說服，要讓客戶自己說出需求",
      "STEP2-STEP3 多聊天，不要急著進入銷售環節",
      "考核可以重複進行，每次都會有不同受眾背景",
    ],
    trainerTips: [
      "聲音放輕鬆，越緊張越卡，必要時站起來講",
      "架構要完整走完，不要跳步驟",
      "收尾時給選擇，不要問「要不要」",
    ],
    practiceTask: "完成實戰考核，針對考核報告寫出 2 好 + 3 優化，制定下一步個人訓練計畫",
    hasSparring: true,
    sparringType: "exam",
    tasks: [
      { id: "d9t1", title: "考前準備", type: "info", description: "放輕鬆，把考核當作真實的一通開發 Call" },
      { id: "d9t2", title: "完成實戰考核", type: "practice", description: "模擬真實客戶，完整走完開發 Call 7 步驟", tip: "70 分及格，架構要完整走完不要跳步驟" },
      { id: "d9t3", title: "考核報告：2 好 + 3 優化", type: "note", description: "針對考核報告寫出反思" },
      { id: "d9t4", title: "制定個人訓練計畫", type: "note", description: "根據考核結果，制定下一步自我提升方向" },
      { id: "d9t5", title: "完成最終測驗", type: "quiz", description: "完成 9 天訓練！", tip: "及格線 60 分" },
    ],
    quiz: [
      {
        question: "實戰考核的及格標準是？",
        options: ["60 分", "70 分", "80 分", "90 分"],
        answer: 1,
      },
      {
        question: "考核評分不包括下列哪個維度？",
        options: ["背景探索深度", "引導技巧", "話術背誦完整度", "異議處理"],
        answer: 2,
      },
      {
        question: "考核中哪個階段最不應該被跳過？",
        options: ["STEP1 開場", "STEP2-STEP3 背景探索與需求挖掘", "STEP5 教學說明", "收尾 CTA"],
        answer: 1,
      },
    ],
  },
];
