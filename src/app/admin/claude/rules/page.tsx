"use client";

import SalesRulesEditor from "@/components/admin/SalesRulesEditor";
import KpiTargetsEditor from "@/components/admin/KpiTargetsEditor";
import StampRulesEditor from "@/components/admin/StampRulesEditor";

export default function AdminClaudeRulesPage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>📐 規則中心</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          偵測規則(業務 alert)+ KPI 目標 + 印章規則 — Claude 評估行為依據
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <SalesRulesEditor />
        <KpiTargetsEditor />
        <StampRulesEditor />
      </div>
    </div>
  );
}
