// ============================================================
// Mentorship Training Schedule — 4-Week Progressive System
// ============================================================

export interface WeekConfig {
  week: number;
  title: string;
  subtitle: string;
  coreFocus: string;
  mentorRole: string;
  mentorRoleLabel: string;
  retentionTarget?: string;
}

export interface DailyTarget {
  day: number;
  week: number;
  dayInWeek: number;
  callTarget: number;
  inviteTarget: number;
  attendanceTarget: number;
  keyAction: string;
  mentorAction: string;
  mentorFocusType:
    | 'demo'
    | 'listen'
    | 'feedback'
    | 'mindset'
    | 'observe'
    | 'review'
    | 'handoff';
}

export interface MentorTask {
  id: string;
  category: '實戰示範' | '旁聽指導' | '每日回饋' | '心態引導' | '數據監控';
  title: string;
  frequency: string;
  purpose: string;
}

export interface FeedbackEntry {
  date: string;
  day: number;
  callTarget: number;
  actualCalls: number;
  targetRate: number;
  invites: number;
  demos: number;
  strength1: string;
  strength2: string;
  improvement: string;
  mentorSignature: string;
  traineeSignature: string;
}

// ------------------------------------------------------------
// Week Configurations
// ------------------------------------------------------------

export const WEEKS: WeekConfig[] = [
  {
    week: 0,
    title: '總部訓練',
    subtitle: '合約導讀、架構對練',
    coreFocus: '結構化知識傳遞',
    mentorRole: 'trainer',
    mentorRoleLabel: '訓練師',
  },
  {
    week: 1,
    title: '建立習慣',
    subtitle: '生存優先，降低挫折',
    coreFocus: '降低挫折感，建立工作習慣',
    mentorRole: 'coach',
    mentorRoleLabel: '教練 (Coach)',
    retentionTarget: '80% 以上',
  },
  {
    week: 2,
    title: '標準對齊',
    subtitle: '數據達標，觀摩轉化',
    coreFocus: '體力與心理磨合，確認穩定產出',
    mentorRole: 'model',
    mentorRoleLabel: '標竿 (Model)',
  },
  {
    week: 3,
    title: '實戰上手',
    subtitle: '角色互換，實戰上手',
    coreFocus: '與其教一百遍，不如讓他摔一遍',
    mentorRole: 'copilot',
    mentorRoleLabel: '副駕駛 (Co-pilot)',
  },
  {
    week: 4,
    title: '獨立驗收',
    subtitle: '穩定產出，自我診斷',
    coreFocus: '教怎麼看數據，引導自我修正',
    mentorRole: 'advisor',
    mentorRoleLabel: '顧問 (Advisor)',
  },
];

// ------------------------------------------------------------
// Daily Targets (Day 3–22, 20 working days post-HQ)
// ------------------------------------------------------------

export const DAILY_TARGETS: DailyTarget[] = [
  // ---- Week 1 ----
  {
    day: 3,
    week: 1,
    dayInWeek: 1,
    callTarget: 30,
    inviteTarget: 0,
    attendanceTarget: 0,
    keyAction: '熟悉撥打系統、講順開場白',
    mentorAction: '全示範：師徒打給新人看，建立信心',
    mentorFocusType: 'demo',
  },
  {
    day: 4,
    week: 1,
    dayInWeek: 2,
    callTarget: 30,
    inviteTarget: 0,
    attendanceTarget: 0,
    keyAction: '嘗試完成初步需求確認，練習處理軟釘子拒絕',
    mentorAction: '陪同撥打：師徒旁聽並即時給予回饋',
    mentorFocusType: 'listen',
  },
  {
    day: 5,
    week: 1,
    dayInWeek: 3,
    callTarget: 40,
    inviteTarget: 0,
    attendanceTarget: 0,
    keyAction: '練習處理軟釘子拒絕、走完架構',
    mentorAction: '錄音檢討：針對拒絕點進行 2+1 回饋',
    mentorFocusType: 'feedback',
  },
  {
    day: 6,
    week: 1,
    dayInWeek: 4,
    callTarget: 50,
    inviteTarget: 0,
    attendanceTarget: 0,
    keyAction: '練習走完整體架構',
    mentorAction: '話術對練：師徒模擬客戶進行異議處理',
    mentorFocusType: 'demo',
  },
  {
    day: 7,
    week: 1,
    dayInWeek: 5,
    callTarget: 60,
    inviteTarget: 1,
    attendanceTarget: 0,
    keyAction: '提高邀約嘗試次數',
    mentorAction:
      '觀察期：確保新人動作不變形\n心態建設：分享成功案例，預告下週目標',
    mentorFocusType: 'mindset',
  },

  // ---- Week 2 ----
  {
    day: 8,
    week: 2,
    dayInWeek: 1,
    callTarget: 80,
    inviteTarget: 1,
    attendanceTarget: 0,
    keyAction: '對齊標準，適應高強度節奏',
    mentorAction:
      '對齊標準：師徒嚴格監督通話數，不達標需留下來檢討原因',
    mentorFocusType: 'observe',
  },
  {
    day: 9,
    week: 2,
    dayInWeek: 2,
    callTarget: 80,
    inviteTarget: 1,
    attendanceTarget: 0,
    keyAction: '記錄並分析拒絕原因',
    mentorAction:
      '實戰示範 1：師父示範完整 Demo，新人旁聽並做筆記',
    mentorFocusType: 'demo',
  },
  {
    day: 10,
    week: 2,
    dayInWeek: 3,
    callTarget: 80,
    inviteTarget: 1,
    attendanceTarget: 0,
    keyAction: '熟練從邀約轉 Demo 的關鍵話術',
    mentorAction:
      '2+1 回饋：針對新人邀約話術的開口契機進行指導',
    mentorFocusType: 'feedback',
  },
  {
    day: 11,
    week: 2,
    dayInWeek: 4,
    callTarget: 80,
    inviteTarget: 1,
    attendanceTarget: 0,
    keyAction: '爭取可以開始做 Demo',
    mentorAction:
      '實戰示範 2：師父再次示範 Demo，重點放在解反對問題',
    mentorFocusType: 'demo',
  },
  {
    day: 12,
    week: 2,
    dayInWeek: 5,
    callTarget: 80,
    inviteTarget: 1,
    attendanceTarget: 0,
    keyAction:
      '整理本週約到的 Demo 準客戶名單\n熟悉產品 FAQ 與 Demo 簡報',
    mentorAction:
      '實戰示範 3：師父再次示範 Demo，重點放在解反對問題\n心態建設：肯定新人本週達標 80 通，預告下週上場',
    mentorFocusType: 'mindset',
  },

  // ---- Week 3 ----
  {
    day: 13,
    week: 3,
    dayInWeek: 1,
    callTarget: 100,
    inviteTarget: 2,
    attendanceTarget: 1,
    keyAction: '首場獨立 Demo (師父旁聽)',
    mentorAction:
      '即時救援：新人卡住時師徒接手，結束後立即 2+1 回饋',
    mentorFocusType: 'demo',
  },
  {
    day: 14,
    week: 3,
    dayInWeek: 2,
    callTarget: 100,
    inviteTarget: 2,
    attendanceTarget: 1,
    keyAction: '優化 Demo 流程中的產品介紹',
    mentorAction:
      '復盤指導：針對 Demo 的缺失，進行 15 分鐘專項訓練',
    mentorFocusType: 'feedback',
  },
  {
    day: 15,
    week: 3,
    dayInWeek: 3,
    callTarget: 100,
    inviteTarget: 2,
    attendanceTarget: 1,
    keyAction: '嘗試在 Demo 中進行締結/成交',
    mentorAction:
      '重點觀察：觀察新人敢不敢要業績，適時給予信心引導',
    mentorFocusType: 'observe',
  },
  {
    day: 16,
    week: 3,
    dayInWeek: 4,
    callTarget: 100,
    inviteTarget: 2,
    attendanceTarget: 1,
    keyAction: '獨立處理客戶異議並完成 Demo',
    mentorAction:
      '放手觀測：師徒減少介入次數，只在關鍵決策點提醒',
    mentorFocusType: 'observe',
  },
  {
    day: 17,
    week: 3,
    dayInWeek: 5,
    callTarget: 100,
    inviteTarget: 2,
    attendanceTarget: 1,
    keyAction:
      '整理成交/未成交案例分析\n結訓總結，準備面談資料',
    mentorAction:
      '深度 1:1：討論如何提升從 Demo 到成交的轉化率\n結訓驗收：師徒評估新人是否具備獨立上線能力，回報主管',
    mentorFocusType: 'review',
  },

  // ---- Week 4 ----
  {
    day: 18,
    week: 4,
    dayInWeek: 1,
    callTarget: 120,
    inviteTarget: 2,
    attendanceTarget: 1,
    keyAction: '全獨立作戰：自主安排 Demo 時間',
    mentorAction:
      '退居幕後：除非新人主動請求，否則師徒不主動介入 Demo',
    mentorFocusType: 'observe',
  },
  {
    day: 19,
    week: 4,
    dayInWeek: 2,
    callTarget: 120,
    inviteTarget: 2,
    attendanceTarget: 1,
    keyAction: '數據自檢：分析自己前三週的邀約率',
    mentorAction:
      '診斷回饋：師徒針對數據弱點給予一次專精指導（如：報價或締結流程）',
    mentorFocusType: 'feedback',
  },
  {
    day: 20,
    week: 4,
    dayInWeek: 3,
    callTarget: 120,
    inviteTarget: 2,
    attendanceTarget: 1,
    keyAction: '個案復盤：挑選一個失敗個案寫分析',
    mentorAction:
      '引導思考：問新人「如果你是客戶，你為什麼不買？」培養覺察力',
    mentorFocusType: 'mindset',
  },
  {
    day: 21,
    week: 4,
    dayInWeek: 4,
    callTarget: 120,
    inviteTarget: 2,
    attendanceTarget: 1,
    keyAction: '衝刺結案：追蹤本月尚未成交的名單',
    mentorAction:
      '協助追單：師徒協助新人分析名單優先順序，教導如何追單',
    mentorFocusType: 'handoff',
  },
  {
    day: 22,
    week: 4,
    dayInWeek: 5,
    callTarget: 120,
    inviteTarget: 2,
    attendanceTarget: 1,
    keyAction:
      '最終驗收回報：整理整月數據指標\n驗收會談',
    mentorAction:
      '正式考核：師徒與主管共同進行最後 1:1，確認是否完成此次師徒任務',
    mentorFocusType: 'review',
  },
];

// ------------------------------------------------------------
// Mentor Tasks
// ------------------------------------------------------------

export const MENTOR_TASKS: MentorTask[] = [
  {
    id: 'mt1',
    category: '實戰示範',
    title: '親自撥打電話、完整 Demo 示範',
    frequency: '每天 3-5 通 / 每週 3 場',
    purpose: '標竿價值：讓新人看見「正確的成交路徑」，建立對產品的信心',
  },
  {
    id: 'mt2',
    category: '旁聽指導',
    title: '即時旁聽新人通話',
    frequency: '前兩週累計 10 通以上',
    purpose: '即時糾偏：抓出新人話術中的致命傷，避免錯誤習慣定型',
  },
  {
    id: 'mt3',
    category: '每日回饋',
    title: '下班前 1:1 檢討 (2+1 格式)',
    frequency: '每天 15-30 分鐘',
    purpose: '情緒價值：透過肯定建立信任，透過錄音檢討精進技能',
  },
  {
    id: 'mt4',
    category: '心態引導',
    title: '挫折安撫與失敗經驗分享',
    frequency: '視新人狀態調整',
    purpose: '文化傳承：讓新人感受到團隊溫暖，降低第一週離職率',
  },
  {
    id: 'mt5',
    category: '數據監控',
    title: '填寫每日回饋表並回報',
    frequency: '每日填寫 / 每週五回報',
    purpose: '管理指標：將感性的輔導轉化為理性的數據，供主管決策',
  },
];

// ------------------------------------------------------------
// Week Summaries (懶人包)
// ------------------------------------------------------------

export const WEEK_SUMMARIES: Record<number, string> = {
  1: '示範 (Show Me) — 我做你看，建立信任',
  2: '觀摩 (Watch Me) — 量能達標，看我成交',
  3: '陪同 (Help Me) — 你做我改，即時救援',
  4: '獨立 (Let Me) — 你做我評，準備獨立',
};

// ------------------------------------------------------------
// Helper Functions
// ------------------------------------------------------------

export function getDailyTarget(absoluteDay: number): DailyTarget | undefined {
  return DAILY_TARGETS.find((t) => t.day === absoluteDay);
}

export function getWeekConfig(week: number): WeekConfig | undefined {
  return WEEKS.find((w) => w.week === week);
}

export function getCallTargetForDay(absoluteDay: number): number {
  if (absoluteDay <= 2) return 0; // HQ training days
  const target = getDailyTarget(absoluteDay);
  return target?.callTarget ?? 0;
}

export function isOverdue(
  absoluteDay: number,
  currentDay: number,
  taskCompleted: boolean,
): boolean {
  return currentDay > absoluteDay && !taskCompleted;
}
