"use client";

import { motion } from "framer-motion";

/**
 * 2026-04-30 末段 G1:法務 deadline countdown widget
 *
 * 顯示最近 30 天內到期的 contracts / compliance / disputes
 * 按 days_left 排序,過期 > 7 天紅色,7-30 天橙色
 */

export interface DeadlineItem {
  type: "contract" | "compliance" | "dispute";
  title: string;
  due_date: string;          // yyyy-MM-dd
  days_left: number;          // < 0 = overdue
  detail?: string;
  link?: string;
}

interface Props {
  items: DeadlineItem[];
  todayStr: string;           // yyyy-MM-dd
}

const TYPE_LABEL: Record<string, string> = {
  contract: "📄 合約",
  compliance: "📋 法遵",
  dispute: "⚠️ 糾紛",
};

export default function DeadlineCountdown({ items, todayStr }: Props) {
  // sort by days_left,過期最先
  const sorted = [...items].sort((a, b) => a.days_left - b.days_left);
  const overdue = sorted.filter((i) => i.days_left < 0);
  const within7 = sorted.filter((i) => i.days_left >= 0 && i.days_left <= 7);
  const within30 = sorted.filter((i) => i.days_left > 7 && i.days_left <= 30);

  if (overdue.length === 0 && within7.length === 0 && within30.length === 0) {
    return (
      <div style={{ padding: 16, background: "#ecfdf5", border: "1px solid #6B7A5A", borderRadius: 8, marginBottom: 24, fontSize: 13, color: "#065f46" }}>
        ✅ 30 天內無到期項目 · today {todayStr}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 12, color: "#64748b", letterSpacing: 2, fontWeight: 600, marginBottom: 8 }}>
        ⏰ DEADLINE COUNTDOWN · today {todayStr}
      </div>

      {/* overdue */}
      {overdue.length > 0 && (
        <Section
          title={`🚨 已逾期 ${overdue.length}`}
          color="#dc2626"
          bg="#fef2f2"
          items={overdue}
          showOverdue
        />
      )}

      {/* within 7 days */}
      {within7.length > 0 && (
        <Section
          title={`🟠 7 天內到期 ${within7.length}`}
          color="#ea580c"
          bg="#fff7ed"
          items={within7}
        />
      )}

      {/* within 30 days */}
      {within30.length > 0 && (
        <Section
          title={`🟡 30 天內 ${within30.length}`}
          color="#d97706"
          bg="#fefce8"
          items={within30}
        />
      )}
    </div>
  );
}

function Section({ title, color, bg, items, showOverdue }: { title: string; color: string; bg: string; items: DeadlineItem[]; showOverdue?: boolean }) {
  return (
    <div className="moyu-glass-card" style={{ borderColor: `${color}40`, padding: "10px 14px", marginBottom: 8, background: `${bg}cc` }}>
      <div style={{ fontSize: 12, color, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gap: 4 }}>
        {items.slice(0, 6).map((it, idx) => (
          <motion.div
            key={`${it.type}-${idx}`}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.03 }}
            style={{
              display: "grid",
              gridTemplateColumns: "70px 1fr 100px",
              gap: 12,
              alignItems: "center",
              padding: "6px 8px",
              background: "rgba(255,255,255,0.6)",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            <span style={{ fontSize: 10, color, fontWeight: 600 }}>{TYPE_LABEL[it.type]}</span>
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1e293b" }}>
              {it.link ? <a href={it.link} style={{ color: "#1e293b" }}>{it.title}</a> : it.title}
              {it.detail && <span style={{ color: "#64748b", fontSize: 11, marginLeft: 6 }}>· {it.detail}</span>}
            </div>
            <div style={{ fontSize: 11, color, fontWeight: 600, textAlign: "right", fontFamily: "monospace" }}>
              {showOverdue ? `逾 ${Math.abs(it.days_left)} 天` : `${it.days_left} 天`}
              <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 400 }}>{it.due_date}</div>
            </div>
          </motion.div>
        ))}
        {items.length > 6 && <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "center", marginTop: 4 }}>...還有 {items.length - 6} 件</div>}
      </div>
    </div>
  );
}
