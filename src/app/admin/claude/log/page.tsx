"use client";

import { useState } from "react";
import SystemRunLogPanel from "@/components/admin/SystemRunLogPanel";
import LineTemplatesEditor from "@/components/admin/LineTemplatesEditor";
import CommandLogPanel from "@/components/admin/CommandLogPanel";

const TABS = [
  { id: "commands", label: "📋 命令日誌",   desc: "Claude 派的所有命令(claude_tasks)" },
  { id: "runs",     label: "📊 運行紀錄",   desc: "17 worker 歷史 log(system_run_log)" },
  { id: "line",     label: "📨 LINE 派令模板", desc: "LINE 訊息模板管理" },
] as const;

export default function AdminClaudeLogPage() {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]["id"]>("commands");
  const tab = TABS.find(t => t.id === activeTab) ?? TABS[0];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>📜 Claude 工作日誌</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          對齊 system-tree v2 §AI 工作台 §工作日誌 — 命令日誌 / 運行紀錄 / LINE 派令
        </p>
      </div>

      {/* Tab nav */}
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
                transition: "all 150ms",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: "var(--text3, #888)", margin: "0 0 16px 0" }}>{tab.desc}</p>

      {/* Tab content */}
      {activeTab === "commands" && <CommandLogPanel />}
      {activeTab === "runs" && <SystemRunLogPanel />}
      {activeTab === "line" && <LineTemplatesEditor />}
    </div>
  );
}
