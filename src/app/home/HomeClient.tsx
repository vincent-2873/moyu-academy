"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Stamp } from "@/components/wabi/Stamp";
import Calendar from "@/components/Calendar";
import StreakScroll from "@/components/wabi/StreakScroll";

const STAGE_NAMES: Record<string, string> = {
  beginner: "研墨者",
  intermediate: "執筆者",
  advanced: "點墨者",
  master: "執印者",
};

const TYPE_ICON: Record<string, string> = {
  video: "▶",
  reading: "📖",
  quiz: "✎",
  sparring: "🗣",
  task: "▤",
  reflection: "✿",
  live_session: "◉",
};

export default function HomeClient() {
  const [email, setEmail] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [todayModules, setTodayModules] = useState<any[]>([]);
  const [stamps, setStamps] = useState<any[]>([]);
  const [allModules, setAllModules] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [assignment, setAssignment] = useState<any>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [showStamp, setShowStamp] = useState(false);
  const [greeting, setGreeting] = useState("早安");
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const e = sessionStorage.getItem("moyu_current_user")
      || sessionStorage.getItem("admin_email")
      || localStorage.getItem("admin_email");
    setEmail(e);
  }, []);

  useEffect(() => {
    if (!email) { setLoading(false); return; }
    fetch(`/api/me/training?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => {
        setUser(d.user);
        const cd = d.assignment?.current_day ?? 0;
        const today = (d.modules || []).filter((m: any) => m.day_offset === cd);
        setTodayModules(today);
        setStamps(d.stamps || []);
        setAllModules(d.modules || []);
        setProgress(d.progress || []);
        setAssignment(d.assignment);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const hour = new Date().getHours();
    setGreeting(hour < 6 ? "凌晨" : hour < 12 ? "早安" : hour < 18 ? "午安" : "晚安");

    const todayKey = `checkin_${email}_${new Date().toISOString().slice(0, 10)}`;
    setCheckedIn(!!localStorage.getItem(todayKey));

    // 算連續簽到天數
    let count = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = `checkin_${email}_${d.toISOString().slice(0, 10)}`;
      if (localStorage.getItem(k)) count++;
      else if (i > 0) break; // 今天沒簽不算斷,但昨天沒簽就斷
    }
    setStreak(count);
  }, [email]);

  function checkin() {
    if (!email || checkedIn) return;
    const todayKey = `checkin_${email}_${new Date().toISOString().slice(0, 10)}`;
    localStorage.setItem(todayKey, new Date().toISOString());
    setShowStamp(true);
    setTimeout(() => { setCheckedIn(true); setShowStamp(false); }, 1400);
  }

  if (loading) return <div style={pageStyle}><Loader /></div>;

  if (!email) {
    return (
      <div style={pageStyle}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", padding: 80 }}>
          <h1 style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 48, color: "var(--ink-deep)", letterSpacing: 6 }}>未 登 入</h1>
          <a href="/" style={{ color: "var(--accent-red)", marginTop: 20, display: "inline-block" }}>回登入頁</a>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Hero — kzero 風大字 + scroll fade */}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "80px 32px 40px" }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, marginBottom: 12, fontWeight: 600 }}
        >
          MOYU · HOME · {new Date().toLocaleDateString("zh-TW", { weekday: "long", month: "long", day: "numeric" })}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.0, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{
            fontFamily: "var(--font-noto-serif-tc)",
            fontSize: "clamp(48px, 8vw, 96px)",
            fontWeight: 600,
            color: "var(--ink-deep)",
            letterSpacing: 4,
            lineHeight: 1.05,
            marginBottom: 16,
          }}
        >
          {greeting},{user?.name || "夥伴"}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{ fontSize: 14, color: "var(--ink-mid)", marginBottom: 48, letterSpacing: 1 }}
        >
          <span style={{ fontFamily: "var(--font-noto-serif-tc)", color: "var(--accent-red)", fontWeight: 600, marginRight: 12 }}>
            {STAGE_NAMES[user?.stage] || "研墨者"}
          </span>
          {user?.brand || "墨宇"} · {user?.email}
        </motion.div>

        <KintsugiLine delay={0.5} />
      </div>

      {/* 簽到 + 狀態 */}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 32px" }}>
        <SectionLabel delay={0.7}>儀式 · ARRIVAL</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 64 }}>
          <Card delay={0.8}>
            <Label>今日簽到</Label>
            <AnimatePresence mode="wait">
              {showStamp ? (
                <motion.div
                  key="stamping"
                  initial={{ opacity: 0, y: -100, scale: 1.5, rotate: -30 }}
                  animate={{ opacity: 1, y: 0, scale: 1, rotate: -8 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 14 }}
                  style={{ marginTop: 12 }}
                >
                  <Stamp text="到" rarity="rare" size={84} />
                </motion.div>
              ) : checkedIn ? (
                <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 14 }}>
                  <Stamp text="到" rarity="rare" size={64} />
                  <div>
                    <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 18, color: "var(--ink-deep)", letterSpacing: 2 }}>已 到</div>
                    <div style={{ fontSize: 11, color: "var(--ink-mid)", marginTop: 2 }}>進入工作狀態</div>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  key="btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={checkin}
                  style={{
                    marginTop: 16,
                    background: "var(--ink-deep)",
                    color: "var(--bg-paper)",
                    fontFamily: "var(--font-noto-serif-tc)",
                    padding: "14px 32px",
                    borderRadius: 4,
                    fontSize: 16,
                    border: "none",
                    cursor: "pointer",
                    letterSpacing: 8,
                  }}
                >
                  簽 到
                </motion.button>
              )}
            </AnimatePresence>
          </Card>

          <Card delay={0.9}>
            <Label>當前狀態</Label>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 28, color: "var(--ink-deep)", letterSpacing: 3 }}>
                {STAGE_NAMES[user?.stage] || "研墨者"}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-mid)", marginTop: 8, lineHeight: 1.7 }}>
                <a href="/learn" style={{ color: "var(--accent-red)", textDecoration: "none" }}>看 14 天養成路徑 →</a>
              </div>
            </div>
          </Card>

          <Card delay={1.0}>
            <Label>已蓋印章</Label>
            <div style={{ marginTop: 12 }}>
              {stamps.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--ink-mid)", lineHeight: 1.7 }}>
                  尚無印章 — 完成 Day 0 任務獲得「初登場」
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {stamps.slice(0, 3).map((s: any) => (
                    <Stamp key={s.id} text={s.stamp_name} rarity={s.rarity} size={48} />
                  ))}
                  {stamps.length > 3 && <span style={{ fontSize: 12, color: "var(--ink-mid)" }}>+{stamps.length - 3}</span>}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* 連 7 天簽到捲軸動畫 */}
        {streak >= 7 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05 }} style={{ marginBottom: 32, textAlign: "center" }}>
            <StreakScroll days={streak} threshold={7} />
          </motion.div>
        )}
      </div>

      {/* 養成日曆 */}
      {assignment && allModules.length > 0 && (
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 32px 56px" }}>
          <SectionLabel delay={1.05}>曆 · CALENDAR · {assignment.start_date} 起</SectionLabel>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.6 }}
          >
            <Calendar
              modules={allModules}
              progress={progress}
              stamps={stamps}
              startDate={assignment.start_date}
              currentDay={assignment.current_day || 0}
            />
          </motion.div>
        </div>
      )}

      {/* 今日任務 */}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 32px 80px" }}>
        <SectionLabel delay={1.2}>今 · TODAY · {todayModules.length} 任務</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {todayModules.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              style={{ padding: 48, textAlign: "center", color: "var(--ink-mid)", border: "1px dashed var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6 }}
            >
              <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 24, color: "var(--ink-deep)", letterSpacing: 4, marginBottom: 8 }}>歇</div>
              <div style={{ fontSize: 13 }}>今天沒有派發任務,主管或 Claude 之後會派</div>
            </motion.div>
          ) : (
            todayModules.map((m: any, i: number) => (
              <motion.a
                key={m.id}
                href="/learn"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 + i * 0.08, duration: 0.5 }}
                whileHover={{ y: -2, transition: { duration: 0.2 } }}
                style={{
                  padding: 20,
                  borderRadius: 6,
                  background: "var(--bg-paper)",
                  border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
                  textDecoration: "none",
                  color: "var(--ink-deep)",
                  display: "block",
                  transition: "box-shadow 0.2s",
                }}
                onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(26,26,26,0.06)"; }}
                onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 16, color: "var(--accent-red)" }}>{TYPE_ICON[m.module_type] || "·"}</span>
                  <span style={{ fontSize: 10, color: "var(--ink-mid)", textTransform: "uppercase", letterSpacing: 2, fontWeight: 600 }}>
                    {m.module_type}
                  </span>
                  {m.duration_min && <span style={{ fontSize: 11, color: "var(--ink-mid)" }}>· {m.duration_min} 分</span>}
                  {m.reward?.stamp && (
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--accent-red)", fontFamily: "var(--font-noto-serif-tc)" }}>
                      ● {m.reward.stamp}
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 18, color: "var(--ink-deep)", fontWeight: 500, marginBottom: 4 }}>
                  {m.title}
                </div>
                {m.description && (
                  <div style={{ fontSize: 12, color: "var(--ink-mid)", lineHeight: 1.7 }}>{m.description}</div>
                )}
              </motion.a>
            ))
          )}
        </div>

        <NavBar active="home" />
      </div>
    </div>
  );
}

function Card({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -2 }}
      style={{
        padding: 24,
        borderRadius: 6,
        background: "var(--bg-paper)",
        border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
      }}
    >
      {children}
    </motion.div>
  );
}

function SectionLabel({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, marginBottom: 16, fontWeight: 600 }}
    >
      {children}
    </motion.div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, color: "var(--ink-mid)", letterSpacing: 3, fontWeight: 600, textTransform: "uppercase" }}>{children}</div>;
}

function KintsugiLine({ delay = 0 }: { delay?: number }) {
  return (
    <motion.svg
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ delay, duration: 0.8 }}
      width="100%" height="3"
      style={{ display: "block", transformOrigin: "left" }}
    >
      <line x1="0" y1="1.5" x2="100%" y2="1.5" stroke="var(--gold-thread, #c9a96e)" strokeWidth="1" strokeDasharray="2 4" />
    </motion.svg>
  );
}

function NavBar({ active }: { active: "home" | "work" | "learn" | "account" }) {
  const items = [
    { id: "home", label: "今天", href: "/home" },
    { id: "work", label: "數據", href: "/work" },
    { id: "learn", label: "養成", href: "/learn" },
    { id: "account", label: "帳號", href: "/account" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.5 }}
      style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 64 }}
    >
      {items.map(it => (
        <motion.a
          key={it.id}
          href={it.href}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          style={{
            textAlign: "center",
            padding: "14px 0",
            borderRadius: 4,
            background: active === it.id ? "var(--ink-deep)" : "transparent",
            color: active === it.id ? "var(--bg-paper)" : "var(--ink-deep)",
            border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
            fontFamily: "var(--font-noto-serif-tc)",
            fontSize: 14,
            textDecoration: "none",
            letterSpacing: 4,
          }}
        >
          {it.label}
        </motion.a>
      ))}
    </motion.div>
  );
}

function Loader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0.4, 1] }}
      transition={{ duration: 1.5, repeat: Infinity }}
      style={{ textAlign: "center", padding: 80, color: "var(--ink-mid)", fontFamily: "var(--font-noto-serif-tc)", letterSpacing: 4 }}
    >
      載 入 中
    </motion.div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--bg-paper, #f7f1e3)",
  color: "var(--ink-deep, #1a1a1a)",
};
