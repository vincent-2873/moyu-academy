/**
 * 2026-04-30 末段:sales_metrics_daily 查詢標準化 helper
 *
 * 問題:Metabase 同步 + 月底 bulk-upsert 會插入 is_monthly_rollup=true 的 row
 *   - 一個員工某月可能有 30 個 daily row + 1 個 monthly rollup row
 *   - sum(net_revenue_daily) 會把 rollup 也加進去 → 2 倍 bug
 *   - Vincent 反映 Alan 顯示 1.1M 但實際看起來不對 → 就是這原因
 *
 * 解法:所有 aggregate/sum query **必須過濾 is_monthly_rollup IS NOT TRUE**
 *   - NULL 跟 false 都當 daily row(safe default)
 *   - true 才是 rollup,排除
 *
 * 用法:
 *   import { excludeRollup } from '@/lib/sales-query';
 *   const q = excludeRollup(sb.from('sales_metrics_daily').select('...'));
 *
 * Notes:
 *   - 不適用於 raw row level 檢查(checkIntegrity 那邊要看 rollup 內容)
 *   - 若想 explicit 只看 rollup row,用 .eq('is_monthly_rollup', true)
 */

export function excludeRollup<T extends { not: (col: string, op: string, val: unknown) => T }>(query: T): T {
  // PostgreSQL `IS NOT TRUE` 邏輯:NULL 跟 false 都通過,只 true 排除
  return query.not("is_monthly_rollup", "is", true);
}

/**
 * 標籤指標說明(給 UI tooltip / 白話化用)
 * 高層主管不一定懂業務 jargon,要加 tooltip
 */
export const METRIC_LABELS: Record<string, { label: string; full: string; baseline?: string }> = {
  call_to_appt: {
    label: "撥打→邀約",
    full: "撥打 100 通電話有幾通能約到面談 — 反映通話開場 + 動機詢問品質",
    baseline: "健康 ≥ 15%(每 7 通約到 1 個)",
  },
  appt_to_close: {
    label: "邀約→成交",
    full: "邀約 10 個有幾個真的下單 — 反映現場收網 + 異議處理能力",
    baseline: "健康 ≥ 25%(每 4 個約到 1 個下單)",
  },
  top_to_median: {
    label: "Top:Median 比例",
    full: "第 1 名營收 ÷ 中位數營收 — 反映團隊穩定度。比例越大表示越仰賴 1-2 人,風險高",
    baseline: "健康 ≤ 3×(top 是中間人 3 倍以內)",
  },
  attendance: {
    label: "員工出席率",
    full: "本週有撥打的員工數 ÷ 在線員工總數 — 沒打卡 = 沒貢獻 = 人力閒置",
    baseline: "健康 ≥ 80%",
  },
  avg_calls_per_employee: {
    label: "人均週撥打",
    full: "整 brand 撥打總數 ÷ 員工數 — 標準業務 30 通/日 × 5 工作日 = 150-200 通/週",
    baseline: "健康 ≥ 200 通/人/週",
  },
};

export type MetricKey = keyof typeof METRIC_LABELS;
