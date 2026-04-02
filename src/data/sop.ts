/**
 * SOP 規範資料 — 名單撥打、CRM 紀錄、LINE 管理、後台代辦
 * 適用所有品牌的標準作業流程
 */

export interface SOPSection {
  id: string;
  title: string;
  icon: string;
  description: string;
  /** Brand filter: empty = all brands */
  brands: string[];
  items: SOPItem[];
}

export interface SOPItem {
  id: string;
  title: string;
  content: string;
  format?: string;
  example?: string;
  important?: boolean;
  tip?: string;
}

export const sopSections: SOPSection[] = [
  // ===================== 名單撥打 =====================
  {
    id: "calling",
    title: "名單撥打 SOP",
    icon: "📞",
    description: "撥打名單的標準流程與紀錄方式",
    brands: [],
    items: [
      {
        id: "calling-principle",
        title: "撥打原則",
        content: "找到客戶電話複製貼上直接打，不要看一通打一通。實際被拒絕才是真的被拒絕。",
        important: true,
        tip: "不要預判客戶，每一通都認真打",
      },
      {
        id: "calling-na",
        title: "沒接紀錄",
        content: "撥打過去客戶沒接電話",
        format: "【日期 NA幾】",
        example: "【04/02 NA1】",
        tip: "NA5 以上回公池",
      },
      {
        id: "calling-soft-reject",
        title: "有接軟性拒絕紀錄",
        content: "撥打過去客戶軟性拒絕（如：沒興趣、沒時間、再考慮）",
        format: "【日期 明拒 : 原因】",
        example: "【04/02 明拒：說沒時間】",
        tip: "回公池",
      },
      {
        id: "calling-hard-reject",
        title: "有接拒絕紀錄（硬性）",
        content: "撥打過去客戶硬性拒絕，說再打我要提告了",
        format: "【日期 要求刪除資料】",
        important: true,
        tip: "在 LINE 群組通報經辦，使用刪除通報格式",
      },
      {
        id: "calling-wrong-number",
        title: "空號 / 非本人",
        content: "撥打過去說不是本人或電話不是他的",
        format: "【日期 非本人 / 空號】",
        tip: "放入非本人 / 空號區",
      },
      {
        id: "calling-chat-no-invite",
        title: "有接有聊但沒邀約",
        content: "撥打過去有聊到天但沒邀約 DEMO，需要後續追蹤",
        format: "【日期 聊了什麼】",
        example: "【04/02 聊到對 Python 有興趣，目前自學中，下次再約】",
      },
      {
        id: "calling-demo-invite",
        title: "有接有邀約 DEMO",
        content: "撥打過去成功邀約 DEMO，依公版資訊做紀錄",
        format: "學習目標：\n身分：\n學習(領域)動機/經驗：\n是否有說到故事或給予到價值：\n學習時間/預算：\n是否有把學習門檻降低：\n裝置：",
        example: "學習目標：轉職資料分析師\n身分：在職上班族（行政）\n學習(領域)動機/經驗：對 AI 有興趣，零基礎\n是否有說到故事或給予到價值：有，分享了轉職成功案例\n學習時間/預算：每週可學 10hr，預算 10-15 萬\n是否有把學習門檻降低：有，強調從零開始\n裝置：筆電 Windows",
        important: true,
      },
    ],
  },

  // ===================== LINE 群組管理 =====================
  {
    id: "line-management",
    title: "LINE 群組管理",
    icon: "💬",
    description: "LINE 大群要單、刪除通報格式",
    brands: [],
    items: [
      {
        id: "line-delete",
        title: "刪除通報格式",
        content: "限於客戶要求刪除資料時使用",
        format: "@經辦群  請協助刪除學員，謝謝\nCRM：（填入客戶 CRM 編號）",
        important: true,
        tip: "僅限客戶主動要求刪除資料時才通報",
      },
      {
        id: "line-request",
        title: "要單格式",
        content: "要單前請先確認名單池都已撥過一輪",
        format: "@經辦群  請我要結案單 100 筆，謝謝",
        important: true,
        tip: "務必確認現有名單已全部撥完才要新單",
      },
      {
        id: "line-naming",
        title: "LINE 記錄方式 — 改名稱",
        content: "DEMO 客戶的 LINE 名稱格式",
        format: "DEMO 日期 / 學生名稱 / 領域 / 顧問名稱",
        example: "04/05 / 王小明 / Python / 陳顧問",
      },
      {
        id: "line-notes",
        title: "LINE 記錄方式 — 記事本",
        content: "在 LINE 記事本新增客戶基本資料",
        format: "新增 CRM / 姓名 / 信箱 / 電話",
        example: "CRM-12345 / 王小明 / wang@email.com / 0912345678",
      },
    ],
  },

  // ===================== 後台代辦建立 =====================
  {
    id: "backend-tasks",
    title: "後台代辦建立方式",
    icon: "🖥️",
    description: "學院後台（ooschool.cc/admin）的代辦事項建立規範",
    brands: [],
    items: [
      {
        id: "backend-link",
        title: "學院後台連結",
        content: "OOschool 學院管理後台",
        format: "https://www.ooschool.cc/admin",
        tip: "請用公司帳號登入",
      },
      {
        id: "backend-tracking",
        title: "追蹤客戶",
        content: "等等打 / 有興趣追蹤的客戶",
        format: "標題打「追蹤」\n分類選「有興趣」",
      },
      {
        id: "backend-demo",
        title: "邀 DEMO 的客戶",
        content: "已成功邀約 DEMO 的客戶，需建立後台代辦",
        format: "標題格式：有效(無效) / 穩(抖) / 領域 / DEMO\n\n• 有效/無效：開發過程中客戶有沒有聽懂你的內容\n• 穩/抖：出席率高於 80% 選穩，其餘選抖\n• 分類：找到「預約 DEMO」\n• 執行日期：設定你跟學生預約的日期時間\n• 勾選「新增會議連結」",
        example: "有效 / 穩 / Python / DEMO",
        important: true,
        tip: "穩抖判斷很重要，影響主管對案件的優先處理順序",
      },
    ],
  },

  // ===================== CRM 操作規範 =====================
  {
    id: "crm-ops",
    title: "CRM 操作規範",
    icon: "📊",
    description: "CRM 系統的標準操作流程",
    brands: [],
    items: [
      {
        id: "crm-update",
        title: "每通電話後更新 CRM",
        content: "每通電話結束後，務必立即更新 CRM 紀錄。不要累積到下班才補。",
        important: true,
        tip: "養成好習慣：打完一通，記一通",
      },
      {
        id: "crm-status",
        title: "客戶狀態分類",
        content: "根據通話結果更新客戶狀態：\n• NA（未接）\n• 明拒（軟性拒絕）\n• 要求刪除（硬性拒絕）\n• 非本人/空號\n• 追蹤（有興趣但未邀約）\n• 預約 DEMO（已邀約）",
      },
    ],
  },
];

/** Get SOP sections visible to a specific brand */
export function getSOPForBrand(brandId: string): SOPSection[] {
  return sopSections.filter(
    (s) => s.brands.length === 0 || s.brands.includes(brandId)
  );
}
