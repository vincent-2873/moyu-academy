"use client";

import { useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Stamp } from "@/components/wabi/Stamp";
import RecordingUploader from "@/components/training/RecordingUploader";

const STAGE_NAMES: Record<string, string> = {
  beginner: "研墨者",
  intermediate: "執筆者",
  advanced: "點墨者",
  master: "執印者",
};

const PATH_NAMES: Record<string, string> = {
  business: "業務養成",
  recruit: "招募養成",
  legal: "法務養成",
  common: "通用養成",
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

export default function LearnClient() {
  const [email, setEmail] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [email]);

  if (loading) {
    return <div style={pageStyle}><motion.div initial={{ opacity: 0 }} animate={{ opacity: [0,1,0.4,1] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ textAlign: "center", padding: 80, color: "var(--ink-mid)", letterSpacing: 4, fontFamily: "var(--font-noto-serif-tc)" }}>載 入 養 成 地 圖</motion.div></div>;
  }

  if (!email || !data?.path || !data?.modules?.length) {
    return (
      <div style={pageStyle}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", padding: 80 }}>
          <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 64, color: "var(--ink-deep)", letterSpacing: 8, marginBottom: 16 }}>無</div>
          <div style={{ color: "var(--ink-mid)", fontSize: 13 }}>還沒分配養成路徑,主管會在報到後派任</div>
        </motion.div>
      </div>
    );
  }

  const { user, path, modules, progress, stamps, assignment } = data;
  const currentDay = assignment?.current_day || 0;

  const moduleByDay: Record<number, any[]> = {};
  modules.forEach((m: any) => {
    if (!moduleByDay[m.day_offset]) moduleByDay[m.day_offset] = [];
    moduleByDay[m.day_offset].push(m);
  });
  const days = Object.keys(moduleByDay).map(Number).sort((a, b) => a - b);

  const progressMap: Record<string, any> = {};
  progress.forEach((p: any) => { progressMap[p.module_id] = p; });

  return (
    <div style={pageStyle}>
      {/* Hero */}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "80px 32px 40px" }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, marginBottom: 12, fontWeight: 600 }}
        >
          MOYU · LEARN · 養 成
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.0, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{
            fontFamily: "var(--font-noto-serif-tc)",
            fontSize: "clamp(64px, 12vw, 144px)",
            fontWeight: 600,
            color: "var(--ink-deep)",
            letterSpacing: 8,
            lineHeight: 1.0,
            marginBottom: 20,
          }}
        >
          {STAGE_NAMES[user.stage] || "研墨者"}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{ fontSize: 14, color: "var(--ink-mid)", marginBottom: 32, letterSpacing: 1 }}
        >
          <span style={{ fontFamily: "var(--font-noto-serif-tc)", color: "var(--accent-red)", fontWeight: 600 }}>
            {PATH_NAMES[user.stage_path] || "通用"}
          </span>
          <span> · </span>
          {user.brand && <span>{user.brand} · </span>}
          <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>第 {currentDay + 1} 天</span>
          <span> / 共 {days.length} 天</span>
        </motion.div>

        <KintsugiLine delay={0.5} />
      </div>

      {/* 印章牆 */}
      {stamps.length > 0 && (
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 32px 56px" }}>
          <SectionLabel delay={0.7}>印 STAMPS · {stamps.length}</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
            {stamps.map((s: any, i: number) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, scale: 0.6, rotate: -30 }}
                animate={{ opacity: 1, scale: 1, rotate: -8 }}
                transition={{ delay: 0.9 + i * 0.1, type: "spring", stiffness: 180, damping: 14 }}
                whileHover={{ rotate: 0, scale: 1.05 }}
                style={{ textAlign: "center" }}
              >
                <Stamp text={s.stamp_name} rarity={s.rarity} size={84} />
                <div style={{ fontSize: 10, color: "var(--ink-mid)", marginTop: 8, letterSpacing: 1 }}>
                  {new Date(s.earned_at).toISOString().slice(0, 10)}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Day Timeline */}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 32px 80px" }}>
        <SectionLabel delay={1.0}>路 PATH · {path.name}</SectionLabel>

        <div style={{ position: "relative", paddingLeft: 0 }}>
          {/* 中央金繕線 */}
          <div style={{
            position: "absolute",
            left: 27,
            top: 28,
            bottom: 28,
            width: 1,
            background: "linear-gradient(to bottom, var(--gold-thread, #c9a96e) 0%, var(--gold-thread, #c9a96e) 60%, transparent 100%)",
            opacity: 0.5,
          }} />

          {days.map((day, di) => {
            const isCurrent = day === currentDay;
            const isPast = day < currentDay;
            const isFuture = day > currentDay;
            const dayModules = moduleByDay[day];

            return (
              <DayBlock
                key={day}
                day={day}
                isCurrent={isCurrent}
                isPast={isPast}
                isFuture={isFuture}
                dayModules={dayModules}
                progressMap={progressMap}
                index={di}
                userEmail={email}
              />
            );
          })}
        </div>

        <NavBar active="learn" />
      </div>
    </div>
  );
}

function DayBlock({ day, isCurrent, isPast, isFuture, dayModules, progressMap, index, userEmail }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay: Math.min(index * 0.04, 0.4) }}
      style={{ marginBottom: 40, opacity: isFuture ? 0.4 : 1, position: "relative" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14, position: "relative", zIndex: 1 }}>
        <motion.div
          whileHover={{ scale: 1.06 }}
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: isCurrent ? "var(--accent-red, #b91c1c)" : isPast ? "var(--ink-deep, #1a1a1a)" : "var(--bg-paper)",
            color: isCurrent || isPast ? "var(--bg-paper, #f7f1e3)" : "var(--ink-mid, #4a4a4a)",
            border: isFuture ? "1px dashed var(--border-soft, rgba(26,26,26,0.10))" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-noto-serif-tc)",
            fontSize: 22,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          D{day}
        </motion.div>
        <div>
          <div style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600 }}>
            {isCurrent ? "今 日" : isPast ? "已 過" : "未 到"}
          </div>
          <div style={{ fontSize: 18, fontFamily: "var(--font-noto-serif-tc)", color: "var(--ink-deep)", letterSpacing: 2, marginTop: 2 }}>
            第 {day} 天 · {dayModules.length} 任務
          </div>
        </div>
      </div>

      <div style={{ marginLeft: 72, display: "flex", flexDirection: "column", gap: 10 }}>
        {dayModules.map((m: any, i: number) => {
          const p = progressMap[m.id];
          const status = p?.status || (isPast ? "skipped" : "pending");
          const completed = status === "completed";
          const inProgress = status === "in_progress";

          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              whileHover={{ y: -2 }}
              style={{
                padding: 16,
                borderRadius: 6,
                background: completed ? "var(--bg-elev)" : "var(--bg-paper)",
                border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
                opacity: status === "skipped" ? 0.5 : 1,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14, color: "var(--accent-red)" }}>{TYPE_ICON[m.module_type] || "·"}</span>
                <span style={{ fontSize: 10, color: "var(--ink-mid)", textTransform: "uppercase", letterSpacing: 2, fontWeight: 600 }}>
                  {m.module_type}
                </span>
                {m.duration_min && <span style={{ fontSize: 11, color: "var(--ink-mid)" }}>· {m.duration_min} 分</span>}
                {completed && <span style={{ fontSize: 11, color: "var(--accent-red)", marginLeft: "auto", fontFamily: "var(--font-noto-serif-tc)" }}>● 已完成</span>}
                {inProgress && <span style={{ fontSize: 11, color: "var(--gold-thread, #c9a96e)", marginLeft: "auto" }}>○ 進行中</span>}
                {m.reward?.stamp && !completed && (
                  <span style={{ fontSize: 10, color: "var(--accent-red)", marginLeft: "auto", fontFamily: "var(--font-noto-serif-tc)" }}>
                    印章「{m.reward.stamp}」
                  </span>
                )}
              </div>
              <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 15, color: "var(--ink-deep)", marginBottom: 4, fontWeight: 500 }}>
                {m.title}
              </div>
              {m.description && (
                <div style={{ fontSize: 12, color: "var(--ink-mid)", lineHeight: 1.7 }}>
                  {m.description}
                </div>
              )}
              {/* 對練 / 任務 module: 上傳錄音 → Whisper 評估 */}
              {(m.module_type === "sparring" || m.module_type === "task") && isCurrent && userEmail && (
                <RecordingUploader moduleId={m.id} userEmail={userEmail} compact />
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function SectionLabel({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, marginBottom: 24, fontWeight: 600 }}
    >
      {children}
    </motion.div>
  );
}

function KintsugiLine({ delay = 0 }: { delay?: number }) {
  return (
    <motion.svg
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ delay, duration: 0.8 }}
      width="100%" height="3"
      style={{ display: "block", transformOrigin: "left", marginBottom: 56 }}
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

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--bg-paper, #f7f1e3)",
  color: "var(--ink-deep, #1a1a1a)",
};
