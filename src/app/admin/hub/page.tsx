"use client";

/**
 * /admin/hub — Claude 報告書(Wave 6 重做,2026-05-02)
 *
 * Vincent 拍板:Claude = CEO+COO+CTO,後台第一頁是「Claude 寫的 memo」不是 dashboard
 * 給董事會 / 投資人 / Vincent(human_ops)看
 *
 * 視覺:Serif memo 風(像 Substack post / Bezos 6-page)
 * 上半:北極星數字 + 14 天 sparkline(Claude 自己預測 vs actual)
 * 中間:Claude 今日 memo(markdown render with inline citation 引用線)
 * 下半:等你拍板 cards + 質詢 Claude 入口 + [展開戰況] accordion
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Gavel, MessageQuote, Activity, TrendingUp, AlertTriangle, Flame, Clock,
  CheckCircle, XCircle, Edit3, Sparkles, FileText, Send, Loader,
} from "../_icons";
import { useAdminMe } from "@/components/admin/useAdminMe";
import { useAdminDateRange } from "@/components/admin/TimeRangePicker";
import { dateRangeQS } from "@/lib/dateRange";

interface Narrative {
  date: string;
  headline: string | null;
  narrative: string | null;
  highlights: Array<{ text: string; cite?: string; metric?: number }>;
  warnings: Array<{ text: string; cite?: string; severity: string }>;
  decisions_made: Array<{ title: string; detail: string; evidence?: string }>;
  decisions_pending: Array<{ title: string; why?: string; claude_recommendation?: string; urgency?: string }>;
  metabase_sync_status: string;
  worker_runs_24h: number;
}

interface PendingDecision {
  id: string;
  category: string;
  title: string;
  context: string;
  claude_recommendation: string;
  urgency: string;
  due_date: string | null;
  created_at: string;
}

interface ReportData {
  ok: boolean;
  today: string;
  range?: { from: string; to: string; label: string; days: number };
  narrative: Narrative | null;
  north_star: {
    // Range-scoped(picker 內)
    range_revenue?: number;
    range_target?: number;
    range_closures?: number;
    range_progress_pct?: number;
    // Quarter-anchored(投資人 pace 用)
    quarter_revenue: number;
    quarter_target: number;
    quarter_closures: number;
    quarter_progress_pct?: number;
    forecast: number | null;
    progress_pct: number;
    prediction_accuracy: number | null;
    spark_14d: Array<{ date: string; revenue: number }>;
  };
  pending_decisions: PendingDecision[];
  recent_worker_runs: Array<{ source: string; status: string; created_at: string }>;
  recent_inquiries: Array<{ id: string; question: string; claude_answer: string | null; asker_role: string; asked_at: string }>;
  prediction_history?: Array<{ target_period: string; metric: string; predicted_value: number; actual_value: number; accuracy_pct: number; predicted_at: string }>;
  has_today_narrative: boolean;
}

export default function ClaudeReportPage() {
  const { data: me } = useAdminMe();
  const { range } = useAdminDateRange();
  const canApprove = me?.permissions.can_approve ?? false;
  const isBoardAudience = me?.permissions.is_board_audience ?? false;
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDrill, setShowDrill] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [askInput, setAskInput] = useState("");
  const [askResult, setAskResult] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  // decision approve/reject state
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [wantV2, setWantV2] = useState(true);
  const [fadingId, setFadingId] = useState<string | null>(null);
  // Toast
  const [toast, setToast] = useState<{ type: "success" | "info" | "warn"; msg: string } | null>(null);
  function showToast(type: "success" | "info" | "warn", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4500);
  }

  // 跟 picker range 連動 — 切時段就重抓
  useEffect(() => { load(); }, [range.from, range.to]);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/admin/claude-report?${dateRangeQS(range)}`, { cache: "no-store" });
    const j = await r.json();
    setData(j);
    setLoading(false);
  }

  async function generateNow() {
    setGenerating(true);
    await fetch("/api/cron/claude-daily-narrative?key=manual-trigger", { method: "POST" });
    await load();
    setGenerating(false);
  }

  async function approveDecision(id: string, title: string) {
    setActingId(id);
    try {
      const r = await fetch(`/api/admin/decisions/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow_up_action: "auto" }),
      });
      const j = await r.json();
      if (j.ok) {
        // fade-out animation
        setFadingId(id);
        const followUps = j.follow_ups || [];
        showToast("success", `✓ 已核准:${title.slice(0, 30)}${followUps.length > 0 ? ` · ${followUps[0]}` : ""}`);
        setTimeout(async () => {
          setFadingId(null);
          await load();
        }, 800);
      } else {
        showToast("warn", "核准失敗:" + (j.error || "unknown"));
      }
    } finally { setActingId(null); }
  }

  async function rejectDecisionConfirm() {
    if (!rejectModalId || !rejectReason.trim()) return;
    const id = rejectModalId;
    const title = data?.pending_decisions?.find(d => d.id === id)?.title || "";
    setActingId(id);
    try {
      const r = await fetch(`/api/admin/decisions/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason, want_v2: wantV2 }),
      });
      const j = await r.json();
      if (j.ok) {
        setRejectModalId(null);
        setRejectReason("");
        setFadingId(id);
        if (j.v2_decision) {
          showToast("success", `✓ 已駁回 · Claude 看完原因改了 v2:${j.v2_decision.title.slice(0, 35)}`);
        } else if (wantV2) {
          showToast("info", "已駁回 · v2 產生失敗(可能 ANTHROPIC_API_KEY 沒設或 Claude 拒答)");
        } else {
          showToast("success", `✓ 已駁回 · 我學到教訓,以後類似 pattern 不再提:${title.slice(0, 25)}`);
        }
        setTimeout(async () => {
          setFadingId(null);
          await load();
        }, 800);
      } else {
        showToast("warn", "駁回失敗:" + (j.error || "unknown"));
      }
    } finally { setActingId(null); }
  }

  async function submitAsk() {
    if (!askInput.trim()) return;
    setAsking(true);
    setAskResult(null);
    const r = await fetch("/api/admin/board/inquiry/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: askInput }),
    });
    const j = await r.json();
    setAskResult(j.answer || j.error || "(無回答)");
    setAsking(false);
  }

  if (loading) {
    return <div className="memo-shell"><div style={{ color: "var(--ds-text-3)", padding: 60, textAlign: "center" }}>載入 Claude 報告中…</div></div>;
  }

  if (!data?.ok) {
    return <div className="memo-shell"><div style={{ padding: 60, textAlign: "center" }}>無法載入</div></div>;
  }

  const ns = data.north_star;
  const n = data.narrative;
  const isToday = data.has_today_narrative;
  // Range-scoped(picker 內)— 跟 picker 連動
  const rangeRevenue = ns.range_revenue ?? ns.quarter_revenue;
  const rangeTarget = ns.range_target ?? ns.quarter_target;
  const rangeProgressPct = ns.range_progress_pct ?? ns.progress_pct;
  const rangeLabel = data.range?.label || "本季";
  // Quarter pace(投資人對標)
  const qProgressPct = ns.quarter_progress_pct ?? ns.progress_pct;
  const forecastPct = ns.forecast ? Math.round((ns.forecast / ns.quarter_target) * 100) : null;

  return (
    <article className="memo-shell">
      {/* 頂部信頭 */}
      <header className="memo-header">
        <div className="memo-byline">
          <div className="memo-from">FROM</div>
          <div className="memo-author">Claude · 墨宇集團 AI 執行長</div>
        </div>
        <div className="memo-byline">
          <div className="memo-from">TO</div>
          <div className="memo-author">董事會 / 投資人 / Vincent(人類副手)</div>
        </div>
        <div className="memo-date">{data.today} · 第 {Math.ceil(((new Date(data.today).getTime() - new Date(data.today.slice(0, 4) + "-01-01").getTime()) / 86400000 + 1) / 7)} 週</div>
      </header>

      <hr className="memo-rule" />

      {/* 北極星 banner */}
      <section className="memo-northstar">
        <div className="ns-grid">
          <div className="ns-main">
            <div className="ns-label">{rangeLabel} 營收進度 · 對標季目標 {qProgressPct}%</div>
            <div className="ns-value">
              <span className="ns-num">NT$ {Math.round(rangeRevenue / 10000).toLocaleString()}</span>
              <span className="ns-sep">/</span>
              <span className="ns-target">{Math.round(rangeTarget / 10000).toLocaleString()} 萬</span>
            </div>
            <div className="ns-bar">
              <div className="ns-bar-fill" style={{ width: `${Math.min(100, rangeProgressPct)}%` }} />
            </div>
            <div className="ns-meta">
              範圍內達 <strong>{rangeProgressPct}%</strong>
              <span style={{ marginLeft: 8, color: "var(--ds-text-3)" }}>
                (季累計 NT$ {Math.round(ns.quarter_revenue / 10000).toLocaleString()} 萬 / {Math.round(ns.quarter_target / 10000).toLocaleString()} 萬 = {qProgressPct}%)
              </span>
              {forecastPct !== null && <> · 我預測季終 <strong>{forecastPct}%</strong>(NT$ {Math.round((ns.forecast ?? 0) / 10000).toLocaleString()} 萬)</>}
            </div>
          </div>
          <div className="ns-side">
            <Sparkline data={ns.spark_14d} />
            <div className="ns-side-meta">過去 14 天每日營收</div>
            {ns.prediction_accuracy !== null && (
              <div className="ns-side-acc">
                我過去預測準度 <strong>{Math.round((ns.prediction_accuracy ?? 0) * 100)}%</strong>
              </div>
            )}
          </div>
        </div>
      </section>

      <hr className="memo-rule" />

      {/* Claude memo 主文 */}
      <section className="memo-body">
        {!isToday && (
          <div className="memo-alert">
            <strong>今日 memo 還沒產生。</strong>
            {n && <span style={{ marginLeft: 8 }}>下面是 {n.date} 的內容。</span>}
            <button onClick={generateNow} disabled={generating} className="ds-btn ds-btn--primary ds-btn--sm" style={{ marginLeft: 12 }}>
              {generating ? "Claude 寫稿中…(約 8-15 秒)" : "現在產生今日 memo"}
            </button>
          </div>
        )}

        {n?.headline && (
          <h2 className="memo-headline">{n.headline}</h2>
        )}

        {n?.narrative ? (
          <div className="memo-narrative">
            <MarkdownLite text={n.narrative} />
          </div>
        ) : (
          <div className="memo-empty">
            尚未有任何日報。點上面按鈕請 Claude 產生第一份。
          </div>
        )}

        {/* highlights / warnings 視覺化 */}
        {n && (n.highlights?.length > 0 || n.warnings?.length > 0) && (
          <div className="memo-callouts">
            {n.highlights?.map((h, i) => (
              <div key={"h" + i} className="memo-callout memo-callout--good">
                <span className="memo-callout-icon"><TrendingUp size={18} color="var(--ds-success)" /></span>
                <div>
                  <div>{h.text}</div>
                  {h.cite && <div className="memo-cite">[依據:{h.cite}]</div>}
                </div>
              </div>
            ))}
            {n.warnings?.map((w, i) => (
              <div key={"w" + i} className={`memo-callout memo-callout--${w.severity === "critical" ? "danger" : "warn"}`}>
                <span className="memo-callout-icon">
                  {w.severity === "critical"
                    ? <Flame size={18} color="var(--ds-danger)" />
                    : <AlertTriangle size={18} color="var(--ds-warning)" />}
                </span>
                <div>
                  <div>{w.text}</div>
                  {w.cite && <div className="memo-cite">[依據:{w.cite}]</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <hr className="memo-rule" />

      {/* 等你拍板區 */}
      <section className="memo-section">
        <h3 className="memo-h3"><Gavel size={20} /> 我做不了的,等你拍板</h3>
        {data.pending_decisions.length === 0 && (
          <div className="memo-empty">沒有待你拍板的事。我繼續看著。</div>
        )}
        {data.pending_decisions.map(d => (
          <div key={d.id} className={`memo-decision memo-decision--${d.urgency}`} data-fading={fadingId === d.id ? "true" : "false"}>
            <div className="memo-decision-head">
              <span className={`memo-urgency memo-urgency--${d.urgency}`}>
                {d.urgency === "critical" ? <Flame size={13} /> : d.urgency === "high" ? <Clock size={13} /> : <Activity size={13} />}
                {d.urgency === "critical" ? "急" : d.urgency === "high" ? "重要" : "一般"}
              </span>
              <span className="memo-decision-cat">{d.category}</span>
              {d.due_date && <span className="memo-decision-due">期限 {d.due_date}</span>}
            </div>
            <div className="memo-decision-title">{d.title}</div>
            {d.context && (
              <div className="memo-decision-context">
                <span className="memo-cite-label">背景</span>
                {d.context}
              </div>
            )}
            {d.claude_recommendation && (
              <div className="memo-decision-rec">
                <span className="memo-cite-label">我的建議</span>
                {d.claude_recommendation}
              </div>
            )}
            <div className="memo-decision-actions">
              {canApprove ? (
                <>
                  <button
                    onClick={() => approveDecision(d.id, d.title)}
                    disabled={actingId === d.id}
                    className="ds-btn ds-btn--primary ds-btn--sm"
                  >
                    {actingId === d.id ? <Loader size={14} /> : <CheckCircle size={14} />}
                    核准 Claude 建議
                  </button>
                  <button
                    onClick={() => setRejectModalId(d.id)}
                    disabled={actingId === d.id}
                    className="ds-btn ds-btn--sm"
                  >
                    <XCircle size={14} />
                    駁回(寫原因)
                  </button>
                </>
              ) : (
                <span style={{ fontSize: 12, color: "var(--ds-text-3)", fontStyle: "italic" }}>
                  {isBoardAudience ? "🏛️ 投資人視角(只讀)— 拍板權在 Vincent" : "拍板權限不足"}
                </span>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Reject modal */}
      {rejectModalId && (
        <div className="memo-modal-backdrop" onClick={() => setRejectModalId(null)}>
          <div className="memo-modal" onClick={e => e.stopPropagation()}>
            <h4 style={{ marginBottom: 10, fontFamily: "'Source Serif Pro', serif", fontSize: 18 }}>駁回 Claude 建議</h4>
            <p style={{ fontSize: 13, color: "var(--ds-text-3)", marginBottom: 10, lineHeight: 1.6 }}>
              寫下駁回原因 — 越具體 Claude 改 v2 越精準。
            </p>
            <textarea
              className="ds-textarea"
              rows={4}
              placeholder="例如:這個方向我們上季試過了,重點不是擴編而是改流程,法務員真正卡的是案件分類沒系統化..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              autoFocus
            />
            {/* Toggle: 要不要 Claude v2 */}
            <label className="memo-toggle">
              <input
                type="checkbox"
                checked={wantV2}
                onChange={e => setWantV2(e.target.checked)}
              />
              <span className="memo-toggle-text">
                <strong>讓 Claude 看完原因再給一版 v2 提案</strong>
                <span className="memo-toggle-hint">
                  {wantV2
                    ? "我會看你的原因 + 原 decision,改一版針對性的 v2(約 12 秒)"
                    : "這個議題 dead — 我寫進教訓,以後類似 pattern 不再提"}
                </span>
              </span>
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <button onClick={() => { setRejectModalId(null); setRejectReason(""); }} className="ds-btn ds-btn--sm">取消</button>
              <button
                onClick={rejectDecisionConfirm}
                disabled={!rejectReason.trim() || actingId === rejectModalId}
                className="ds-btn ds-btn--primary ds-btn--sm"
              >
                {actingId === rejectModalId ? <Loader size={14} /> : (wantV2 ? <Sparkles size={14} /> : <XCircle size={14} />)}
                {wantV2 ? "駁回並請 Claude 改 v2" : "駁回(此議題 dead)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`memo-toast memo-toast--${toast.type}`} role="status">
          {toast.type === "success" && <CheckCircle size={16} />}
          {toast.type === "warn" && <AlertTriangle size={16} />}
          {toast.type === "info" && <Sparkles size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      <hr className="memo-rule" />

      {/* Claude 預測準度(Wave 8 #2)*/}
      {data.prediction_history && data.prediction_history.length > 0 && (
        <section className="memo-section">
          <h3 className="memo-h3"><TrendingUp size={20} /> 我的預測 vs 實際</h3>
          <p className="memo-help">
            投資人最愛問「Claude 多準?」— 這裡是我過去 {data.prediction_history.length} 個 prediction 的真實對帳。
          </p>
          <div className="prediction-table">
            <div className="prediction-table__head">
              <span>週/月</span>
              <span>指標</span>
              <span>我預測</span>
              <span>實際</span>
              <span>準度</span>
            </div>
            {data.prediction_history.slice(0, 8).map((p, i) => {
              const acc = Number(p.accuracy_pct || 0);
              const accClass = acc >= 90 ? "good" : acc >= 70 ? "ok" : "warn";
              const metricLabel: Record<string, string> = {
                calls: "通話",
                closures: "成交",
                revenue: "營收",
                conversion_rate: "轉換率",
              };
              return (
                <div key={i} className="prediction-table__row">
                  <span className="prediction-period">{p.target_period}</span>
                  <span>{metricLabel[p.metric] || p.metric}</span>
                  <span>{p.metric === "conversion_rate" ? `${(p.predicted_value * 100).toFixed(1)}%` : Math.round(p.predicted_value).toLocaleString()}</span>
                  <span>{p.metric === "conversion_rate" ? `${(p.actual_value * 100).toFixed(1)}%` : Math.round(p.actual_value).toLocaleString()}</span>
                  <span className={`prediction-acc prediction-acc--${accClass}`}>{acc.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
          {(() => {
            const avg = data.prediction_history.reduce((s, p) => s + Number(p.accuracy_pct || 0), 0) / data.prediction_history.length;
            return (
              <div className="prediction-summary">
                平均準度 <strong>{avg.toFixed(1)}%</strong>
                {avg >= 85 ? " — 我這個高管擔得起" : avg >= 70 ? " — 還在學,但比 baseline 強" : " — 我承認最近抓不準,我會調 prompt"}
              </div>
            );
          })()}
        </section>
      )}

      <hr className="memo-rule" />

      {/* 質詢入口 */}
      <section className="memo-section">
        <h3 className="memo-h3"><MessageQuote size={20} /> 質詢我</h3>
        <p className="memo-help">投資人 / 董事 / Vincent 都可以打字問。我會用 RAG + Metabase 真資料回答,並引用來源。</p>
        <div className="memo-ask">
          <textarea
            className="ds-textarea"
            rows={3}
            placeholder="例如:Q1 為什麼沒達成 30M?或 OOschool 這週為什麼下滑?"
            value={askInput}
            onChange={e => setAskInput(e.target.value)}
          />
          <button onClick={submitAsk} disabled={asking || !askInput.trim()} className="ds-btn ds-btn--primary" style={{ marginTop: 8 }}>
            {asking ? "Claude 思考中…" : "送出問題"}
          </button>
          {askResult && (
            <div className="memo-ask-answer">
              <div className="memo-cite-label">Claude 回覆</div>
              <MarkdownLite text={askResult} />
            </div>
          )}
        </div>
        {data.recent_inquiries.length > 0 && (
          <details className="memo-details">
            <summary>過去質詢紀錄({data.recent_inquiries.length})</summary>
            {data.recent_inquiries.map(q => (
              <div key={q.id} className="memo-inquiry">
                <div className="memo-inquiry-q">
                  <span className="memo-cite-label">{q.asker_role || "投資人"} 問</span>
                  {q.question}
                </div>
                {q.claude_answer && (
                  <div className="memo-inquiry-a">
                    <span className="memo-cite-label">我答</span>
                    {q.claude_answer.slice(0, 280)}{q.claude_answer.length > 280 ? "…" : ""}
                  </div>
                )}
              </div>
            ))}
          </details>
        )}
      </section>

      <hr className="memo-rule" />

      {/* 自動化運作摘要 */}
      <section className="memo-section memo-ops">
        <h3 className="memo-h3"><Activity size={20} /> 過去 24h 我自己處理了</h3>
        <div className="memo-ops-grid">
          <div className="memo-ops-stat">
            <div className="memo-ops-stat-num">{n?.worker_runs_24h ?? 0}</div>
            <div className="memo-ops-stat-label">自動化執行次數</div>
          </div>
          <div className="memo-ops-stat">
            <div className="memo-ops-stat-num">{data.pending_decisions.length}</div>
            <div className="memo-ops-stat-label">需 Vincent 拍板</div>
          </div>
          <div className="memo-ops-stat">
            <div className={`memo-ops-stat-num memo-sync-${n?.metabase_sync_status || "unknown"}`}>
              {n?.metabase_sync_status === "healthy" ? "✓" : n?.metabase_sync_status === "warning" ? "△" : n?.metabase_sync_status === "critical" ? "✕" : "?"}
            </div>
            <div className="memo-ops-stat-label">資料同步狀態</div>
          </div>
        </div>
        {data.recent_worker_runs.length > 0 && (
          <details className="memo-details">
            <summary>看詳細 worker log</summary>
            <table className="ds-table" style={{ marginTop: 12 }}>
              <thead>
                <tr><th>來源</th><th>狀態</th><th className="ds-table__num">時間</th></tr>
              </thead>
              <tbody>
                {data.recent_worker_runs.slice(0, 8).map((r, i) => (
                  <tr key={i}>
                    <td>{r.source}</td>
                    <td><span className={`ds-badge ${r.status === "success" ? "ds-badge--success" : "ds-badge--danger"}`}>{r.status}</span></td>
                    <td className="ds-table__num">{r.created_at?.slice(5, 16) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>

      <hr className="memo-rule" />

      {/* Drill 進詳細數字 */}
      <section className="memo-section">
        <button onClick={() => setShowDrill(!showDrill)} className="ds-btn ds-btn--ghost" style={{ width: "100%" }}>
          {showDrill ? "收起" : "展開"} 戰況詳細數字 · 5 品牌橫向 · Top 5 業務 · 法務 / 訓練細節 →
        </button>
        {showDrill && (
          <div style={{ marginTop: 16 }}>
            <div className="memo-drill-row">
              <Link href="/admin/board" className="ds-card">
                <div className="memo-drill-icon">📊</div>
                <div className="memo-drill-title">集團週/月/季成績單</div>
                <div className="memo-drill-hint">完整 KPI + 各品牌 + Top 5</div>
              </Link>
              <Link href="/admin/sales/dashboard" className="ds-card">
                <div className="memo-drill-icon">🎯</div>
                <div className="memo-drill-title">業務戰況</div>
                <div className="memo-drill-hint">即時 5 品牌橫向 + 漏斗</div>
              </Link>
              <Link href="/admin/legal/cases" className="ds-card">
                <div className="memo-drill-icon">⚖️</div>
                <div className="memo-drill-title">法務案件</div>
                <div className="memo-drill-hint">案件 / aging / 承辦人</div>
              </Link>
              <Link href="/admin/training-ops/students" className="ds-card">
                <div className="memo-drill-icon">📚</div>
                <div className="memo-drill-title">訓練營運</div>
                <div className="memo-drill-hint">學員 / 卡關 / 教材</div>
              </Link>
            </div>
          </div>
        )}
      </section>

      <style jsx>{`
        .memo-shell {
          max-width: 760px;
          margin: 0 auto;
          padding: var(--ds-sp-6) var(--ds-sp-4);
          font-family: 'Source Serif Pro', 'Noto Serif TC', Georgia, serif;
          color: var(--ds-text);
          line-height: 1.75;
        }
        .memo-header {
          display: grid;
          gap: 4px;
          margin-bottom: var(--ds-sp-4);
        }
        .memo-byline {
          display: flex;
          gap: 12px;
          align-items: baseline;
          font-size: 13px;
        }
        .memo-from {
          font-family: var(--ds-font-mono);
          font-size: 11px;
          color: var(--ds-text-3);
          letter-spacing: 0.1em;
          width: 36px;
        }
        .memo-author {
          font-weight: 600;
          color: var(--ds-text);
        }
        .memo-date {
          font-family: var(--ds-font-mono);
          font-size: 12px;
          color: var(--ds-text-3);
          letter-spacing: 0.05em;
          margin-top: 4px;
        }
        .memo-rule {
          border: none;
          border-top: 1px solid var(--ds-border);
          margin: var(--ds-sp-5) 0;
        }
        .memo-northstar { margin: var(--ds-sp-4) 0; }
        .ns-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: var(--ds-sp-6);
          align-items: center;
        }
        @media (max-width: 720px) { .ns-grid { grid-template-columns: 1fr; } }
        .ns-label {
          font-family: var(--ds-font-sans);
          font-size: 11px;
          color: var(--ds-text-3);
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .ns-value {
          font-family: var(--ds-font-mono);
          font-size: 38px;
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1;
          display: flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 8px;
        }
        .ns-num { color: var(--ds-text); }
        .ns-sep { color: var(--ds-text-3); font-weight: 300; }
        .ns-target { color: var(--ds-text-3); font-size: 22px; }
        .ns-bar {
          height: 6px;
          background: var(--ds-surface-2);
          border-radius: 3px;
          margin: 14px 0 8px;
          overflow: hidden;
        }
        .ns-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--ds-primary), var(--ds-accent));
          transition: width 600ms ease;
        }
        .ns-meta {
          font-family: var(--ds-font-sans);
          font-size: 13px;
          color: var(--ds-text-2);
        }
        .ns-side-meta, .ns-side-acc {
          font-family: var(--ds-font-sans);
          font-size: 12px;
          color: var(--ds-text-3);
          margin-top: 6px;
        }

        .memo-headline {
          font-family: 'Source Serif Pro', 'Noto Serif TC', Georgia, serif;
          font-size: 24px;
          line-height: 1.4;
          margin: var(--ds-sp-4) 0 var(--ds-sp-3);
          color: var(--ds-text);
          letter-spacing: -0.01em;
        }
        .memo-narrative {
          font-size: 16px;
          line-height: 1.85;
          color: var(--ds-text);
        }
        .memo-narrative :global(h2) {
          font-size: 18px;
          margin-top: 24px;
          margin-bottom: 8px;
          font-weight: 700;
          color: var(--ds-text);
        }
        .memo-narrative :global(p) { margin: 8px 0 16px; }
        .memo-narrative :global(strong) { color: var(--ds-text); font-weight: 700; }
        .memo-narrative :global(.cite) {
          color: var(--ds-text-3);
          font-style: italic;
          font-size: 13px;
          font-family: var(--ds-font-sans);
        }

        .memo-callouts {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin: 24px 0;
        }
        .memo-callout {
          display: flex;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 6px;
          font-size: 14px;
          font-family: var(--ds-font-sans);
          line-height: 1.6;
          border-left: 3px solid;
        }
        .memo-callout--good {
          background: var(--ds-success-soft);
          border-left-color: var(--ds-success);
        }
        .memo-callout--warn {
          background: var(--ds-warning-soft);
          border-left-color: var(--ds-warning);
        }
        .memo-callout--danger {
          background: var(--ds-danger-soft);
          border-left-color: var(--ds-danger);
        }
        .memo-callout-icon { font-size: 18px; line-height: 1; }
        .memo-cite {
          font-size: 12px;
          color: var(--ds-text-3);
          font-style: italic;
          margin-top: 4px;
        }
        .memo-cite-label {
          display: inline-block;
          font-family: var(--ds-font-mono);
          font-size: 10px;
          letter-spacing: 0.1em;
          color: var(--ds-text-3);
          text-transform: uppercase;
          margin-right: 8px;
          vertical-align: middle;
        }
        .memo-h3 {
          font-family: 'Source Serif Pro', 'Noto Serif TC', Georgia, serif;
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 14px;
          letter-spacing: -0.01em;
        }
        .memo-help {
          font-family: var(--ds-font-sans);
          font-size: 13px;
          color: var(--ds-text-3);
          margin-bottom: 12px;
        }
        .memo-empty {
          font-family: var(--ds-font-sans);
          font-size: 14px;
          color: var(--ds-text-3);
          padding: 18px;
          text-align: center;
          background: var(--ds-surface-2);
          border-radius: 8px;
        }
        .memo-alert {
          background: var(--ds-warning-soft);
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 18px;
          font-family: var(--ds-font-sans);
          font-size: 14px;
        }
        .memo-decision {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border);
          border-left: 3px solid var(--ds-text-3);
          border-radius: 8px;
          padding: 16px 18px;
          margin-bottom: 12px;
          font-family: var(--ds-font-sans);
        }
        .memo-decision--critical { border-left-color: var(--ds-danger); }
        .memo-decision--high { border-left-color: var(--ds-warning); }
        .memo-decision-head {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 6px;
        }
        .memo-decision-cat {
          font-size: 11px;
          font-family: var(--ds-font-mono);
          letter-spacing: 0.05em;
          color: var(--ds-text-3);
          text-transform: uppercase;
        }
        .memo-decision-due {
          font-size: 12px;
          color: var(--ds-warning);
          margin-left: auto;
        }
        .memo-decision-title {
          font-family: 'Source Serif Pro', 'Noto Serif TC', serif;
          font-size: 17px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .memo-decision-context, .memo-decision-rec {
          font-size: 13px;
          line-height: 1.7;
          color: var(--ds-text-2);
          margin-bottom: 8px;
        }
        .memo-decision-rec { color: var(--ds-text); }
        .memo-decision-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          flex-wrap: wrap;
        }
        .memo-decision-actions :global(.ds-btn) {
          gap: 6px;
        }
        .memo-urgency {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          border-radius: 999px;
          border: 1px solid;
        }
        .memo-urgency--critical {
          background: var(--ds-danger-soft);
          color: var(--ds-danger);
          border-color: var(--ds-danger);
        }
        .memo-urgency--high {
          background: var(--ds-warning-soft);
          color: var(--ds-warning);
          border-color: var(--ds-warning);
        }
        .memo-urgency--normal {
          background: var(--ds-surface-2);
          color: var(--ds-text-2);
          border-color: var(--ds-border);
        }
        .memo-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(26, 24, 21, 0.5);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          font-family: var(--ds-font-sans);
        }
        .memo-modal {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border);
          border-radius: 12px;
          padding: 24px;
          max-width: 540px;
          width: 100%;
          box-shadow: var(--ds-shadow-lg);
        }
        .memo-toggle {
          display: flex;
          gap: 10px;
          margin-top: 14px;
          padding: 12px;
          background: var(--ds-accent-soft);
          border: 1px solid var(--ds-accent);
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          line-height: 1.5;
        }
        .memo-toggle input[type="checkbox"] {
          margin-top: 3px;
          accent-color: var(--ds-primary);
          flex-shrink: 0;
        }
        .memo-toggle-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .memo-toggle-hint {
          font-size: 12px;
          color: var(--ds-text-2);
        }
        /* Decision card fade-out */
        .memo-decision {
          transition: opacity 0.6s ease, transform 0.6s ease, max-height 0.6s ease;
          overflow: hidden;
        }
        .memo-decision[data-fading="true"] {
          opacity: 0.3;
          transform: translateX(-20px);
          pointer-events: none;
        }
        /* Toast */
        .memo-toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 20px;
          background: var(--ds-text);
          color: var(--ds-text-on);
          border-radius: 999px;
          font-size: 14px;
          font-family: var(--ds-font-sans);
          box-shadow: var(--ds-shadow-lg);
          z-index: 200;
          animation: ds-toast-in 240ms cubic-bezier(0.34, 1.56, 0.64, 1);
          max-width: 720px;
          line-height: 1.5;
        }
        .memo-toast--success { background: var(--ds-success); }
        .memo-toast--warn { background: var(--ds-warning); }
        .memo-toast--info { background: var(--ds-info); }
        @keyframes ds-toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .memo-h3 :global(svg) {
          vertical-align: middle;
          margin-right: 6px;
          color: var(--ds-text-2);
        }
        .memo-ask {
          background: var(--ds-surface-2);
          padding: 14px;
          border-radius: 10px;
        }
        .memo-ask-answer {
          margin-top: 14px;
          padding: 14px;
          background: var(--ds-surface);
          border-left: 3px solid var(--ds-primary);
          border-radius: 6px;
          font-family: var(--ds-font-sans);
          font-size: 14px;
          line-height: 1.7;
        }
        .memo-details {
          margin-top: 14px;
          font-family: var(--ds-font-sans);
          font-size: 13px;
        }
        .memo-details summary { cursor: pointer; color: var(--ds-text-2); padding: 6px 0; }
        .memo-inquiry {
          padding: 10px 0;
          border-bottom: 1px solid var(--ds-divider);
        }
        .memo-inquiry-q { color: var(--ds-text); margin-bottom: 4px; }
        .memo-inquiry-a { color: var(--ds-text-2); padding-left: 16px; font-size: 13px; }

        .memo-ops-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin: 14px 0;
        }
        @media (max-width: 600px) { .memo-ops-grid { grid-template-columns: 1fr; } }
        .memo-ops-stat {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border);
          padding: 14px 16px;
          border-radius: 8px;
          font-family: var(--ds-font-sans);
        }
        .memo-ops-stat-num {
          font-family: var(--ds-font-mono);
          font-size: 28px;
          font-weight: 700;
          line-height: 1;
        }
        .memo-sync-healthy { color: var(--ds-success); }
        .memo-sync-warning { color: var(--ds-warning); }
        .memo-sync-critical { color: var(--ds-danger); }
        .memo-ops-stat-label {
          font-size: 12px;
          color: var(--ds-text-3);
          margin-top: 6px;
        }

        .memo-drill-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }
        .memo-drill-row :global(a) { text-decoration: none; transition: transform 120ms; }
        .memo-drill-row :global(a:hover) { transform: translateY(-2px); }
        .memo-drill-icon { font-size: 24px; margin-bottom: 8px; }
        .memo-drill-title { font-weight: 700; font-family: 'Source Serif Pro', serif; font-size: 16px; }
        .memo-drill-hint { font-size: 12px; color: var(--ds-text-3); font-family: var(--ds-font-sans); margin-top: 4px; }

        /* Wave 8 #2 — prediction table */
        .prediction-table {
          font-family: var(--ds-font-sans);
          background: var(--ds-surface);
          border: 1px solid var(--ds-border);
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 12px;
        }
        .prediction-table__head, .prediction-table__row {
          display: grid;
          grid-template-columns: 1.4fr 0.8fr 1fr 1fr 0.7fr;
          padding: 10px 14px;
          align-items: center;
          font-size: 13px;
          gap: 8px;
        }
        .prediction-table__head {
          background: var(--ds-surface-2);
          font-size: 11px;
          color: var(--ds-text-3);
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border-bottom: 1px solid var(--ds-border);
        }
        .prediction-table__row {
          border-bottom: 1px solid var(--ds-border-soft, rgba(120, 80, 30, 0.06));
        }
        .prediction-table__row:last-child { border-bottom: none; }
        .prediction-period {
          font-family: var(--ds-font-mono);
          font-size: 12px;
          color: var(--ds-text-2);
        }
        .prediction-acc {
          font-weight: 700;
          font-family: var(--ds-font-mono);
          text-align: right;
        }
        .prediction-acc--good { color: var(--ds-success, #10b981); }
        .prediction-acc--ok { color: var(--ds-warning, #f59e0b); }
        .prediction-acc--warn { color: var(--ds-danger, #b43c28); }
        .prediction-summary {
          font-family: var(--ds-font-sans);
          font-size: 13px;
          color: var(--ds-text-2);
          padding: 10px 14px;
          background: var(--ds-surface-2);
          border-radius: 6px;
        }
      `}</style>
    </article>
  );
}

/**
 * 14 天 sparkline (SVG inline,沒第三方 lib)
 */
function Sparkline({ data }: { data: Array<{ date: string; revenue: number }> }) {
  if (data.length < 2) return null;
  const W = 240, H = 56, P = 4;
  const max = Math.max(...data.map(d => d.revenue), 1);
  const points = data.map((d, i) => {
    const x = P + (i / (data.length - 1)) * (W - P * 2);
    const y = H - P - (d.revenue / max) * (H - P * 2);
    return `${x},${y}`;
  }).join(" ");
  const lastY = H - P - (data[data.length - 1].revenue / max) * (H - P * 2);
  const lastX = W - P;
  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      <polyline points={points} fill="none" stroke="var(--ds-primary)" strokeWidth="1.5" />
      <circle cx={lastX} cy={lastY} r="3" fill="var(--ds-primary)" />
    </svg>
  );
}

/**
 * Minimal markdown render(safe,只支援 ## h2, **bold**, [cite] 引用,segments）
 * 不引第三方 lib
 */
function MarkdownLite({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let para: string[] = [];
  const flush = (key: string | number) => {
    if (para.length === 0) return;
    out.push(<p key={"p" + key}>{renderInline(para.join(" "))}</p>);
    para = [];
  };
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      flush(idx);
      out.push(<h2 key={"h" + idx}>{trimmed.slice(3)}</h2>);
    } else if (trimmed === "") {
      flush(idx);
    } else {
      para.push(trimmed);
    }
  });
  flush("end");
  return <>{out}</>;
}

function renderInline(text: string): React.ReactNode {
  // bold (**text**) + cite [依據:...]
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*)|(\[依據:[^\]]+\])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={"b" + key++}>{m[1].slice(2, -2)}</strong>);
    else if (m[2]) parts.push(<span key={"c" + key++} className="cite">{m[2]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
