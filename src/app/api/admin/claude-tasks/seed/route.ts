import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 一次性 seed：建立初始 4 個 Claude 指派任務
 * 用法：POST /api/admin/claude-tasks/seed
 *
 * 這 4 個任務對應用戶尚未提供的關鍵資訊：
 * 1. LINE 推播設定
 * 2. 外部後台 API 連線資訊
 * 3. 試點品牌選擇
 * 4. KPI 警報門檻
 */

const INITIAL_TASKS = [
  {
    title: "提供 LINE 推播 token + 接收者 ID",
    description: "Claude 需要透過 LINE 主動把任務、警報、自動行動結果推播給你。目前 line-notify.ts 已就緒，只缺環境變數。",
    category: "setup" as const,
    priority: "critical" as const,
    why: "你明確要求「主動回報節奏兩者都要，然後我會希望你透過 Line 來去傳送給我」。沒有 token 之前，所有 LINE 推播會 fallback 到 stub mode（寫入 claude_actions 表），但你不會收到通知。",
    expected_input: "請提供以下兩個值：\n1. LINE_CHANNEL_ACCESS_TOKEN（從 LINE Developers Console > Messaging API channel 取得）\n2. LINE_USER_ID（接收推播的 LINE 帳號 ID）\n\n設定方式：在 Vercel Dashboard > moyu-academy > Settings > Environment Variables 加入這兩個變數，然後重新部署即可自動生效",
    blocked_features: ["LINE 即時推播", "緊急警報通知", "Claude 任務即時提醒"],
  },
  {
    title: "提供外部後台 API（業績/CRM 系統）連線資訊",
    description: "你有提到「實際資料數據我也會給你另外一個後台系統的 API」。這個資訊還沒拿到，所以業績相關的自動化還無法啟用。",
    category: "data" as const,
    priority: "high" as const,
    why: "目前只能用 moyu-academy 內部的 KPI 表（kpi_entries），但業務的真實成交數字、客戶狀態、撥打紀錄都在外部 CRM。沒接這個 API，AI 無法做完整的戰力分析",
    expected_input: "請提供：\n1. 外部後台系統名稱（CRM 廠商或自建？）\n2. Base URL\n3. 認證方式（API Key / OAuth / Basic Auth？）\n4. 主要 endpoint：\n   - 業務每日撥打紀錄\n   - 業務成交紀錄\n   - 客戶名單（含狀態：新單/追蹤中/已成交/已流失）\n5. 資料結構（提供範例 JSON 即可）",
    blocked_features: ["真實業績儀表板", "成交率分析", "客戶轉換漏斗", "業務 ROI 計算"],
  },
  {
    title: "選擇試點品牌（4 選 1）",
    description: "目前 4 個品牌（nSchool 財經 / OOschool 無限 / XUEMI 學米 / AIschool AI）的訓練內容架構是同一份，但每個品牌的客群、產品、業務節奏不同。建議先選一個品牌做完整的 AI 自動化試點，調整過後再複製到其他品牌。",
    category: "decision" as const,
    priority: "high" as const,
    why: "一次處理 4 個品牌的客製化複雜度太高，先做 MVP 試點 → 驗證 → 複製，比同時做 4 個更容易看到成效",
    expected_input: "請選一個試點品牌：\n• nSchool（財經）— 通常是最成熟的業務團隊？\n• OOschool（無限／學米的線上課程入口品牌）\n• XUEMI 學米（4 師 1 學員制，技能培訓）\n• AIschool（AI 落地師，最新品牌）\n\n如果不確定，建議選「業務人數最多 + 流失率最高」的那個，AI 介入價值最大",
    blocked_features: ["品牌專屬 AI 訓練優化", "AI 內容自動迭代", "AI 提示詞客製化"],
  },
  {
    title: "設定業務 KPI 警報門檻",
    description: "Claude AI 自動掃描已建好（src/app/api/cron/claude-autoscan/route.ts），會每天偵測異常並推播警報。但異常的定義（超過幾天沒打電話算異常？分數低於多少算異常？）你還沒給門檻。",
    category: "decision" as const,
    priority: "normal" as const,
    why: "目前先用預設值（7 天未活動 = critical / 3 天 = warning），但每個品牌的標準應該不同。預設值會誤報或漏報",
    expected_input: "請提供以下門檻（沒答的就用預設值）：\n1. 撥打數每日最低標準：__ 通\n2. 連續幾天未活動視為「警示」：__ 天（預設 3）\n3. 連續幾天未活動視為「嚴重」：__ 天（預設 7）\n4. 測驗分數低於多少要主管介入：__ 分（預設 60）\n5. 連續幾天無邀約視為異常：__ 天\n6. 對練分數低於多少要重新對練：__ 分",
    blocked_features: ["精準 KPI 警報", "個人化績效標準", "主管介入時機判斷"],
  },
];

export async function POST(_request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // 檢查是否已經 seed 過 (避免重複)
    const { data: existing } = await supabase
      .from("claude_tasks")
      .select("title")
      .in(
        "title",
        INITIAL_TASKS.map((t) => t.title)
      );

    const existingTitles = new Set((existing || []).map((e) => e.title));
    const toInsert = INITIAL_TASKS.filter((t) => !existingTitles.has(t.title));

    if (toInsert.length === 0) {
      return Response.json({ ok: true, message: "All initial tasks already exist", inserted: 0 });
    }

    const { data, error } = await supabase
      .from("claude_tasks")
      .insert(toInsert)
      .select();

    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({ ok: true, inserted: data?.length || 0, tasks: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
