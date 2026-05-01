"use client";

/**
 * /admin/hub — 墨宇集團戰情總覽(2026-05-02 新增)
 *
 * Vincent 拍板:不要切換來切換去,一頁看到所有重點
 *  - 集團今日數字(SMD 真資料)
 *  - 5 品牌橫向比對
 *  - Claude 健康度(17 worker 狀態 + 最近 sync)
 *  - 法務案件 / 訓練生狀態 / 人類待辦 摘要 + drill-down
 *  - 本週 vs 上週 趨勢
 *
 * 全頁面用 SMD + recent_sync_runs + legal_cases + training 等真實資料,沒有 demo
 */

import { useEffect, useState } from "react";
import Link from "next/link";

interface HubData {
  ok: boolean;
  generated_at: string;
  empire: {
    today_calls: number;
    today_appointments: number;
    today_closures: number;
    today_revenue: number;
    week_calls: number;
    week_appointments: number;
    week_closures: number;
    week_revenue: number;
    week_vs_last_pct: number;
    active_users: number;
    silent_today: number;
    silent_3d: number;
    effective_date: string;
    effective_date_is_today: boolean;
  };
  brands: Array<{
    brand: string;
    name: string;
    today_calls: number;
    week_calls: number;
    week_closures: number;
    week_revenue: number;
    people: number;
    status: "healthy" | "warning" | "critical" | "unknown";
    diagnosis: string;
  }>;
  top_today: Array<{ name: string; brand: string; calls: number; closures: number }>;
  struggling: Array<{ name: string; brand: string; calls: number; closures: number; reason: string }>;
  legal: { open_cases: number; due_week: number; overdue: number };
  training: { in_training: number; today_active: number; stuck: number; need_attention: number };
  claude: {
    last_sync_at: string | null;
    sync_health: string;
    days_behind: number | null;
    recent_runs: Array<{ source: string; status: string; at: string }>;
    pending_human: number;
  };
  next_actions: Array<{ urgency: "critical" | "high" | "normal"; title: string; detail: string; href?: string }>;
}

const BRAND_NAMES: Record<string, string> = {
  nschool: "nSchool 財經",
  xuemi: "XUEMI 學米",
  ooschool: "OOschool 無限",
  aischool: "AIschool 智能",
  xlab: "X LAB 實驗室",
};

const STATUS_BADGE: Record<string, string> = {
  healthy: "ds-badge--success",
  warning: "ds-badge--warning",
  critical: "ds-badge--danger",
  unknown: "ds-badge",
};

export default function AdminHubPage() {
  const [data, setData] = useState<HubData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/hub", { cache: "no-store" })
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="ds-empty"><div className="ds-empty__title">載入中…</div></div>;
  }

  if (!data?.ok) {
    return (
      <div className="ds-empty">
        <div className="ds-empty__icon">⚠️</div>
        <div className="ds-empty__title">資料載入失敗</div>
      </div>
    );
  }

  const { empire, brands, top_today, struggling, legal, training, claude, next_actions } = data;
  const isToday = empire.effective_date_is_today;
  const dateLabel = isToday ? "今日" : `${empire.effective_date}(最近工作日)`;

  return (
    <div className="ds-fade-in">
      {/* Header */}
      <header className="ds-page__header">
        <h1 className="ds-page__title">🏯 墨宇集團戰情中心</h1>
        <p className="ds-page__subtitle">
          {dateLabel} · 自動同步 Metabase / Notion / 17 個 AI Worker · 一頁看完所有戰線
        </p>
      </header>

      {/* 四大集團 KPI */}
      <div className="ds-grid ds-grid--4" style={{ marginBottom: "var(--ds-sp-6)" }}>
        <div className="ds-stat">
          <div className="ds-stat__label">{dateLabel}撥打</div>
          <div className="ds-stat__value">{fmt(empire.today_calls)}</div>
          <div className="ds-stat__delta">
            {empire.active_users} 位開口 / {empire.silent_today} 位 silent
          </div>
        </div>
        <div className="ds-stat">
          <div className="ds-stat__label">{dateLabel}邀約</div>
          <div className="ds-stat__value">{fmt(empire.today_appointments)}</div>
          <div className="ds-stat__delta">轉換 {pct(empire.today_appointments, empire.today_calls)}</div>
        </div>
        <div className="ds-stat">
          <div className="ds-stat__label">{dateLabel}成交</div>
          <div className="ds-stat__value">{fmt(empire.today_closures)}</div>
          <div className="ds-stat__delta">營收 NT$ {Math.round(empire.today_revenue / 10000)} 萬</div>
        </div>
        <div className="ds-stat">
          <div className="ds-stat__label">本週 vs 上週</div>
          <div className="ds-stat__value">
            {empire.week_vs_last_pct >= 0 ? "+" : ""}{empire.week_vs_last_pct.toFixed(0)}%
          </div>
          <div className={`ds-stat__delta ${empire.week_vs_last_pct >= 0 ? "ds-stat__delta--up" : "ds-stat__delta--down"}`}>
            本週 {fmt(empire.week_calls)} 通 / {empire.week_closures} 成交
          </div>
        </div>
      </div>

      {/* 待 Vincent 處理(Next Actions)*/}
      {next_actions.length > 0 && (
        <div className="ds-card ds-card--accent" style={{ marginBottom: "var(--ds-sp-6)" }}>
          <div className="ds-card__title">⚡ 你今天該注意的事</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ds-sp-2)" }}>
            {next_actions.map((a, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "var(--ds-sp-3)",
                padding: "var(--ds-sp-3)",
                background: a.urgency === "critical" ? "var(--ds-danger-soft)" : a.urgency === "high" ? "var(--ds-warning-soft)" : "var(--ds-surface-2)",
                borderRadius: "var(--ds-radius-md)",
                fontSize: "var(--ds-fs-sm)",
              }}>
                <span className={`ds-badge ${a.urgency === "critical" ? "ds-badge--danger" : a.urgency === "high" ? "ds-badge--warning" : "ds-badge--info"}`}>
                  {a.urgency === "critical" ? "🔴 緊急" : a.urgency === "high" ? "🟡 重要" : "ℹ️ 提醒"}
                </span>
                <div style={{ flex: 1 }}>
                  <strong>{a.title}</strong>
                  <span style={{ color: "var(--ds-text-3)", marginLeft: 8 }}>{a.detail}</span>
                </div>
                {a.href && <Link href={a.href} className="ds-btn ds-btn--sm">處理 →</Link>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5 品牌橫向比對 */}
      <div className="ds-card" style={{ marginBottom: "var(--ds-sp-6)" }}>
        <div className="ds-card__title">
          🏷️ 5 品牌戰況
          <Link href="/admin/board" className="ds-btn ds-btn--sm ds-btn--ghost" style={{ marginLeft: "auto" }}>看完整 →</Link>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="ds-table">
            <thead>
              <tr>
                <th>品牌</th>
                <th>狀態</th>
                <th>業務</th>
                <th className="ds-table__num">{dateLabel}撥打</th>
                <th className="ds-table__num">本週成交</th>
                <th className="ds-table__num">本週營收</th>
                <th>診斷</th>
              </tr>
            </thead>
            <tbody>
              {brands.map(b => (
                <tr key={b.brand}>
                  <td><strong>{b.name}</strong></td>
                  <td><span className={`ds-badge ${STATUS_BADGE[b.status]}`}>{b.status}</span></td>
                  <td>{b.people}</td>
                  <td className="ds-table__num">{fmt(b.today_calls)}</td>
                  <td className="ds-table__num">{fmt(b.week_closures)}</td>
                  <td className="ds-table__num">NT$ {Math.round(b.week_revenue / 10000)}萬</td>
                  <td style={{ color: "var(--ds-text-3)", fontSize: "var(--ds-fs-xs)" }}>{b.diagnosis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 兩欄:Top + Struggling */}
      <div className="ds-grid ds-grid--2" style={{ marginBottom: "var(--ds-sp-6)" }}>
        <div className="ds-card ds-card--success">
          <div className="ds-card__title">🏆 {dateLabel}領跑業務</div>
          {top_today.length === 0 && <div className="ds-empty__hint">{dateLabel}無人撥打</div>}
          {top_today.map((p, i) => (
            <div key={p.name + i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "var(--ds-sp-2) 0",
              borderBottom: i < top_today.length - 1 ? "1px solid var(--ds-divider)" : "none",
              fontSize: "var(--ds-fs-sm)",
            }}>
              <div>
                <span className="ds-badge ds-badge--gold" style={{ marginRight: 8 }}>{i + 1}</span>
                <strong>{p.name}</strong>
                <span style={{ color: "var(--ds-text-3)", marginLeft: 8 }}>{BRAND_NAMES[p.brand] || p.brand}</span>
              </div>
              <span className="ds-num">{p.calls} 通 / {p.closures} 成交</span>
            </div>
          ))}
        </div>

        <div className="ds-card ds-card--warning">
          <div className="ds-card__title">⚠️ 需介入(量多無成交 / 連續 silent)</div>
          {struggling.length === 0 && <div className="ds-empty__hint">沒有需介入的業務 ✓</div>}
          {struggling.map((p, i) => (
            <div key={p.name + i} style={{
              padding: "var(--ds-sp-2) 0",
              borderBottom: i < struggling.length - 1 ? "1px solid var(--ds-divider)" : "none",
              fontSize: "var(--ds-fs-sm)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{p.name}</strong>
                <span style={{ color: "var(--ds-text-3)" }}>{BRAND_NAMES[p.brand] || p.brand}</span>
              </div>
              <div style={{ color: "var(--ds-warning)", fontSize: "var(--ds-fs-xs)", marginTop: 2 }}>{p.reason}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 三欄:法務 / 訓練 / Claude */}
      <div className="ds-grid ds-grid--3" style={{ marginBottom: "var(--ds-sp-6)" }}>
        <div className="ds-card">
          <div className="ds-card__title">
            ⚖️ 法務戰線
            <Link href="/admin/legal/cases" className="ds-btn ds-btn--sm ds-btn--ghost" style={{ marginLeft: "auto" }}>看案件 →</Link>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--ds-sp-2) 0", fontSize: "var(--ds-fs-sm)", borderBottom: "1px solid var(--ds-divider)" }}>
            <span>進行中案件</span><strong className="ds-num">{legal.open_cases}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--ds-sp-2) 0", fontSize: "var(--ds-fs-sm)", borderBottom: "1px solid var(--ds-divider)" }}>
            <span>本週到期</span><strong className="ds-num" style={{ color: legal.due_week > 0 ? "var(--ds-warning)" : "inherit" }}>{legal.due_week}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--ds-sp-2) 0", fontSize: "var(--ds-fs-sm)" }}>
            <span>已逾期</span><strong className="ds-num" style={{ color: legal.overdue > 0 ? "var(--ds-danger)" : "inherit" }}>{legal.overdue}</strong>
          </div>
        </div>

        <div className="ds-card">
          <div className="ds-card__title">
            📚 訓練營運
            <Link href="/admin/training-ops/students" className="ds-btn ds-btn--sm ds-btn--ghost" style={{ marginLeft: "auto" }}>看學員 →</Link>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--ds-sp-2) 0", fontSize: "var(--ds-fs-sm)", borderBottom: "1px solid var(--ds-divider)" }}>
            <span>訓練中</span><strong className="ds-num">{training.in_training}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--ds-sp-2) 0", fontSize: "var(--ds-fs-sm)", borderBottom: "1px solid var(--ds-divider)" }}>
            <span>{dateLabel}上線</span><strong className="ds-num">{training.today_active}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--ds-sp-2) 0", fontSize: "var(--ds-fs-sm)" }}>
            <span>需介入</span><strong className="ds-num" style={{ color: training.need_attention > 0 ? "var(--ds-warning)" : "inherit" }}>{training.need_attention}</strong>
          </div>
        </div>

        <div className="ds-card">
          <div className="ds-card__title">
            🤖 Claude 健康度
            <Link href="/admin/claude/live" className="ds-btn ds-btn--sm ds-btn--ghost" style={{ marginLeft: "auto" }}>看 worker →</Link>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--ds-sp-2) 0", fontSize: "var(--ds-fs-sm)", borderBottom: "1px solid var(--ds-divider)" }}>
            <span>Metabase 同步</span>
            <span className={`ds-badge ${claude.sync_health === "healthy" ? "ds-badge--success" : claude.sync_health === "warning" ? "ds-badge--warning" : "ds-badge--danger"}`}>
              {claude.sync_health}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--ds-sp-2) 0", fontSize: "var(--ds-fs-sm)", borderBottom: "1px solid var(--ds-divider)" }}>
            <span>最後 sync</span>
            <span className="ds-num" style={{ fontSize: "var(--ds-fs-xs)" }}>{claude.last_sync_at?.slice(5, 16) || "—"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--ds-sp-2) 0", fontSize: "var(--ds-fs-sm)" }}>
            <span>等 Vincent 處理</span><strong className="ds-num" style={{ color: claude.pending_human > 0 ? "var(--ds-primary)" : "inherit" }}>{claude.pending_human}</strong>
          </div>
        </div>
      </div>

      {/* Recent worker runs */}
      <div className="ds-card">
        <div className="ds-card__title">📜 最近 5 個自動同步</div>
        {claude.recent_runs.length === 0 && <div className="ds-empty__hint">沒有 sync 紀錄</div>}
        {claude.recent_runs.map((r, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "var(--ds-sp-2) 0",
            borderBottom: i < claude.recent_runs.length - 1 ? "1px solid var(--ds-divider)" : "none",
            fontSize: "var(--ds-fs-sm)",
          }}>
            <div>
              <span className={`ds-badge ${r.status === "success" ? "ds-badge--success" : "ds-badge--danger"}`}>{r.status}</span>
              <span style={{ marginLeft: 8 }}>{r.source}</span>
            </div>
            <span style={{ color: "var(--ds-text-3)", fontSize: "var(--ds-fs-xs)" }}>{r.at?.slice(5, 16) || "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmt(n: number): string {
  if (n == null) return "0";
  return n.toLocaleString("zh-TW");
}
function pct(num: number, total: number): string {
  if (!total) return "—";
  return `${Math.round((num / total) * 100)}%`;
}
