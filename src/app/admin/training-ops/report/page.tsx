"use client";

import { useEffect, useState } from "react";
import { PageHeader, KPICard, StubNotice, ErrorBox, LoadingBox, SectionHeader } from "../_components";

interface TopModuleRow {
  module_id: string;
  title: string;
  module_type: string;
  enrolled: number;
  completed: number;
  completion_rate: number;
  avg_score: number | null;
  claude_assessment: string | null;
  claude_suggestion: string | null;
}

interface ReportData {
  ok: boolean;
  generated_at: string;
  period: string;
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
  top5: TopModuleRow[];
  bottom5: TopModuleRow[];
  total_evaluated: number;
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
            <KPICard label="入訓"     value={data.summary.enrolled} />
            <KPICard label="完訓"     value={data.summary.completed} />
            <KPICard label="完訓率(%)" value={data.summary.completion_rate} />
            <KPICard label="淘汰"     value={data.summary.dropout} accent={data.summary.dropout > 0 ? "amber" : "default"} />
          </div>

          {data.post_training && (
            <>
              <SectionHeader title="完訓 30 天後表現" />
              <div style={{
                padding: 24,
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                display: "flex", gap: 32, flexWrap: "wrap",
                marginBottom: 16,
              }}>
                <Metric label="平均日撥打" value={`${data.post_training.avg_calls_per_day} 通`} />
                <Metric label="平均月成交" value={`${data.post_training.avg_close_per_month} 件`} />
                <Metric label="平均月營收" value={`NT$ ${data.post_training.avg_revenue_per_month.toLocaleString()}`} />
              </div>
            </>
          )}

          <SectionHeader title="🏆 Top 5 module" count={data.top5.length} accent="jade" />
          {data.top5.length === 0 ? (
            <EffectivenessEmptyHint period={data.period} />
          ) : (
            data.top5.map((m, i) => (
              <ModuleRow key={m.module_id} idx={i + 1} mod={m} variant="top" />
            ))
          )}

          <SectionHeader title="📉 Bottom 5 module(建議檢討)" count={data.bottom5.length} accent="ruby" />
          {data.bottom5.length === 0 ? (
            <EffectivenessEmptyHint period={data.period} />
          ) : (
            data.bottom5.map((m, i) => (
              <ModuleRow key={m.module_id} idx={i + 1} mod={m} variant="bottom" />
            ))
          )}

          <StubNotice tasks={[
            "Task 1.6 ✓ training-effectiveness cron + Top/Bottom + 簡易規則式 assessment",
            "GitHub Actions weekly cron:每週日 02:00 台北跑 (cron: 0 18 * * 6)",
            "Phase 2 後續:OpenAI gpt-4o-mini 生 claude_suggestion(改寫建議),目前用規則分類",
            "完訓 30 天後表現:撈完訓 user 的 sales_metrics_daily,Phase 2.x 加",
          ]} />
        </>
      )}
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

function ModuleRow({ idx, mod, variant }: { idx: number; mod: TopModuleRow; variant: "top" | "bottom" }) {
  const accentColor = variant === "top" ? "var(--green)" : "var(--accent)";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "14px 16px",
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: 8,
      marginBottom: 8,
    }}>
      <div style={{
        width: 28, fontSize: 13, fontWeight: 600, color: accentColor,
        fontFamily: '"JetBrains Mono", monospace', flexShrink: 0,
      }}>
        #{idx}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {mod.title}
        </div>
        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2, fontFamily: '"JetBrains Mono", monospace' }}>
          {mod.module_type} · {mod.enrolled} 入訓 · {mod.completed} 完訓
          {typeof mod.avg_score === "number" && ` · 均分 ${mod.avg_score}`}
        </div>
      </div>
      <div style={{
        fontSize: 16, fontWeight: 700, color: accentColor,
        fontFamily: '"JetBrains Mono", monospace', minWidth: 60, textAlign: "right",
      }}>
        {mod.completion_rate}%
      </div>
      {mod.claude_assessment && (
        <div style={{
          fontSize: 11, padding: "3px 8px",
          background: "var(--bg2)",
          borderRadius: 4, color: accentColor, fontWeight: 500,
          flexShrink: 0,
        }}>
          {mod.claude_assessment}
        </div>
      )}
    </div>
  );
}

function EffectivenessEmptyHint({ period }: { period: string }) {
  return (
    <div style={{
      padding: 16, background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 8, color: "var(--text3)", fontSize: 13, marginBottom: 16, lineHeight: 1.7,
    }}>
      目前還沒有 {period} 的成效資料 — weekly cron 每週日 02:00 自動跑(GitHub Actions),
      或在 GitHub Actions UI 手動 trigger workflow_dispatch。
      <br />
      <span style={{ color: "var(--text2)" }}>
        Phase 2 用戶開始用 training_module_progress / roleplay_sessions 後,Top/Bottom 才會有資料。
      </span>
    </div>
  );
}
