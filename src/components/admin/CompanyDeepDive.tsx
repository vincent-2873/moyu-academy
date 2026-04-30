"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/**
 * 2026-04-30 末段 G4 + Quality pass:CompanyDeepDive
 *
 * 改:
 *   - 加 diagnosis 一句話(brand 整體狀態)
 *   - 員工分群:領跑者 / 中堅 / 落後 / 隱形(本週沒打卡)
 *   - 該關注員工 widget(自動偵測異常)
 *   - 業績排名第 1 視覺強化
 *   - RWD 手機 layout
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

interface ConcernItem {
  email: string; name: string; reason: string; severity: "critical" | "warning";
}

interface DeepDiveData {
  ok: boolean;
  brand: string;
  employees: Employee[];
  trend: TrendPoint[];
  sparrings: Sparring[];
  groups: {
    leaders: { email: string; name: string; week_revenue: number; week_calls: number }[];
    middle_count: number;
    laggers: { email: string; name: string; week_revenue: number; week_calls: number; active_days_7d: number }[];
    invisible: { email: string; name: string; active_days_7d: number }[];
  };
  concerns: ConcernItem[];
  diagnosis: string;
  summary: {
    employee_count: number; week_total_revenue: number; week_total_calls: number;
    avg_calls_per_employee: number; sparring_count_30d: number;
    leaders_count: number; laggers_count: number; invisible_count: number;
  };
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
      <style>{`
        @media (max-width: 768px) {
          .cdd-summary { grid-template-columns: repeat(2, 1fr) !important; }
          .cdd-emp-row { grid-template-columns: 24px 1fr 60px 80px !important; gap: 6px !important; font-size: 11px !important; }
          .cdd-emp-row .cdd-cell-extra { display: none !important; }
          .cdd-trend-bars { gap: 3px !important; }
          .cdd-spar-row { grid-template-columns: 1fr 50px !important; gap: 4px !important; }
          .cdd-spar-row .cdd-cell-extra { display: none !important; }
        }
      `}</style>

      {/* diagnosis 一句話 */}
      <div style={{
        padding: "14px 18px",
        background: data.summary.invisible_count / Math.max(1, data.summary.employee_count) > 0.3 ? "rgba(185,28,28,0.05)"
          : data.concerns.length / Math.max(1, data.summary.employee_count) > 0.3 ? "rgba(217,119,6,0.05)"
          : "rgba(107,122,90,0.05)",
        border: `1px solid ${data.summary.invisible_count / Math.max(1, data.summary.employee_count) > 0.3 ? "var(--accent-red)"
          : data.concerns.length / Math.max(1, data.summary.employee_count) > 0.3 ? "#d97706"
          : "#6B7A5A"}`,
        borderRadius: 10,
        fontSize: 14,
        color: "var(--text)",
        lineHeight: 1.7,
      }}>
        {data.diagnosis}
      </div>

      {/* summary strip */}
      <div className="cdd-summary moyu-glass-card" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, padding: 14 }}>
        <Quick label="員工" value={data.summary.employee_count} />
        <Quick label="本週撥打 / 人均" value={data.summary.week_total_calls} unit={`通(${data.summary.avg_calls_per_employee}/人)`} />
        <Quick label="本週總營收" value={`NT$ ${data.summary.week_total_revenue.toLocaleString()}`} />
        <Quick label="30 天對練" value={data.summary.sparring_count_30d} unit="場" />
      </div>

      {/* 群組 segmentation strip */}
      <div className="cdd-summary" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <SegBox label="🏆 領跑" count={data.summary.leaders_count} color="#c9a96e" total={data.summary.employee_count} />
        <SegBox label="📊 中堅" count={data.summary.employee_count - data.summary.leaders_count - data.summary.laggers_count - data.summary.invisible_count} color="#6B7E94" total={data.summary.employee_count} />
        <SegBox label="🐌 落後" count={data.summary.laggers_count} color="#d97706" total={data.summary.employee_count} />
        <SegBox label="👻 隱形" count={data.summary.invisible_count} color="var(--accent-red)" total={data.summary.employee_count} />
      </div>

      {/* concerns widget — 該關注的人 */}
      {data.concerns.length > 0 && (
        <div style={{ background: "rgba(185,28,28,0.04)", border: "1px solid rgba(185,28,28,0.3)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-red)", marginBottom: 10 }}>
            🚨 該特別關注 · {data.concerns.length} 人
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {data.concerns.slice(0, 8).map((c, i) => (
              <motion.div
                key={c.email}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr",
                  gap: 10,
                  padding: "8px 12px",
                  background: "rgba(255,255,255,0.6)",
                  borderRadius: 6,
                  fontSize: 12,
                  borderLeft: `3px solid ${c.severity === "critical" ? "var(--accent-red)" : "#d97706"}`,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: c.severity === "critical" ? "var(--accent-red)" : "#d97706" }}>
                  {c.severity === "critical" ? "🔴 緊急" : "🟠 注意"}
                </span>
                <div>
                  <div style={{ color: "var(--text)", fontWeight: 600 }}>{c.name}</div>
                  <div style={{ color: "var(--text3)", fontSize: 11, marginTop: 2 }}>{c.reason}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* 7-day trend */}
      <div className="moyu-glass-card" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 14 }}>📈 過去 7 天走勢</div>
        <div className="cdd-trend-bars" style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 120 }}>
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

      {/* employees ranked */}
      <div className="moyu-glass-card" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>👥 業務員列表(本週營收排序)</div>
        <div style={{ display: "grid", gap: 4 }}>
          {data.employees.slice(0, 20).map((e, idx) => {
            const isFirst = idx === 0 && e.week_revenue > 0;
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.02 }}
                className="cdd-emp-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "30px 1fr 60px 60px 60px 80px 100px",
                  gap: 8,
                  alignItems: "center",
                  padding: "8px 12px",
                  background: isFirst ? "rgba(201,169,110,0.10)" : "var(--bg2)",
                  border: isFirst ? "1px solid #c9a96e" : "1px solid transparent",
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                <span style={{ color: idx === 0 ? "#c9a96e" : "var(--text3)", fontWeight: 700, fontFamily: "monospace", fontSize: idx === 0 ? 18 : 13 }}>
                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                </span>
                <div>
                  <div style={{ color: "var(--text)", fontWeight: isFirst ? 700 : 600 }}>{e.name}</div>
                  <div className="cdd-cell-extra" style={{ color: "var(--text3)", fontSize: 10, fontFamily: "monospace" }}>{e.email}</div>
                </div>
                <div className="cdd-cell-extra" style={{ textAlign: "right", color: "var(--text2)" }}>{e.week_calls} 通</div>
                <div className="cdd-cell-extra" style={{ textAlign: "right", color: "var(--text2)" }}>{e.week_appts} 邀</div>
                <div style={{ textAlign: "right", color: e.week_closes > 0 ? "#6B7A5A" : "var(--text3)", fontWeight: 600 }}>{e.week_closes} 成</div>
                <div className="cdd-cell-extra" style={{ textAlign: "right", color: e.active_days_7d >= 5 ? "#6B7A5A" : e.active_days_7d >= 3 ? "var(--text3)" : "var(--accent-red)", fontSize: 10 }}>
                  {e.active_days_7d}/7 天活躍
                </div>
                <div style={{ textAlign: "right", color: isFirst ? "#c9a96e" : "var(--text)", fontWeight: 700 }}>
                  NT$ {e.week_revenue.toLocaleString()}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* sparrings */}
      {data.sparrings.length > 0 && (
        <div className="moyu-glass-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>🎯 對練紀錄(過去 30 天 Top 20)</div>
          <div style={{ display: "grid", gap: 4 }}>
            {data.sparrings.map((s, i) => (
              <div key={i} className="cdd-spar-row" style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 60px 100px",
                gap: 8,
                padding: "6px 10px",
                background: "var(--bg2)",
                borderRadius: 4,
                fontSize: 12,
              }}>
                <span className="cdd-cell-extra" style={{ color: "var(--text3)", fontFamily: "monospace", fontSize: 10 }}>{s.user_email}</span>
                <span style={{ color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.scenario}</span>
                <span style={{ textAlign: "right", color: s.score >= 80 ? "#6B7A5A" : s.score >= 60 ? "#B89968" : "var(--accent-red)", fontWeight: 700 }}>{s.score}</span>
                <span className="cdd-cell-extra" style={{ textAlign: "right", color: "var(--text3)", fontSize: 10 }}>{new Date(s.created_at).toISOString().slice(5, 10)}</span>
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

function SegBox({ label, count, color, total }: { label: string; count: number; color: string; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ padding: 12, background: "var(--card)", border: `1px solid ${color}40`, borderRadius: 8, textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 4 }}>{count}</div>
      <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{pct}%</div>
    </div>
  );
}
