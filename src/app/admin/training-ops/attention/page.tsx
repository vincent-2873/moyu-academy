"use client";

import { useEffect, useState } from "react";
import { PageHeader, KPICard, StubNotice, ErrorBox, LoadingBox } from "../_components";

interface AttentionData {
  ok: boolean;
  generated_at: string;
  urgent: Array<{ id: string; title: string }>;
  normal: Array<{ id: string; title: string }>;
  resolved_today: number;
}

export default function AttentionPage() {
  const [data, setData] = useState<AttentionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/training-ops/attention")
      .then(r => r.json())
      .then((d: AttentionData) => setData(d))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div>
      <PageHeader
        title="需介入清單"
        subtitle="Claude 處理不了的,丟給你 — 只看真正需要 Vincent 親自接的人"
      />

      {error && <ErrorBox message={error} />}
      {!data && !error && <LoadingBox />}

      {data && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}>
          <KPICard label="🔴 緊急"   value={data.urgent.length} accent={data.urgent.length > 0 ? "ruby" : "default"} />
          <KPICard label="🟡 一般"   value={data.normal.length} accent={data.normal.length > 0 ? "amber" : "default"} />
          <KPICard label="✅ 今日已處理" value={data.resolved_today} />
        </div>
      )}

      <StubNotice tasks={[
        "Task 1.4:StuckCard 元件(Claude 嘗試清單 + 判斷 + 4 動作按鈕)",
        "Task 1.4:POST /api/admin/training-ops/attention/:id/action(self_handle / delegate_to_leader / voice_memo / mark_resolved)",
        "Task 1.4:已處理 24h 內仍可看到區塊",
      ]} />
    </div>
  );
}
