"use client";

import CronConfigEditor from "@/components/admin/CronConfigEditor";

export default function AdminSettingsCronPage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>⏰ 排程管理</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          17 cron 排程 schedule / 啟用 / 觸發歷史(對齊 system-tree v2 §17 worker)
        </p>
      </div>
      <CronConfigEditor />
    </div>
  );
}
