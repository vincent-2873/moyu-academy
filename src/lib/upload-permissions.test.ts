import { describe, it, expect } from "vitest";
import { canUploadRag, RAG_UPLOAD_ROLES, uploadDeniedReason } from "./upload-permissions";

describe("upload-permissions", () => {
  it("super_admin 可上傳", () => {
    expect(canUploadRag("super_admin")).toBe(true);
  });

  it("2 manager 可上傳", () => {
    expect(canUploadRag("sales_manager")).toBe(true);
    expect(canUploadRag("legal_manager")).toBe(true);
  });

  it("一般員工不可上傳", () => {
    expect(canUploadRag("sales_rep")).toBe(false);
    expect(canUploadRag("legal_staff")).toBe(false);
    expect(canUploadRag("trainer")).toBe(false);
    expect(canUploadRag("brand_manager")).toBe(false);     // brand_manager 也不在允許清單
    expect(canUploadRag("ceo")).toBe(false);                // ceo 也不在(只 3 個)
  });

  it("空值 / undefined 不可", () => {
    expect(canUploadRag(null)).toBe(false);
    expect(canUploadRag(undefined)).toBe(false);
    expect(canUploadRag("")).toBe(false);
  });

  it("RAG_UPLOAD_ROLES 剛好 3 個(Wave 8 砍 recruit_manager)", () => {
    expect(RAG_UPLOAD_ROLES.size).toBe(3);
  });

  it("uploadDeniedReason 包含 role 名", () => {
    expect(uploadDeniedReason("sales_rep")).toContain("sales_rep");
  });

  it("uploadDeniedReason null = 未登入提示", () => {
    expect(uploadDeniedReason(null)).toContain("未登入");
  });
});
