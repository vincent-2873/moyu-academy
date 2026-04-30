/**
 * 時區 helper module
 * 規範:全系統時區基準 = Asia/Taipei(UTC+8)
 * 詳見 huance-copilot-memory/architecture/timezone-policy-v1.0.md
 *
 * ❌ 禁用 raw new Date().toISOString().split('T')[0] / Date.prototype.toLocaleDateString
 * ✅ 強制用本 module 的 helpers
 */

import { differenceInCalendarDays, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { zhTW } from 'date-fns/locale';

const TAIPEI_TZ = 'Asia/Taipei';

/**
 * 取台北「現在」Date 物件
 * Date 物件本身永遠是 UTC,顯示時轉時區
 */
export function taipeiNow(): Date {
  return new Date();
}

/**
 * 取台北「今天」(yyyy-MM-dd 字串)
 * 無論 server TZ 如何,輸出都是台北日期
 */
export function taipeiToday(): string {
  return formatInTimeZone(new Date(), TAIPEI_TZ, 'yyyy-MM-dd');
}

/**
 * 計算 Day Offset(hired_at 當天 = Day 1)
 * 用台北日曆日比對,週末照算
 *
 * @example
 *   calculateDayOffset('2026-04-28T15:30:00Z') // 報到當天 → 1
 *   calculateDayOffset(new Date('2026-04-28'), '2026-05-03') // → 6
 */
export function calculateDayOffset(hiredAt: Date | string, today?: string): number {
  const hiredAtDate = typeof hiredAt === 'string' ? new Date(hiredAt) : hiredAt;
  const hiredTaipei = formatInTimeZone(hiredAtDate, TAIPEI_TZ, 'yyyy-MM-dd');
  const todayTaipei = today ?? taipeiToday();
  return differenceInCalendarDays(parseISO(todayTaipei), parseISO(hiredTaipei)) + 1;
}

/**
 * 格式化台北時間顯示
 *
 * @example
 *   formatTaipeiDate(new Date()) // '2026-04-29 三'
 *   formatTaipeiDate(new Date(), 'yyyy-MM-dd HH:mm') // '2026-04-29 14:30'
 */
export function formatTaipeiDate(date: Date | string, fmt = 'yyyy-MM-dd EEE'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(d, TAIPEI_TZ, fmt, { locale: zhTW });
}

/**
 * 2026-04-30 第三輪 Wave A:取台北當月第一天(yyyy-MM-01)
 *
 * 為什麼要這個 helper:
 *   ❌ 錯:`new Date(y, m, 1).toISOString().slice(0, 10)`
 *      → 本機 TZ 00:00 換 UTC 後在台北 UTC+8 會變前一天 16:00
 *      → toISOString 拿到的是 「上個月最後一天」,月初邊界全錯
 *   ✅ 對:用 formatInTimeZone 直接取台北日曆下的 yyyy-MM-01
 */
export function taipeiMonthStart(date: Date = new Date()): string {
  // 'yyyy-MM' 拿到 e.g. '2026-04',加 '-01' 即可
  return formatInTimeZone(date, TAIPEI_TZ, 'yyyy-MM') + '-01';
}

/** 取台北上個月區間 [start, end] (inclusive),格式 yyyy-MM-dd */
export function taipeiLastMonthRange(date: Date = new Date()): { start: string; end: string } {
  const y = Number(formatInTimeZone(date, TAIPEI_TZ, 'yyyy'));
  const m = Number(formatInTimeZone(date, TAIPEI_TZ, 'M'));   // 1-12
  // 上月年份 / 月份
  const lastY = m === 1 ? y - 1 : y;
  const lastM = m === 1 ? 12 : m - 1;
  const lastMStr = String(lastM).padStart(2, '0');
  const start = `${lastY}-${lastMStr}-01`;
  // 上月最後一天 = 本月第一天往前推 1 天
  const lastMEnd = new Date(Date.UTC(y, m - 1, 1) - 86400000);
  const end = formatInTimeZone(lastMEnd, TAIPEI_TZ, 'yyyy-MM-dd');
  return { start, end };
}

/**
 * 取台北當月已過天數(month-to-date)— 月初第 1 天 = 1
 *   2026-04-15 (Taipei) → 15
 *   2026-04-01 (Taipei) → 1
 */
export function taipeiDayOfMonth(date: Date = new Date()): number {
  return Number(formatInTimeZone(date, TAIPEI_TZ, 'd'));
}

/**
 * 取台北當月總天數(28-31)
 */
export function taipeiDaysInMonth(date: Date = new Date()): number {
  const y = Number(formatInTimeZone(date, TAIPEI_TZ, 'yyyy'));
  const m = Number(formatInTimeZone(date, TAIPEI_TZ, 'M'));
  return new Date(Date.UTC(y, m, 0)).getUTCDate();   // m 是 1-12,m 月第 0 天 = (m-1) 月最後一天 → 用 m 拿到本月最後一天
}

/** 取台北 N 天前的 yyyy-MM-dd */
export function taipeiDaysAgo(n: number, date: Date = new Date()): string {
  const past = new Date(date.getTime() - n * 86400000);
  return formatInTimeZone(past, TAIPEI_TZ, 'yyyy-MM-dd');
}
