"use client";

import { useEffect, useState } from "react";
import { PageHeader, KPICard, StubNotice, ErrorBox, LoadingBox } from "../_components";

interface MaterialsData {
  ok: boolean;
  generated_at: string;
  by_brand: Array<{
    brand: string;
    path_code: string;
    expected: number;
    actual: number;
    missing: number;
    status: "complete" | "incomplete" | "empty";
  }>;
}

const BRAND_LABELS: Record<string, string> = {
  nschool:  "nSchool 財經",
  xuemi:    "XUEMI 學米",
  ooschool: "ooschool 無限",
  aischool: "aischool 未來",
  xlab:     "X LAB 實體",
};

export default function MaterialsPage() {
  const [data, setData] = useState<MaterialsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/training-ops/materials")
      .then(r => r.json())
      .then((d: MaterialsData) => setData(d))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div>
      <PageHeader
        title="教材管理"
        subtitle="各品牌 × path 的訓練模組完整度,Claude 自動補草稿"
      />

      {error && <ErrorBox message={error} />}
      {!data && !error && <LoadingBox />}

      {data && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}>
          <KPICard label="完整 brand × path" value={data.by_brand.filter(b => b.status === "complete").length} />
          <KPICard label="缺部分"            value={data.by_brand.filter(b => b.status === "incomplete").length} accent="amber" />
          <KPICard label="全空(全新品牌)"  value={data.by_brand.filter(b => b.status === "empty").length}      accent="ruby" />
        </div>
      )}

      {data && data.by_brand.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>各品牌完整度</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.by_brand.map(b => (
              <BrandRow key={b.path_code} {...b} />
            ))}
          </div>
        </div>
      )}

      <StubNotice tasks={[
        "Task 1.5:POST /api/admin/training-ops/materials/generate-draft(Claude 從同 path 其他 brand 改寫)",
        "Task 1.5:「採用全部 / 一個一個改」按鈕",
        "Task 1.5:module_type CHECK 完整 allowed values 查清楚再 INSERT",
      ]} />
    </div>
  );
}

function BrandRow({ brand, path_code, expected, actual, missing, status }: MaterialsData["by_brand"][0]) {
  const statusColor = status === "complete" ? "var(--green)" : status === "empty" ? "var(--accent)" : "var(--gold)";
  const statusText  = status === "complete" ? "✓ 完整"      : status === "empty" ? "🆕 全新"   : "⚠ 缺部分";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "12px 16px",
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 8,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
          {BRAND_LABELS[brand] ?? brand}
        </div>
        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2, fontFamily: '"JetBrains Mono", monospace' }}>
          {path_code}
        </div>
      </div>
      <div style={{ fontSize: 13, color: "var(--text2)", fontFamily: '"JetBrains Mono", monospace' }}>
        {actual} / {expected}
      </div>
      <div style={{ fontSize: 12, color: statusColor, fontWeight: 500, minWidth: 80, textAlign: "right" }}>
        {statusText}
      </div>
    </div>
  );
}
