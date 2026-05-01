"use client";

import { useState } from "react";
import SalesRulesEditor from "@/components/admin/SalesRulesEditor";
import KpiTargetsEditor from "@/components/admin/KpiTargetsEditor";
import StampRulesEditor from "@/components/admin/StampRulesEditor";

const TABS = [
  { id: "detection", label: "🚨 偵測規則", desc: "業務 alert 觸發條件(原業務規則 10 條)" },
  { id: "kpi",       label: "🎯 KPI 目標", desc: "Yu KPI 漏斗目標 + 撥通/通次/通時/邀約/出席/成交" },
  { id: "stamp",     label: "🏆 印章規則", desc: "成就印章解鎖條件(common/rare/epic/legendary)" },
] as const;

export default function AdminClaudeRulesPage() {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]["id"]>("detection");
  const tab = TABS.find(t => t.id === activeTab) ?? TABS[0];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>📐 規則中心</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          對齊 system-tree v2 §AI 工作台 §規則中心 — 偵測規則 + KPI 目標 + 印章規則
        </p>
      </div>

      <div style={{
        display: "flex",
        gap: 4,
        marginBottom: 8,
        borderBottom: "1px solid var(--ink-line, #E5E2DA)",
      }}>
        {TABS.map(t => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: "6px 6px 0 0",
                background: active ? "var(--ink-paper, #FAFAF7)" : "transparent",
                color: active ? "var(--ink-deep, #2A2622)" : "var(--text2, #5C544A)",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                borderBottom: active ? "2px solid #C8102E" : "2px solid transparent",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: "var(--text3, #888)", margin: "0 0 16px 0" }}>{tab.desc}</p>

      {activeTab === "detection" && <SalesRulesEditor />}
      {activeTab === "kpi"       && <KpiTargetsEditor />}
      {activeTab === "stamp"     && <StampRulesEditor />}
    </div>
  );
}
