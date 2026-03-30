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
    color: "#00d2d3",
    colorLight: "rgba(0,210,211,0.15)",
    inviteCode: "OO2026",
    description: "AI/Python 教育及多元職能培訓",
    focus: "AI/Python 教育",
    website: "https://www.xplatform.world",
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
};
