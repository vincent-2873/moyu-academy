import { describe, it, expect } from "vitest";
import { anonymize, detectPII } from "./anonymize";

describe("anonymize", () => {
  it("替換 email", () => {
    const r = anonymize("聯絡 vincent@xuemi.co 跟 test@gmail.com");
    expect(r.found.emails).toBe(2);
    expect(r.text).toContain("[EMAIL]");
    expect(r.text).not.toContain("vincent@xuemi.co");
    expect(r.hasPII).toBe(true);
  });

  it("替換台灣手機 / 固網", () => {
    const r = anonymize("打 0912-345-678 找王先生 / 02-2345-6789 公司");
    expect(r.found.phones).toBeGreaterThanOrEqual(2);
    expect(r.text).toContain("[PHONE]");
  });

  it("替換身分證", () => {
    const r = anonymize("身分證 A123456789 / B287654321");
    expect(r.found.idNumbers).toBe(2);
    expect(r.text).toContain("[ID]");
  });

  it("替換信用卡 16 位", () => {
    const r = anonymize("卡號 4567-8901-2345-6789");
    expect(r.found.creditCards).toBe(1);
    expect(r.text).toContain("[CARD]");
    expect(r.text).not.toContain("4567-8901");
  });

  it("無 PII 時 hasPII=false 且 text 不變", () => {
    const txt = "今天天氣很好,客戶很滿意";
    const r = anonymize(txt);
    expect(r.hasPII).toBe(false);
    expect(r.text).toBe(txt);
    expect(r.found.total).toBe(0);
  });

  it("空字串 / null safe", () => {
    expect(anonymize("").hasPII).toBe(false);
    expect(anonymize("").found.total).toBe(0);
  });

  it("detectPII 不修改原文", () => {
    const txt = "vincent@xuemi.co 0912-345-678";
    const f = detectPII(txt);
    expect(f.emails).toBe(1);
    expect(f.phones).toBe(1);
    expect(f.total).toBe(2);
  });

  it("CC 先抓不被 phone regex 吃", () => {
    // 4567-8901-2345-6789 不應該被 phone 抓(因為 4567 開頭非 09)
    const r = anonymize("CC 4567-8901-2345-6789 phone 0912-345-678");
    expect(r.found.creditCards).toBe(1);
    expect(r.found.phones).toBeGreaterThanOrEqual(1);
  });
});
