"use client";

import SystemRunLogPanel from "@/components/admin/SystemRunLogPanel";

export default function AdminClaudeLogPage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>📜 Claude 工作日誌</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          17 worker 歷史 log + 命令日誌 + LINE 派令模板
        </p>
      </div>
      <SystemRunLogPanel />
    </div>
  );
}
