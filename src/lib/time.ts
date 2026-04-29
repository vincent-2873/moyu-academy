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
