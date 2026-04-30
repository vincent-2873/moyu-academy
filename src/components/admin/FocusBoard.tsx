"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/**
 * 2026-04-30 末段 K4:Admin 主控台「最該看什麼」focus widget
 *
 * 設計從人類視角:
 *   一上 admin 30 秒內要回答這 3 個問題:
 *     1. 我現在最該幹嘛?(top action)
 *     2. 月底會達標嗎?(projection + on-track gauge)
 *     3. 本週狀況跟上週比?(WoW delta)
 */

interface FocusData {
  ok: boolean;
  today: string;
  this_week: { calls: number; appts: number; closes: number; revenue: number };
  last_week: { calls: number; appts: number; closes: number; revenue: number };
  wow_pct: { calls: number; appts: number; closes: number; revenue: number };
  top_performer: { name: string; brand: string; revenue: number; calls: number; closes: number } | null;
  bottom_count: number;
  employee_count: number;
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
  warning: "#d97706",
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

  return (
    <div style={{ marginBottom: 24 }}>
      <style>{`
        @media (max-width: 768px) {
          .focus-grid-3col { grid-template-columns: 1fr !important; }
          .focus-wow-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      {/* top action — 最大區塊,最顯眼 */}
      <motion.a
        href={data.top_action_link}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.005 }}
        style={{
          display: "block",
          padding: "20px 24px",
          background: m.health === "critical" || data.pending_critical_commands.length > 0 ? "rgba(184,71,74,0.08)" : "rgba(184,153,104,0.08)",
          border: `2px solid ${m.health === "critical" || data.pending_critical_commands.length > 0 ? "#B8474A" : "#B89968"}`,
          borderRadius: 14,
          textDecoration: "none",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: 3, fontWeight: 600, marginBottom: 8 }}>
          ⚡ 你現在最該做的事 → 點擊跳轉
        </div>
        <div style={{ fontSize: 18, color: "var(--text)", fontWeight: 700, lineHeight: 1.5 }}>
          {data.top_action}
        </div>
      </motion.a>

      {/* 3 col main */}
      <div className="focus-grid-3col" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 12 }}>
        {/* 月底達標 */}
        <div style={{ padding: 18, background: "var(--card)", border: `1px solid ${onTrackColor}30`, borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: 2, fontWeight: 600 }}>📅 月底預估達標</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: onTrackColor }}>{m.on_track_pct}%</span>
            <span style={{ fontSize: 13, color: "var(--text2)" }}>達標</span>
          </div>
          {/* progress bar */}
          <div style={{ height: 8, background: "var(--bg2)", borderRadius: 99, overflow: "hidden", marginTop: 12, position: "relative" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, m.on_track_pct)}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{ height: "100%", background: onTrackColor, borderRadius: 99 }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--text3)" }}>
            <span>已 NT$ {m.revenue.toLocaleString()}</span>
            <span>預估 NT$ {m.projected_eom.toLocaleString()}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
            目標 NT$ {m.target.toLocaleString()} · D{m.day_of_month}/{m.days_in_month} ·
            <span style={{ color: m.vs_last_month_pct >= 0 ? "#6B7A5A" : "#B8474A", fontWeight: 600, marginLeft: 4 }}>
              vs 上月 {m.vs_last_month_pct >= 0 ? "+" : ""}{m.vs_last_month_pct}%
            </span>
          </div>
        </div>

        {/* 本週 vs 上週 (WoW) */}
        <div style={{ padding: 18, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: 2, fontWeight: 600, marginBottom: 12 }}>📊 本週 vs 上週</div>
          <div className="focus-wow-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            <WowCell label="撥打" value={data.this_week.calls} delta={data.wow_pct.calls} />
            <WowCell label="邀約" value={data.this_week.appts} delta={data.wow_pct.appts} />
            <WowCell label="成交" value={data.this_week.closes} delta={data.wow_pct.closes} />
            <WowCell label="營收" value={data.this_week.revenue} delta={data.wow_pct.revenue} isCurrency />
          </div>
        </div>

        {/* Top performer */}
        <div style={{ padding: 18, background: "rgba(201,169,110,0.05)", border: "1px solid #B89968", borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: 2, fontWeight: 600, marginBottom: 8 }}>🏆 本週領跑</div>
          {data.top_performer ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{data.top_performer.name}</div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2, marginBottom: 12 }}>{data.top_performer.brand}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, fontSize: 11 }}>
                <div>
                  <div style={{ color: "var(--text3)" }}>通數</div>
                  <div style={{ color: "var(--text)", fontWeight: 700, fontSize: 14 }}>{data.top_performer.calls}</div>
                </div>
                <div>
                  <div style={{ color: "var(--text3)" }}>成交</div>
                  <div style={{ color: "var(--text)", fontWeight: 700, fontSize: 14 }}>{data.top_performer.closes}</div>
                </div>
                <div>
                  <div style={{ color: "var(--text3)" }}>營收</div>
                  <div style={{ color: "#c9a96e", fontWeight: 800, fontSize: 14 }}>NT$ {(data.top_performer.revenue / 1000).toFixed(0)}k</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 12, padding: "6px 8px", background: "var(--bg2)", borderRadius: 4 }}>
                落後者:{data.bottom_count} / {data.employee_count} 人本週通數 &lt; 30
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: "var(--text3)" }}>無資料</div>
          )}
        </div>
      </div>
    </div>
  );
}

function WowCell({ label, value, delta, isCurrency }: { label: string; value: number; delta: number; isCurrency?: boolean }) {
  const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  const color = delta > 5 ? "#6B7A5A" : delta < -5 ? "#B8474A" : "var(--text3)";
  return (
    <div style={{ padding: "8px 10px", background: "var(--bg2)", borderRadius: 6 }}>
      <div style={{ fontSize: 9, color: "var(--text3)", letterSpacing: 1, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>
        {isCurrency ? `NT$ ${(value / 1000).toFixed(0)}k` : value.toLocaleString()}
      </div>
      <div style={{ fontSize: 10, color, fontWeight: 600, marginTop: 2 }}>
        {arrow} {Math.abs(delta)}%
      </div>
    </div>
  );
}
