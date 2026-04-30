"use client";

import { useState } from "react";
import { motion } from "framer-motion";

/**
 * 2026-04-30 末段:Metabase 三方對比 admin tab UI
 *
 * 功能:
 *   - 選日期範圍(預設 4/1-4/13)
 *   - 點「啟動自動化拉」→ 即時 query Metabase + 撈 DB 同期間
 *   - 顯示:DB 統計 / Live 統計 / 差異最大員工 / 同人多 row 警報
 */

interface AuditData {
  ok: boolean;
  range: { from: string; to: string };
  summary: {
    db: {
      total_rows: number; rollup_rows: number; daily_rows: number;
      unique_emails: number;
      total_calls: number; total_closures: number; total_revenue: number;
    };
    live: {
      brands_queried: number;
      per_brand_rows: Record<string, number>;
      unique_emails: number;
      total_calls: number; total_closures: number; total_revenue: number;
      errors: { brand: string; question_id: number; error: string }[];
    };
    diff_count: number;
    big_diff_count: number;
    duplicate_emails_with_multi_rows_per_day: number;
  };
  duplicate_email_dates: Record<string, { date: string; rows: number }[]>;
  big_diff: Array<{
    email: string; name: string; brand: string;
    db_calls: number; db_closures: number; db_revenue: number;
    live_calls: number; live_closures: number; live_revenue: number;
    diff_calls: number; diff_closures: number; diff_revenue: number;
    only_in_db: boolean; only_in_live: boolean;
  }>;
  full_diff: any[];
}

export default function MetabaseAuditPanel() {
  const [from, setFrom] = useState("2026-04-01");
  const [to, setTo] = useState("2026-04-13");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AuditData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const r = await fetch(`/api/admin/metabase-audit?from=${from}&to=${to}`);
      const d = await r.json();
      if (d.ok) setData(d);
      else setError(d.error || "unknown");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 1280, margin: "0 auto" }}>
      <div className="moyu-section-label" style={{ marginBottom: 12 }}>METABASE · 三方對比稽核</div>
      <h1 style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 600, color: "var(--ink-deep)", letterSpacing: 4, marginBottom: 8 }}>
        資料對標
      </h1>
      <div style={{ fontSize: 13, color: "var(--ink-mid)", marginBottom: 24, lineHeight: 1.7 }}>
        即時跑 Metabase question 拿真實值 → 對比 DB sales_metrics_daily 同期間 → 找差異(同 email 多 row 顯示出來)。
      </div>

      {/* form */}
      <div className="moyu-glass-card" style={{ padding: 20, marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>FROM</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>TO</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={run}
          disabled={loading}
          style={{
            padding: "12px 24px",
            background: loading ? "rgba(26,26,26,0.10)" : "var(--accent-red, #b91c1c)",
            color: loading ? "rgba(26,26,26,0.55)" : "var(--bg-paper)",
            border: "none",
            borderRadius: 4,
            fontSize: 14,
            fontFamily: "var(--font-noto-serif-tc)",
            letterSpacing: 2,
            cursor: loading ? "wait" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "拉資料中… 30-60 秒" : "🚀 啟動自動化拉"}
        </motion.button>
      </div>

      {error && (
        <div className="moyu-glass-card-accent" style={{ padding: 16, marginBottom: 16, fontSize: 13, color: "var(--accent-red)" }}>
          ❌ {error}
        </div>
      )}

      {data && (
        <>
          {/* 兩端統計 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div className="moyu-glass-card" style={{ padding: 20 }}>
              <div className="moyu-section-label">📦 DB 現有資料</div>
              <Row label="總 row 數" v={data.summary.db.total_rows} />
              <Row label="rollup row" v={data.summary.db.rollup_rows} red={data.summary.db.rollup_rows > 0} />
              <Row label="daily row" v={data.summary.db.daily_rows} />
              <Row label="員工數" v={data.summary.db.unique_emails} />
              <hr className="moyu-gold-divider" style={{ margin: "10px 0" }} />
              <Row label="總撥打" v={data.summary.db.total_calls} />
              <Row label="總成交(raw)" v={data.summary.db.total_closures} />
              <Row label="總營收" v={`NT$ ${data.summary.db.total_revenue.toLocaleString()}`} />
            </div>

            <div className="moyu-glass-card" style={{ padding: 20 }}>
              <div className="moyu-section-label">🌐 Metabase Live(自動化即時拉)</div>
              <Row label="brand 跑了" v={data.summary.live.brands_queried} />
              <Row label="員工數" v={data.summary.live.unique_emails} />
              <hr className="moyu-gold-divider" style={{ margin: "10px 0" }} />
              <Row label="總撥打" v={data.summary.live.total_calls} />
              <Row label="總成交(raw)" v={data.summary.live.total_closures} />
              <Row label="總營收" v={`NT$ ${data.summary.live.total_revenue.toLocaleString()}`} />
              {data.summary.live.errors.length > 0 && (
                <div style={{ marginTop: 12, fontSize: 11, color: "var(--accent-red)" }}>
                  ⚠️ {data.summary.live.errors.length} brand 失敗:
                  {data.summary.live.errors.map((e, i) => (
                    <div key={i} style={{ marginTop: 4, fontFamily: "var(--font-jetbrains-mono)" }}>
                      {e.brand}: {e.error.slice(0, 80)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 差異 banner */}
          <div className="moyu-glass-card" style={{ padding: 16, marginBottom: 16, fontSize: 14, lineHeight: 1.7 }}>
            <strong>📊 結論:</strong>
            {" "}撥打差 <span className="moyu-mono" style={{ color: "var(--accent-red)" }}>
              {(data.summary.db.total_calls - data.summary.live.total_calls).toLocaleString()}
            </span>{" "}通 ·
            營收差 <span className="moyu-mono" style={{ color: "var(--accent-red)" }}>
              NT$ {(data.summary.db.total_revenue - data.summary.live.total_revenue).toLocaleString()}
            </span>
            {data.summary.duplicate_emails_with_multi_rows_per_day > 0 && (
              <span style={{ color: "var(--accent-red)", fontWeight: 600, marginLeft: 12 }}>
                · {data.summary.duplicate_emails_with_multi_rows_per_day} 個 email 同日有多 row
              </span>
            )}
          </div>

          {/* 同 email 同日多 row 警報 */}
          {Object.keys(data.duplicate_email_dates).length > 0 && (
            <div className="moyu-glass-card-accent" style={{ padding: 20, marginBottom: 16 }}>
              <div className="moyu-section-label" style={{ color: "var(--accent-red)", marginBottom: 12 }}>
                🚨 同 email 同日多 row(翻倍 root cause)
              </div>
              <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
                {Object.entries(data.duplicate_email_dates).slice(0, 20).map(([email, dates]) => (
                  <div key={email} style={{ padding: "6px 12px", background: "rgba(184,71,74,0.06)", borderRadius: 4 }}>
                    <span className="moyu-mono">{email}</span>
                    <span style={{ marginLeft: 8, color: "var(--ink-mid)" }}>
                      {dates.map((d) => `${d.date}(${d.rows} row)`).join(" · ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 大差異 table */}
          <div className="moyu-glass-card" style={{ padding: 20 }}>
            <div className="moyu-section-label" style={{ marginBottom: 12 }}>
              💢 差異最大 Top {data.big_diff.length}(營收差 &gt; NT$ 10k 或 通數差 &gt; 50)
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--ink-mid)", borderBottom: "1px solid rgba(26,26,26,0.10)" }}>
                    <th style={th}>name</th>
                    <th style={th}>brand</th>
                    <th style={thR}>DB 通</th>
                    <th style={thR}>Live 通</th>
                    <th style={thR}>差</th>
                    <th style={thR}>DB 成</th>
                    <th style={thR}>Live 成</th>
                    <th style={thR}>DB 營收</th>
                    <th style={thR}>Live 營收</th>
                    <th style={thR}>差</th>
                  </tr>
                </thead>
                <tbody>
                  {data.big_diff.map((d, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(26,26,26,0.05)" }}>
                      <td style={td}>{d.name} {d.only_in_db && <span style={{ color: "var(--accent-red)", marginLeft: 4 }}>⚠️ 只 DB 有</span>}</td>
                      <td style={td}>{d.brand}</td>
                      <td style={tdR} className="moyu-mono">{d.db_calls.toLocaleString()}</td>
                      <td style={tdR} className="moyu-mono">{d.live_calls.toLocaleString()}</td>
                      <td style={{ ...tdR, color: d.diff_calls > 0 ? "var(--accent-red)" : "#6B7A5A", fontWeight: 600 }} className="moyu-mono">
                        {d.diff_calls > 0 ? "+" : ""}{d.diff_calls.toLocaleString()}
                      </td>
                      <td style={tdR} className="moyu-mono">{d.db_closures}</td>
                      <td style={tdR} className="moyu-mono">{d.live_closures}</td>
                      <td style={tdR} className="moyu-mono">NT$ {d.db_revenue.toLocaleString()}</td>
                      <td style={tdR} className="moyu-mono">NT$ {d.live_revenue.toLocaleString()}</td>
                      <td style={{ ...tdR, color: d.diff_revenue > 0 ? "var(--accent-red)" : "#6B7A5A", fontWeight: 600 }} className="moyu-mono">
                        {d.diff_revenue > 0 ? "+" : ""}{d.diff_revenue.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* full diff JSON 下載 */}
          <div style={{ marginTop: 12, fontSize: 11, color: "var(--ink-mid)", textAlign: "right" }}>
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `metabase-audit-${from}-to-${to}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              style={{ background: "transparent", color: "var(--accent-red)", border: 0, cursor: "pointer", textDecoration: "underline" }}
            >
              📥 下載完整對比 JSON({data.full_diff.length} 員工)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, v, red }: { label: string; v: any; red?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
      <span style={{ color: "var(--ink-mid)" }}>{label}</span>
      <span className="moyu-mono" style={{ color: red ? "var(--accent-red)" : "var(--ink-deep)", fontWeight: 600 }}>
        {typeof v === "number" ? v.toLocaleString() : v}
      </span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "rgba(247,241,227,0.85)",
  border: "1px solid rgba(26,26,26,0.10)",
  borderRadius: 4,
  fontSize: 13,
  fontFamily: "var(--font-jetbrains-mono)",
  color: "var(--ink-deep)",
  outline: "none",
};

const th: React.CSSProperties = { padding: "8px 6px", fontSize: 10, fontWeight: 600, letterSpacing: 1, textAlign: "left" };
const thR: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "8px 6px", color: "var(--ink-deep)" };
const tdR: React.CSSProperties = { ...td, textAlign: "right" };
