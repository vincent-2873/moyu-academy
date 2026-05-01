"use client";

import HealthDashboard from "@/components/admin/HealthDashboard";
import MetabaseAuditPanel from "@/components/admin/MetabaseAuditPanel";

export default function AdminSettingsHealthPage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>❤️ 系統健康度</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          API endpoint 健康度 + Metabase 對標 audit
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <HealthDashboard />
        <MetabaseAuditPanel />
      </div>
    </div>
  );
}
