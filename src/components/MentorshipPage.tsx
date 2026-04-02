"use client";

import React, { useState, useEffect, useCallback } from "react";

/* ──────────── Types ──────────── */

interface MentorshipPageProps {
  userEmail: string;
  userName: string;
  userId?: string;
  brandId: string;
  userRole: string; // sales_rep, mentor, team_leader, etc.
}

interface PersonNode {
  name: string;
  email: string;
  role: string;
  brand: string;
}

interface MentorPair {
  id: string;
  trainee: PersonNode;
  mentor: PersonNode;
  manager: PersonNode | null;
  start_date: string;
  current_day: number;
  current_week: number;
  current_mode: string;
  feedback_count: number;
  completion_rate: number;
  milestones: MilestoneItem[];
}

interface MentorMessage {
  id: string;
  sender_email: string;
  sender_name: string;
  message: string;
  type: string; // daily, encouragement, feedback
  created_at: string;
}

interface MilestoneItem {
  key: string;
  label: string;
  achieved: boolean;
  date?: string;
}

/* ──────────── Keyframe styles (injected once) ──────────── */

const injectStyles = (() => {
  let injected = false;
  return () => {
    if (injected || typeof document === "undefined") return;
    injected = true;
    const style = document.createElement("style");
    style.textContent = `
      @keyframes mentorship-glow {
        0%, 100% { box-shadow: 0 0 8px 2px var(--accent), 0 0 20px 4px rgba(99,102,241,0.15); }
        50% { box-shadow: 0 0 16px 4px var(--accent), 0 0 32px 8px rgba(99,102,241,0.25); }
      }
      @keyframes mentorship-lantern {
        0%, 100% { transform: translateY(0) rotate(-2deg); opacity: 0.9; }
        50% { transform: translateY(-8px) rotate(2deg); opacity: 1; }
      }
      @keyframes mentorship-pulse-dot {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.5); opacity: 0.6; }
      }
      @keyframes mentorship-fade-in {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes mentorship-scroll-bg {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .mentorship-glow-border {
        animation: mentorship-glow 2.5s ease-in-out infinite;
      }
      .mentorship-lantern {
        animation: mentorship-lantern 3s ease-in-out infinite;
      }
      .mentorship-pulse-dot {
        animation: mentorship-pulse-dot 1.8s ease-in-out infinite;
      }
      .mentorship-fade-in {
        animation: mentorship-fade-in 0.5s ease-out both;
      }
      .mentorship-scroll-banner {
        background: linear-gradient(135deg, #b8860b33, #daa52033, #b8860b33);
        background-size: 200% 200%;
        animation: mentorship-scroll-bg 6s ease infinite;
      }
    `;
    document.head.appendChild(style);
  };
})();

/* ──────────── Milestone definitions ──────────── */

const MILESTONE_DEFS = [
  { key: "first_call", label: "首通達成", icon: "📞", color: "var(--teal)" },
  { key: "first_invite", label: "首場邀約", icon: "📨", color: "var(--accent)" },
  { key: "first_demo", label: "首場Demo", icon: "🎤", color: "var(--gold)" },
  { key: "week1_done", label: "Week1結業", icon: "🏅", color: "var(--green)" },
  { key: "week2_done", label: "Week2結業", icon: "🏅", color: "var(--green)" },
  { key: "week3_done", label: "Week3結業", icon: "🏅", color: "var(--green)" },
  { key: "first_close", label: "首場成交", icon: "🎉", color: "var(--gold)" },
  { key: "graduation", label: "正式結業", icon: "🎓", color: "var(--accent)" },
];

/* ──────────── Helper Components ──────────── */

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`bg-[var(--bg2)] rounded-lg animate-pulse ${className ?? ""}`}
    />
  );
}

function AvatarCircle({
  name,
  gradient,
  size = "w-14 h-14",
  textSize = "text-xl",
}: {
  name: string;
  gradient: string;
  size?: string;
  textSize?: string;
}) {
  return (
    <div
      className={`${size} rounded-full flex items-center justify-center font-bold ${textSize} text-white shrink-0`}
      style={{ background: gradient }}
    >
      {name.charAt(0)}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { bg: string; label: string }> = {
    daily: { bg: "bg-blue-500/20 text-blue-400", label: "每日" },
    encouragement: { bg: "bg-yellow-500/20 text-yellow-400", label: "鼓勵" },
    feedback: { bg: "bg-green-500/20 text-green-400", label: "回饋" },
  };
  const info = map[type] ?? { bg: "bg-gray-500/20 text-gray-400", label: type };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full ${info.bg}`}>
      {info.label}
    </span>
  );
}

/* ──────────── Main Component ──────────── */

export default function MentorshipPage({
  userEmail,
  userName,
  userId,
  brandId,
  userRole,
}: MentorshipPageProps) {
  const [pair, setPair] = useState<MentorPair | null>(null);
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [dailyInput, setDailyInput] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  const isMentor = userRole === "mentor" || userRole === "team_leader";

  /* ── Inject keyframes ── */
  useEffect(() => {
    injectStyles();
  }, []);

  /* ── Fetch pair data ── */
  useEffect(() => {
    async function fetchPair() {
      setLoading(true);
      try {
        const params = userId
          ? `user_id=${encodeURIComponent(userId)}`
          : `user_email=${encodeURIComponent(userEmail)}`;
        const res = await fetch(`/api/mentorship?${params}`);
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        setPair(data.pair ?? null);
      } catch {
        setPair(null);
      } finally {
        setLoading(false);
      }
    }
    fetchPair();
  }, [userEmail, userId]);

  /* ── Fetch messages ── */
  const fetchMessages = useCallback(async () => {
    if (!pair?.id) return;
    setMsgLoading(true);
    try {
      const res = await fetch(
        `/api/mentorship/messages?pair_id=${encodeURIComponent(pair.id)}`
      );
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setMsgLoading(false);
    }
  }, [pair?.id]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  /* ── Send daily message ── */
  async function handleSendMessage() {
    if (!dailyInput.trim() || !pair?.id) return;
    setSendingMsg(true);
    try {
      const res = await fetch("/api/mentorship/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pair_id: pair.id,
          sender_email: userEmail,
          sender_name: userName,
          message: dailyInput.trim(),
          type: "daily",
        }),
      });
      if (!res.ok) throw new Error("send failed");
      setDailyInput("");
      fetchMessages();
    } catch {
      // silent fail
    } finally {
      setSendingMsg(false);
    }
  }

  /* ── Merge milestones with defs ── */
  const milestones: (typeof MILESTONE_DEFS[number] & {
    achieved: boolean;
    date?: string;
  })[] = MILESTONE_DEFS.map((def) => {
    const found = pair?.milestones?.find((m) => m.key === def.key);
    return {
      ...def,
      achieved: found?.achieved ?? false,
      date: found?.date,
    };
  });

  /* ── Today's message ── */
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMessage = messages.find(
    (m) => m.created_at?.slice(0, 10) === todayStr
  );

  /* ── Current week position for timeline ── */
  const currentWeek = pair?.current_week ?? 1;

  /* ══════════════════ RENDER ══════════════════ */

  /* Loading skeleton */
  if (loading) {
    return (
      <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
        <SkeletonBlock className="h-16 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonBlock className="h-40" />
          <SkeletonBlock className="h-40" />
          <SkeletonBlock className="h-40" />
        </div>
        <SkeletonBlock className="h-48 w-full" />
        <SkeletonBlock className="h-32 w-full" />
        <SkeletonBlock className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto mentorship-fade-in">
      {/* ═══ 拜師帖 Banner ═══ */}
      <div className="mentorship-scroll-banner rounded-2xl border border-[var(--gold)]/30 px-6 py-5 text-center relative overflow-hidden">
        <div className="absolute inset-0 border-[3px] border-double border-[var(--gold)]/20 rounded-2xl pointer-events-none m-1" />
        <p
          className="text-sm tracking-widest mb-1 uppercase"
          style={{ color: "var(--gold)" }}
        >
          師 徒 傳 承
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--text)]">
          拜師帖
        </h1>
        <p className="text-xs mt-1 text-[var(--text3)]">
          薪火相傳 &middot; 共創佳績
        </p>
      </div>

      {/* ═══ Section 1: 師徒傳承樹 ═══ */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
          <span className="text-xl">🌳</span> 師徒傳承樹
        </h2>

        {!pair ? (
          /* Empty state */
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-10 text-center">
            <div className="text-5xl mentorship-lantern inline-block mb-4">
              🏮
            </div>
            <p className="text-[var(--text2)] text-lg font-medium">
              等待師父配對中...
            </p>
            <p className="text-[var(--text3)] text-sm mt-2">
              系統將於近期為你安排師父，請耐心等候
            </p>
          </div>
        ) : (
          /* Hierarchy tree */
          <div className="flex flex-col items-center gap-0">
            {/* Manager card */}
            {pair.manager && (
              <>
                <HierarchyCard
                  person={pair.manager}
                  icon="👑"
                  roleLabel="據點主管"
                  gradient="linear-gradient(135deg, #b8860b, #daa520)"
                  avatarGradient="linear-gradient(135deg, #b8860b, #f0c040)"
                  isCurrentUser={pair.manager.email === userEmail}
                />
                <div className="w-px h-8 bg-[var(--border)]" />
              </>
            )}

            {/* Mentor card */}
            <HierarchyCard
              person={pair.mentor}
              icon="🛡️"
              roleLabel="師父"
              gradient="linear-gradient(135deg, #7c3aed, #a855f7)"
              avatarGradient="linear-gradient(135deg, #7c3aed, #c084fc)"
              isCurrentUser={pair.mentor.email === userEmail}
            />
            <div className="w-px h-8 bg-[var(--border)]" />

            {/* Trainee card */}
            <HierarchyCard
              person={pair.trainee}
              icon="🌱"
              roleLabel="我"
              gradient="linear-gradient(135deg, #0d9488, #2dd4bf)"
              avatarGradient="linear-gradient(135deg, #0d9488, #5eead4)"
              isCurrentUser={pair.trainee.email === userEmail}
            />
          </div>
        )}
      </section>

      {/* Remaining sections only when pair exists */}
      {pair && (
        <>
          {/* ═══ Section 2: 師父的話 ═══ */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
              <span className="text-xl">💬</span> 師父的話
            </h2>

            {/* Today's message */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 mb-4">
              <p className="text-xs font-medium text-[var(--accent)] mb-3 tracking-wider uppercase">
                今日師父的話
              </p>
              {todayMessage ? (
                <div className="relative pl-4 border-l-2 border-[var(--accent)]">
                  <span className="absolute -left-3 -top-1 text-2xl text-[var(--accent)] opacity-30">
                    &ldquo;
                  </span>
                  <p className="text-[var(--text)] leading-relaxed italic">
                    {todayMessage.message}
                  </p>
                  <p className="text-[var(--text3)] text-xs mt-2">
                    &mdash; {todayMessage.sender_name}
                  </p>
                </div>
              ) : (
                <p className="text-[var(--text3)] text-sm italic">
                  今天還沒有師父的話，敬請期待...
                </p>
              )}
            </div>

            {/* Mentor input */}
            {isMentor && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 mb-4">
                <label className="text-xs text-[var(--text3)] mb-2 block">
                  撰寫今日師父的話
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dailyInput}
                    onChange={(e) => setDailyInput(e.target.value)}
                    placeholder="給徒弟一句鼓勵..."
                    className="flex-1 bg-[var(--bg2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text3)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSendMessage();
                    }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={sendingMsg || !dailyInput.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40"
                    style={{ background: "var(--accent)" }}
                  >
                    {sendingMsg ? "..." : "發送"}
                  </button>
                </div>
              </div>
            )}

            {/* Message history */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 max-h-80 overflow-y-auto">
              <p className="text-xs text-[var(--text3)] mb-3 font-medium">
                歷史訊息
              </p>
              {msgLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <SkeletonBlock key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <p className="text-[var(--text3)] text-sm text-center py-6">
                  尚無訊息紀錄
                </p>
              ) : (
                <div className="space-y-3">
                  {messages.slice(0, 10).map((msg) => (
                    <div
                      key={msg.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg2)]/50"
                    >
                      <AvatarCircle
                        name={msg.sender_name}
                        gradient="linear-gradient(135deg, var(--accent), var(--teal))"
                        size="w-8 h-8"
                        textSize="text-xs"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-[var(--text)]">
                            {msg.sender_name}
                          </span>
                          <TypeBadge type={msg.type} />
                        </div>
                        <p className="text-sm text-[var(--text2)] leading-relaxed">
                          {msg.message}
                        </p>
                        <p className="text-[10px] text-[var(--text3)] mt-1">
                          {formatTimestamp(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ═══ Section 3: 訓練里程碑 ═══ */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
              <span className="text-xl">🏆</span> 訓練里程碑
            </h2>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 overflow-x-auto">
              {/* Week markers */}
              <div className="flex justify-between mb-2 min-w-[600px] px-2">
                {[1, 2, 3, 4].map((w) => (
                  <div key={w} className="text-center">
                    <span
                      className={`text-xs font-medium ${
                        w === currentWeek
                          ? "text-[var(--accent)]"
                          : "text-[var(--text3)]"
                      }`}
                    >
                      Week {w}
                    </span>
                  </div>
                ))}
              </div>

              {/* Horizontal timeline bar */}
              <div className="relative min-w-[600px] h-2 bg-[var(--bg2)] rounded-full mx-2 mb-6">
                {/* Progress fill */}
                <div
                  className="absolute left-0 top-0 h-2 rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(
                      ((pair.current_day ?? 0) / 28) * 100,
                      100
                    )}%`,
                    background:
                      "linear-gradient(90deg, var(--teal), var(--accent))",
                  }}
                />
                {/* Current position dot */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white mentorship-pulse-dot"
                  style={{
                    left: `calc(${Math.min(
                      ((pair.current_day ?? 0) / 28) * 100,
                      100
                    )}% - 8px)`,
                    background: "var(--accent)",
                  }}
                />
              </div>

              {/* Milestone items */}
              <div className="grid grid-cols-4 md:grid-cols-8 gap-3 min-w-[600px]">
                {milestones.map((ms) => (
                  <div
                    key={ms.key}
                    className={`flex flex-col items-center text-center transition-all duration-300 ${
                      ms.achieved ? "opacity-100 scale-100" : "opacity-40 scale-95"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-lg mb-1 ${
                        ms.achieved
                          ? "shadow-lg"
                          : "bg-[var(--bg2)]"
                      }`}
                      style={
                        ms.achieved
                          ? { background: ms.color, boxShadow: `0 0 12px ${ms.color}40` }
                          : undefined
                      }
                    >
                      {ms.achieved ? ms.icon : "○"}
                    </div>
                    <span className="text-[10px] text-[var(--text2)] font-medium leading-tight">
                      {ms.label}
                    </span>
                    {ms.achieved && ms.date && (
                      <span className="text-[9px] text-[var(--text3)]">
                        {ms.date}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══ Section 4: 師徒數據 ═══ */}
          <section>
            <h2 className="text-lg font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
              <span className="text-xl">📊</span> 師徒數據
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="訓練天數"
                value={`${pair.current_day ?? 0} / 28`}
                sub={`${Math.round(((pair.current_day ?? 0) / 28) * 100)}%`}
                color="var(--teal)"
              />
              <StatCard
                label="當前階段"
                value={`Week ${pair.current_week ?? 1}`}
                sub={pair.current_mode ?? "Coach"}
                color="var(--accent)"
              />
              <StatCard
                label="師父回饋數"
                value={String(pair.feedback_count ?? 0)}
                sub="次"
                color="var(--gold)"
              />
              <StatCard
                label="完成率"
                value={`${pair.completion_rate ?? 0}%`}
                sub="課程進度"
                color="var(--green)"
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/* ──────────── Sub Components ──────────── */

function HierarchyCard({
  person,
  icon,
  roleLabel,
  gradient,
  avatarGradient,
  isCurrentUser,
}: {
  person: PersonNode;
  icon: string;
  roleLabel: string;
  gradient: string;
  avatarGradient: string;
  isCurrentUser: boolean;
}) {
  return (
    <div
      className={`bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 w-56 text-center transition-all duration-300 ${
        isCurrentUser ? "mentorship-glow-border" : ""
      }`}
      style={
        isCurrentUser
          ? { borderColor: "var(--accent)" }
          : undefined
      }
    >
      {/* Gradient top strip */}
      <div
        className="h-1 rounded-full mx-auto w-16 mb-3"
        style={{ background: gradient }}
      />
      <div className="flex flex-col items-center gap-2">
        <AvatarCircle
          name={person.name}
          gradient={avatarGradient}
        />
        <div>
          <div className="flex items-center justify-center gap-1">
            <span className="text-base">{icon}</span>
            <span className="text-sm font-semibold text-[var(--text)]">
              {person.name}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text3)]">{roleLabel}</p>
          <p className="text-[10px] text-[var(--text3)] mt-0.5">
            {person.brand}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 text-center">
      <p className="text-xs text-[var(--text3)] mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>
        {value}
      </p>
      <p className="text-[11px] text-[var(--text3)] mt-0.5">{sub}</p>
    </div>
  );
}

/* ──────────── Helpers ──────────── */

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = d.getHours().toString().padStart(2, "0");
    const mins = d.getMinutes().toString().padStart(2, "0");
    return `${month}/${day} ${hours}:${mins}`;
  } catch {
    return ts;
  }
}
