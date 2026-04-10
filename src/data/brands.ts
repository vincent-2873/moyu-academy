export interface Brand {
  id: string;
  name: string;
  fullName: string;
  color: string;
  colorLight: string;
  inviteCode: string;
  description: string;
  focus: string;
  website: string;
  line: string;
  instagram: string;
  email: string;
  courses: string[];
  pricing: PricingPlan[];
}

export interface PricingPlan {
  name: string;
  price: string;
  description: string;
}

export const brands: Record<string, Brand> = {
  nschool: {
    id: "nschool",
    name: "nSchool",
    fullName: "nSchool 財經學院",
    color: "#feca57",
    colorLight: "rgba(254,202,87,0.15)",
    inviteCode: "NS2026",
    description: "專注財經教育，涵蓋股票、投資、ETF 等領域",
    focus: "財經教育",
    website: "https://nschool.tw",
    line: "@5201nschool",
    instagram: "@shibamoney",
    email: "contact@xplatform.world",
    courses: ["基本面分析", "技術面分析", "籌碼面分析", "ETF 投資策略"],
    pricing: [
      { name: "FI-1", price: "NT$68,000", description: "財經基礎入門方案" },
      { name: "FI-2", price: "NT$128,000", description: "進階投資分析方案" },
      { name: "FI-3", price: "NT$168,000", description: "專業操盤策略方案" },
      { name: "FI-4", price: "NT$230,000", description: "高階全方位方案" },
    ],
  },
  xuemi: {
    id: "xuemi",
    name: "XUEMI",
    fullName: "XUEMI 學米",
    color: "#7c6cf0",
    colorLight: "rgba(124,108,240,0.15)",
    inviteCode: "XM2026",
    description: "職能教育品牌，專攻 UI/UX、前後端開發",
    focus: "職能教育",
    website: "https://www.xuemi.co",
    line: "@872vnsns",
    instagram: "@xuemi__tw",
    email: "contact@xplatform.world",
    courses: ["UIUX 設計", "前端開發 FED", "前端進階 FE2", "後端工程 BE"],
    pricing: [
      { name: "UIUX 學習計畫 A", price: "NT$108,875", description: "UI/UX 設計入門" },
      { name: "介面設計師轉職 B", price: "NT$118,875", description: "轉職設計師方案" },
      { name: "前端工程師培訓", price: "NT$148,735", description: "前端完整培訓" },
      { name: "前端進階方案", price: "NT$158,735", description: "前端進階技術" },
      { name: "後端工程師培訓", price: "NT$168,000", description: "後端完整培訓" },
      { name: "全端工程師培訓", price: "NT$206,735", description: "全端完整培訓" },
    ],
  },
  ooschool: {
    id: "ooschool",
    name: "OOschool",
    fullName: "OOschool 無限學院",
    color: "#4F46E5",
    colorLight: "rgba(79,70,229,0.15)",
    inviteCode: "OO2026",
    description: "AI/Python 教育及多元職能培訓",
    focus: "AI/Python 教育",
    website: "https://www.ooschool.cc",
    line: "@xplatform01",
    instagram: "@xplatform.world",
    email: "contact@xplatform.world",
    courses: ["Python 程式設計", "AI 人工智慧", "數據分析", "機械學習"],
    pricing: [
      { name: "輕量體驗 A", price: "NT$108,000", description: "入門體驗方案" },
      { name: "輕量體驗 B", price: "NT$114,000", description: "入門進階方案" },
      { name: "強化核心 1A", price: "NT$144,000", description: "核心技術方案" },
      { name: "強化核心 2B", price: "NT$153,000", description: "核心進階方案" },
      { name: "專精挑戰 1B", price: "NT$179,000", description: "專精技術方案" },
      { name: "專精挑戰 2C", price: "NT$200,000", description: "全方位專精方案" },
    ],
  },
  aischool: {
    id: "aischool",
    name: "AIschool",
    fullName: "AIschool AI 未來學院",
    color: "#10B981",
    colorLight: "rgba(16,185,129,0.15)",
    inviteCode: "AS2026",
    description: "AI 應用與未來科技教育，涵蓋 LLM、自動化、AI 工具實戰",
    focus: "AI 應用教育",
    website: "https://www.xplatform.world",
    line: "@xplatform01",
    instagram: "@xplatform.world",
    email: "contact@xplatform.world",
    courses: ["AI 工具實戰", "LLM 應用開發", "自動化流程", "AI 商業應用"],
    pricing: [
      { name: "AI 入門體驗", price: "NT$98,000", description: "AI 基礎入門方案" },
      { name: "AI 進階應用", price: "NT$138,000", description: "進階 AI 應用方案" },
      { name: "AI 專業開發", price: "NT$178,000", description: "專業 AI 開發方案" },
      { name: "AI 全方位菁英", price: "NT$218,000", description: "全方位 AI 菁英方案" },
    ],
  },
  moyuhunt: {
    id: "moyuhunt",
    name: "墨宇獵頭",
    fullName: "墨宇獵頭 業務招聘部",
    color: "#fb923c",
    colorLight: "rgba(251,146,60,0.15)",
    inviteCode: "MOYUHUNT",
    description: "集團招聘部，負責替 4 個業務品牌招聘新業務員",
    focus: "業務招聘",
    website: "https://www.xplatform.world",
    line: "",
    instagram: "",
    email: "hunt@xplatform.world",
    courses: [],
    pricing: [],
  },
  hq: {
    id: "hq",
    name: "墨宇股份有限公司",
    fullName: "墨宇股份有限公司",
    color: "#dc2626",
    colorLight: "rgba(220,38,38,0.15)",
    inviteCode: "MOYUHQ2026",
    description: "墨宇股份有限公司",
    focus: "墨宇股份有限公司",
    website: "https://www.xplatform.world",
    line: "",
    instagram: "",
    email: "ceo@xplatform.world",
    courses: [],
    pricing: [],
  },
  legal: {
    id: "legal",
    name: "法務顧問事務所",
    fullName: "墨宇法務顧問事務所",
    color: "#7c6cf0",
    colorLight: "rgba(124,108,240,0.15)",
    inviteCode: "MOYULAW2026",
    description: "法務顧問事務所",
    focus: "法務顧問",
    website: "https://www.xplatform.world",
    line: "",
    instagram: "",
    email: "legal@xplatform.world",
    courses: [],
    pricing: [],
  },
};
