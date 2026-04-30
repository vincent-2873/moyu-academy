import { describe, it, expect } from "vitest";
import {
  taipeiToday, taipeiMonthStart, taipeiLastMonthRange,
  taipeiDayOfMonth, taipeiDaysInMonth, taipeiDaysAgo,
  calculateDayOffset, formatTaipeiDate,
} from "./time";

describe("time helpers", () => {
  it("taipeiToday 回 yyyy-MM-dd", () => {
    const t = taipeiToday();
    expect(t).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("taipeiMonthStart 永遠是 01 結尾", () => {
    const ms = taipeiMonthStart(new Date("2026-04-15T05:00:00Z"));
    expect(ms).toMatch(/-01$/);
    // 2026-04-15 UTC 13:00 = Taipei,所以還在 4 月
    expect(ms).toBe("2026-04-01");
  });

  it("月初 UTC 16:00 前一天 → 台北 = 該月第一天(off-by-one fix verify)", () => {
    // 2026-04-01 00:00 UTC+8 = 2026-03-31 16:00 UTC
    // 舊 bug:new Date(y,m,1).toISOString() 會回 "2026-03-31"
    // helper 應正確回 "2026-04-01"
    const taipeiBoundary = new Date("2026-03-31T16:30:00Z"); // = 台北 4-01 00:30
    const ms = taipeiMonthStart(taipeiBoundary);
    expect(ms).toBe("2026-04-01");
  });

  it("taipeiLastMonthRange 跨年正確", () => {
    const r = taipeiLastMonthRange(new Date("2026-01-15T05:00:00Z"));
    expect(r.start).toBe("2025-12-01");
    expect(r.end).toBe("2025-12-31");
  });

  it("taipeiLastMonthRange 一般月", () => {
    const r = taipeiLastMonthRange(new Date("2026-04-15T05:00:00Z"));
    expect(r.start).toBe("2026-03-01");
    expect(r.end).toBe("2026-03-31");
  });

  it("taipeiDayOfMonth 月初 = 1", () => {
    const d = taipeiDayOfMonth(new Date("2026-04-01T05:00:00Z"));
    expect(d).toBe(1);
  });

  it("taipeiDaysInMonth April = 30", () => {
    const n = taipeiDaysInMonth(new Date("2026-04-15T05:00:00Z"));
    expect(n).toBe(30);
  });

  it("taipeiDaysInMonth February non-leap = 28", () => {
    const n = taipeiDaysInMonth(new Date("2026-02-15T05:00:00Z"));
    expect(n).toBe(28);
  });

  it("taipeiDaysAgo 7 天前", () => {
    const today = new Date("2026-04-15T05:00:00Z");
    const a = taipeiDaysAgo(7, today);
    expect(a).toBe("2026-04-08");
  });

  it("calculateDayOffset 報到當天 = 1", () => {
    const off = calculateDayOffset("2026-04-28T15:30:00Z", "2026-04-28");
    expect(off).toBe(1);
  });

  it("calculateDayOffset 跨日 +5", () => {
    const off = calculateDayOffset(new Date("2026-04-28T00:00:00Z"), "2026-05-03");
    expect(off).toBe(6);
  });

  it("formatTaipeiDate 預設格式", () => {
    const s = formatTaipeiDate(new Date("2026-04-15T05:00:00Z"), "yyyy-MM-dd");
    expect(s).toBe("2026-04-15");
  });
});
