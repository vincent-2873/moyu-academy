"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/**
 * 2026-04-30 末段:員工前台 DailyFocus
 *
 * 給業務員/員工:登入第一個看到「今天該幹嘛」
 * 設計同 admin FocusBoard 一致:毛玻璃 + 金線 + Mono
 */

interface DailyFocusData {
  ok: boolean;
  me: { email: string; name: string; brand: string; stage: string; role: string };
  headline: string;
  today: {
    date: string; calls: number; appts: number; closes: number; revenue: number;
    target: number; gap_to_target: number; pct: number;
  };
  seven_day: { calls: number; appts: number; closes: number; revenue: number; baseline: { calls: number; appts: number; closes: number } };
  rank: { my_rank: number; peer_count: number; above_me: { name: string; revenue: number } | null; gap_to_above: number };
  weakness: { axis: string; label: string; current: number; baseline: number; gap: number; hint: string } | null;
  reminders: { type: string; level: "info" | "warning" | "critical"; text: string }[];
  pending_commands: { id: string; title: string; detail: string | null; severity: string; deadline: string | null }[];
  recent_sparring_count: number;
}

interface Props {
  email: string;
}

export default function DailyFocus({ email }: Props) {
  const [data, setData] = useState<DailyFocusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) return;
    fetch(`/api/me/daily-focus?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [email]);

  if (loading) return <div style={{ padding: 16, fontSize: 13, color: "rgba(26,26,26,0.55)" }}>載入今日重點…</div>;
  if (!data || !data.ok) return null;

  const t = data.today;
  const todayColor = t.pct >= 100 ? "#6B7A5A" : t.pct >= 50 ? "#B89968" : "#B8474A";

  return (
    <div style={{ marginBottom: 24 }}>
      <style>{`
        @media (max-width: 768px) {
          .df-grid-3col { grid-template-columns: 1fr !important; }
          .df-today-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>

      {/* Headline 大字一句話 */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="moyu-glass-card"
        style={{ padding: "20px 28px", marginBottom: 16 }}
      >
        <div className="moyu-section-label" style={{ marginBottom: 8 }}>
          <span className="moyu-ink-dot" style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "rgba(184,71,74,0.85)", marginRight: 8 }} />
          DAILY FOCUS · {t.date}
        </div>
        <div style={{ fontFamily: "var(--font-noto-serif-tc, serif)", fontSize: "clamp(18px, 2.4vw, 24px)", color: "rgba(26,26,26,0.92)", fontWeight: 700, lineHeight: 1.5, letterSpacing: 1 }}>
          {data.headline}
        </div>
      </motion.div>

      {/* 3 col main */}
      <div className="df-grid-3col" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* Today progress */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="moyu-glass-card is-hover"
          style={{ padding: 20 }}
        >
          <div className="moyu-section-label">📞 今日進度</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
            <span className="moyu-mono" style={{ fontSize: 40, fontWeight: 700, color: todayColor, lineHeight: 1 }}>{t.calls}</span>
            <span style={{ fontSize: 13, color: "rgba(26,26,26,0.55)" }}>/ {t.target} 通</span>
            <span className="moyu-mono" style={{ marginLeft: "auto", fontSize: 14, color: todayColor, fontWeight: 700 }}>{t.pct}%</span>
          </div>
          <div style={{ height: 6, background: "rgba(26,26,26,0.06)", borderRadius: 99, overflow: "hidden", marginTop: 12, position: "relative" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, t.pct)}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              style={{ height: "100%", background: todayColor, borderRadius: 99 }}
            />
          </div>
          <div className="df-today-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 14, fontSize: 11 }}>
            <div>
              <div style={{ color: "rgba(26,26,26,0.55)" }}>邀約</div>
              <div className="moyu-mono" style={{ color: "rgba(26,26,26,0.92)", fontWeight: 700, fontSize: 16, marginTop: 2 }}>{t.appts}</div>
            </div>
            <div>
              <div style={{ color: "rgba(26,26,26,0.55)" }}>成交</div>
              <div className="moyu-mono" style={{ color: t.closes > 0 ? "#6B7A5A" : "rgba(26,26,26,0.55)", fontWeight: 700, fontSize: 16, marginTop: 2 }}>{t.closes}</div>
            </div>
            <div>
              <div style={{ color: "rgba(26,26,26,0.55)" }}>營收</div>
              <div className="moyu-mono" style={{ color: t.revenue > 0 ? "#B89968" : "rgba(26,26,26,0.55)", fontWeight: 800, fontSize: 14, marginTop: 2 }}>NT$ {(t.revenue / 1000).toFixed(0)}k</div>
            </div>
          </div>
          {t.gap_to_target > 0 && (
            <div style={{ fontSize: 11, color: todayColor, marginTop: 12, padding: "6px 10px", background: "rgba(184,71,74,0.04)", borderRadius: 4 }}>
              還差 <span className="moyu-mono">{t.gap_to_target}</span> 通到今日 baseline
            </div>
          )}
        </motion.div>

        {/* Rank */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={data.rank.my_rank === 1 ? "moyu-glass-card-gold is-hover" : "moyu-glass-card is-hover"}
          style={{ padding: 20 }}
        >
          <div className="moyu-section-label">🏆 brand 內排名(本週)</div>
          {data.rank.my_rank > 0 ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 12 }}>
                <span style={{ fontSize: 30, lineHeight: 1 }}>
                  {data.rank.my_rank === 1 ? "🥇" : data.rank.my_rank === 2 ? "🥈" : data.rank.my_rank === 3 ? "🥉" : ""}
                </span>
                <span className="moyu-mono" style={{ fontSize: 36, fontWeight: 700, color: data.rank.my_rank === 1 ? "#B89968" : "rgba(26,26,26,0.92)", lineHeight: 1 }}>
                  #{data.rank.my_rank}
                </span>
                <span style={{ fontSize: 13, color: "rgba(26,26,26,0.55)" }}>/ {data.rank.peer_count}</span>
              </div>
              {data.rank.above_me && (
                <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(26,26,26,0.04)", borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: "rgba(26,26,26,0.55)", letterSpacing: 1, marginBottom: 4 }}>上一名 #{data.rank.my_rank - 1}</div>
                  <div style={{ fontSize: 13, color: "rgba(26,26,26,0.85)", fontWeight: 600 }}>{data.rank.above_me.name}</div>
                  <div className="moyu-mono" style={{ fontSize: 12, color: "#B8474A", marginTop: 4, fontWeight: 600 }}>
                    距離 NT$ {data.rank.gap_to_above.toLocaleString()}
                  </div>
                </div>
              )}
              {data.rank.my_rank === 1 && (
                <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(201,169,110,0.10)", borderRadius: 6, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
                  你領頭 — 持續穩定就好
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: "rgba(26,26,26,0.55)", marginTop: 12 }}>本週尚無排名資料</div>
          )}
        </motion.div>

        {/* Weakness + action */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={data.weakness ? "moyu-glass-card-accent is-hover" : "moyu-glass-card is-hover"}
          style={{ padding: 20 }}
        >
          <div className="moyu-section-label" style={{ color: data.weakness ? "rgba(184,71,74,0.85)" : undefined }}>
            🎯 弱項突破
          </div>
          {data.weakness ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 10 }}>
                <span style={{ fontFamily: "var(--font-noto-serif-tc, serif)", fontSize: 18, fontWeight: 700, color: "rgba(26,26,26,0.92)" }}>
                  {data.weakness.label}
                </span>
                <span className="moyu-mono" style={{ fontSize: 12, color: "#B8474A", marginLeft: "auto", fontWeight: 700 }}>
                  {data.weakness.current} / {data.weakness.baseline}
                </span>
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: "rgba(26,26,26,0.85)", lineHeight: 1.7 }}>
                {data.weakness.hint}
              </div>
            </>
          ) : (
            <>
              <div style={{ marginTop: 14, fontSize: 14, color: "#6B7A5A", fontWeight: 600 }}>✓ 全部達 baseline</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "rgba(26,26,26,0.55)" }}>持續穩定 + 找『最好的那 1 軸』再上一階</div>
            </>
          )}
        </motion.div>
      </div>

      {/* Reminders 行 */}
      {data.reminders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="moyu-glass-card"
          style={{ padding: 18, marginBottom: 14 }}
        >
          <div className="moyu-section-label" style={{ marginBottom: 10 }}>📣 戰情官提醒 · {data.reminders.length}</div>
          <div style={{ display: "grid", gap: 6 }}>
            {data.reminders.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                style={{
                  padding: "10px 14px",
                  background: r.level === "critical" ? "rgba(184,71,74,0.06)" : r.level === "warning" ? "rgba(184,153,104,0.08)" : "rgba(8,145,178,0.05)",
                  borderLeft: `3px solid ${r.level === "critical" ? "#B8474A" : r.level === "warning" ? "#B89968" : "#0891b2"}`,
                  borderRadius: 4,
                  fontSize: 13,
                  color: "rgba(26,26,26,0.85)",
                  lineHeight: 1.6,
                }}
              >
                {r.text}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 待辦命令 */}
      {data.pending_commands.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="moyu-glass-card"
          style={{ padding: 18 }}
        >
          <div className="moyu-section-label" style={{ marginBottom: 10 }}>📋 你的待辦 · {data.pending_commands.length}</div>
          <div style={{ display: "grid", gap: 6 }}>
            {data.pending_commands.map((c) => (
              <a
                key={c.id}
                href="/"
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 80px",
                  gap: 12,
                  padding: "10px 14px",
                  background: "rgba(26,26,26,0.03)",
                  borderRadius: 4,
                  fontSize: 12,
                  textDecoration: "none",
                  color: "rgba(26,26,26,0.85)",
                  borderLeft: `3px solid ${c.severity === "critical" ? "#B8474A" : c.severity === "high" ? "#B89968" : "rgba(26,26,26,0.20)"}`,
                }}
              >
                <span className="moyu-mono" style={{ fontSize: 9, fontWeight: 700, color: c.severity === "critical" ? "#B8474A" : c.severity === "high" ? "#B89968" : "rgba(26,26,26,0.55)", letterSpacing: 1 }}>
                  {c.severity?.toUpperCase()}
                </span>
                <span style={{ fontWeight: 600 }}>{c.title}</span>
                <span className="moyu-mono" style={{ fontSize: 10, color: "rgba(26,26,26,0.55)", textAlign: "right" }}>
                  {c.deadline ? new Date(c.deadline).toISOString().slice(5, 10) : "—"}
                </span>
              </a>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
