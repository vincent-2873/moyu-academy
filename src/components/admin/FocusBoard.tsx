"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/**
 * 2026-04-30 末段 視覺精緻化版:Admin 主控台 FocusBoard
 *
 * 設計給高階主管(總經理 / 董事長 / 投資人):
 *   30 秒內回答 5 個問題:
 *     1. 我現在最該幹嘛?(top action)
 *     2. 月底會達標嗎?(projection)
 *     3. 本週 vs 上週?(WoW)
 *     4. 對標健康嗎?(benchmark vs baseline)
 *     5. 有什麼風險訊號?(risks)
 *
 * 視覺:毛玻璃 + 毛邊 + 金線分隔 + Mono 數字
 */

interface BenchmarkData {
  avg_calls_per_employee: number;
  avg_calls_baseline: number;
  call_to_appt_rate_pct: number;
  call_to_appt_baseline: number;
  appt_to_close_rate_pct: number;
  appt_to_close_baseline: number;
  attendance_pct: number;
  top_to_median_ratio: number;
  active_employee_count: number;
}

interface FocusData {
  ok: boolean;
  today: string;
  this_week: { calls: number; appts: number; closes: number; revenue: number };
  last_week: { calls: number; appts: number; closes: number; revenue: number };
  wow_pct: { calls: number; appts: number; closes: number; revenue: number };
  top_performer: { name: string; brand: string; revenue: number; calls: number; closes: number } | null;
  bottom_count: number;
  employee_count: number;
  benchmark: BenchmarkData;
  risks: { level: "high" | "medium" | "low"; signal: string }[];
  month_progress: {
    day_of_month: number; days_in_month: number;
    revenue: number; target: number; projected_eom: number;
    on_track_pct: number; vs_last_month_pct: number;
    health: "healthy" | "warning" | "critical";
  };
  pending_critical_commands: Array<{ id: string; title: string; severity: string; owner_email: string; created_at: string }>;
  top_action: string;
  top_action_link: string;
}

const HEALTH_COLOR: Record<string, string> = {
  healthy: "#6B7A5A",
  warning: "#B89968",
  critical: "#B8474A",
};

export default function FocusBoard() {
  const [data, setData] = useState<FocusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/focus-board")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 16, fontSize: 13, color: "var(--text3)" }}>載入 focus…</div>;
  if (!data || !data.ok) return null;

  const m = data.month_progress;
  const onTrackColor = HEALTH_COLOR[m.health];
  const isUrgent = m.health === "critical" || data.pending_critical_commands.length > 0;

  return (
    <div style={{ marginBottom: 24 }}>
      <style>{`
        @media (max-width: 768px) {
          .focus-grid-3col { grid-template-columns: 1fr !important; }
          .focus-wow-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .focus-bench-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      {/* top action — 大 banner */}
      <motion.a
        href={data.top_action_link}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`is-hover ${isUrgent ? "moyu-glass-card-accent" : "moyu-glass-card-gold"}`}
        style={{
          display: "block",
          padding: "20px 28px",
          textDecoration: "none",
          marginBottom: 16,
          cursor: "pointer",
        }}
      >
        <div className="moyu-section-label" style={{ marginBottom: 8 }}>
          <span className="moyu-ink-dot" style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: isUrgent ? "rgba(184,71,74,0.85)" : "rgba(201,169,110,0.85)", marginRight: 8 }} />
          ⚡ 最該做的事 → 點擊跳轉
        </div>
        <div style={{ fontFamily: "var(--font-noto-serif-tc, serif)", fontSize: "clamp(16px, 2.2vw, 20px)", color: "rgba(26,26,26,0.92)", fontWeight: 700, lineHeight: 1.5, letterSpacing: 1 }}>
          {data.top_action}
        </div>
      </motion.a>

      {/* 3 col main */}
      <div className="focus-grid-3col" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* 月底達標 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="moyu-glass-card is-hover"
          style={{ padding: 20, borderColor: `${onTrackColor}30` }}
        >
          <div className="moyu-section-label">📅 月底預估達標</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
            <span className="moyu-mono" style={{ fontSize: 40, fontWeight: 700, color: onTrackColor, lineHeight: 1 }}>{m.on_track_pct}</span>
            <span style={{ fontSize: 14, color: "rgba(26,26,26,0.55)", fontFamily: "var(--font-noto-serif-tc, serif)" }}>%</span>
            <span style={{ fontSize: 12, color: "rgba(26,26,26,0.55)", marginLeft: 8 }}>達標</span>
          </div>
          <div style={{ height: 6, background: "rgba(26,26,26,0.06)", borderRadius: 99, overflow: "hidden", marginTop: 14, position: "relative" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, m.on_track_pct)}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              style={{ height: "100%", background: onTrackColor, borderRadius: 99 }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11, color: "rgba(26,26,26,0.55)" }}>
            <span className="moyu-mono">已 NT$ {m.revenue.toLocaleString()}</span>
            <span className="moyu-mono">預估 NT$ {m.projected_eom.toLocaleString()}</span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(26,26,26,0.55)", marginTop: 6 }}>
            目標 <span className="moyu-mono">NT$ {m.target.toLocaleString()}</span> · D{m.day_of_month}/{m.days_in_month} ·
            <span style={{ color: m.vs_last_month_pct >= 0 ? "#6B7A5A" : "#B8474A", fontWeight: 600, marginLeft: 4 }} className="moyu-mono">
              vs 上月 {m.vs_last_month_pct >= 0 ? "+" : ""}{m.vs_last_month_pct}%
            </span>
          </div>
        </motion.div>

        {/* 本週 vs 上週 (WoW) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="moyu-glass-card is-hover"
          style={{ padding: 20 }}
        >
          <div className="moyu-section-label" style={{ marginBottom: 12 }}>📊 本週 vs 上週</div>
          <div className="focus-wow-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            <WowCell label="撥打" value={data.this_week.calls} delta={data.wow_pct.calls} />
            <WowCell label="邀約" value={data.this_week.appts} delta={data.wow_pct.appts} />
            <WowCell label="成交" value={data.this_week.closes} delta={data.wow_pct.closes} />
            <WowCell label="營收" value={data.this_week.revenue} delta={data.wow_pct.revenue} isCurrency />
          </div>
        </motion.div>

        {/* Top performer */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="moyu-glass-card-gold is-hover"
          style={{ padding: 20 }}
        >
          <div className="moyu-section-label" style={{ marginBottom: 8 }}>🏆 本週領跑</div>
          {data.top_performer ? (
            <>
              <div style={{ fontFamily: "var(--font-noto-serif-tc, serif)", fontSize: 22, fontWeight: 700, color: "rgba(26,26,26,0.92)", letterSpacing: 1 }}>
                {data.top_performer.name}
              </div>
              <div style={{ fontSize: 11, color: "rgba(26,26,26,0.55)", marginTop: 2, marginBottom: 14 }}>{data.top_performer.brand}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 11 }}>
                <div>
                  <div style={{ color: "rgba(26,26,26,0.55)" }}>通數</div>
                  <div className="moyu-mono" style={{ color: "rgba(26,26,26,0.92)", fontWeight: 700, fontSize: 16, marginTop: 2 }}>{data.top_performer.calls}</div>
                </div>
                <div>
                  <div style={{ color: "rgba(26,26,26,0.55)" }}>成交</div>
                  <div className="moyu-mono" style={{ color: "rgba(26,26,26,0.92)", fontWeight: 700, fontSize: 16, marginTop: 2 }}>{data.top_performer.closes}</div>
                </div>
                <div>
                  <div style={{ color: "rgba(26,26,26,0.55)" }}>營收</div>
                  <div className="moyu-mono" style={{ color: "#B89968", fontWeight: 800, fontSize: 16, marginTop: 2 }}>NT$ {(data.top_performer.revenue / 1000).toFixed(0)}k</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "rgba(26,26,26,0.55)", marginTop: 14, padding: "8px 10px", background: "rgba(26,26,26,0.04)", borderRadius: 4 }}>
                落後者:<span className="moyu-mono">{data.bottom_count} / {data.employee_count}</span> 人本週通數 &lt; 30
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: "rgba(26,26,26,0.55)" }}>無資料</div>
          )}
        </motion.div>
      </div>

      {/* 對標 benchmark — 投資人視角 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="moyu-glass-card"
        style={{ padding: 20, marginBottom: 14 }}
      >
        <div className="moyu-section-label" style={{ marginBottom: 14 }}>🎯 對標健康度(投資人視角)</div>
        <div className="focus-bench-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <BenchCell label="人均週撥打" value={data.benchmark.avg_calls_per_employee} baseline={data.benchmark.avg_calls_baseline} unit="通" higherBetter />
          <BenchCell label="撥打→邀約" value={data.benchmark.call_to_appt_rate_pct} baseline={data.benchmark.call_to_appt_baseline} unit="%" higherBetter />
          <BenchCell label="邀約→成交" value={data.benchmark.appt_to_close_rate_pct} baseline={data.benchmark.appt_to_close_baseline} unit="%" higherBetter />
          <BenchCell label="員工出席率" value={data.benchmark.attendance_pct} baseline={80} unit="%" higherBetter />
        </div>
        <div className="moyu-gold-divider" />
        <div style={{ fontSize: 11, color: "rgba(26,26,26,0.55)", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <span>📐 Top:Median 比例 = <strong className="moyu-mono" style={{ color: data.benchmark.top_to_median_ratio > 5 ? "#B8474A" : data.benchmark.top_to_median_ratio > 3 ? "#B89968" : "#6B7A5A" }}>
            {data.benchmark.top_to_median_ratio}×
          </strong>{" "}
          {data.benchmark.top_to_median_ratio > 5 ? "(過度依賴單 Top)" : data.benchmark.top_to_median_ratio > 3 ? "(略不平均)" : "(健康)"}
          </span>
          <span>👥 活躍 / 總員工 = <strong className="moyu-mono">{data.benchmark.active_employee_count} / {data.employee_count}</strong></span>
        </div>
      </motion.div>

      {/* Risks 紅黃旗 — 投資人視角 */}
      {data.risks && data.risks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="moyu-glass-card-accent"
          style={{ padding: 20 }}
        >
          <div className="moyu-section-label" style={{ color: "rgba(184,71,74,0.85)", marginBottom: 12 }}>🚨 風險訊號 · {data.risks.length}</div>
          <div style={{ display: "grid", gap: 6 }}>
            {data.risks.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr",
                  gap: 12,
                  padding: "10px 14px",
                  background: r.level === "high" ? "rgba(184,71,74,0.06)" : "rgba(184,153,104,0.06)",
                  borderLeft: `3px solid ${r.level === "high" ? "#B8474A" : "#B89968"}`,
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: r.level === "high" ? "#B8474A" : "#B89968", letterSpacing: 1 }}>
                  {r.level === "high" ? "🔴 HIGH" : "🟠 MED"}
                </span>
                <span style={{ color: "rgba(26,26,26,0.85)", lineHeight: 1.6 }}>{r.signal}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function WowCell({ label, value, delta, isCurrency }: { label: string; value: number; delta: number; isCurrency?: boolean }) {
  const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  const color = delta > 5 ? "#6B7A5A" : delta < -5 ? "#B8474A" : "rgba(26,26,26,0.55)";
  return (
    <div style={{ padding: "10px 12px", background: "rgba(26,26,26,0.03)", borderRadius: 6 }}>
      <div className="moyu-section-label" style={{ fontSize: 9, letterSpacing: 1.5 }}>{label}</div>
      <div className="moyu-mono" style={{ fontSize: 17, fontWeight: 700, color: "rgba(26,26,26,0.92)", marginTop: 3 }}>
        {isCurrency ? `NT$ ${(value / 1000).toFixed(0)}k` : value.toLocaleString()}
      </div>
      <div className="moyu-mono" style={{ fontSize: 10, color, fontWeight: 600, marginTop: 2 }}>
        {arrow} {Math.abs(delta)}%
      </div>
    </div>
  );
}

function BenchCell({ label, value, baseline, unit, higherBetter }: { label: string; value: number; baseline: number; unit: string; higherBetter: boolean }) {
  const ok = higherBetter ? value >= baseline : value <= baseline;
  const ratio = baseline > 0 ? value / baseline : 0;
  const color = ok ? "#6B7A5A" : ratio >= 0.7 ? "#B89968" : "#B8474A";
  return (
    <div>
      <div style={{ fontSize: 11, color: "rgba(26,26,26,0.55)", letterSpacing: 1, fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 6 }}>
        <span className="moyu-mono" style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: 11, color: "rgba(26,26,26,0.55)" }}>{unit}</span>
        <span className="moyu-mono" style={{ fontSize: 10, color, marginLeft: 4 }}>
          {ok ? "✓" : "↓"}
        </span>
      </div>
      <div style={{ fontSize: 10, color: "rgba(26,26,26,0.55)", marginTop: 4 }}>
        baseline <span className="moyu-mono">{baseline}{unit}</span>
        <span style={{ color, marginLeft: 4, fontWeight: 600 }} className="moyu-mono">
          ({Math.round(ratio * 100)}%)
        </span>
      </div>
    </div>
  );
}
