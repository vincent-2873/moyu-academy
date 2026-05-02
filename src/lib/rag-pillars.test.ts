import { describe, it, expect } from "vitest";
import { getRolePillars, inferPillarFromPath, pillarFromNotionDbId } from "./rag-pillars";

describe("rag-pillars (post-2026-05-01: HR 體系已砍)", () => {
  it("sales_rep 看 sales + common", () => {
    expect(getRolePillars("sales_rep").sort()).toEqual(["common", "sales"]);
  });

  it("super_admin 看 legal + sales + common(HR 已砍)", () => {
    expect(getRolePillars("super_admin").sort()).toEqual(["common", "legal", "sales"]);
  });

  it("trainer 看 sales + common(HR 已砍)", () => {
    expect(getRolePillars("trainer").sort()).toEqual(["common", "sales"]);
  });

  it("未知 role(已砍 hr/recruiter)fallback common", () => {
    expect(getRolePillars("unknown_role")).toEqual(["common"]);
  });

  it("legal_staff 限 legal + common", () => {
    expect(getRolePillars("legal_staff").sort()).toEqual(["common", "legal"]);
  });

  it("空 / 未知 role fallback common", () => {
    expect(getRolePillars(null)).toEqual(["common"]);
    expect(getRolePillars(undefined)).toEqual(["common"]);
    expect(getRolePillars("__nonexistent__")).toEqual(["common"]);
  });

  it("inferPillarFromPath legal", () => {
    expect(inferPillarFromPath("content/training/legal/contract.md")).toBe("legal");
  });

  it("inferPillarFromPath sales", () => {
    expect(inferPillarFromPath("content/training/sales/script.md")).toBe("sales");
  });

  it("inferPillarFromPath foundation → common", () => {
    expect(inferPillarFromPath("content/training/foundation/intro.md")).toBe("common");
  });

  it("inferPillarFromPath legacy hrbp 路徑 fallback common(hr pillar 已砍)", () => {
    expect(inferPillarFromPath("content/training/hrbp_series/EP1.md")).toBe("common");
    expect(inferPillarFromPath("content\\training\\hrbp_series\\EP2.md")).toBe("common");
  });

  it("pillarFromNotionDbId 找到 sales config", () => {
    const cfgs = [
      { id: "sales", notion_database_id: "xyz" },
      { id: "legal", notion_database_id: "abc" },
    ];
    expect(pillarFromNotionDbId("xyz", cfgs)).toBe("sales");
    expect(pillarFromNotionDbId("abc", cfgs)).toBe("legal");
  });

  it("pillarFromNotionDbId legacy hr config → common", () => {
    const cfgs = [{ id: "hr", notion_database_id: "old" }];
    expect(pillarFromNotionDbId("old", cfgs)).toBe("common");
  });

  it("pillarFromNotionDbId 找不到 → common", () => {
    expect(pillarFromNotionDbId("unknown", [])).toBe("common");
  });
});
