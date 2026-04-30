import { describe, it, expect } from "vitest";
import { getRolePillars, inferPillarFromPath, pillarFromNotionDbId } from "./rag-pillars";

describe("rag-pillars", () => {
  it("sales_rep 看 sales + common", () => {
    expect(getRolePillars("sales_rep").sort()).toEqual(["common", "sales"]);
  });

  it("super_admin 看全 4 池", () => {
    expect(getRolePillars("super_admin").sort()).toEqual(["common", "hr", "legal", "sales"]);
  });

  it("trainer 跨 hr+sales+common", () => {
    expect(getRolePillars("trainer").sort()).toEqual(["common", "hr", "sales"]);
  });

  it("legal_staff 限 legal + common", () => {
    expect(getRolePillars("legal_staff").sort()).toEqual(["common", "legal"]);
  });

  it("空 / 未知 role fallback common", () => {
    expect(getRolePillars(null)).toEqual(["common"]);
    expect(getRolePillars(undefined)).toEqual(["common"]);
    expect(getRolePillars("__nonexistent__")).toEqual(["common"]);
  });

  it("inferPillarFromPath hrbp_series", () => {
    expect(inferPillarFromPath("content/training/hrbp_series/EP1.md")).toBe("hr");
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

  it("inferPillarFromPath 反斜線 windows path 也 ok", () => {
    expect(inferPillarFromPath("content\\training\\hrbp_series\\EP2.md")).toBe("hr");
  });

  it("pillarFromNotionDbId 找到 hr config", () => {
    const cfgs = [{ id: "hr", notion_database_id: "abc123" }, { id: "sales", notion_database_id: "xyz" }];
    expect(pillarFromNotionDbId("abc123", cfgs)).toBe("hr");
    expect(pillarFromNotionDbId("xyz", cfgs)).toBe("sales");
  });

  it("pillarFromNotionDbId 找不到 → common", () => {
    expect(pillarFromNotionDbId("unknown", [])).toBe("common");
  });
});
