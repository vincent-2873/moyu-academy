"use client";

import UsersEditor from "@/components/admin/UsersEditor";
import EmployeesFromMetabaseTab from "@/components/admin/EmployeesFromMetabaseTab";

export default function AdminSettingsPeoplePage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>👥 人員管理</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          員工列表 / 編輯 / Metabase 同步 / 權限設定
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <EmployeesFromMetabaseTab />
        <UsersEditor />
      </div>
    </div>
  );
}
