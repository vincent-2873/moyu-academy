"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { modules, type TrainingModule } from "@/data/modules";

// ---------- Types ----------

interface DailyTargets {
  callTarget: number;
  inviteTarget: number;
  attendanceTarget: number;
}

interface WeekConfig {
  weekNumber: number;
  label: string;
  mode: string;
}

interface CalendarDashboardProps {
  userEmail: string;
  currentDay: number; // 1-22
  startDate: string; // ISO date string
  completedTasks: Record<string, boolean>;
  onTaskToggle: (taskId: string) => void;
}

// ---------- Mentorship schedule fallback ----------

let mentorshipSchedule: {
  dailyTargets: Record<number, DailyTargets>;
  weekConfigs: Record<number, WeekConfig>;
  mentorActions: Record<number, string>;
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mentorshipSchedule = require("@/data/mentorship-schedule");
} catch {
  // file doesn't exist yet — use fallback data
}

// Fallback data when mentorship-schedule is not available
const DEFAULT_WEEK_CONFIGS: Record<number, WeekConfig> = {
  1: { weekNumber: 1, label: "教練模式", mode: "Coach" },
  2: { weekNumber: 2, label: "標竿模式", mode: "Model" },
  3: { weekNumber: 3, label: "試翼模式", mode: "Trial" },
  4: { weekNumber: 4, label: "獨立模式", mode: "Solo" },
};

function getWeekConfig(trainingDay: number): WeekConfig {
  if (mentorshipSchedule?.weekConfigs) {
    const weekNum = Math.ceil(trainingDay / 5);
    return mentorshipSchedule.weekConfigs[weekNum] ?? DEFAULT_WEEK_CONFIGS[weekNum] ?? DEFAULT_WEEK_CONFIGS[1];
  }
  const weekNum = Math.ceil(trainingDay / 5);
  return DEFAULT_WEEK_CONFIGS[weekNum] ?? DEFAULT_WEEK_CONFIGS[1];
}

function getDailyTargets(trainingDay: number): DailyTargets {
  if (mentorshipSchedule?.dailyTargets?.[trainingDay]) {
    return mentorshipSchedule.dailyTargets[trainingDay];
  }
  // Progressive fallback targets
  if (trainingDay <= 3) return { callTarget: 40, inviteTarget: 0, attendanceTarget: 0 };
  if (trainingDay <= 7) return { callTarget: 60, inviteTarget: 1, attendanceTarget: 0 };
  if (trainingDay <= 14) return { callTarget: 80, inviteTarget: 1, attendanceTarget: 0 };
  return { callTarget: 100, inviteTarget: 2, attendanceTarget: 1 };
}

function getMentorAction(trainingDay: number): string {
  if (mentorshipSchedule?.mentorActions?.[trainingDay]) {
    return mentorshipSchedule.mentorActions[trainingDay];
  }
  const weekNum = Math.ceil(trainingDay / 5);
  switch (weekNum) {
    case 1: return "即時旁聽 + 即時回饋：針對開發話術語氣進行指導";
    case 2: return "2+1 回饋：針對邀約話術開口契機進行指導";
    case 3: return "抽聽回饋：針對異議處理技巧進行指導";
    case 4: return "週覆盤：獨立開發成效檢視與改善建議";
    default: return "持續追蹤與回饋";
  }
}

// ---------- Date Helpers ----------

function parseISO(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

/** Build a map: training day number -> calendar Date (skipping weekends) */
function buildTrainingDayMap(startDate: Date, totalDays: number): Map<number, Date> {
  const map = new Map<number, Date>();
  let current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  let dayCount = 0;

  // Ensure startDate itself is a weekday; if not, advance
  while (!isWeekday(current)) {
    current = addDays(current, 1);
  }

  while (dayCount < totalDays) {
    if (isWeekday(current)) {
      dayCount++;
      map.set(dayCount, new Date(current));
    }
    current = addDays(current, 1);
  }
  return map;
}

/** Reverse: given a calendar date, find its training day number (or null) */
function getTrainingDayForDate(date: Date, dayMap: Map<number, Date>): number | null {
  for (const [dayNum, d] of dayMap) {
    if (isSameDay(date, d)) return dayNum;
  }
  return null;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  // 0=Sun, 1=Mon ... 6=Sat -> convert to Mon-based: 0=Mon, 6=Sun
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function getModuleForDay(trainingDay: number): TrainingModule | undefined {
  return modules.find((m) => m.day === trainingDay);
}

// ---------- Notification Bell ----------

function NotificationBell({
  overdueItems,
  todayTasks,
}: {
  overdueItems: { dayNum: number; taskTitle: string }[];
  todayTasks: { id: string; title: string; done: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const remainingToday = todayTasks.filter((t) => !t.done);
  const count = overdueItems.length + remainingToday.length;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "8px 12px",
          cursor: "pointer",
          fontSize: 18,
          color: "var(--text)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>🔔</span>
        {count > 0 && (
          <span
            style={{
              background: "var(--red)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              borderRadius: "50%",
              width: 20,
              height: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "absolute",
              top: -6,
              right: -6,
            }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 90 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              width: 320,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 16,
              zIndex: 100,
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
              maxHeight: 400,
              overflowY: "auto",
            }}
          >
            {overdueItems.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--red)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 8,
                  }}
                >
                  逾期未完成
                </div>
                {overdueItems.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--red)",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: "var(--text2)", fontSize: 13 }}>
                      Day {item.dayNum}
                    </span>
                    <span style={{ color: "var(--text)", fontSize: 13, flex: 1 }}>
                      {item.taskTitle}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {remainingToday.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--gold)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 8,
                  }}
                >
                  今日待辦
                </div>
                {remainingToday.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                      fontSize: 13,
                      color: "var(--text)",
                    }}
                  >
                    ☐ {task.title}
                  </div>
                ))}
              </div>
            )}

            {count === 0 && (
              <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: 16 }}>
                沒有待辦事項 🎉
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Main Component ----------

export default function CalendarDashboard({
  userEmail,
  currentDay,
  startDate,
  completedTasks,
  onTaskToggle,
}: CalendarDashboardProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const start = useMemo(() => parseISO(startDate), [startDate]);
  const TOTAL_TRAINING_DAYS = 22;

  const dayMap = useMemo(
    () => buildTrainingDayMap(start, TOTAL_TRAINING_DAYS),
    [start],
  );

  // Reverse map: "YYYY-MM-DD" -> training day number
  const dateToTrainingDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const [dayNum, d] of dayMap) {
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      m.set(key, dayNum);
    }
    return m;
  }, [dayMap]);

  const dateKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  // Determine the training day for selected date
  const selectedTrainingDay = useMemo(
    () => getTrainingDayForDate(selectedDate, dayMap),
    [selectedDate, dayMap],
  );

  // Navigate months
  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  // Status for a training day
  type DayStatus = "completed" | "in-progress" | "overdue" | "upcoming";

  const getDayStatus = useCallback(
    (trainingDay: number): DayStatus => {
      if (trainingDay < currentDay) {
        // Check if all tasks are done
        const mod = getModuleForDay(trainingDay);
        if (mod) {
          const allDone = mod.tasks.every((t) => completedTasks[`day${trainingDay}-${t.id}`]);
          return allDone ? "completed" : "overdue";
        }
        return "completed";
      }
      if (trainingDay === currentDay) return "in-progress";
      return "upcoming";
    },
    [currentDay, completedTasks],
  );

  const statusColor: Record<DayStatus, string> = {
    completed: "var(--green)",
    "in-progress": "var(--gold)",
    overdue: "var(--red)",
    upcoming: "var(--text3)",
  };

  // Build overdue items for notification
  const overdueItems = useMemo(() => {
    const items: { dayNum: number; taskTitle: string }[] = [];
    for (let d = 1; d < currentDay; d++) {
      const mod = getModuleForDay(d);
      if (!mod) continue;
      for (const task of mod.tasks) {
        if (!completedTasks[`day${d}-${task.id}`]) {
          items.push({ dayNum: d, taskTitle: task.title });
        }
      }
    }
    return items;
  }, [currentDay, completedTasks]);

  // Today's tasks
  const todayModule = getModuleForDay(currentDay);
  const todayTasks = useMemo(() => {
    if (!todayModule) return [];
    return todayModule.tasks.map((t) => ({
      id: `day${currentDay}-${t.id}`,
      title: t.title,
      done: !!completedTasks[`day${currentDay}-${t.id}`],
    }));
  }, [todayModule, currentDay, completedTasks]);

  // Calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const weekDays = ["一", "二", "三", "四", "五", "六", "日"];
  const monthNames = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月",
  ];

  // Build calendar cells
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(viewYear, viewMonth, d));
  }
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  // Detail panel data
  const detailModule = selectedTrainingDay ? getModuleForDay(selectedTrainingDay) : null;
  const detailWeekConfig = selectedTrainingDay ? getWeekConfig(selectedTrainingDay) : null;
  const detailTargets = selectedTrainingDay ? getDailyTargets(selectedTrainingDay) : null;
  const detailMentorAction = selectedTrainingDay ? getMentorAction(selectedTrainingDay) : null;
  const detailStatus = selectedTrainingDay ? getDayStatus(selectedTrainingDay) : null;

  // Task completion for detail panel
  const detailTasks = useMemo(() => {
    if (!detailModule || !selectedTrainingDay) return [];
    return detailModule.tasks.map((t) => ({
      ...t,
      taskId: `day${selectedTrainingDay}-${t.id}`,
      done: !!completedTasks[`day${selectedTrainingDay}-${t.id}`],
    }));
  }, [detailModule, selectedTrainingDay, completedTasks]);

  const completedCount = detailTasks.filter((t) => t.done).length;
  const totalCount = detailTasks.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Overall training progress
  const overallProgress = Math.round((currentDay / TOTAL_TRAINING_DAYS) * 100);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        width: "100%",
        minHeight: "100%",
      }}
    >
      {/* Top bar with notification */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <h2 style={{ color: "var(--text)", fontSize: 20, fontWeight: 700, margin: 0 }}>
            訓練日曆
          </h2>
          <p style={{ color: "var(--text3)", fontSize: 13, margin: "4px 0 0" }}>
            第 {currentDay} 天 / {TOTAL_TRAINING_DAYS} 天 · 整體進度 {overallProgress}%
          </p>
        </div>
        <NotificationBell overdueItems={overdueItems} todayTasks={todayTasks} />
      </div>

      {/* Main layout: Calendar + Detail */}
      <div
        style={{
          display: "flex",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        {/* Calendar */}
        <div
          style={{
            flex: "1 1 400px",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 24,
            minWidth: 0,
          }}
        >
          {/* Month navigation */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <button
              onClick={prevMonth}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
                cursor: "pointer",
                padding: "6px 12px",
                fontSize: 16,
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              ◀
            </button>
            <span style={{ color: "var(--text)", fontSize: 18, fontWeight: 700 }}>
              {viewYear}年{monthNames[viewMonth]}
            </span>
            <button
              onClick={nextMonth}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
                cursor: "pointer",
                padding: "6px 12px",
                fontSize: 16,
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              ▶
            </button>
          </div>

          {/* Week day headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 4,
              marginBottom: 8,
            }}
          >
            {weekDays.map((wd, i) => (
              <div
                key={wd}
                style={{
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  color: i >= 5 ? "var(--text3)" : "var(--text2)",
                  padding: "4px 0",
                  letterSpacing: 1,
                }}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 4,
            }}
          >
            {cells.map((cellDate, idx) => {
              if (!cellDate) {
                return <div key={`empty-${idx}`} style={{ aspectRatio: "1", minHeight: 48 }} />;
              }

              const trainingDay = dateToTrainingDay.get(dateKey(cellDate)) ?? null;
              const isToday = isSameDay(cellDate, today);
              const isSelected = isSameDay(cellDate, selectedDate);
              const status = trainingDay ? getDayStatus(trainingDay) : null;
              const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(cellDate)}
                  style={{
                    aspectRatio: "1",
                    minHeight: 48,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    background: isSelected
                      ? "rgba(139, 92, 246, 0.15)"
                      : isToday
                        ? "rgba(139, 92, 246, 0.06)"
                        : "transparent",
                    border: isToday
                      ? "2px solid var(--accent)"
                      : isSelected
                        ? "2px solid rgba(139, 92, 246, 0.4)"
                        : "1px solid transparent",
                    borderRadius: 10,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    padding: 2,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !isToday) {
                      e.currentTarget.style.background = "var(--bg2)";
                      e.currentTarget.style.border = "1px solid var(--border)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !isToday) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.border = "1px solid transparent";
                    }
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: isToday ? 700 : 500,
                      color: isWeekend ? "var(--text3)" : isToday ? "var(--accent)" : "var(--text)",
                    }}
                  >
                    {cellDate.getDate()}
                  </span>
                  {trainingDay && (
                    <>
                      <span
                        style={{
                          fontSize: 9,
                          color: "var(--text3)",
                          lineHeight: 1,
                        }}
                      >
                        D{trainingDay}
                      </span>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: status ? statusColor[status] : "var(--text3)",
                        }}
                      />
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 16,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {[
              { label: "已完成", color: "var(--green)" },
              { label: "進行中", color: "var(--gold)" },
              { label: "逾期", color: "var(--red)" },
              { label: "未來", color: "var(--text3)" },
            ].map((item) => (
              <div
                key={item.label}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: item.color,
                  }}
                />
                <span style={{ fontSize: 11, color: "var(--text3)" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        <div
          style={{
            flex: "1 1 340px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {selectedTrainingDay && detailModule ? (
            <>
              {/* Header card */}
              <div
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                  padding: 24,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <h3
                      style={{
                        color: "var(--text)",
                        fontSize: 18,
                        fontWeight: 700,
                        margin: 0,
                      }}
                    >
                      Day {selectedTrainingDay} — {detailModule.title}
                    </h3>
                    {detailWeekConfig && (
                      <p
                        style={{
                          color: "var(--text2)",
                          fontSize: 13,
                          margin: "6px 0 0",
                        }}
                      >
                        Week {detailWeekConfig.weekNumber} · {detailWeekConfig.label} ({detailWeekConfig.mode})
                      </p>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 20,
                      background:
                        detailStatus === "completed"
                          ? "rgba(34,197,94,0.15)"
                          : detailStatus === "in-progress"
                            ? "rgba(234,179,8,0.15)"
                            : detailStatus === "overdue"
                              ? "rgba(239,68,68,0.15)"
                              : "rgba(148,163,184,0.15)",
                      color:
                        detailStatus === "completed"
                          ? "var(--green)"
                          : detailStatus === "in-progress"
                            ? "var(--gold)"
                            : detailStatus === "overdue"
                              ? "var(--red)"
                              : "var(--text3)",
                    }}
                  >
                    {detailStatus === "completed"
                      ? "已完成"
                      : detailStatus === "in-progress"
                        ? "進行中"
                        : detailStatus === "overdue"
                          ? "逾期"
                          : "未開始"}
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      color: "var(--text3)",
                      marginBottom: 6,
                    }}
                  >
                    <span>任務完成度</span>
                    <span>
                      {completedCount}/{totalCount} ({progress}%)
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: 6,
                      background: "var(--bg2)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${progress}%`,
                        height: "100%",
                        background:
                          progress === 100
                            ? "var(--green)"
                            : "linear-gradient(90deg, var(--accent), var(--teal))",
                        borderRadius: 3,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* KPI Targets */}
              {detailTargets && (
                <div
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: 20,
                  }}
                >
                  <h4
                    style={{
                      color: "var(--text)",
                      fontSize: 14,
                      fontWeight: 700,
                      margin: "0 0 12px",
                    }}
                  >
                    📊 今日 KPI 目標
                  </h4>
                  <div style={{ display: "flex", gap: 10 }}>
                    {[
                      {
                        label: "通次",
                        value: detailTargets.callTarget,
                        color: "var(--accent)",
                        bg: "rgba(139, 92, 246, 0.1)",
                      },
                      {
                        label: "邀約",
                        value: detailTargets.inviteTarget,
                        color: "var(--teal)",
                        bg: "rgba(20, 184, 166, 0.1)",
                      },
                      {
                        label: "出席",
                        value: detailTargets.attendanceTarget,
                        color: "var(--gold)",
                        bg: "rgba(234, 179, 8, 0.1)",
                      },
                    ].map((kpi) => (
                      <div
                        key={kpi.label}
                        style={{
                          flex: 1,
                          background: kpi.bg,
                          borderRadius: 12,
                          padding: "14px 12px",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 22,
                            fontWeight: 800,
                            color: kpi.color,
                          }}
                        >
                          {kpi.value}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text3)",
                            marginTop: 4,
                          }}
                        >
                          {kpi.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Task Checklist */}
              {detailTasks.length > 0 && (
                <div
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: 20,
                  }}
                >
                  <h4
                    style={{
                      color: "var(--text)",
                      fontSize: 14,
                      fontWeight: 700,
                      margin: "0 0 12px",
                    }}
                  >
                    ✅ 任務清單
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {detailTasks.map((task) => (
                      <button
                        key={task.taskId}
                        onClick={() => onTaskToggle(task.taskId)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          background: task.done ? "rgba(34,197,94,0.06)" : "transparent",
                          border: "1px solid",
                          borderColor: task.done ? "rgba(34,197,94,0.2)" : "var(--border)",
                          borderRadius: 10,
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 0.15s ease",
                          width: "100%",
                        }}
                        onMouseEnter={(e) => {
                          if (!task.done) e.currentTarget.style.background = "var(--bg2)";
                        }}
                        onMouseLeave={(e) => {
                          if (!task.done) e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <span
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 6,
                            border: task.done
                              ? "2px solid var(--green)"
                              : "2px solid var(--border)",
                            background: task.done ? "var(--green)" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            color: "#fff",
                            flexShrink: 0,
                            transition: "all 0.15s ease",
                          }}
                        >
                          {task.done ? "✓" : ""}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            color: task.done ? "var(--text3)" : "var(--text)",
                            textDecoration: task.done ? "line-through" : "none",
                            flex: 1,
                          }}
                        >
                          {task.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mentor Action */}
              {detailMentorAction && (
                <div
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: 20,
                  }}
                >
                  <h4
                    style={{
                      color: "var(--text)",
                      fontSize: 14,
                      fontWeight: 700,
                      margin: "0 0 10px",
                    }}
                  >
                    🎯 師徒動作
                  </h4>
                  <p
                    style={{
                      color: "var(--text2)",
                      fontSize: 13,
                      lineHeight: 1.7,
                      margin: 0,
                      padding: "10px 14px",
                      background: "var(--bg2)",
                      borderRadius: 10,
                      borderLeft: "3px solid var(--accent)",
                    }}
                  >
                    {detailMentorAction}
                  </p>
                </div>
              )}
            </>
          ) : (
            /* No training day selected */
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: 40,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
              <h3
                style={{
                  color: "var(--text)",
                  fontSize: 16,
                  fontWeight: 600,
                  margin: "0 0 8px",
                }}
              >
                {selectedDate
                  ? `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日`
                  : "選擇日期"}
              </h3>
              <p style={{ color: "var(--text3)", fontSize: 13, margin: 0 }}>
                {selectedDate && (selectedDate.getDay() === 0 || selectedDate.getDay() === 6)
                  ? "週末休息日，沒有訓練安排"
                  : "此日期沒有對應的訓練日"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
