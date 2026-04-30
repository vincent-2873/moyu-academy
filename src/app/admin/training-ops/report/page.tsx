"use client";

import { useEffect, useState } from "react";
import { PageHeader, KPICard, StubNotice, ErrorBox, LoadingBox } from "../_components";

interface ReportData {
  ok: boolean;
  generated_at: string;
  summary: {
    enrolled: number;
    completed: number;
    completion_rate: number;
    completion_rate_change: number;
    dropout: number;
  };
  post_training: {
    avg_calls_per_day: number;
    avg_close_per_month: number;
    avg_revenue_per_month: number;
  } | null;
}

export default function ReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/training-ops/report")
      .then(r => r.json())
      .then((d: ReportData) => setData(d))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div>
      <PageHeader
        title="成效報告"
        subtitle="完訓率 / 完訓 30 天後表現 / Top + Bottom modules + Claude 改寫建議"
      />

      {error && <ErrorBox message={error} />}
      {!data && !error && <LoadingBox />}

      {data && (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}>
            <KPICard label="入訓"   value={data.summary.enrolled} />
            <KPICard label="完訓"   value={data.summary.completed} />
            <KPICard label="完訓率(%)" value={data.summary.completion_rate} />
            <KPICard label="淘汰"   value={data.summary.dropout} accent={data.summary.dropout > 0 ? "amber" : "default"} />
          </div>

          {data.post_training && (
            <div style={{
              marginBottom: 32,
              padding: 24,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginTop: 0, marginBottom: 16 }}>
                完訓 30 天後表現
              </h2>
              <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                <Metric label="平均日撥打" value={`${data.post_training.avg_calls_per_day} 通`} />
                <Metric label="平均月成交" value={`${data.post_training.avg_close_per_month} 件`} />
                <Metric label="平均月營收" value={`NT$ ${data.post_training.avg_revenue_per_month.toLocaleString()}`} />
              </div>
            </div>
          )}
        </>
      )}

      <StubNotice tasks={[
        "Task 1.6:Top 5 / Bottom 5 modules + 完訓率 / 完訓後成交率",
        "Task 1.6:Claude 自動評估「有效 / 一般 / 無效」+ 建議改寫",
        "Task 1.6:GitHub Actions weekly cron(/api/cron/training-effectiveness)寫入 module_effectiveness",
      ]} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6, letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", fontFamily: '"JetBrains Mono", monospace' }}>
        {value}
      </div>
    </div>
  );
}
