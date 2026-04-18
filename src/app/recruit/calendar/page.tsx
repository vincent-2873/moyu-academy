"use client";

import { useState, useEffect, useCallback } from "react";
import MobileNav from "@/components/MobileNav";

interface InterviewEvent {
  id: string;
  candidate_name: string;
  interview_scheduled_at: string;
  interview_location: string | null;
  candidate_phone: string | null;
  account: string | null;
}

interface TaskDeadline {
  id: string;
  title: string;
  deadline: string;
  severity: string;
  status: string;
  owner_email: string;
}

interface DayEvents {
  interviews: InterviewEvent[];
  tasks: TaskDeadline[];
}

export default function RecruitCalendarPage() {
  const [email, setEmail] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth()); // 0-indexed
  const [interviews, setInterviews] = useState<InterviewEvent[]>([]);
  const [tasks, setTasks] = useState<TaskDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const e = sessionStorage.getItem("moyu_current_user");
    if (!e) {
      window.location.href = "/";
      return;
    }
    setEmail(e);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch both data sources in parallel
      const [ivRes, taskRes] = await Promise.all([
        fetch(`/api/recruit/calendar-data?type=interviews&year=${year}&month=${month + 1}`, { cache: "no-store" }),
        fetch(`/api/recruit/calendar-data?type=tasks&year=${year}&month=${month + 1}`, { cache: "no-store" }),
      ]);
      const ivData = await ivRes.json();
      const taskData = await taskRes.json();
      if (ivData.ok) setInterviews(ivData.interviews || []);
      if (taskData.ok) setTasks(taskData.tasks || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();

  // Group events by day key (YYYY-MM-DD)
  const dayMap: Record<string, DayEvents> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    dayMap[key] = { interviews: [], tasks: [] };
  }
  for (const iv of interviews) {
    const dt = new Date(iv.interview_scheduled_at);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    if (dayMap[key]) dayMap[key].interviews.push(iv);
  }
  for (const t of tasks) {
    if (!t.deadline) continue;
    const dt = new Date(t.deadline);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    if (dayMap[key]) dayMap[key].tasks.push(t);
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
    setExpandedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
    setExpandedDay(null);
  };

  const monthLabel = `${year} 年 ${month + 1} 月`;
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];

  // Build grid cells
  const cells: Array<{ day: number; key: string } | null> = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, key });
  }

  // Expanded day detail
  const expandedEvents = expandedDay ? dayMap[expandedDay] : null;
  const expandedDate = expandedDay
    ? new Date(expandedDay + "T00:00:00+08:00").toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "long" })
    : "";

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <style>{`
        @media (max-width: 768px) {
          .cal-header { flex-wrap: wrap !important; }
          .cal-main { padding-bottom: 80px !important; }
          .cal-day-cell { min-height: 56px !important; padding: 4px !important; }
          .cal-day-cell span { font-size: 9px !important; }
        }
      `}</style>
      {/* Header */}
      <div className="cal-header" style={S.header}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>📅 招聘行事曆</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{email}</div>
        </div>
        <div style={{ flex: 1 }} />
        <a href="/recruit" style={S.linkBtn}>← 新訓</a>
        <a href="/recruit/104" style={S.linkBtn}>📞 104</a>
        <a href="/today" style={S.linkBtn}>📋 今日</a>
      </div>

      <div className="cal-main" style={{ maxWidth: 960, margin: "0 auto", padding: "20px 14px" }}>
        {/* Month navigation */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button style={S.navBtn} onClick={prevMonth}>&larr; 上月</button>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{monthLabel}</div>
          <button style={S.navBtn} onClick={nextMonth}>下月 &rarr;</button>
        </div>

        {loading && <div style={{ textAlign: "center", padding: 20, color: "#94a3b8" }}>載入中...</div>}

        {/* Calendar grid */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          {/* Weekday header */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {weekDays.map((wd, i) => (
              <div key={wd} style={{
                padding: "10px 4px", textAlign: "center", fontSize: 13, fontWeight: 700,
                color: i === 0 ? "#dc2626" : i === 6 ? "#2563eb" : "#475569",
                background: "#f1f5f9", borderBottom: "1px solid #e2e8f0",
              }}>{wd}</div>
            ))}
          </div>
          {/* Day cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {cells.map((cell, idx) => {
              if (!cell) {
                return <div key={`empty-${idx}`} style={S.emptyCell} />;
              }
              const ev = dayMap[cell.key];
              const isToday = cell.key === todayKey;
              const isExpanded = cell.key === expandedDay;
              const hasIv = ev.interviews.length > 0;
              const hasTk = ev.tasks.length > 0;
              const hasOverdue = ev.tasks.some(t => t.status === "pending" && new Date(t.deadline) < today);
              return (
                <div
                  key={cell.key}
                  style={{
                    ...S.dayCell,
                    background: isExpanded ? "#eff6ff" : isToday ? "#fefce8" : "#fff",
                    border: isToday ? "2px solid #eab308" : "1px solid #f1f5f9",
                    cursor: (hasIv || hasTk) ? "pointer" : "default",
                  }}
                  onClick={() => (hasIv || hasTk) ? setExpandedDay(isExpanded ? null : cell.key) : undefined}
                >
                  <div style={{ fontSize: 13, fontWeight: isToday ? 900 : 500, color: isToday ? "#854d0e" : "#334155" }}>
                    {cell.day}
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                    {hasIv && (
                      <span style={S.badgeGreen}>{ev.interviews.length} 面試</span>
                    )}
                    {hasTk && (
                      <span style={hasOverdue ? S.badgeRed : S.badgeBlue}>{ev.tasks.length} 任務</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expanded day detail */}
        {expandedDay && expandedEvents && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 16, marginTop: 16 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 800 }}>{expandedDate}</h3>

            {expandedEvents.interviews.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", marginBottom: 6 }}>面試 ({expandedEvents.interviews.length})</div>
                {expandedEvents.interviews.map(iv => {
                  const time = new Date(iv.interview_scheduled_at).toLocaleTimeString("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={iv.id} style={{ padding: "8px 0", borderTop: "1px solid #f1f5f9", display: "flex", gap: 12, alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#16a34a", width: 60 }}>{time}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{iv.candidate_name}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {iv.interview_location || "未定"} {iv.candidate_phone ? `· ${iv.candidate_phone}` : ""}
                          {iv.account ? ` · ${iv.account}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {expandedEvents.tasks.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", marginBottom: 6 }}>任務截止 ({expandedEvents.tasks.length})</div>
                {expandedEvents.tasks.map(t => {
                  const isOverdue = t.status === "pending" && new Date(t.deadline) < today;
                  const sevColor = t.severity === "critical" ? "#dc2626" : t.severity === "high" ? "#f59e0b" : "#64748b";
                  return (
                    <div key={t.id} style={{ padding: "8px 0", borderTop: "1px solid #f1f5f9", display: "flex", gap: 12, alignItems: "center" }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                        background: isOverdue ? "#fef2f2" : "#f0f9ff",
                        color: isOverdue ? "#dc2626" : sevColor,
                      }}>
                        {isOverdue ? "逾期" : t.severity}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isOverdue ? "#dc2626" : "#1e293b" }}>{t.title}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{t.owner_email} · {t.status}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div style={{ display: "flex", gap: 16, justifyContent: "center", padding: "20px 0 40px", fontSize: 12, color: "#94a3b8" }}>
          <span><span style={{ ...S.badgeGreen, marginRight: 4 }}>N</span> 面試</span>
          <span><span style={{ ...S.badgeBlue, marginRight: 4 }}>N</span> 任務截止</span>
          <span><span style={{ ...S.badgeRed, marginRight: 4 }}>N</span> 逾期任務</span>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  header: {
    background: "#0f172a", padding: "12px 16px", color: "#fff",
    display: "flex", alignItems: "center", gap: 10,
    position: "sticky", top: 0, zIndex: 10,
  },
  linkBtn: {
    padding: "4px 10px", borderRadius: 6, fontSize: 11,
    color: "#cbd5e1", textDecoration: "none",
    border: "1px solid rgba(255,255,255,0.15)",
  },
  navBtn: {
    padding: "6px 14px", borderRadius: 8, border: "1px solid #cbd5e1",
    background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  emptyCell: {
    minHeight: 72, borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9",
    background: "#fafafa",
  },
  dayCell: {
    minHeight: 72, padding: "6px 8px", borderRight: "1px solid #f1f5f9",
    borderBottom: "1px solid #f1f5f9", transition: "background 0.15s",
  },
  badgeGreen: {
    display: "inline-block", fontSize: 10, fontWeight: 700, padding: "1px 5px",
    borderRadius: 4, background: "#dcfce7", color: "#16a34a",
  },
  badgeBlue: {
    display: "inline-block", fontSize: 10, fontWeight: 700, padding: "1px 5px",
    borderRadius: 4, background: "#dbeafe", color: "#2563eb",
  },
  badgeRed: {
    display: "inline-block", fontSize: 10, fontWeight: 700, padding: "1px 5px",
    borderRadius: 4, background: "#fef2f2", color: "#dc2626",
  },
};
