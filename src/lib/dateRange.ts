/**
 * 共用日期範圍工具(2026-05-02 Wave 8 #1)
 *
 * Vincent 拍板鐵則:**MoM / WoW 嚴格切月**,不要 rolling days。
 * - 投資人看「2026 5月」就乾淨 5/1-31(到月底)/ 5/1-本月今日(到目前)
 * - 不要「過去 30 天」這種 rolling 概念
 *
 * Timezone 全部 TPE(Asia/Taipei,UTC+8)。
 */

export type DateRangePreset =
  | "today"        // 今天
  | "week"         // 本週(週一 ~ 今日)
  | "twoweek"      // 本週 + 上週(2 週合計到今日)
  | "month"        // 本月迄今(1 號 ~ 今日)
  | "lastmonth"    // 上月(1 號 ~ 月底)
  | "quarter"      // 本季迄今(季初 ~ 今日)
  | "custom";      // 自訂

export interface DateRange {
  preset: DateRangePreset;
  from: string;     // YYYY-MM-DD (TPE)
  to: string;       // YYYY-MM-DD (TPE, inclusive)
  label: string;    // 顯示用
}

const TPE_OFFSET_MIN = 8 * 60;

function toTpeDate(d: Date): Date {
  // 把 UTC date 轉成 TPE 本地日(忽略 time)
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + TPE_OFFSET_MIN * 60 * 1000);
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function tpeNow(): Date {
  return toTpeDate(new Date());
}

/** 把 preset 轉成具體日期區間(TPE 嚴格切月) */
export function presetToRange(
  preset: DateRangePreset,
  customFrom?: string,
  customTo?: string
): DateRange {
  if (preset === "custom") {
    const from = customFrom || fmt(tpeNow());
    const to = customTo || fmt(tpeNow());
    return { preset, from, to, label: `${from} ~ ${to}` };
  }

  const now = tpeNow();
  const today = fmt(now);

  switch (preset) {
    case "today":
      return { preset, from: today, to: today, label: `今天(${today})` };

    case "week": {
      // 本週週一 ~ 今日
      const dow = now.getDay() || 7; // 週日=7
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dow - 1));
      return { preset, from: fmt(monday), to: today, label: `本週迄今` };
    }

    case "twoweek": {
      // 上週週一 ~ 今日(14 天視窗,但對齊週起點)
      const dow = now.getDay() || 7;
      const lastMonday = new Date(now);
      lastMonday.setDate(now.getDate() - (dow - 1) - 7);
      return { preset, from: fmt(lastMonday), to: today, label: `本週+上週` };
    }

    case "month": {
      // 本月 1 號 ~ 今日
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        preset,
        from: fmt(first),
        to: today,
        label: `${now.getFullYear()}年${now.getMonth() + 1}月迄今`,
      };
    }

    case "lastmonth": {
      // 上月完整(1 號 ~ 月底)
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        preset,
        from: fmt(first),
        to: fmt(last),
        label: `${first.getFullYear()}年${first.getMonth() + 1}月`,
      };
    }

    case "quarter": {
      // 本季迄今(季初 ~ 今日)
      const q = Math.floor(now.getMonth() / 3); // 0-3
      const first = new Date(now.getFullYear(), q * 3, 1);
      return {
        preset,
        from: fmt(first),
        to: today,
        label: `${now.getFullYear()}Q${q + 1} 迄今`,
      };
    }
  }
}

/** 把 DateRange 轉成 querystring(for fetch) */
export function dateRangeQS(r: DateRange): string {
  return `from=${r.from}&to=${r.to}`;
}

/** 解析 querystring → DateRange(API 端用) */
export function parseDateRangeQS(searchParams: URLSearchParams | { get: (k: string) => string | null }): { from: string | null; to: string | null } {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  // 簡單格式校驗
  const ok = (s: string | null) => s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  return {
    from: ok(from) ? from : null,
    to: ok(to) ? to : null,
  };
}

/** 對比上一期(等長視窗)— 給 MoM/WoW 比較用 */
export function previousRange(r: DateRange): { from: string; to: string } {
  if (r.preset === "month" || r.preset === "lastmonth") {
    // 上一個月完整
    const fromD = new Date(r.from);
    const prevFirst = new Date(fromD.getFullYear(), fromD.getMonth() - 1, 1);
    const prevLast = new Date(fromD.getFullYear(), fromD.getMonth(), 0);
    // 但 to 要對齊「同樣 day-of-month」如果是 month 迄今
    if (r.preset === "month") {
      const toD = new Date(r.to);
      const dayOfMonth = toD.getDate();
      const prevSameDay = new Date(prevFirst.getFullYear(), prevFirst.getMonth(), Math.min(dayOfMonth, prevLast.getDate()));
      return { from: fmt(prevFirst), to: fmt(prevSameDay) };
    }
    return { from: fmt(prevFirst), to: fmt(prevLast) };
  }

  // 一般狀況:retreat 等長視窗
  const fromD = new Date(r.from);
  const toD = new Date(r.to);
  const days = Math.round((toD.getTime() - fromD.getTime()) / 86400000) + 1;
  const prevTo = new Date(fromD);
  prevTo.setDate(fromD.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevTo.getDate() - (days - 1));
  return { from: fmt(prevFrom), to: fmt(prevTo) };
}

export const DEFAULT_PRESET: DateRangePreset = "month";

export const PRESET_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "今天" },
  { value: "week", label: "本週" },
  { value: "twoweek", label: "兩週" },
  { value: "month", label: "本月" },
  { value: "lastmonth", label: "上月" },
  { value: "quarter", label: "本季" },
  { value: "custom", label: "自訂" },
];
