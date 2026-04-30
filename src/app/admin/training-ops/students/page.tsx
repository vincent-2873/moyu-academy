"use client";

import { useEffect, useState } from "react";
import { PageHeader, KPICard, StubNotice, ErrorBox, LoadingBox } from "../_components";

interface StudentsData {
  ok: boolean;
  generated_at: string;
  summary: {
    total_in_training: number;
    today_active: number;
    stuck: number;
    need_attention: number;
  };
}

export default function StudentsPage() {
  const [data, setData] = useState<StudentsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/training-ops/students")
      .then(r => r.json())
      .then((d: StudentsData) => setData(d))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div>
      <PageHeader
        title="訓練生戰況"
        subtitle={data
          ? `本月 ${data.summary.total_in_training} 人 · 上線率 ${pct(data.summary.today_active, data.summary.total_in_training)}`
          : "本月訓練生狀況一覽"
        }
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
          <KPICard label="訓練中"   value={data.summary.total_in_training} />
          <KPICard label="今日上線" value={data.summary.today_active} />
          <KPICard label="卡關中"   value={data.summary.stuck}          accent={data.summary.stuck > 0 ? "amber" : "default"} />
          <KPICard label="需介入"   value={data.summary.need_attention} accent={data.summary.need_attention > 0 ? "ruby"  : "default"} />
        </div>
      )}

      <StubNotice tasks={[
        "Task 1.3:KPI 進度分布(D0-D14 條形圖)",
        "Task 1.3:需介入清單前 3 預覽 + StuckCard 元件",
        "Task 1.3:Claude 自動處理區(by 品牌摺疊)",
        "Task 1.3:本月成效快覽(完訓率 / 平均對練分 / 卡關處理率)",
      ]} />
    </div>
  );
}

function pct(num: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((num / total) * 100)}%`;
}
