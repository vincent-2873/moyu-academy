"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import BreathingNumber from "@/components/wabi/BreathingNumber";

/**
 * N6 (2026-04-30 第三輪):system_run_log 健康度 widget
 *
 * 顯示:
 *   - 過去 24h 各 source 的 ok / fail / noop 統計
 *   - last run 狀態 + duration
 *   - 失敗 source 紅色 highlight
 *   - 點 source 看歷史 run detail
 */

type SourceStat = {
  source: string;
  runs: number; ok: number; partial: number; fail: number; noop: number;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  avg_duration_ms: number;
  success_rate_pct: number;
};

type RunRow = {
  id: number;
  source: string;
  status: string;
  rows_in: number | null;
  rows_out: number | null;
  duration_ms: number | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const STATUS_COLOR: Record<string, string> = {
  ok: "#6B7A5A",
  partial: "#B89968",
  fail: "#B91C1C",
  noop: "#94a3b8",
};

export default function SystemRunLogPanel() {
  const [bySource, setBySource] = useState<SourceStat[]>([]);
  const [rows, setRows] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [hours, setHours] = useState(24);

  async function refresh() {
    setLoading(true);
    const from = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const r = await fetch(`/api/admin/system-run-log?from=${from}&limit=500`);
    const d = await r.json();
    setBySource(d.by_source || []);
    setRows(d.rows || []);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [hours]);

  const totalRuns = bySource.reduce((s, x) => s + x.runs, 0);
  const totalFail = bySource.reduce((s, x) => s + x.fail, 0);
  const totalOk = bySource.reduce((s, x) => s + x.ok, 0);
  const overallPct = totalRuns > 0 ? Math.round((totalOk / totalRuns) * 100) : 100;

  const filteredRows = activeSource ? rows.filter((r) => r.source === activeSource) : rows;

  return (
    <div style={{ padding: "32px", maxWidth: 1400, margin: "0 auto" }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, marginBottom: 12, fontWeight: 600 }}>
        ADMIN · SYSTEM RUN LOG
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: "clamp(36px, 5vw, 56px)", fontWeight: 600, color: "var(--ink-deep)", letterSpacing: 4, marginBottom: 24, lineHeight: 1.1 }}
      >
        系統運行紀錄
      </motion.h1>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <Stat label="範圍" value={`${hours}h`} />
        <Stat label="總執行" value={totalRuns} />
        <Stat label="成功率" value={`${overallPct}%`} warning={overallPct < 80} />
        <Stat label="失敗" value={totalFail} warning={totalFail > 0} />
      </div>

      {/* Time range selector */}
      <div className="flex gap-2 mb-4">
        {[1, 6, 24, 72, 168].map((h) => (
          <button
            key={h}
            onClick={() => setHours(h)}
            style={{
              padding: "4px 12px",
              borderRadius: 3,
              background: hours === h ? "var(--ink-deep)" : "transparent",
              color: hours === h ? "var(--bg-paper)" : "var(--ink-deep)",
              border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
              fontSize: 11,
              fontFamily: "var(--font-noto-serif-tc)",
              cursor: "pointer",
            }}
          >
            {h === 168 ? "7 天" : h === 72 ? "3 天" : `${h}h`}
          </button>
        ))}
        <button
          onClick={refresh}
          style={{ padding: "4px 12px", borderRadius: 3, background: "transparent", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", color: "var(--ink-mid)", fontSize: 11, cursor: "pointer", marginLeft: "auto" }}
        >
          🔄 重新整理
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Left: by_source list */}
        <div>
          <div style={labelStyle}>來 SOURCE · {bySource.length}</div>
          {loading ? (
            <div className="p-8 text-sm" style={{ color: "var(--ink-mid)" }}>載入中…</div>
          ) : bySource.length === 0 ? (
            <div className="p-8 text-sm" style={{ color: "var(--ink-mid)" }}>過去 {hours}h 無紀錄</div>
          ) : (
            <div className="space-y-1.5 mt-2">
              {bySource.map((s) => {
                const isActive = activeSource === s.source;
                const failed = s.fail > 0;
                return (
                  <motion.button
                    key={s.source}
                    whileHover={{ x: 2 }}
                    onClick={() => setActiveSource(isActive ? null : s.source)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 4,
                      background: isActive ? "var(--ink-deep)" : "var(--bg-paper)",
                      color: isActive ? "var(--bg-paper)" : "var(--ink-deep)",
                      border: `1px solid ${failed ? "var(--accent-red)" : "var(--border-soft, rgba(26,26,26,0.10))"}`,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, fontWeight: 600 }}>
                        {s.source}
                      </span>
                      <span style={{ fontSize: 10, color: isActive ? "rgba(255,255,255,0.7)" : STATUS_COLOR[s.last_status || "noop"], marginLeft: "auto", fontWeight: 600 }}>
                        {s.last_status}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 10, marginTop: 4, color: isActive ? "rgba(255,255,255,0.7)" : "var(--ink-mid)" }}>
                      <span>{s.runs} runs</span>
                      <span style={{ color: isActive ? "rgba(255,255,255,0.7)" : (s.success_rate_pct < 80 ? "var(--accent-red)" : "var(--gold-thread, #c9a96e)") }}>
                        {s.success_rate_pct}%
                      </span>
                      {s.fail > 0 && <span style={{ color: "var(--accent-red)" }}>{s.fail} fail</span>}
                      <span>{s.avg_duration_ms}ms avg</span>
                    </div>
                    {s.last_error && (
                      <div style={{ marginTop: 4, fontSize: 10, color: isActive ? "rgba(255,200,200,0.9)" : "var(--accent-red)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.last_error.slice(0, 100)}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: run detail */}
        <div>
          <div style={labelStyle}>
            詳 RUNS {activeSource && <span style={{ color: "var(--accent-red)", marginLeft: 8 }}>· {activeSource}</span>}
          </div>
          <div className="space-y-1.5 mt-2 max-h-[600px] overflow-y-auto">
            {filteredRows.slice(0, 100).map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  padding: "8px 12px",
                  background: "var(--bg-paper)",
                  border: `1px solid ${r.status === "fail" ? "var(--accent-red)" : "var(--border-soft, rgba(26,26,26,0.10))"}`,
                  borderRadius: 4,
                  fontSize: 11,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLOR[r.status] || "var(--ink-mid)" }} />
                  <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, fontWeight: 600 }}>{r.source}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-mid)" }}>
                    {new Date(r.created_at).toISOString().slice(11, 19)} · {r.duration_ms}ms
                  </span>
                </div>
                <div style={{ marginTop: 2, fontSize: 10, color: "var(--ink-mid)" }}>
                  {r.rows_in != null ? `in=${r.rows_in} ` : ""}{r.rows_out != null ? `out=${r.rows_out}` : ""}
                </div>
                {r.error_message && (
                  <div style={{ marginTop: 4, fontSize: 10, color: "var(--accent-red)", lineHeight: 1.4, fontFamily: "var(--font-jetbrains-mono)" }}>
                    {r.error_message.slice(0, 200)}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, warning }: { label: string; value: any; warning?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: 16,
        background: "var(--bg-paper)",
        border: `1px solid ${warning ? "var(--accent-red)" : "var(--border-soft, rgba(26,26,26,0.10))"}`,
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 10, color: warning ? "var(--accent-red)" : "var(--ink-mid)", letterSpacing: 2, fontWeight: 600 }}>{label}</div>
      <BreathingNumber size={28} color={warning ? "var(--accent-red)" : undefined}>{typeof value === "number" ? value.toLocaleString() : value}</BreathingNumber>
    </motion.div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--ink-mid)", letterSpacing: 3, fontWeight: 600 };
