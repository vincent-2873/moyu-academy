"use client";

import SetupWizard from "@/components/admin/SetupWizard";
import AssetsUploader from "@/components/admin/AssetsUploader";

export default function AdminSettingsSystemPage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>⚙️ 系統參數</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          Setup 完成度 / env 設定 / 資產(Logo / 圖片)/ 系統管控
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <SetupWizard />
        <AssetsUploader />
      </div>
    </div>
  );
}
