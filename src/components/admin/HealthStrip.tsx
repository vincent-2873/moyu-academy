"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import BreathingNumber from "@/components/wabi/BreathingNumber";

/**
 * HealthStrip — pillars tab 上方放的精簡 widget(取代/補 CeoOverviewSection 之前的)
 * 一行 6 個數字,3 行高
 */

export default function HealthStrip() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/health-overview")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: "var(--ink-mid)", fontSize: 13 }}>載入 pulse…</div>;
  if (!data) return null;

  const items = [
    { label: "業務員", value: 53, suffix: "人" }, // 從 sales metrics distinct people 推
    { label: "本月撥打", value: data.sales.sum_calls_2026?.toLocaleString() || "—", suffix: "通" },
    { label: "本月營收", value: `${(data.sales.sum_revenue_2026 / 1000).toFixed(0)}k`, prefix: "NT$" },
    { label: "知識片段", value: data.knowledge.total, suffix: "段" },
    { label: "印章已蓋", value: data.training.stamps_total, suffix: "個" },
    { label: "Cron 24h", value: data.cron.pass_rate_pct ?? "—", suffix: "%", warning: data.cron.pass_rate_pct != null && data.cron.pass_rate_pct < 80 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      style={{
        padding: "20px 24px",
        background: "var(--bg-paper)",
        border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
        borderRadius: 6,
        marginBottom: 24,
      }}
    >
      <div style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, marginBottom: 16, fontWeight: 600 }}>
        脈 PULSE · 即時健康度
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16 }}>
        {items.map((it, i) => (
          <motion.div
            key={it.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            style={{ borderLeft: it.warning ? "2px solid var(--accent-red)" : "2px solid var(--gold-thread, #c9a96e)", paddingLeft: 12 }}
          >
            <div style={{ fontSize: 9, color: it.warning ? "var(--accent-red)" : "var(--ink-mid)", letterSpacing: 2, fontWeight: 600, marginBottom: 4 }}>
              {it.label}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              {it.prefix && <span style={{ fontSize: 11, color: "var(--ink-mid)" }}>{it.prefix}</span>}
              <BreathingNumber size={22} color={it.warning ? "var(--accent-red)" : undefined}>
                {String(it.value)}
              </BreathingNumber>
              {it.suffix && <span style={{ fontSize: 11, color: "var(--ink-mid)" }}>{it.suffix}</span>}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
