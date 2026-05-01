"use client";

import HealthStrip from "@/components/admin/HealthStrip";
import SystemRunLogPanel from "@/components/admin/SystemRunLogPanel";

export default function AdminClaudeLivePage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>🤖 Claude 即時狀態</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          17 worker 即時 log + 系統健康度(對齊 system-tree v2 §AI 工作台)
        </p>
      </div>
      <div style={{ marginBottom: 20 }}>
        <HealthStrip />
      </div>
      <SystemRunLogPanel />
    </div>
  );
}
