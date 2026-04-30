"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PageHeader, KPICard, ErrorBox, LoadingBox,
  SectionHeader, ProgressDistributionBar, MonthlySummaryRow,
  AttentionPreviewItem, AutoHandledBlock,
  type AttentionPreview,
} from "../_components";

interface StudentsData {
  ok: boolean;
  generated_at: string;
  summary: {
    total_in_training: number;
    today_active: number;
    stuck: number;
    need_attention: number;
  };
  progress_distribution: Array<{ day: number; count: number; is_lagging: boolean }>;
  attention_list: AttentionPreview[];
  auto_handled: { total: number; by_brand: Record<string, number> };
  monthly_summary: {
    completion_rate: number;
    completion_rate_change: number;
    avg_practice_score: number;
    stuck_resolution_rate: number;
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
        <>
          {/* 4 KPI 卡 */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}>
            <KPICard label="訓練中"   value={data.summary.total_in_training} />
            <KPICard label="今日上線" value={data.summary.today_active} />
            <KPICard label="卡關中"   value={data.summary.stuck}          accent={data.summary.stuck > 0 ? "amber" : "default"} />
            <KPICard label="需介入"   value={data.summary.need_attention} accent={data.summary.need_attention > 0 ? "ruby" : "default"} />
          </div>

          {/* 進度分布 */}
          <SectionHeader title="進度分布" />
          <ProgressDistributionBar distribution={data.progress_distribution} />

          {/* 緊急區塊 */}
          {data.attention_list.length > 0 ? (
            <>
              <SectionHeader title="🚨 需要你親自介入" count={data.summary.need_attention} accent="ruby" />
              {data.attention_list.map(item => (
                <AttentionPreviewItem key={item.user_id || item.summary} item={item} />
              ))}
              <Link href="/admin/training-ops/attention" style={{
                display: "inline-block", marginTop: 8, fontSize: 13,
                color: "var(--accent)", textDecoration: "none",
              }}>
                看完整清單 →
              </Link>
            </>
          ) : (
            <>
              <SectionHeader title="🚨 需要你親自介入" count={0} accent="jade" />
              <div style={{
                padding: 16, background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 8, color: "var(--text3)", fontSize: 13,
              }}>
                目前沒有需要你親自介入的案例 — Claude 都接住了。
              </div>
            </>
          )}

          {/* 自動處理區 */}
          <SectionHeader title="自動處理" />
          <AutoHandledBlock total={data.auto_handled.total} byBrand={data.auto_handled.by_brand} />

          {/* 月成效快覽 */}
          <SectionHeader title="本月成效快覽" />
          <MonthlySummaryRow summary={data.monthly_summary} />
        </>
      )}
    </div>
  );
}

function pct(num: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((num / total) * 100)}%`;
}
