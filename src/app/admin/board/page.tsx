"use client";

/**
 * /admin/board (新版 — 取代舊 quarterly 為 default 入口)
 *
 * Vincent 拍板(2026-05-02):
 * - 不只看「季度」— 還要看「週」「月」(這週要留意 / 這月要留意)
 * - 資料來源 sales_metrics_daily(Metabase 真實 incremental sync)
 * - 不空殼,要實資料
 */

import { useEffect, useState } from "react";

interface PeriodSummary {
  ok: boolean;
  period: "week" | "month" | "quarter";
  range: { from: string; to: string };
  totals: {
    calls: number;
    connected: number;
    appointments: number;
    closures: number;
    revenue: number;
    active_users: number;
  };
  by_brand: Array<{
    brand: string;
    calls: number;
    closures: number;
    revenue: number;
    people: number;
  }>;
  top_performers: Array<{
    name: string;
    brand: string;
    calls: number;
    closures: number;
    revenue: number;
  }>;
  highlights: string[];
  warnings: string[];
}

const BRAND_NAMES: Record<string, string> = {
  nschool: "nSchool 財經",
  xuemi: "XUEMI 學米",
  ooschool: "OOschool 無限",
  aischool: "AIschool 智能",
  xlab: "X LAB 實驗室",
};

export default function AdminBoardPage() {
  const [period, setPeriod] = useState<"week" | "month" | "quarter">("week");
  const [data, setData] = useState<PeriodSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/board/period-summary?period=${period}`, { cache: "no-store" })
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div>
      <header className="ds-page__header">
        <h1 className="ds-page__title">📊 集團成績單</h1>
        <p className="ds-page__subtitle">
          資料來源:Metabase Q1381 incremental sync(每 15 分自動)· 切換週 / 月 / 季看不同維度
        </p>
      </header>

      {/* Period 切換 */}
      <div className="ds-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={period === "week"}
          className={`ds-tabs__item${period === "week" ? " ds-tabs__item--active" : ""}`}
          onClick={() => setPeriod("week")}
        >📅 本週成績單</button>
        <button
          role="tab"
          aria-selected={period === "month"}
          className={`ds-tabs__item${period === "month" ? " ds-tabs__item--active" : ""}`}
          onClick={() => setPeriod("month")}
        >📆 本月成績單</button>
        <button
          role="tab"
          aria-selected={period === "quarter"}
          className={`ds-tabs__item${period === "quarter" ? " ds-tabs__item--active" : ""}`}
          onClick={() => setPeriod("quarter")}
        >📊 本季成績單</button>
      </div>

      {loading && <div className="ds-empty"><div className="ds-empty__title">載入中…</div></div>}

      {!loading && data?.ok && (
        <div className="ds-fade-in">
          {/* 範圍 */}
          <div style={{ marginBottom: "var(--ds-sp-5)", fontSize: "var(--ds-fs-sm)", color: "var(--ds-text-3)" }}>
            區間 <strong style={{ color: "var(--ds-text)" }}>{data.range.from}</strong> ~ <strong style={{ color: "var(--ds-text)" }}>{data.range.to}</strong>
          </div>

          {/* KPI 4 卡 */}
          <div className="ds-grid ds-grid--4" style={{ marginBottom: "var(--ds-sp-6)" }}>
            <div className="ds-stat">
              <div className="ds-stat__label">總撥打</div>
              <div className="ds-stat__value">{fmt(data.totals.calls)}</div>
              <div className="ds-stat__delta">{data.totals.active_users} 位業務</div>
            </div>
            <div className="ds-stat">
              <div className="ds-stat__label">有效通</div>
              <div className="ds-stat__value">{fmt(data.totals.connected)}</div>
              <div className="ds-stat__delta">接通率 {pct(data.totals.connected, data.totals.calls)}</div>
            </div>
            <div className="ds-stat">
              <div className="ds-stat__label">邀約出席</div>
              <div className="ds-stat__value">{fmt(data.totals.appointments)}</div>
              <div className="ds-stat__delta">通-邀 {pct(data.totals.appointments, data.totals.connected)}</div>
            </div>
            <div className="ds-stat">
              <div className="ds-stat__label">成交</div>
              <div className="ds-stat__value">{fmt(data.totals.closures)}</div>
              <div className="ds-stat__delta">營收 NT$ {Math.round(data.totals.revenue / 10000)} 萬</div>
            </div>
          </div>

          {/* Highlights / Warnings */}
          {(data.highlights.length > 0 || data.warnings.length > 0) && (
            <div className="ds-grid ds-grid--2" style={{ marginBottom: "var(--ds-sp-6)" }}>
              {data.highlights.length > 0 && (
                <div className="ds-card ds-card--success">
                  <div className="ds-card__title">🌟 亮點</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: "var(--ds-fs-sm)", lineHeight: 1.8 }}>
                    {data.highlights.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                </div>
              )}
              {data.warnings.length > 0 && (
                <div className="ds-card ds-card--warning">
                  <div className="ds-card__title">⚠️ 要留意</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: "var(--ds-fs-sm)", lineHeight: 1.8 }}>
                    {data.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 各品牌 */}
          <div className="ds-card" style={{ marginBottom: "var(--ds-sp-6)" }}>
            <div className="ds-card__title">🏷️ 各品牌表現</div>
            <div style={{ overflowX: "auto" }}>
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>品牌</th>
                    <th>業務</th>
                    <th className="ds-table__num">撥打</th>
                    <th className="ds-table__num">成交</th>
                    <th className="ds-table__num">營收</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_brand.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--ds-text-3)" }}>無資料</td></tr>
                  )}
                  {data.by_brand.map(b => (
                    <tr key={b.brand}>
                      <td><strong>{BRAND_NAMES[b.brand] || b.brand}</strong></td>
                      <td>{b.people}</td>
                      <td className="ds-table__num">{fmt(b.calls)}</td>
                      <td className="ds-table__num">{fmt(b.closures)}</td>
                      <td className="ds-table__num">NT$ {Math.round(b.revenue / 10000)}萬</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top 5 業務 */}
          <div className="ds-card">
            <div className="ds-card__title">🏆 Top 5 業務(本{period === "week" ? "週" : period === "month" ? "月" : "季"})</div>
            <div style={{ overflowX: "auto" }}>
              <table className="ds-table">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>#</th>
                    <th>姓名</th>
                    <th>品牌</th>
                    <th className="ds-table__num">撥打</th>
                    <th className="ds-table__num">成交</th>
                    <th className="ds-table__num">營收</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_performers.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--ds-text-3)" }}>無資料</td></tr>
                  )}
                  {data.top_performers.map((p, i) => (
                    <tr key={p.name + i}>
                      <td><span className="ds-badge ds-badge--gold">{i + 1}</span></td>
                      <td><strong>{p.name}</strong></td>
                      <td>{BRAND_NAMES[p.brand] || p.brand}</td>
                      <td className="ds-table__num">{fmt(p.calls)}</td>
                      <td className="ds-table__num">{fmt(p.closures)}</td>
                      <td className="ds-table__num">NT$ {Math.round(p.revenue / 10000)}萬</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && data && !data.ok && (
        <div className="ds-empty">
          <div className="ds-empty__icon">⚠️</div>
          <div className="ds-empty__title">資料載入失敗</div>
          <div className="ds-empty__hint">period-summary endpoint 還沒 deploy。</div>
        </div>
      )}
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
