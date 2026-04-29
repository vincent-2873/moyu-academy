"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Calendar — 養成日曆元件
 *
 * 顯示員工 14 天養成路徑 with 月曆 view
 * - 月份切換
 * - 每天 cell 顯示 module 數 + 印章 + 完成狀態
 * - current day 朱紅 highlight
 * - 點 cell 顯示該天詳細任務
 *
 * Props:
 *   modules: training_modules with day_offset
 *   progress: training_user_progress
 *   stamps: training_stamps
 *   startDate: assignment.start_date (Day 0 = 報到日)
 *   currentDay: assignment.current_day
 *   onDayClick?: (day: number) => void
 */

type Module = { id: string; day_offset: number; sequence: number; module_type: string; title: string; description?: string | null; duration_min?: number | null; reward?: any };
type Progress = { module_id: string; status: string };
type Stamp = { id: string; stamp_name: string; rarity: string; earned_at: string; source_module_id?: string | null };

interface Props {
  modules: Module[];
  progress: Progress[];
  stamps: Stamp[];
  startDate: string;          // YYYY-MM-DD (Day 0)
  currentDay: number;
  onDayClick?: (day: number, dateStr: string) => void;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export default function Calendar({ modules, progress, stamps, startDate, currentDay, onDayClick }: Props) {
  const [viewYear, setViewYear] = useState(() => new Date(startDate).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date(startDate).getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(currentDay);

  // 把 modules group by day_offset
  const modulesByDay = useMemo(() => {
    const m: Record<number, Module[]> = {};
    modules.forEach(mod => {
      if (!m[mod.day_offset]) m[mod.day_offset] = [];
      m[mod.day_offset].push(mod);
    });
    return m;
  }, [modules]);

  const progressMap = useMemo(() => {
    const map: Record<string, string> = {};
    progress.forEach(p => map[p.module_id] = p.status);
    return map;
  }, [progress]);

  // start date Day 0 對應日期
  const startD = new Date(startDate + "T00:00:00");

  // 把 day_offset 轉成 Date
  function dayToDate(day: number) {
    const d = new Date(startD);
    d.setDate(d.getDate() + day);
    return d;
  }

  // 把 Date 轉成 day_offset
  function dateToDay(date: Date): number {
    const days = Math.floor((date.getTime() - startD.getTime()) / 86400000);
    return days;
  }

  const monthFirstDay = new Date(viewYear, viewMonth, 1);
  const monthLastDay = new Date(viewYear, viewMonth + 1, 0);
  const daysInMonth = monthLastDay.getDate();
  const startWeekday = monthFirstDay.getDay();

  // 構建 cells: 前面填空 + 1 ~ daysInMonth
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function changeMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m += 12; y -= 1; }
    if (m > 11) { m -= 12; y += 1; }
    setViewMonth(m); setViewYear(y);
  }

  function jumpToToday() {
    const today = new Date();
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDay(currentDay);
  }

  const monthName = `${viewYear} 年 ${viewMonth + 1} 月`;
  const selectedModules = selectedDay != null ? (modulesByDay[selectedDay] || []) : [];
  const selectedDateStr = selectedDay != null ? dayToDate(selectedDay).toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "long" }) : "";

  return (
    <div style={{ background: "var(--bg-paper)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6, padding: 24 }}>
      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <motion.button
          whileHover={{ x: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => changeMonth(-1)}
          style={navBtnStyle}
        >
          ‹
        </motion.button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 20, color: "var(--ink-deep)", letterSpacing: 4 }}>
            {monthName}
          </div>
          <button onClick={jumpToToday} style={{ background: "transparent", border: "none", color: "var(--accent-red)", fontSize: 11, cursor: "pointer", marginTop: 2, letterSpacing: 1 }}>
            回今日 D{currentDay}
          </button>
        </div>
        <motion.button
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => changeMonth(1)}
          style={navBtnStyle}
        >
          ›
        </motion.button>
      </div>

      {/* Weekday header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 10, color: "var(--ink-mid)", letterSpacing: 2, padding: "6px 0", fontWeight: 600 }}>
            {w}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((d, i) => {
          if (d == null) return <div key={i} />;
          const cellDate = new Date(viewYear, viewMonth, d);
          const dayOffset = dateToDay(cellDate);
          const todayMods = modulesByDay[dayOffset] || [];
          const inRange = dayOffset >= 0 && dayOffset < 30;
          const isCurrent = dayOffset === currentDay;
          const isPast = dayOffset < currentDay && inRange;
          const isFuture = dayOffset > currentDay && inRange;
          const isSelected = selectedDay === dayOffset;
          const completedCount = todayMods.filter(m => progressMap[m.id] === "completed").length;
          const totalCount = todayMods.length;
          const dayStamps = stamps.filter(s => todayMods.some(m => m.id === s.source_module_id));

          return (
            <motion.button
              key={i}
              whileHover={{ scale: inRange ? 1.05 : 1 }}
              whileTap={{ scale: inRange ? 0.95 : 1 }}
              onClick={() => {
                if (inRange) {
                  setSelectedDay(dayOffset);
                  onDayClick?.(dayOffset, cellDate.toISOString().slice(0, 10));
                }
              }}
              disabled={!inRange}
              style={{
                aspectRatio: "1 / 1",
                padding: 6,
                borderRadius: 4,
                border: "1px solid",
                borderColor: isSelected ? "var(--accent-red)" : isCurrent ? "var(--accent-red)" : "var(--border-soft, rgba(26,26,26,0.10))",
                background: isCurrent ? "var(--accent-red)" : isSelected ? "var(--bg-elev)" : "var(--bg-paper)",
                color: isCurrent ? "var(--bg-paper)" : isFuture ? "var(--ink-mid)" : "var(--ink-deep)",
                cursor: inRange ? "pointer" : "not-allowed",
                opacity: inRange ? 1 : 0.4,
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                fontFamily: "var(--font-noto-serif-tc)",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>{d}</span>
              {inRange && (
                <span style={{ fontSize: 9, opacity: isCurrent ? 0.9 : 0.6, marginTop: 1 }}>
                  D{dayOffset}
                </span>
              )}
              {totalCount > 0 && (
                <div style={{ display: "flex", gap: 2, marginTop: "auto", padding: 2 }}>
                  {Array.from({ length: Math.min(totalCount, 4) }).map((_, idx) => (
                    <div
                      key={idx}
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: idx < completedCount
                          ? (isCurrent ? "var(--bg-paper)" : "var(--accent-red)")
                          : (isCurrent ? "rgba(247,241,227,0.3)" : "var(--border-soft, rgba(26,26,26,0.10))"),
                      }}
                    />
                  ))}
                </div>
              )}
              {dayStamps.length > 0 && (
                <span style={{ position: "absolute", top: -2, right: -2, fontSize: 12, color: "var(--accent-red)" }}>●</span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Selected day detail */}
      <AnimatePresence mode="wait">
        {selectedDay != null && selectedModules.length > 0 && (
          <motion.div
            key={selectedDay}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border-soft, rgba(26,26,26,0.10))" }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: "var(--accent-red)", letterSpacing: 2, fontWeight: 600 }}>
                D{selectedDay} · {selectedModules.length} 任務
              </span>
              <span style={{ fontSize: 11, color: "var(--ink-mid)" }}>{selectedDateStr}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {selectedModules.map(m => {
                const status = progressMap[m.id] || "pending";
                const completed = status === "completed";
                return (
                  <div key={m.id} style={{ padding: 10, borderRadius: 4, background: completed ? "var(--bg-elev)" : "transparent", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 9, color: "var(--ink-mid)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>{m.module_type}</span>
                      {m.duration_min && <span style={{ fontSize: 10, color: "var(--ink-mid)" }}>· {m.duration_min} 分</span>}
                      {completed && <span style={{ fontSize: 10, color: "var(--accent-red)", marginLeft: "auto" }}>● 完</span>}
                    </div>
                    <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 13, color: "var(--ink-deep)" }}>{m.title}</div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 4,
  background: "transparent",
  border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
  color: "var(--ink-deep)",
  fontSize: 18,
  fontFamily: "var(--font-noto-serif-tc)",
  cursor: "pointer",
};
