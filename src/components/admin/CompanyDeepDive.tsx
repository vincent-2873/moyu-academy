"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/**
 * 2026-04-30 末段 G4:替換 admin/page.tsx:2543 TODO
 *
 * 顯示該 brand 業務員列表 + 7d trend + 對練紀錄
 */

interface Employee {
  id: string; email: string; name: string; role: string;
  week_calls: number; week_appts: number; week_closes: number; week_revenue: number;
  active_days_7d: number;
  conversion_call_to_appt: number;
  conversion_appt_to_close: number;
}

interface TrendPoint {
  date: string; calls: number; appts: number; closes: number; revenue: number;
}

interface Sparring {
  user_email: string; score: number; scenario: string; created_at: string;
}

interface DeepDiveData {
  ok: boolean;
  brand: string;
  employees: Employee[];
  trend: TrendPoint[];
  sparrings: Sparring[];
  summary: { employee_count: number; week_total_revenue: number; week_total_calls: number; sparring_count_30d: number };
}

interface Props { brand: string; }

export default function CompanyDeepDive({ brand }: Props) {
  const [data, setData] = useState<DeepDiveData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/company-deepdive?brand=${encodeURIComponent(brand)}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [brand]);

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--text3)" }}>載入 deep dive…</div>;
  if (!data || !data.ok) return null;

  const maxRev = Math.max(1, ...data.trend.map((t) => t.revenue));
  const maxCalls = Math.max(1, ...data.trend.map((t) => t.calls));

  return (
    <div style={{ marginTop: 24, display: "grid", gap: 16 }}>
      {/* summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, padding: 14, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }}>
        <Quick label="員工" value={data.summary.employee_count} />
        <Quick label="本週總撥打" value={data.summary.week_total_calls} unit="通" />
        <Quick label="本週總營收" value={`NT$ ${data.summary.week_total_revenue.toLocaleString()}`} />
        <Quick label="30 天對練" value={data.summary.sparring_count_30d} unit="場" />
      </div>

      {/* 7-day trend */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 14 }}>📈 過去 7 天走勢</div>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 120 }}>
          {data.trend.map((t) => (
            <div key={t.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 9, color: "var(--text3)" }}>{t.calls}</div>
              <div style={{ width: "100%", height: `${(t.calls / maxCalls) * 80}%`, background: "#B89968", opacity: 0.7, borderRadius: 4, minHeight: 2 }} />
              <div style={{ width: "100%", height: `${(t.revenue / maxRev) * 30}%`, background: "#6B7A5A", borderRadius: 4, minHeight: 2 }} />
              <div style={{ fontSize: 9, color: "var(--text3)" }}>{t.date.slice(5)}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 11, color: "var(--text3)", justifyContent: "center" }}>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#B89968", marginRight: 4, borderRadius: 2 }} />撥打</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#6B7A5A", marginRight: 4, borderRadius: 2 }} />營收</span>
        </div>
      </div>

      {/* employees */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>👥 業務員列表(本週營收排序)</div>
        <div style={{ display: "grid", gap: 4 }}>
          {data.employees.slice(0, 20).map((e, idx) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.02 }}
              style={{
                display: "grid",
                gridTemplateColumns: "30px 1fr 60px 60px 60px 80px 90px",
                gap: 8,
                alignItems: "center",
                padding: "8px 12px",
                background: idx === 0 ? "rgba(201,169,110,0.08)" : "var(--bg2)",
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              <span style={{ color: idx === 0 ? "#c9a96e" : "var(--text3)", fontWeight: 700, fontFamily: "monospace" }}>
                {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
              </span>
              <div>
                <div style={{ color: "var(--text)", fontWeight: 600 }}>{e.name}</div>
                <div style={{ color: "var(--text3)", fontSize: 10, fontFamily: "monospace" }}>{e.email}</div>
              </div>
              <div style={{ textAlign: "right", color: "var(--text2)" }}>{e.week_calls} 通</div>
              <div style={{ textAlign: "right", color: "var(--text2)" }}>{e.week_appts} 邀</div>
              <div style={{ textAlign: "right", color: "var(--text2)" }}>{e.week_closes} 成</div>
              <div style={{ textAlign: "right", color: "var(--text3)", fontSize: 10 }}>{e.active_days_7d} 天活躍</div>
              <div style={{ textAlign: "right", color: "#6B7A5A", fontWeight: 700 }}>NT$ {e.week_revenue.toLocaleString()}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* sparrings */}
      {data.sparrings.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>🎯 對練紀錄(過去 30 天 Top 20)</div>
          <div style={{ display: "grid", gap: 4 }}>
            {data.sparrings.map((s, i) => (
              <div key={i} style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 60px 100px",
                gap: 8,
                padding: "6px 10px",
                background: "var(--bg2)",
                borderRadius: 4,
                fontSize: 12,
              }}>
                <span style={{ color: "var(--text3)", fontFamily: "monospace", fontSize: 10 }}>{s.user_email}</span>
                <span style={{ color: "var(--text2)" }}>{s.scenario}</span>
                <span style={{ textAlign: "right", color: s.score >= 80 ? "#6B7A5A" : s.score >= 60 ? "#B89968" : "var(--accent-red)", fontWeight: 700 }}>{s.score}</span>
                <span style={{ textAlign: "right", color: "var(--text3)", fontSize: 10 }}>{new Date(s.created_at).toISOString().slice(5, 10)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Quick({ label, value, unit }: { label: string; value: any; unit?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 9, color: "var(--text3)", letterSpacing: 1, fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2, marginTop: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {unit && <span style={{ fontSize: 10, color: "var(--text3)" }}>{unit}</span>}
      </div>
    </div>
  );
}
