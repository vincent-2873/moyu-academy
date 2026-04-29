"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import BreathingNumber from "@/components/wabi/BreathingNumber";

export default function HealthDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/health-overview")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-12 text-center text-sm" style={{ color: "var(--ink-mid)" }}>載入健康度…</div>;
  if (!data) return <div className="p-12 text-center text-sm" style={{ color: "var(--ink-mid)" }}>載入失敗</div>;

  const envSet = Object.entries(data.env || {}).filter(([_, v]) => v).length;
  const envTotal = Object.keys(data.env || {}).length;

  return (
    <div style={{ padding: "32px", maxWidth: 1400, margin: "0 auto" }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, marginBottom: 12, fontWeight: 600 }}>
        ADMIN · SYSTEM HEALTH
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: "clamp(40px, 6vw, 64px)", fontWeight: 600, color: "var(--ink-deep)", letterSpacing: 4, marginBottom: 32, lineHeight: 1.1 }}
      >
        系統健康度
      </motion.h1>

      <KintsugiLine />

      {/* Sales Metrics */}
      <SectionLabel>業 SALES METRICS</SectionLabel>
      <div className="grid md:grid-cols-3 gap-4 mb-12">
        <BigStat label="2026 總撥打" value={data.sales.sum_calls_2026} unit="通" delay={0.1} />
        <BigStat label="2026 總營收" value={`NT$ ${(data.sales.sum_revenue_2026 / 1000).toFixed(0)}k`} delay={0.2} />
        <BigStat label="總 rows" value={data.sales.total_rows} unit="筆" delay={0.3} />
      </div>

      {/* Knowledge / RAG */}
      <SectionLabel>知 KNOWLEDGE BASE</SectionLabel>
      <div className="grid md:grid-cols-3 gap-4 mb-12">
        <BigStat label="知識片段" value={data.knowledge.total} unit="chunks" delay={0.4} />
        <BigStat
          label="已 Embedding"
          value={data.knowledge.with_embedding}
          unit={`/ ${data.knowledge.total}`}
          delay={0.5}
          warning={data.knowledge.with_embedding === 0 && data.knowledge.total > 0}
        />
        <Card delay={0.6}>
          <Label>來源類型</Label>
          <div style={{ marginTop: 12 }}>
            {Object.entries(data.knowledge.sources_by_type || {}).length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--ink-mid)" }}>無</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.knowledge.sources_by_type || {}).map(([k, v]: any) => (
                  <span key={k} style={{ fontSize: 11, padding: "3px 8px", background: "var(--bg-elev)", borderRadius: 2, fontFamily: "var(--font-noto-serif-tc)" }}>
                    {k} <span style={{ color: "var(--accent-red)", fontWeight: 600 }}>{v}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Training */}
      <SectionLabel>養 TRAINING</SectionLabel>
      <div className="grid md:grid-cols-3 gap-4 mb-12">
        <BigStat label="進行中 assignments" value={data.training.assignments_by_status?.active || 0} delay={0.7} />
        <BigStat label="完成 assignments" value={data.training.assignments_by_status?.completed || 0} delay={0.8} />
        <BigStat label="總印章" value={data.training.stamps_total} unit="個" delay={0.9} />
      </div>

      {/* Cron */}
      <SectionLabel>排 CRON · 24H</SectionLabel>
      <div className="grid md:grid-cols-3 gap-4 mb-12">
        <BigStat label="跑了" value={data.cron.runs_24h} unit="次" delay={1.0} />
        <BigStat label="成功率" value={data.cron.pass_rate_pct ?? "—"} unit="%" delay={1.1} warning={data.cron.pass_rate_pct != null && data.cron.pass_rate_pct < 80} />
        <BigStat label="失敗" value={data.cron.fail} unit="次" delay={1.2} warning={data.cron.fail > 0} />
      </div>

      {/* Freshness */}
      {data.freshness && data.freshness.length > 0 && (
        <>
          <SectionLabel>鮮 FRESHNESS</SectionLabel>
          <div className="grid md:grid-cols-3 gap-3 mb-12">
            {data.freshness.map((f: any, i: number) => (
              <motion.div
                key={f.table_name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.3 + i * 0.05 }}
                style={{ padding: 12, background: "var(--bg-paper)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 4 }}
              >
                <div style={{ fontSize: 10, color: "var(--ink-mid)", letterSpacing: 1, fontWeight: 600 }}>{f.table_name}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                  <span style={{ fontSize: 18, fontFamily: "var(--font-jetbrains-mono)", fontWeight: 600, color: "var(--ink-deep)" }}>{f.row_count?.toLocaleString() || 0}</span>
                  <span style={{ fontSize: 10, color: "var(--ink-mid)" }}>筆</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--ink-mid)", marginTop: 2 }}>
                  {f.last_updated ? new Date(f.last_updated).toISOString().slice(0, 16).replace("T", " ") : "無"}
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Env */}
      <SectionLabel>密 ENV · {envSet}/{envTotal} 設定</SectionLabel>
      <div className="grid md:grid-cols-2 gap-2 mb-12">
        {Object.entries(data.env || {}).map(([k, v]: any, i) => (
          <motion.div
            key={k}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 + i * 0.03 }}
            style={{
              padding: "8px 14px",
              background: v ? "var(--bg-elev)" : "rgba(185,28,28,0.05)",
              border: `1px solid ${v ? "var(--border-soft, rgba(26,26,26,0.10))" : "rgba(185,28,28,0.3)"}`,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: v ? "var(--gold-thread, #c9a96e)" : "var(--accent-red)" }} />
            <span style={{ fontSize: 12, fontFamily: "var(--font-jetbrains-mono)", color: "var(--ink-deep)", flex: 1 }}>{k}</span>
            <span style={{ fontSize: 10, color: v ? "var(--gold-thread, #c9a96e)" : "var(--accent-red)", letterSpacing: 1, fontWeight: 600 }}>
              {v ? "已設" : "未設"}
            </span>
          </motion.div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: "var(--ink-mid)", textAlign: "right", letterSpacing: 1 }}>
        Last updated: {new Date(data.timestamp).toLocaleString("zh-TW")}
      </div>
    </div>
  );
}

function BigStat({ label, value, unit, delay = 0, warning }: { label: string; value: any; unit?: string; delay?: number; warning?: boolean }) {
  const display = value == null ? "—" : (typeof value === "number" ? value.toLocaleString() : value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -2 }}
      style={{
        padding: 24,
        background: "var(--bg-paper)",
        border: `1px solid ${warning ? "var(--accent-red)" : "var(--border-soft, rgba(26,26,26,0.10))"}`,
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 10, color: warning ? "var(--accent-red)" : "var(--ink-mid)", letterSpacing: 3, fontWeight: 600, textTransform: "uppercase", marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <BreathingNumber size={36} color={warning ? "var(--accent-red)" : undefined}>{display}</BreathingNumber>
        {unit && <span style={{ fontSize: 13, color: "var(--ink-mid)" }}>{unit}</span>}
      </div>
    </motion.div>
  );
}

function Card({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -2 }}
      style={{ padding: 24, background: "var(--bg-paper)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6 }}
    >
      {children}
    </motion.div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, marginBottom: 16, fontWeight: 600 }}>
      {children}
    </motion.div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, color: "var(--ink-mid)", letterSpacing: 3, fontWeight: 600, textTransform: "uppercase" }}>{children}</div>;
}

function KintsugiLine() {
  return <svg width="100%" height="3" style={{ display: "block", marginBottom: 40 }}><line x1="0" y1="1.5" x2="100%" y2="1.5" stroke="var(--gold-thread, #c9a96e)" strokeWidth="1" strokeDasharray="2 4" /></svg>;
}
