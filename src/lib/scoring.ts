// Scoring engine for sparring sessions
import type { SparringScores } from "./store";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

// Keywords/patterns that indicate good sales behaviors
const SPIN_PATTERNS = {
  situation: [
    "目前", "現在", "工作", "背景", "經驗", "做什麼", "多久",
    "了解", "請問", "方便", "聊聊",
  ],
  problem: [
    "困擾", "問題", "挑戰", "難", "痛點", "不滿", "擔心",
    "瓶頸", "卡住", "不確定", "困難",
  ],
  implication: [
    "如果不", "繼續這樣", "長期", "影響", "後果", "代價",
    "錯過", "越來越", "落後", "風險",
  ],
  needPayoff: [
    "想像", "如果可以", "理想", "好處", "價值", "改變",
    "解決", "達成", "實現", "提升",
  ],
};

const OPENING_PATTERNS = [
  "你好", "您好", "嗨", "哈囉", "感謝", "謝謝", "今天",
  "方便", "打擾", "耽誤",
];

const OBJECTION_PATTERNS = [
  "理解", "了解你的", "確實", "很正常", "很多人也", "分期",
  "投資自己", "ROI", "回報", "換個角度", "不過",
];

const CLOSING_PATTERNS = [
  "下一步", "安排", "預約", "DEMO", "方案", "選擇",
  "開始", "報名", "加入", "時間", "什麼時候",
];

function countPatternMatches(text: string, patterns: string[]): number {
  return patterns.filter((p) => text.includes(p)).length;
}

export function scoreConversation(
  messages: ConversationMessage[]
): SparringScores {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content);
  const allUserText = userMessages.join(" ");
  const msgCount = userMessages.length;

  if (msgCount === 0) {
    return {
      opening: 0,
      spinCoverage: 0,
      painPointDepth: 0,
      solutionMatch: 0,
      objectionHandling: 0,
      closingPush: 0,
      overall: 0,
    };
  }

  // 1. Opening (first 1-2 messages)
  const openingText = userMessages.slice(0, 2).join(" ");
  const openingHits = countPatternMatches(openingText, OPENING_PATTERNS);
  const opening = Math.min(100, 40 + openingHits * 15);

  // 2. SPIN Coverage
  const sHits = countPatternMatches(allUserText, SPIN_PATTERNS.situation);
  const pHits = countPatternMatches(allUserText, SPIN_PATTERNS.problem);
  const iHits = countPatternMatches(allUserText, SPIN_PATTERNS.implication);
  const nHits = countPatternMatches(allUserText, SPIN_PATTERNS.needPayoff);
  const spinStages = [sHits > 0, pHits > 0, iHits > 0, nHits > 0].filter(Boolean).length;
  const spinCoverage = Math.min(100, spinStages * 25);

  // 3. Pain Point Depth (P + I stages)
  const painHits = pHits + iHits;
  const painPointDepth = Math.min(100, 20 + painHits * 15);

  // 4. Solution Match (N stage + specific product/course mentions)
  const solutionHits = nHits + countPatternMatches(allUserText, [
    "課程", "方案", "適合", "推薦", "建議", "客製", "需求",
  ]);
  const solutionMatch = Math.min(100, 20 + solutionHits * 12);

  // 5. Objection Handling
  const objectionHits = countPatternMatches(allUserText, OBJECTION_PATTERNS);
  const objectionHandling = Math.min(100, 30 + objectionHits * 15);

  // 6. Closing Push (later messages)
  const laterText = userMessages.slice(Math.max(0, msgCount - 3)).join(" ");
  const closingHits = countPatternMatches(laterText, CLOSING_PATTERNS);
  const closingPush = Math.min(100, 20 + closingHits * 18);

  // Overall weighted average
  const overall = Math.round(
    opening * 0.1 +
    spinCoverage * 0.25 +
    painPointDepth * 0.2 +
    solutionMatch * 0.15 +
    objectionHandling * 0.15 +
    closingPush * 0.15
  );

  return {
    opening,
    spinCoverage,
    painPointDepth,
    solutionMatch,
    objectionHandling,
    closingPush,
    overall,
  };
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return "卓越";
  if (score >= 80) return "優秀";
  if (score >= 70) return "良好";
  if (score >= 60) return "及格";
  if (score >= 40) return "待加強";
  return "需要練習";
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "#10ac84";
  if (score >= 60) return "#feca57";
  if (score >= 40) return "#ff9f43";
  return "#ee5a52";
}

export const SCORE_LABELS: Record<keyof SparringScores, string> = {
  opening: "開場力",
  spinCoverage: "SPIN 覆蓋率",
  painPointDepth: "痛點挖掘",
  solutionMatch: "方案匹配",
  objectionHandling: "異議處理",
  closingPush: "成交推進",
  overall: "綜合分數",
};
