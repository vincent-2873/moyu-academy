"use client";

import UsersEditor from "@/components/admin/UsersEditor";
import EmployeesFromMetabaseTab from "@/components/admin/EmployeesFromMetabaseTab";
import PeopleManager from "@/components/admin/PeopleManager";

export default function AdminSettingsPeoplePage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>👥 人員管理</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          會員管理 / persona_role 切換 / 邀請投資人 / Metabase 同步 / 員工編輯
        </p>
      </div>

      {/* Wave 8 #3:會員 + persona_role 管理(投資人也走這裡邀請進來)*/}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>🏛️ 會員 / 角色 / 投資人邀請</h2>
        <PeopleManager />
      </section>

      {/* 既有功能保留(向後相容)*/}
      <details style={{ marginBottom: 24 }}>
        <summary style={{ fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "8px 0", color: "var(--ds-text-3)" }}>
          ▸ 進階:Metabase 同步 + 員工編輯
        </summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 12 }}>
          <EmployeesFromMetabaseTab />
          <UsersEditor />
        </div>
      </details>
    </div>
  );
}
