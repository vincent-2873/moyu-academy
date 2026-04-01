"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getCurrentUser,
  loginUser,
  registerUser,
  logout,
  updateUser,
  addKpiEntry,
  addSparringRecord,
  type User,
  type SparringRecord,
} from "@/lib/store";
import { syncProgress, syncQuizScore, syncKpiEntry, syncRegister, migrateLocalStorageToSupabase, syncVideoProgress } from "@/lib/sync";
import { brands } from "@/data/brands";
import { modules, TASK_ICONS } from "@/data/modules";
import { personas, getPersonasByBrand } from "@/data/personas";
import Sidebar from "@/components/Sidebar";
import CalendarDashboard from "@/components/CalendarDashboard";
import MentorTeamCard from "@/components/MentorTeamCard";
import MentorshipPage from "@/components/MentorshipPage";
import CeremonyOverlay from "@/components/CeremonyOverlay";
import ScoreRadar from "@/components/ScoreRadar";
import { scoreConversation, getScoreColor, getScoreLabel, SCORE_LABELS } from "@/lib/scoring";
import {
  trainingVideos,
  videoCategories,
  getVideosForBrand,
  getCategoriesForBrand,
  getDriveEmbedUrl,
  getDriveLink,
  getVideosForDay,
  type TrainingVideo,
} from "@/data/videos";

type Page =
  | "dashboard"
  | "training"
  | "videos"
  | "sparring"
  | "transcripts"
  | "tools"
  | "pricing"
  | "kpi"
  | "records"
  | "finance"
  | "knowledge"
  | "mentorship"
  | "articles";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const u = getCurrentUser();
    setUser(u);
    setLoading(false);
    // Migrate localStorage data to Supabase on login
    if (u) migrateLocalStorageToSupabase(u);
  }, []);

  const refreshUser = () => setUser(getCurrentUser());

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-2xl font-bold animate-pulse" style={{ color: "var(--accent)" }}>
          墨宇學院 2.0
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onLogin={refreshUser} />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        currentPage={page}
        onNavigate={(p) => { setPage(p as Page); setMobileMenuOpen(false); }}
        userName={user.name}
        brandId={user.brand}
        completedModules={user.completedModules}
        onLogout={() => {
          logout();
          setUser(null);
        }}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />
      {/* Mobile hamburger button */}
      <button
        className="md:hidden fixed top-4 left-4 z-30 w-10 h-10 rounded-lg bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-[var(--text)] shadow-lg"
        onClick={() => setMobileMenuOpen(true)}
      >
        ☰
      </button>
      <main className="flex-1 ml-0 md:ml-[260px] p-4 md:p-8 animate-fade-in" key={page}>
        {page === "dashboard" && <DashboardPage user={user} onNavigate={(p) => setPage(p as Page)} />}
        {page === "training" && <TrainingPage user={user} onUpdate={refreshUser} />}
        {page === "videos" && <VideosPage brandId={user.brand} userEmail={user.email} />}
        {page === "sparring" && <SparringPage user={user} onUpdate={refreshUser} />}
        {page === "transcripts" && <TranscriptsPage brandId={user.brand} />}
        {page === "tools" && <ToolsPage />}
        {page === "pricing" && <PricingPage brandId={user.brand} />}
        {page === "kpi" && <KpiPage user={user} onUpdate={refreshUser} />}
        {page === "records" && <RecordsPage user={user} />}
        {page === "finance" && <FinanceKnowledgePage />}
        {page === "knowledge" && <KnowledgePage brandId={user.brand} />}
        {page === "mentorship" && <MentorshipPage userEmail={user.email} userName={user.name} brandId={user.brand} userRole={user.role || "sales_rep"} />}
        {page === "articles" && <ArticlesPage />}
      </main>
      <HelpBot />
    </div>
  );
}

/* ===================== HELPBOT ===================== */
function HelpBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "嗨！我是小墨 👋 有任何操作問題都可以問我！" },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const userMsg = { role: "user" as const, content: input.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/helpbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs }),
      });
      const data = await res.json();
      setMessages([...newMsgs, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages([...newMsgs, { role: "assistant", content: "抱歉，暫時無法回覆，請稍後再試！" }]);
    }
    setSending(false);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl shadow-lg z-50 transition-transform hover:scale-110"
        style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))" }}
      >
        {open ? "✕" : "💬"}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-3 md:right-6 w-[calc(100vw-24px)] max-w-[380px] h-[70vh] max-h-[520px] bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-fade-in"
        >
          {/* Header */}
          <div
            className="px-5 py-4 text-white font-bold flex items-center gap-3"
            style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))" }}
          >
            <span className="text-2xl">🤖</span>
            <div>
              <p className="text-sm font-bold">小墨 AI 客服</p>
              <p className="text-[10px] opacity-80">有問題隨時問我！</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-[var(--accent)] text-white rounded-br-sm"
                      : "bg-[var(--bg2)] text-[var(--text)] rounded-bl-sm"
                  }`}
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-[var(--bg2)] px-3.5 py-2.5 rounded-xl rounded-bl-sm text-sm animate-pulse">
                  小墨思考中...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[var(--border)]">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="輸入你的問題..."
                className="flex-1 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg2)] text-[var(--text)] text-sm outline-none focus:border-[var(--accent)]"
                disabled={sending}
              />
              <button
                onClick={send}
                disabled={!input.trim() || sending}
                className="px-4 py-2.5 rounded-lg text-white text-sm font-bold disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))" }}
              >
                送出
              </button>
            </div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {["怎麼用語音對練？", "邀請碼在哪？", "AI 評分標準？"].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    setTimeout(() => {
                      const userMsg = { role: "user" as const, content: q };
                      const newMsgs = [...messages, userMsg];
                      setMessages(newMsgs);
                      setInput("");
                      setSending(true);
                      fetch("/api/helpbot", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ messages: newMsgs }),
                      })
                        .then((r) => r.json())
                        .then((data) => setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]))
                        .catch(() => setMessages((prev) => [...prev, { role: "assistant", content: "抱歉，暫時無法回覆" }]))
                        .finally(() => setSending(false));
                    }, 50);
                  }}
                  className="px-2.5 py-1 rounded-full bg-[var(--bg2)] text-[10px] text-[var(--text2)] hover:text-[var(--accent)] hover:bg-[rgba(102,126,234,0.1)] transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ===================== AUTH ===================== */
function AuthPage({ onLogin }: { onLogin: () => void }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("nschool");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isRegister) {
      const b = brands[brand];
      if (inviteCode !== b.inviteCode) {
        setError("邀請碼錯誤");
        return;
      }
      const res = registerUser(email, password, name, brand);
      if (!res.success) {
        setError(res.error || "註冊失敗");
        return;
      }
      // Sync to Supabase
      syncRegister(email, name, brand);
      const loginRes = loginUser(email, password);
      if (loginRes.success) onLogin();
    } else {
      const res = loginUser(email, password);
      if (!res.success) {
        setError(res.error || "登入失敗");
        return;
      }
      onLogin();
    }
  };

  return (
    <div className="h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1
            className="text-4xl font-bold mb-2"
            style={{
              background: "linear-gradient(135deg, var(--accent), var(--teal))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            墨宇學院 2.0
          </h1>
          <p className="text-[var(--text3)]">AI 驅動的業務培訓與對練系統</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 sm:p-8"
        >
          <h2 className="text-xl font-bold mb-6">
            {isRegister ? "建立帳號" : "登入"}
          </h2>

          {isRegister && (
            <>
              <div className="mb-4">
                <label className="block text-xs text-[var(--text2)] mb-1">姓名</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg2)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs text-[var(--text2)] mb-1">品牌</label>
                <select
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg2)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                >
                  {Object.values(brands).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-xs text-[var(--text2)] mb-1">邀請碼</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg2)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  placeholder="請輸入邀請碼"
                  required
                />
              </div>
            </>
          )}

          <div className="mb-4">
            <label className="block text-xs text-[var(--text2)] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg2)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs text-[var(--text2)] mb-1">密碼</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg2)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              required
            />
          </div>

          {error && (
            <p className="text-[var(--red)] text-sm mb-4">{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-lg font-bold text-white transition-all hover:shadow-lg"
            style={{
              background: "linear-gradient(135deg, var(--accent), var(--teal))",
            }}
          >
            {isRegister ? "註冊" : "登入"}
          </button>

          <p className="text-center text-sm text-[var(--text2)] mt-4">
            {isRegister ? "已有帳號？" : "還沒有帳號？"}
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
              }}
              className="text-[var(--accent)] ml-1 hover:underline"
            >
              {isRegister ? "登入" : "註冊"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

/* ===================== DASHBOARD ===================== */
function DashboardPage({ user, onNavigate }: { user: User; onNavigate: (p: string) => void }) {
  const brand = brands[user.brand];
  const progress = Math.round((user.completedModules.length / 9) * 100);
  const avgScore =
    user.sparringRecords.length > 0
      ? Math.round(
          user.sparringRecords.reduce((s, r) => s + r.scores.overall, 0) /
            user.sparringRecords.length
        )
      : 0;
  const todayKpi = user.kpiData.find(
    (k) => k.date === new Date().toISOString().slice(0, 10)
  );
  const weekRecords = user.sparringRecords.filter((r) => {
    const d = new Date(r.date);
    const now = new Date();
    return now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  });

  const stats = [
    { label: "課程進度", value: `${progress}%`, sub: `${user.completedModules.length}/9 完成`, color: brand.color },
    { label: "對練平均分", value: avgScore || "—", sub: `${user.sparringRecords.length} 次對練`, color: "var(--teal)" },
    { label: "本週對練", value: weekRecords.length, sub: "次", color: "var(--gold)" },
    { label: "今日撥打", value: todayKpi?.calls || 0, sub: `有效 ${todayKpi?.validCalls || 0}`, color: "var(--green)" },
  ];

  // Determine next recommended action
  const nextModule = modules.find((m) => !user.completedModules.includes(m.id));
  const weakestDimension = user.sparringRecords.length > 0
    ? (() => {
        const latest = user.sparringRecords[user.sparringRecords.length - 1];
        const dims = Object.entries(latest.scores).filter(([k]) => k !== "overall") as [string, number][];
        dims.sort((a, b) => a[1] - b[1]);
        return dims[0];
      })()
    : null;

  // Calculate overdue tasks for notification bell
  const currentDay = Math.min(22, Math.max(1, Math.ceil((Date.now() - new Date(user.joinDate).getTime()) / (1000 * 60 * 60 * 24))));
  const [overdueCount, setOverdueCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`moyu_tasks_${user.email}`);
      const tasks: Record<string, boolean> = stored ? JSON.parse(stored) : {};
      let overdue = 0;
      // Count incomplete tasks from past days
      for (let d = 1; d < currentDay; d++) {
        const mod = modules.find((m) => m.day === d);
        if (mod) {
          mod.tasks.forEach((_, idx) => {
            const taskId = `day${d}_task${idx}`;
            if (!tasks[taskId]) overdue++;
          });
        }
      }
      setOverdueCount(overdue);
    } catch { setOverdueCount(0); }
  }, [user.email, currentDay]);

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            歡迎回來，{user.name}
          </h1>
          <p className="text-[var(--text2)]">
            {brand.fullName} | 加入 {Math.ceil((Date.now() - new Date(user.joinDate).getTime()) / (1000 * 60 * 60 * 24))} 天 | 訓練第 {currentDay} 天
          </p>
        </div>
        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-10 h-10 rounded-lg bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-xl hover:bg-[var(--bg2)] transition-all"
          >
            🔔
            {overdueCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--red)] text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {overdueCount > 99 ? "99+" : overdueCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-12 w-72 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                <span className="font-bold text-sm">通知中心</span>
                <button onClick={() => setShowNotifications(false)} className="text-[var(--text3)] hover:text-[var(--text)]">✕</button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {overdueCount > 0 ? (
                  <div className="p-4 space-y-2">
                    <div className="flex items-start gap-3 p-3 bg-[rgba(255,77,77,0.08)] rounded-lg border border-[rgba(255,77,77,0.2)]">
                      <span className="text-lg">⚠️</span>
                      <div>
                        <p className="text-sm font-semibold text-[var(--red)]">逾期任務提醒</p>
                        <p className="text-xs text-[var(--text2)] mt-0.5">
                          你有 {overdueCount} 項過去天數的任務尚未完成，請盡快補完！
                        </p>
                      </div>
                    </div>
                    {!todayKpi && (
                      <div className="flex items-start gap-3 p-3 bg-[rgba(254,202,87,0.08)] rounded-lg border border-[rgba(254,202,87,0.2)]">
                        <span className="text-lg">📊</span>
                        <div>
                          <p className="text-sm font-semibold text-[var(--gold)]">今日 KPI 未填</p>
                          <p className="text-xs text-[var(--text2)] mt-0.5">記得填寫今天的 KPI 數據</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 text-center text-[var(--text3)]">
                    <p className="text-2xl mb-2">✅</p>
                    <p className="text-sm">太棒了！目前沒有逾期任務</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <div
            key={i}
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 relative overflow-hidden"
          >
            <div
              className="absolute top-0 left-0 right-0 h-[3px]"
              style={{
                background: `linear-gradient(90deg, ${s.color}, ${s.color}80)`,
              }}
            />
            <p className="text-xs text-[var(--text3)]">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>
              {s.value}
            </p>
            <p className="text-xs text-[var(--text2)] mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Calendar Dashboard - 日曆 + 每日待辦 */}
      <div className="mb-8">
        <CalendarDashboard
          userEmail={user.email}
          currentDay={Math.min(22, Math.max(1, Math.ceil((Date.now() - new Date(user.joinDate).getTime()) / (1000 * 60 * 60 * 24))))}
          startDate={user.joinDate}
          completedTasks={(() => {
            try {
              const stored = localStorage.getItem(`moyu_tasks_${user.email}`);
              return stored ? JSON.parse(stored) : {};
            } catch { return {}; }
          })()}
          onTaskToggle={(taskId: string) => {
            try {
              const key = `moyu_tasks_${user.email}`;
              const stored = localStorage.getItem(key);
              const tasks = stored ? JSON.parse(stored) : {};
              tasks[taskId] = !tasks[taskId];
              localStorage.setItem(key, JSON.stringify(tasks));
            } catch { /* ignore */ }
          }}
        />
      </div>

      {/* Recommended Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4" style={{ color: "var(--accent-light)" }}>
            推薦行動
          </h3>
          <div className="space-y-3">
            {nextModule && (
              <button
                onClick={() => onNavigate("training")}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-[var(--bg2)] border border-[var(--border)] hover:border-[var(--accent)] transition-all text-left"
              >
                <span className="text-2xl">📚</span>
                <div>
                  <p className="font-semibold text-sm">繼續學習</p>
                  <p className="text-xs text-[var(--text2)]">
                    Day {nextModule.day} — {nextModule.title}
                  </p>
                </div>
              </button>
            )}
            <button
              onClick={() => onNavigate("sparring")}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-[var(--bg2)] border border-[var(--border)] hover:border-[var(--teal)] transition-all text-left"
            >
              <span className="text-2xl">🎯</span>
              <div>
                <p className="font-semibold text-sm">開始對練</p>
                <p className="text-xs text-[var(--text2)]">
                  {weakestDimension
                    ? `加強 ${SCORE_LABELS[weakestDimension[0] as keyof typeof SCORE_LABELS]}（上次 ${weakestDimension[1]} 分）`
                    : "選擇一位 AI 客戶開始練習"}
                </p>
              </div>
            </button>
            <button
              onClick={() => onNavigate("kpi")}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-[var(--bg2)] border border-[var(--border)] hover:border-[var(--gold)] transition-all text-left"
            >
              <span className="text-2xl">📈</span>
              <div>
                <p className="font-semibold text-sm">記錄今日 KPI</p>
                <p className="text-xs text-[var(--text2)]">
                  {todayKpi ? "已填寫，可更新" : "尚未填寫今天的數據"}
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Recent Sparring */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4" style={{ color: "var(--teal)" }}>
            最近對練
          </h3>
          {user.sparringRecords.length === 0 ? (
            <div className="text-center py-8 text-[var(--text3)]">
              <p className="text-3xl mb-2">🎯</p>
              <p>還沒有對練紀錄</p>
              <p className="text-sm mt-1">去試試 AI 對練吧！</p>
            </div>
          ) : (
            <div className="space-y-2">
              {user.sparringRecords
                .slice(-5)
                .reverse()
                .map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 p-3 bg-[var(--bg2)] rounded-lg"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
                      style={{
                        background: `${getScoreColor(r.scores.overall)}20`,
                        color: getScoreColor(r.scores.overall),
                      }}
                    >
                      {r.scores.overall}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{r.personaName}</p>
                      <p className="text-[10px] text-[var(--text3)]">
                        {new Date(r.date).toLocaleDateString("zh-TW")} · {getScoreLabel(r.scores.overall)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Mentor Team Card */}
      <div className="mt-6">
        <MentorTeamCard userEmail={user.email} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

/* ===================== VIDEOS ===================== */
function VideosPage({ brandId, userEmail }: { brandId: string; userEmail?: string }) {
  const [selectedVideo, setSelectedVideo] = useState<TrainingVideo | null>(null);
  const videoStartTime = useRef<number>(0);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const categories = getCategoriesForBrand(brandId);
  const allVideos = getVideosForBrand(brandId);
  const filteredVideos =
    activeCategory === "all"
      ? allVideos
      : allVideos.filter((v) => v.category === activeCategory);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">影片教學</h1>
        <p className="text-[var(--text3)] text-sm">觀看訓練影片，學習 DEMO 流程與實戰技巧</p>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeCategory === "all"
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--bg2)] text-[var(--text2)] hover:bg-[var(--border)]"
          }`}
        >
          全部影片 ({allVideos.length})
        </button>
        {categories.map((cat) => {
          const count = allVideos.filter((v) => v.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeCategory === cat.id
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--bg2)] text-[var(--text2)] hover:bg-[var(--border)]"
              }`}
            >
              {cat.icon} {cat.title} ({count})
            </button>
          );
        })}
      </div>

      {/* Selected Video Player */}
      {selectedVideo && (
        <div className="mb-6 bg-[var(--bg2)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="aspect-video bg-black">
            <iframe
              src={getDriveEmbedUrl(selectedVideo.driveFileId, selectedVideo.type)}
              className="w-full h-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>
          <div className="p-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">{selectedVideo.title}</h3>
              <p className="text-sm text-[var(--text3)]">
                {selectedVideo.description} · {selectedVideo.size}
                {selectedVideo.presenter && ` · 講者：${selectedVideo.presenter}`}
              </p>
            </div>
            <div className="flex gap-2">
              <a
                href={getDriveLink(selectedVideo.driveFileId, selectedVideo.type)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg text-xs bg-[var(--border)] text-[var(--text2)] hover:text-white transition-colors"
              >
                在 Google Drive 開啟
              </a>
              <button
                onClick={() => {
                  if (selectedVideo && userEmail && videoStartTime.current > 0) {
                    const watchSecs = Math.round((Date.now() - videoStartTime.current) / 1000);
                    syncVideoProgress(userEmail, selectedVideo.id, watchSecs);
                  }
                  videoStartTime.current = 0;
                  setSelectedVideo(null);
                }}
                className="px-3 py-1.5 rounded-lg text-xs bg-[var(--border)] text-[var(--text2)] hover:text-white transition-colors"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVideos.map((video) => (
          <button
            key={video.id}
            onClick={() => {
              // Track previous video watch time
              if (selectedVideo && userEmail && videoStartTime.current > 0) {
                const watchSecs = Math.round((Date.now() - videoStartTime.current) / 1000);
                syncVideoProgress(userEmail, selectedVideo.id, watchSecs);
              }
              setSelectedVideo(video);
              videoStartTime.current = Date.now();
            }}
            className={`text-left bg-[var(--bg2)] rounded-xl border transition-all hover:border-[var(--accent)] hover:shadow-lg ${
              selectedVideo?.id === video.id
                ? "border-[var(--accent)] shadow-lg"
                : "border-[var(--border)]"
            }`}
          >
            <div className="aspect-video bg-[var(--bg)] rounded-t-xl flex items-center justify-center relative overflow-hidden">
              <div className="text-4xl">
                {video.type === "slides" ? "📊" : "▶️"}
              </div>
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
                {video.size}
              </div>
              {video.type === "slides" && (
                <div className="absolute top-2 left-2 bg-blue-500/80 text-white text-[10px] px-2 py-0.5 rounded">
                  簡報
                </div>
              )}
            </div>
            <div className="p-3">
              <h4 className="font-semibold text-sm mb-1">{video.title}</h4>
              <p className="text-xs text-[var(--text3)] line-clamp-2">{video.description}</p>
              {video.presenter && (
                <p className="text-xs text-[var(--accent)] mt-1">講者：{video.presenter}</p>
              )}
            </div>
          </button>
        ))}
      </div>

      {filteredVideos.length === 0 && (
        <div className="text-center py-16 text-[var(--text3)]">
          <div className="text-4xl mb-3">🎬</div>
          <p>這個分類暫無影片</p>
        </div>
      )}
    </div>
  );
}

/* ===================== TRAINING ===================== */
function TrainingPage({ user, onUpdate }: { user: User; onUpdate: () => void }) {
  const [selectedModule, setSelectedModule] = useState<number | null>(null);
  const [quizMode, setQuizMode] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [taskDone, setTaskDone] = useState<Record<string, boolean>>({});
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const mod = selectedModule !== null ? modules.find((m) => m.id === selectedModule) : null;

  // Load task completions from localStorage
  useEffect(() => {
    const key = `moyu_tasks_${user.email}`;
    const saved = localStorage.getItem(key);
    if (saved) setTaskDone(JSON.parse(saved));
  }, [user.email]);

  const toggleTask = (taskId: string) => {
    setTaskDone((prev) => {
      const updated = { ...prev, [taskId]: !prev[taskId] };
      localStorage.setItem(`moyu_tasks_${user.email}`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleQuizSubmit = () => {
    if (!mod) return;
    const correct = mod.quiz.reduce(
      (c, q, i) => c + (answers[i] === q.answer ? 1 : 0),
      0
    );
    const score = Math.round((correct / mod.quiz.length) * 100);
    setQuizSubmitted(true);

    const newScores = [
      ...user.quizScores.filter((s) => s.moduleId !== mod.id),
      { moduleId: mod.id, score, date: new Date().toISOString() },
    ];

    const newCompleted = score >= 60
      ? [...new Set([...user.completedModules, mod.id])]
      : user.completedModules;

    const newProgress = Math.round((newCompleted.length / 9) * 100);
    updateUser(user.email, {
      quizScores: newScores,
      completedModules: newCompleted,
      progress: newProgress,
    });

    // Auto-complete the quiz task
    if (score >= 60 && mod.tasks) {
      const quizTask = mod.tasks.find((t) => t.type === "quiz");
      if (quizTask) {
        setTaskDone((prev) => {
          const updated = { ...prev, [quizTask.id]: true };
          localStorage.setItem(`moyu_tasks_${user.email}`, JSON.stringify(updated));
          return updated;
        });
      }
    }

    syncQuizScore(user.email, mod.id, score);
    const currentDay = Math.min(Math.max(...newCompleted, 0) + 1, 9);
    syncProgress(user.email, newCompleted, newProgress, currentDay);
    onUpdate();
  };

  if (mod) {
    const prevScore = user.quizScores.find((s) => s.moduleId === mod.id);
    const dayCompleted = user.completedModules.includes(mod.id);
    const doneTasks = mod.tasks.filter((t) => t.type === "quiz" ? dayCompleted : taskDone[t.id]);
    const taskProgress = mod.tasks.length > 0 ? Math.round((doneTasks.length / mod.tasks.length) * 100) : 0;
    const firstUndone = mod.tasks.find((t) => t.type === "quiz" ? !dayCompleted : !taskDone[t.id]);

    return (
      <div className="animate-fade-in max-w-3xl">
        <button
          onClick={() => { setSelectedModule(null); setQuizMode(false); setQuizSubmitted(false); setAnswers([]); }}
          className="text-sm text-[var(--text2)] hover:text-[var(--text)] mb-4 flex items-center gap-1"
        >
          ← 回到課程列表
        </button>

        {/* Header */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold" style={{ background: dayCompleted ? "rgba(34,197,94,0.15)" : "rgba(99,102,241,0.15)", color: dayCompleted ? "var(--green)" : "var(--accent-light)" }}>
              {dayCompleted ? "✓" : mod.day}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Day {mod.day} — {mod.title}</h1>
              <p className="text-sm text-[var(--text2)]">{mod.subtitle}</p>
            </div>
            {prevScore && (
              <span className="px-3 py-1 rounded-lg text-sm font-bold" style={{ background: `${getScoreColor(prevScore.score)}20`, color: getScoreColor(prevScore.score) }}>
                {prevScore.score} 分
              </span>
            )}
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-[var(--bg2)] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${taskProgress}%`, background: taskProgress === 100 ? "var(--green)" : "linear-gradient(90deg, var(--accent), var(--teal))" }} />
            </div>
            <span className="text-sm font-bold" style={{ color: taskProgress === 100 ? "var(--green)" : "var(--accent)" }}>
              {doneTasks.length}/{mod.tasks.length}
            </span>
          </div>
          {/* Description */}
          <p className="text-sm text-[var(--text2)] mt-4 leading-relaxed">{mod.description}</p>
        </div>

        {!quizMode ? (
          <div className="space-y-3">
            {/* KPI Targets */}
            {mod.kpiTargets && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 mb-2">
                <p className="text-xs font-bold text-[var(--text3)] mb-3">今日 KPI 目標</p>
                <div className="grid grid-cols-3 gap-3">
                  {mod.kpiTargets.calls && <div className="text-center p-2 bg-[var(--bg2)] rounded-lg"><p className="text-lg font-bold" style={{ color: "var(--accent)" }}>{mod.kpiTargets.calls}</p><p className="text-[10px] text-[var(--text3)]">進線數</p></div>}
                  {mod.kpiTargets.talkTime && <div className="text-center p-2 bg-[var(--bg2)] rounded-lg"><p className="text-lg font-bold" style={{ color: "var(--teal)" }}>{mod.kpiTargets.talkTime}</p><p className="text-[10px] text-[var(--text3)]">通話時長</p></div>}
                  {mod.kpiTargets.invites && <div className="text-center p-2 bg-[var(--bg2)] rounded-lg"><p className="text-lg font-bold" style={{ color: "var(--gold)" }}>{mod.kpiTargets.invites}</p><p className="text-[10px] text-[var(--text3)]">邀約數</p></div>}
                </div>
              </div>
            )}

            {/* Task List */}
            <div className="space-y-2">
              {mod.tasks.map((task, idx) => {
                const isQuizTask = task.type === "quiz";
                const isDone = isQuizTask ? dayCompleted : taskDone[task.id];
                const isCurrent = task.id === firstUndone?.id;
                const isExpanded = expandedTask === task.id;
                const resource = task.resourceIndex !== undefined && mod.resources ? mod.resources[task.resourceIndex] : null;

                return (
                  <div key={task.id}>
                    <div
                      className={`relative rounded-xl border transition-all cursor-pointer ${
                        isDone
                          ? "bg-[var(--card)] border-[var(--green)] border-opacity-30"
                          : isCurrent
                          ? "bg-[var(--card)] border-[var(--accent)] shadow-lg shadow-[var(--accent)]/10"
                          : "bg-[var(--card)] border-[var(--border)] opacity-70"
                      }`}
                      onClick={() => {
                        if (isQuizTask) {
                          setQuizMode(true);
                          setAnswers(new Array(mod.quiz.length).fill(-1));
                          setQuizSubmitted(false);
                        } else {
                          setExpandedTask(isExpanded ? null : task.id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 p-4">
                        {/* Step number / checkbox */}
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                            isDone
                              ? "bg-[rgba(34,197,94,0.15)]"
                              : isCurrent
                              ? "bg-[rgba(99,102,241,0.15)]"
                              : "bg-[var(--bg2)]"
                          }`}
                          style={{ color: isDone ? "var(--green)" : isCurrent ? "var(--accent)" : "var(--text3)" }}
                        >
                          {isDone ? "✓" : TASK_ICONS[task.type]}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold text-sm ${isDone ? "line-through text-[var(--text3)]" : ""}`}>
                              {idx + 1}. {task.title}
                            </span>
                            {isCurrent && !isDone && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent-light)" }}>
                                下一步
                              </span>
                            )}
                          </div>
                          {task.time && (
                            <span className="text-[11px] font-mono" style={{ color: "var(--teal)" }}>{task.time}</span>
                          )}
                        </div>

                        {/* Checkbox / action */}
                        {!isQuizTask ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
                            className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${
                              isDone ? "border-[var(--green)] bg-[var(--green)]" : "border-[var(--border)] hover:border-[var(--accent)]"
                            }`}
                          >
                            {isDone && <span className="text-white text-xs font-bold">✓</span>}
                          </button>
                        ) : (
                          <div className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: isDone ? "rgba(34,197,94,0.15)" : "linear-gradient(135deg, var(--accent), var(--teal))", color: isDone ? "var(--green)" : "#fff" }}>
                            {isDone ? "已通過" : "開始測驗"}
                          </div>
                        )}
                      </div>

                      {/* Expanded content */}
                      {isExpanded && !isQuizTask && (
                        <div className="px-4 pb-4 pt-0">
                          <div className="border-t border-[var(--border)] pt-3 space-y-2">
                            {task.description && (
                              <p className="text-sm text-[var(--text2)]">{task.description}</p>
                            )}
                            {task.tip && (
                              <div className="flex gap-2 items-start">
                                <span className="text-[var(--gold)] shrink-0">💡</span>
                                <p className="text-xs text-[var(--gold)]">{task.tip}</p>
                              </div>
                            )}
                            {resource && (
                              <a
                                href={resource.driveFileId ? getDriveLink(resource.driveFileId, 'video') : resource.url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-2 p-2 bg-[var(--bg2)] rounded-lg hover:border-[var(--accent)] border border-transparent transition-all text-sm"
                              >
                                <span>{resource.type === 'video' ? '🎬' : resource.type === 'recording' ? '🎙️' : '📝'}</span>
                                <span className="text-[var(--accent-light)] font-medium truncate">{resource.title}</span>
                                <span className="text-[var(--text3)] text-xs ml-auto shrink-0">打開 →</span>
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Key Points */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 mt-4">
              <h3 className="font-bold mb-3 text-sm" style={{ color: "var(--gold)" }}>💡 關鍵要點</h3>
              <div className="space-y-2">
                {mod.keyPoints.map((kp, i) => (
                  <p key={i} className="text-xs text-[var(--text2)] leading-relaxed">• {kp}</p>
                ))}
              </div>
            </div>

            {/* Trainer Tips */}
            {mod.trainerTips && mod.trainerTips.length > 0 && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
                <h3 className="font-bold mb-3 text-sm" style={{ color: "var(--gold)" }}>⚡ 講師提醒</h3>
                <div className="space-y-2">
                  {mod.trainerTips.map((tip, i) => (
                    <p key={i} className="text-xs text-[var(--text2)] leading-relaxed">• {tip}</p>
                  ))}
                </div>
              </div>
            )}

            {/* All Resources */}
            {mod.resources && mod.resources.length > 0 && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
                <h3 className="font-bold mb-3 text-sm" style={{ color: "var(--teal)" }}>📚 教學資源</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {mod.resources.map((res, ri) => {
                    const icon = res.type === 'video' ? '🎬' : res.type === 'recording' ? '🎙️' : res.type === 'notion' ? '📝' : '📄';
                    const href = res.driveFileId ? getDriveLink(res.driveFileId, 'video') : res.url || '#';
                    return (
                      <a key={ri} href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2.5 bg-[var(--bg2)] rounded-lg hover:border-[var(--accent)] border border-transparent transition-all">
                        <span className="text-base">{icon}</span>
                        <span className="text-xs font-medium truncate">{res.title}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Quiz Mode */
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setQuizMode(false)} className="text-sm text-[var(--text2)] hover:text-[var(--text)]">← 回到任務</button>
              <span className="text-sm font-bold">每日測驗（{mod.quiz.length} 題）</span>
            </div>
            {mod.quiz.map((q, qi) => (
              <div key={qi} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
                <p className="font-semibold mb-3">{qi + 1}. {q.question}</p>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => {
                    const isSelected = answers[qi] === oi;
                    const isCorrect = quizSubmitted && oi === q.answer;
                    const isWrong = quizSubmitted && isSelected && oi !== q.answer;
                    return (
                      <button key={oi} onClick={() => { if (quizSubmitted) return; const na = [...answers]; na[qi] = oi; setAnswers(na); }}
                        className={`w-full text-left px-4 py-2.5 rounded-lg border transition-all text-sm ${isCorrect ? "border-[var(--green)] bg-[rgba(16,172,132,0.1)]" : isWrong ? "border-[var(--red)] bg-[rgba(238,90,82,0.1)]" : isSelected ? "border-[var(--accent)] bg-[rgba(124,108,240,0.1)]" : "border-[var(--border)] hover:border-[var(--accent)]"}`}
                        disabled={quizSubmitted}>{opt}</button>
                    );
                  })}
                </div>
              </div>
            ))}
            {!quizSubmitted ? (
              <button onClick={handleQuizSubmit} disabled={answers.includes(-1)}
                className="w-full px-6 py-3 rounded-xl font-bold text-white disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))" }}>
                提交測驗
              </button>
            ) : (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 text-center">
                {(() => {
                  const correct = mod.quiz.reduce((c, q, i) => c + (answers[i] === q.answer ? 1 : 0), 0);
                  const score = Math.round((correct / mod.quiz.length) * 100);
                  return (
                    <>
                      <p className="text-3xl font-bold mb-2" style={{ color: getScoreColor(score) }}>{score} 分</p>
                      <p className="text-sm text-[var(--text2)]">{correct}/{mod.quiz.length} 正確</p>
                      <p className="text-sm mt-3" style={{ color: score >= 60 ? "var(--green)" : "var(--red)" }}>
                        {score >= 60 ? "🎉 恭喜通過！已解鎖下一天訓練" : "未達 60 分及格線，複習後再試一次"}
                      </p>
                      {score >= 60 && (
                        <button onClick={() => { setQuizMode(false); setSelectedModule(null); }}
                          className="mt-4 px-6 py-2.5 rounded-lg font-bold text-white"
                          style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))" }}>
                          繼續下一天 →
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ─── Module List View ─── */
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">課程訓練</h1>
        <p className="text-[var(--text2)] text-sm">完成每天的任務和測驗，逐步解鎖下一階段</p>
        {/* Overall progress */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2.5 bg-[var(--bg2)] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.round((user.completedModules.length / 9) * 100)}%`, background: "linear-gradient(90deg, var(--accent), var(--teal), var(--green))" }} />
          </div>
          <span className="text-sm font-bold text-[var(--accent)]">{user.completedModules.length}/9</span>
        </div>
      </div>

      <div className="space-y-3">
        {modules.map((m) => {
          const completed = user.completedModules.includes(m.id);
          const prevCompleted = m.id === 1 || user.completedModules.includes(m.id - 1);
          const locked = !completed && !prevCompleted;
          const isCurrent = !completed && prevCompleted;
          const score = user.quizScores.find((s) => s.moduleId === m.id);
          const mDoneTasks = m.tasks.filter((t) => t.type === "quiz" ? completed : taskDone[t.id]);
          const mProgress = m.tasks.length > 0 ? Math.round((mDoneTasks.length / m.tasks.length) * 100) : 0;

          return (
            <button
              key={m.id}
              onClick={() => !locked && setSelectedModule(m.id)}
              disabled={locked}
              className={`w-full text-left rounded-xl border transition-all ${
                locked ? "opacity-35 cursor-not-allowed border-[var(--border)] bg-[var(--card)]"
                  : isCurrent ? "border-[var(--accent)] bg-[var(--card)] shadow-lg shadow-[var(--accent)]/10"
                  : completed ? "border-[var(--green)] border-opacity-40 bg-[var(--card)]"
                  : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]"
              }`}
            >
              <div className="flex items-center gap-4 p-4 pb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${
                  completed ? "bg-[rgba(34,197,94,0.15)] text-[var(--green)]"
                    : isCurrent ? "bg-[rgba(99,102,241,0.15)] text-[var(--accent-light)]"
                    : "bg-[var(--bg2)] text-[var(--text3)]"
                }`}>
                  {completed ? "✓" : locked ? "🔒" : m.day}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">Day {m.day} — {m.title}</p>
                    {isCurrent && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0" style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent-light)" }}>進行中</span>}
                  </div>
                  <p className="text-xs text-[var(--text3)] truncate">{m.subtitle}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {score && <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: `${getScoreColor(score.score)}20`, color: getScoreColor(score.score) }}>{score.score}分</span>}
                  {m.hasSparring && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[rgba(0,210,211,0.1)] text-[var(--teal)]">含對練</span>}
                </div>
              </div>
              {/* Mini progress bar */}
              {!locked && (
                <div className="px-4 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[var(--bg2)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${mProgress}%`, background: completed ? "var(--green)" : "var(--accent)" }} />
                    </div>
                    <span className="text-[10px] text-[var(--text3)]">{mDoneTasks.length}/{m.tasks.length}</span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== SPARRING ===================== */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { interface Window { webkitSpeechRecognition: any; SpeechRecognition: any; } }

interface CoachingTip {
  emoji: string;
  tip: string;
  suggested: string;
  timestamp: number;
}

function SparringPage({ user, onUpdate }: { user: User; onUpdate: () => void }) {
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [feedback, setFeedback] = useState<{
    scores: import("@/lib/store").SparringScores;
    highlights: string[];
    improvements: string[];
    summary: string;
  } | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  // Voice states
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [interimText, setInterimText] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);

  // Coaching states
  const [coachingTips, setCoachingTips] = useState<CoachingTip[]>([]);
  const [latestTip, setLatestTip] = useState<CoachingTip | null>(null);
  const [showCoachPanel, setShowCoachPanel] = useState(true);

  // Refs
  const recognitionRef = useRef<ReturnType<typeof Object> | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef("");
  const sendingRef = useRef(false);
  sendingRef.current = sending;

  const brandPersonas = getPersonasByBrand(user.brand);
  const persona = personas.find((p) => p.id === selectedPersona);
  const brand = brands[user.brand];

  // Init speech APIs
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setVoiceSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "zh-TW";
        recognition.maxAlternatives = 1;
        recognitionRef.current = recognition;
      }
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimText]);

  // Speak text using TTS
  const speakText = useCallback((text: string) => {
    if (!synthRef.current || !voiceEnabled) return;
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-TW";
    utterance.rate = 1.1;
    utterance.pitch = 1.0;

    const voices = synthRef.current.getVoices();
    const zhVoice = voices.find(
      (v) => v.lang.startsWith("zh") && v.name.includes("Mei")
    ) || voices.find((v) => v.lang.startsWith("zh-TW"))
      || voices.find((v) => v.lang.startsWith("zh"));
    if (zhVoice) utterance.voice = zhVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // Auto-start listening after AI finishes speaking (phone-call flow)
      if (voiceEnabled && sessionActive) {
        setTimeout(() => {
          if (!sendingRef.current) startListening();
        }, 200);
      }
    };
    synthRef.current.speak(utterance);
  }, [voiceEnabled, sessionActive]);

  // Track whether we want to keep listening
  const wantListeningRef = useRef(false);

  // Auto-send: called when silence detected
  const autoSendVoice = useCallback(() => {
    const text = transcriptRef.current.trim();
    if (!text || sendingRef.current) return;
    // Stop listening, clear state, then send
    wantListeningRef.current = false;
    const recognition = recognitionRef.current;
    if (recognition) {
      try { recognition.stop(); } catch { /* */ }
    }
    setIsListening(false);
    setInterimText("");
    setInput("");
    transcriptRef.current = "";
    sendMessage(text);
  }, []);

  // Start voice recognition — fresh transcript each time
  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || sendingRef.current || isSpeaking) return;
    if (wantListeningRef.current) return;

    // Clear all previous transcript state
    transcriptRef.current = "";
    setInterimText("");
    setInput("");
    wantListeningRef.current = true;
    setIsListening(true);

    recognition.onresult = (event: { resultIndex: number; results: { length: number; [key: number]: { isFinal: boolean; [key: number]: { transcript: string } } } }) => {
      let fullFinal = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          fullFinal += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      const display = fullFinal + interim;
      transcriptRef.current = display;
      setInterimText(display);
      setInput(display);

      // Reset silence timer — auto-send after 1.5s of silence
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (display.trim()) {
        silenceTimerRef.current = setTimeout(() => {
          if (wantListeningRef.current && transcriptRef.current.trim()) {
            autoSendVoice();
          }
        }, 1500);
      }
    };

    recognition.onerror = (e: { error: string }) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantListeningRef.current = false;
        setIsListening(false);
      }
      // On "no-speech", just keep going
    };

    recognition.onend = () => {
      if (wantListeningRef.current && !sendingRef.current) {
        try {
          recognition.start();
        } catch {
          wantListeningRef.current = false;
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    try {
      recognition.start();
    } catch {
      wantListeningRef.current = false;
      setIsListening(false);
    }
  }, [isSpeaking, autoSendVoice]);

  // Stop voice recognition
  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    wantListeningRef.current = false;
    const recognition = recognitionRef.current;
    if (recognition) {
      try { recognition.stop(); } catch { /* ignore */ }
    }
    setIsListening(false);
    setInterimText("");
    transcriptRef.current = "";
  }, []);

  // Fetch coaching tip after each exchange
  const fetchCoachingTip = useCallback(async (
    allMessages: { role: "user" | "assistant"; content: string }[],
    lastUser: string,
    lastAi: string
  ) => {
    try {
      const res = await fetch("/api/coaching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages,
          personaName: persona?.name,
          brandName: brand?.fullName,
          lastUserMsg: lastUser,
          lastAiMsg: lastAi,
        }),
      });
      const tip = await res.json();
      const coachTip: CoachingTip = { ...tip, timestamp: Date.now() };
      setLatestTip(coachTip);
      setCoachingTips((prev) => [...prev, coachTip]);
    } catch {
      // Silently fail
    }
  }, [persona?.name, brand?.fullName]);

  // Send message (voice or text)
  const sendMessage = async (textOverride?: string) => {
    const text = textOverride || input;
    if (!text.trim() || !persona || sendingRef.current) return;

    // Clear all voice state
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    wantListeningRef.current = false;
    const recognition = recognitionRef.current;
    if (recognition) {
      try { recognition.stop(); } catch { /* */ }
    }
    setIsListening(false);
    transcriptRef.current = "";

    const userMsg = { role: "user" as const, content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setInterimText("");
    setSending(true);

    try {
      const res = await fetch("/api/sparring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          systemPrompt: persona.systemPrompt,
          brandName: brand.fullName,
          personaName: persona.name,
        }),
      });
      const data = await res.json();
      const aiMsg = { role: "assistant" as const, content: data.reply };
      const updatedMessages = [...newMessages, aiMsg];
      setMessages(updatedMessages);

      setSending(false);

      // Speak AI response — speakText.onend will auto-start listening
      if (voiceEnabled) {
        speakText(data.reply);
      } else {
        // Text mode: no auto-listen
      }

      // Fetch coaching tip in background
      fetchCoachingTip(updatedMessages, text.trim(), data.reply);
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "（系統錯誤，請稍後再試）" },
      ]);
      setSending(false);
    }
  };

  // Handle voice send: stop listening, then send what we have
  const handleVoiceSend = () => {
    const text = transcriptRef.current.trim() || input.trim();
    if (text) {
      sendMessage(text);
    }
  };

  const endSession = async () => {
    if (messages.length < 4) return;
    stopListening();
    if (synthRef.current) synthRef.current.cancel();
    setLoadingFeedback(true);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          personaName: persona?.name,
          brandName: brand.fullName,
        }),
      });
      const data = await res.json();
      setFeedback(data);

      const record: SparringRecord = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        personaId: selectedPersona!,
        personaName: persona?.name || "",
        messages,
        scores: data.scores,
        feedback: data.summary,
        duration: Math.round((Date.now() - startTime) / 1000),
      };
      addSparringRecord(user.email, record);
      onUpdate();
    } catch {
      const scores = scoreConversation(messages);
      setFeedback({
        scores,
        highlights: ["完成了一次對練"],
        improvements: ["試著多使用 SPIN 提問技巧"],
        summary: "繼續練習會越來越好！",
      });
    }
    setLoadingFeedback(false);
    setSessionActive(false);
  };

  // ===== FEEDBACK VIEW =====
  if (feedback && persona) {
    return (
      <div className="animate-fade-in max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">對練報告</h1>
          <p className="text-[var(--text2)]">與 {persona.name} 的對練分析</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
            <div className="text-center mb-4">
              <span className="text-5xl font-bold" style={{ color: getScoreColor(feedback.scores.overall) }}>
                {feedback.scores.overall}
              </span>
              <p className="text-sm text-[var(--text2)] mt-1">{getScoreLabel(feedback.scores.overall)}</p>
            </div>
            <ScoreRadar scores={feedback.scores} />
          </div>

          <div className="space-y-4">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <h3 className="font-bold mb-2" style={{ color: "var(--green)" }}>做得好的地方</h3>
              {feedback.highlights.map((h, i) => (
                <p key={i} className="text-sm text-[var(--text2)] mb-1.5">✅ {h}</p>
              ))}
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <h3 className="font-bold mb-2" style={{ color: "var(--orange)" }}>改善建議</h3>
              {feedback.improvements.map((imp, i) => (
                <p key={i} className="text-sm text-[var(--text2)] mb-1.5">💡 {imp}</p>
              ))}
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <h3 className="font-bold mb-2" style={{ color: "var(--accent-light)" }}>整體評語</h3>
              <p className="text-sm">{feedback.summary}</p>
            </div>
          </div>
        </div>

        {/* Coaching tips history */}
        {coachingTips.length > 0 && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 mt-6">
            <h3 className="font-bold mb-4">教練即時反饋紀錄</h3>
            <div className="space-y-2">
              {coachingTips.map((tip, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-[var(--bg2)] rounded-lg">
                  <span className="text-xl">{tip.emoji}</span>
                  <div>
                    <p className="text-sm">{tip.tip}</p>
                    {tip.suggested && (
                      <p className="text-xs text-[var(--teal)] mt-1 italic">💬 {tip.suggested}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conversation review */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 mt-6">
          <h3 className="font-bold mb-4">對話回顧</h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] px-4 py-2.5 text-sm ${m.role === "user" ? "chat-user" : "chat-ai"}`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              setFeedback(null);
              setMessages([]);
              setCoachingTips([]);
              setLatestTip(null);
              setSessionActive(true);
              setStartTime(Date.now());
            }}
            className="px-6 py-3 rounded-lg font-bold text-white"
            style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))" }}
          >
            再練一次（同客戶）
          </button>
          <button
            onClick={() => {
              setFeedback(null);
              setMessages([]);
              setCoachingTips([]);
              setLatestTip(null);
              setSelectedPersona(null);
              setSessionActive(false);
            }}
            className="px-6 py-3 rounded-lg font-bold border border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)]"
          >
            選擇其他客戶
          </button>
        </div>
      </div>
    );
  }

  // ===== ACTIVE VOICE SPARRING SESSION =====
  if (sessionActive && persona) {
    const liveScore = messages.filter((m) => m.role === "user").length >= 2
      ? scoreConversation(messages)
      : null;

    return (
      <div className="animate-fade-in flex h-[calc(100vh-64px)] gap-4">
        {/* Main conversation area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center gap-4 pb-4 border-b border-[var(--border)] mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold relative"
              style={{ background: brand.colorLight, color: brand.color }}
            >
              {persona.name.charAt(0)}
              {isSpeaking && (
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-[var(--green)] rounded-full flex items-center justify-center">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                </span>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold">{persona.name}</p>
                {isSpeaking && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(16,172,132,0.15)] text-[var(--green)] animate-pulse">
                    說話中...
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text2)]">
                {persona.occupation} · {"★".repeat(persona.difficulty)}{"☆".repeat(3 - persona.difficulty)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {liveScore && (
                <span
                  className="px-3 py-1 rounded-lg text-xs font-bold"
                  style={{ background: `${getScoreColor(liveScore.overall)}20`, color: getScoreColor(liveScore.overall) }}
                >
                  {liveScore.overall} 分
                </span>
              )}
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  voiceEnabled
                    ? "bg-[rgba(0,210,211,0.15)] text-[var(--teal)]"
                    : "bg-[var(--bg2)] text-[var(--text3)]"
                }`}
              >
                {voiceEnabled ? "🔊 語音開" : "🔇 語音關"}
              </button>
              <button
                onClick={() => setShowCoachPanel(!showCoachPanel)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  showCoachPanel
                    ? "bg-[rgba(254,202,87,0.15)] text-[var(--gold)]"
                    : "bg-[var(--bg2)] text-[var(--text3)]"
                }`}
              >
                🧑‍🏫 教練
              </button>
              <button
                onClick={endSession}
                disabled={messages.length < 4 || loadingFeedback}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[var(--red)] text-white disabled:opacity-40"
              >
                {loadingFeedback ? "分析中..." : "結束對練"}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 pb-4">
            {messages.length === 0 && (
              <div className="text-center py-16 text-[var(--text3)]">
                <p className="text-5xl mb-4">📞</p>
                <p className="text-lg">電話對練模式</p>
                <p className="text-sm mt-2">你是 {brand.fullName} 的業務顧問</p>
                <p className="text-sm">客戶「{persona.name}」已接聽電話</p>
                <p className="text-sm mt-4 text-[var(--accent)]">
                  {voiceSupported ? "按麥克風開始 — 說完自動發送，像講電話一樣" : "你的瀏覽器不支援語音，請使用打字模式"}
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
              >
                <div className="flex flex-col gap-1 max-w-[75%]">
                  <span className={`text-[10px] ${m.role === "user" ? "text-right" : "text-left"} text-[var(--text3)]`}>
                    {m.role === "user" ? "你（業務）" : persona.name}
                  </span>
                  <div className={`px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "chat-user" : "chat-ai"}`}>
                    {m.content}
                  </div>
                </div>
              </div>
            ))}
            {/* Interim voice text */}
            {isListening && interimText && (
              <div className="flex justify-end animate-fade-in">
                <div className="max-w-[75%]">
                  <span className="text-[10px] text-right block text-[var(--text3)]">正在聽...</span>
                  <div className="chat-user px-4 py-3 text-sm opacity-60 italic">
                    {interimText}
                  </div>
                </div>
              </div>
            )}
            {sending && (
              <div className="flex justify-start animate-fade-in">
                <div className="chat-ai px-4 py-3 text-sm">
                  <span className="inline-flex gap-1">
                    <span className="w-2 h-2 bg-[var(--text3)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-[var(--text3)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-[var(--text3)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice + Text Input */}
          <div className="pt-4 border-t border-[var(--border)]">
            <div className="flex items-center gap-3">
              {/* Mic button */}
              {voiceSupported && (
                <button
                  onClick={isListening ? handleVoiceSend : startListening}
                  disabled={sending || isSpeaking}
                  className={`relative w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all disabled:opacity-30 shrink-0 ${
                    isListening
                      ? "bg-[var(--red)] text-white shadow-[0_0_30px_rgba(238,90,82,0.4)]"
                      : "bg-[var(--card)] border-2 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
                  }`}
                >
                  {isListening ? "⏹" : "🎤"}
                  {isListening && (
                    <span className="absolute inset-0 rounded-full border-2 border-[var(--red)] animate-ping opacity-30" />
                  )}
                </button>
              )}

              {/* Text input */}
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={isListening ? "正在聽你說話..." : "打字或按麥克風說話..."}
                  className="flex-1 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg2)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  disabled={sending || isSpeaking}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || sending}
                  className="px-5 py-3 rounded-xl font-bold text-white disabled:opacity-40 shrink-0"
                  style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))" }}
                >
                  發送
                </button>
              </div>
            </div>

            {/* Voice status bar */}
            {isListening && (
              <div className="flex items-center gap-2 mt-2 px-2">
                <span className="w-2 h-2 bg-[var(--red)] rounded-full animate-pulse" />
                <span className="text-xs text-[var(--red)]">
                  {interimText ? "聽到了，停頓後自動發送..." : "正在聽你說話..."}
                </span>
                <div className="flex-1 flex justify-end gap-1">
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-[var(--accent)] rounded-full animate-pulse"
                      style={{
                        height: `${Math.random() * 16 + 4}px`,
                        animationDelay: `${i * 80}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            {isSpeaking && (
              <div className="flex items-center gap-2 mt-2 px-2">
                <span className="w-2 h-2 bg-[var(--green)] rounded-full animate-pulse" />
                <span className="text-xs text-[var(--green)]">對方說話中，說完後自動輪到你...</span>
              </div>
            )}
          </div>
        </div>

        {/* Coach Panel (right sidebar) */}
        {showCoachPanel && (
          <div className="w-[280px] shrink-0 flex flex-col gap-3">
            {/* Latest tip */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🧑‍🏫</span>
                <h3 className="font-bold text-sm">即時教練</h3>
              </div>
              {latestTip ? (
                <div className="animate-fade-in">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-2xl">{latestTip.emoji}</span>
                    <p className="text-sm leading-relaxed">{latestTip.tip}</p>
                  </div>
                  {latestTip.suggested && (
                    <div className="mt-3 p-3 bg-[var(--bg2)] rounded-lg border-l-2 border-[var(--teal)]">
                      <p className="text-[10px] text-[var(--teal)] mb-1">建議話術</p>
                      <p className="text-xs text-[var(--text2)] italic leading-relaxed">
                        「{latestTip.suggested}」
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[var(--text3)]">
                  開始對話後，教練會即時給你反饋
                </p>
              )}
            </div>

            {/* Live scores */}
            {liveScore && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                <h3 className="font-bold text-sm mb-3">即時表現</h3>
                <div className="space-y-2">
                  {(Object.entries(SCORE_LABELS) as [keyof typeof SCORE_LABELS, string][])
                    .filter(([k]) => k !== "overall")
                    .map(([key, label]) => (
                      <div key={key}>
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-[var(--text3)]">{label}</span>
                          <span style={{ color: getScoreColor(liveScore[key]) }}>
                            {liveScore[key]}
                          </span>
                        </div>
                        <div className="h-1.5 bg-[var(--bg2)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${liveScore[key]}%`,
                              background: getScoreColor(liveScore[key]),
                            }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Tips history */}
            {coachingTips.length > 1 && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex-1 overflow-y-auto">
                <h3 className="font-bold text-sm mb-2">教練紀錄</h3>
                <div className="space-y-2">
                  {coachingTips.slice(-5).reverse().map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-[var(--bg2)] rounded-lg">
                      <span>{tip.emoji}</span>
                      <p className="text-[11px] text-[var(--text2)] leading-relaxed">{tip.tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ===== PERSONA SELECTION =====
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI 語音對練</h1>
        <p className="text-[var(--text2)]">
          選擇客戶 → 用語音對練 → 即時教練反饋 → 結束後獲得完整報告
        </p>
        {!voiceSupported && (
          <p className="text-sm text-[var(--orange)] mt-2">
            你的瀏覽器不支援語音辨識，建議使用 Chrome 瀏覽器以獲得最佳體驗
          </p>
        )}
      </div>

      {/* How it works */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { icon: "🎤", title: "語音對話", desc: "按麥克風說話，AI 客戶用語音回覆" },
          { icon: "🧑‍🏫", title: "即時教練", desc: "每輪對話後教練給你口語化提醒" },
          { icon: "📊", title: "即時評分", desc: "6 維度即時顯示你的表現" },
          { icon: "📝", title: "完整報告", desc: "結束後獲得詳細分析與改善建議" },
        ].map((s, i) => (
          <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 text-center">
            <p className="text-2xl mb-2">{s.icon}</p>
            <p className="font-bold text-sm">{s.title}</p>
            <p className="text-[10px] text-[var(--text3)] mt-1">{s.desc}</p>
          </div>
        ))}
      </div>

      <h3 className="font-bold mb-3" style={{ color: brand.color }}>
        {brand.fullName} 客戶
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {brandPersonas.map((p) => {
          const pastRecords = user.sparringRecords.filter((r) => r.personaId === p.id);
          const bestScore = pastRecords.length > 0 ? Math.max(...pastRecords.map((r) => r.scores.overall)) : null;

          return (
            <button
              key={p.id}
              onClick={() => {
                setSelectedPersona(p.id);
                setMessages([]);
                setCoachingTips([]);
                setLatestTip(null);
                setSessionActive(true);
                setStartTime(Date.now());
                setFeedback(null);
              }}
              className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 text-left hover:border-[var(--accent)] transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform"
                  style={{ background: brand.colorLight, color: brand.color }}
                >
                  {p.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold">{p.name}</p>
                  <p className="text-xs text-[var(--text3)]">{p.occupation}，{p.age}歲</p>
                </div>
              </div>

              <p className="text-sm text-[var(--text2)] mb-3">{p.description}</p>

              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {[1, 2, 3].map((d) => (
                    <span key={d} className={`text-sm ${d <= p.difficulty ? "text-[var(--gold)]" : "text-[var(--border)]"}`}>★</span>
                  ))}
                </div>
                {bestScore !== null && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: `${getScoreColor(bestScore)}20`, color: getScoreColor(bestScore) }}>
                    最高 {bestScore}
                  </span>
                )}
                {pastRecords.length > 0 && (
                  <span className="text-[10px] text-[var(--text3)]">{pastRecords.length}次</span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {p.objections.slice(0, 2).map((o, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg2)] text-[var(--text3)]">
                    「{o.slice(0, 10)}...」
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
}

/* ===================== TRANSCRIPTS ===================== */
function TranscriptsPage({ brandId }: { brandId: string }) {
  const brand = brands[brandId];

  const transcripts: Record<string, { title: string; customer: string; steps: { title: string; lines: { speaker: string; text: string }[]; keyPoint: string }[] }> = {
    nschool: {
      title: "在職有經驗保守型客戶開發",
      customer: "陳先生，42歲工程師，投資 ETF 為主",
      steps: [
        {
          title: "Step 1 — 開場破冰",
          lines: [
            { speaker: "業務", text: "陳先生您好！我是 nSchool 的顧問小王，感謝您撥空接聽。之前看到您有填寫我們的投資體驗問卷，想跟您聊聊您目前的投資狀況。" },
            { speaker: "客戶", text: "嗯，對，我有填。不過我自己有在投資了，主要買 ETF。" },
            { speaker: "業務", text: "太好了！有投資經驗的人和我們聊最有收穫。方便請教一下，您投資大概多久了？" },
          ],
          keyPoint: "不要被「我已經有在投資」嚇退，反而用它作為深入了解的切入點",
        },
        {
          title: "Step 2 — 需求探詢 (SPIN-S)",
          lines: [
            { speaker: "客戶", text: "大概十年了吧，主要就是 0050、0056 這些。" },
            { speaker: "業務", text: "十年資歷很不錯！那您目前的年化報酬大概在什麼水位？" },
            { speaker: "客戶", text: "大概 5-7% 左右，還算穩定。" },
          ],
          keyPoint: "用具體數字確認客戶現狀，為後面的痛點挖掘做準備",
        },
        {
          title: "Step 3 — 痛點放大 (SPIN-P/I)",
          lines: [
            { speaker: "業務", text: "5-7% 確實穩健。不過我好奇一下，以您的資歷和資金規模，有沒有想過報酬率其實可以更高？" },
            { speaker: "客戶", text: "有想過啦，但我比較保守，不想承擔太大風險。" },
            { speaker: "業務", text: "完全理解。不過您有算過嗎？如果年化從 6% 提升到 10%，以您的資金規模，10 年後的差距可能是好幾百萬。這個機會成本其實蠻大的。" },
          ],
          keyPoint: "用具體數字讓客戶感受「不行動的代價」— 這就是 Implication",
        },
        {
          title: "Step 4 — 方案呈現",
          lines: [
            { speaker: "客戶", text: "幾百萬...這樣說的話確實值得研究一下。" },
            { speaker: "業務", text: "我們 nSchool 有一套系統化的投資課程，特別適合像您這樣有基礎但想突破的人。不只教理論，更重要的是教您一套完整的選股和風控系統。" },
          ],
          keyPoint: "方案呈現要對應客戶的痛點，不要做功能展示",
        },
        {
          title: "Step 5 — 異議處理",
          lines: [
            { speaker: "客戶", text: "聽起來不錯，但網路上免費資源也很多，為什麼要花這個錢？" },
            { speaker: "業務", text: "陳先生，您投資十年了，這十年的經驗告訴您：自學最貴的成本是什麼？" },
            { speaker: "客戶", text: "嗯...大概是時間和踩坑的損失吧。" },
            { speaker: "業務", text: "完全正確。我們的課程就是幫您把這兩個成本降到最低。" },
          ],
          keyPoint: "讓客戶自己說出答案比你告訴他更有說服力",
        },
        {
          title: "Step 6 — 推進成交",
          lines: [
            { speaker: "業務", text: "這樣吧，我們下週有一場免費的投資策略分享會，我幫您保留一個位置？您可以先來聽聽看，覺得適合再決定。" },
            { speaker: "客戶", text: "免費的啊？那好，幫我安排吧。" },
          ],
          keyPoint: "不要在電話裡直接推高價方案，先用低門檻的下一步建立關係",
        },
      ],
    },
    xuemi: {
      title: "機械工程師轉職 UIUX 設計師",
      customer: "張小姐，26歲，機械系畢業，自學 Figma 中",
      steps: [
        {
          title: "Step 1 — 開場破冰",
          lines: [
            { speaker: "業務", text: "張小姐您好！我是學米的顧問，看到您有在了解 UI/UX 轉職的課程。現在方便聊幾分鐘嗎？" },
            { speaker: "客戶", text: "嗯嗯可以啊！我最近一直在看轉職的東西。" },
          ],
          keyPoint: "轉職者通常很積極，開場不用太花時間，直接切入需求",
        },
        {
          title: "Step 2 — 需求探詢",
          lines: [
            { speaker: "業務", text: "太好了！方便跟我分享一下，是什麼讓您想從機械轉到 UI/UX 呢？" },
            { speaker: "客戶", text: "我覺得機械太無聊了...而且我一直對設計很有興趣，自學了 3 個月的 Figma。" },
          ],
          keyPoint: "了解轉職動機比了解技術背景更重要",
        },
        {
          title: "Step 3 — 痛點放大",
          lines: [
            { speaker: "業務", text: "自學 3 個月很棒！那我想請問，目前自學遇到最大的困難是什麼？" },
            { speaker: "客戶", text: "就是...我不確定做出來的東西夠不夠好，也不知道作品集要怎麼準備才能投履歷。" },
            { speaker: "業務", text: "這其實是自學最大的盲點 — 沒有人幫你看、幫你改。如果繼續這樣，可能再學半年還是不確定自己準備好了沒有。" },
          ],
          keyPoint: "放大「自學沒有反饋」的痛點",
        },
        {
          title: "Step 4 — 方案呈現",
          lines: [
            { speaker: "業務", text: "學米的課程最大特色就是「一對一作品集輔導」，導師會直接幫你看作品、給修改建議，確保你的作品集能通過面試。" },
            { speaker: "客戶", text: "哇真的嗎！有作品集輔導聽起來超讚的！" },
          ],
          keyPoint: "直接解決客戶最在意的痛點",
        },
        {
          title: "Step 5 — 異議處理",
          lines: [
            { speaker: "客戶", text: "但是...這課程多少錢啊？我存款不多。" },
            { speaker: "業務", text: "我理解預算是考量。我們有分期方案，一個月大概 5000 多。您想一下，現在投資學習，轉職後薪水可能從 4 萬變 5-6 萬，這個投報率其實很高。" },
          ],
          keyPoint: "把學費轉化成投資概念，計算 ROI",
        },
        {
          title: "Step 6 — 推進成交",
          lines: [
            { speaker: "業務", text: "這樣吧，我先幫您安排一次免費的設計能力評估，讓導師看看您目前的程度，幫您規劃最適合的學習路線。" },
            { speaker: "客戶", text: "好！我要預約！" },
          ],
          keyPoint: "低門檻下一步：免費評估 → 再推課程",
        },
      ],
    },
    ooschool: {
      title: "大三學生想學 Python 提升競爭力",
      customer: "許同學，21歲，企管系大三",
      steps: [
        {
          title: "Step 1 — 開場破冰",
          lines: [
            { speaker: "業務", text: "許同學你好！我是無限學院的顧問，看到你有在了解 Python 的課程。現在方便聊一下嗎？" },
            { speaker: "客戶", text: "欸可以啊！我最近超想學 Python 的！" },
          ],
          keyPoint: "學生通常很好聊，保持活力和同理心",
        },
        {
          title: "Step 2 — 需求探詢",
          lines: [
            { speaker: "業務", text: "很棒欸！什麼讓你想學 Python 呢？" },
            { speaker: "客戶", text: "我們系上選修有教一點，覺得超酷的！而且我看很多職缺都要會 Python。" },
            { speaker: "業務", text: "你已經開始為畢業做準備了，很有遠見！那你現在學到什麼程度？" },
          ],
          keyPoint: "先肯定再探詢，學生需要被鼓勵",
        },
        {
          title: "Step 3 — 痛點放大",
          lines: [
            { speaker: "業務", text: "那你有想過，如果只靠學校教的那點基礎，畢業後跟資工系的人競爭，會不會有點吃虧？" },
            { speaker: "客戶", text: "嗯...也對欸。他們四年都在寫程式，我才學一學期。" },
          ],
          keyPoint: "用同儕比較創造適度的緊迫感",
        },
        {
          title: "Step 4 — 方案呈現",
          lines: [
            { speaker: "業務", text: "無限學院的 Python 課程是一對一教學，會根據你企管系的背景，教你怎麼用 Python 做商業數據分析。這是企管 + Python 的跨域優勢，反而是純資工系沒有的。" },
            { speaker: "客戶", text: "哇塞！企管加 Python 聽起來也太酷了吧！" },
          ],
          keyPoint: "把「劣勢」轉化為「跨域優勢」",
        },
        {
          title: "Step 5 — 異議處理",
          lines: [
            { speaker: "客戶", text: "但是...我是學生沒什麼錢欸，要跟爸媽講。" },
            { speaker: "業務", text: "理解！其實很多同學的爸媽聽到是「就業導向的技能學習」都很支持。你可以跟爸媽說，這是在畢業前為自己加薪的投資。我們也有學生分期方案，一個月不到 3000。" },
          ],
          keyPoint: "幫學生準備說服父母的話術",
        },
        {
          title: "Step 6 — 推進成交",
          lines: [
            { speaker: "業務", text: "這樣好不好，我先幫你安排一堂免費的 Python 體驗課，你帶你爸媽一起來聽也可以。讓他們看看課程內容，也比較放心。" },
            { speaker: "客戶", text: "欸好！那我約禮拜六可以嗎？" },
          ],
          keyPoint: "邀請家長一起來，降低家長的疑慮也推進成交",
        },
      ],
    },
  };

  const t = transcripts[brandId];

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">聽 Call 逐字稿</h1>
        <p className="text-[var(--text2)]">{brand.fullName} — {t.title}</p>
        <p className="text-sm text-[var(--text3)] mt-1">客戶：{t.customer}</p>
      </div>

      <div className="space-y-6">
        {t.steps.map((step, si) => (
          <div key={si} className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border)]" style={{ background: `${brand.color}15` }}>
              <h3 className="font-bold" style={{ color: brand.color }}>{step.title}</h3>
            </div>
            <div className="p-5 space-y-3">
              {step.lines.map((line, li) => (
                <div key={li} className="flex gap-3">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded h-fit mt-0.5"
                    style={{
                      background: line.speaker === "業務" ? "rgba(124,108,240,0.15)" : "rgba(0,210,211,0.15)",
                      color: line.speaker === "業務" ? "var(--accent)" : "var(--teal)",
                    }}
                  >
                    {line.speaker}
                  </span>
                  <p className="text-sm flex-1">{line.text}</p>
                </div>
              ))}
              <div className="mt-3 p-3 rounded-lg bg-[var(--bg2)] border-l-2 border-[var(--gold)]">
                <p className="text-xs text-[var(--gold)]">💡 關鍵學習點</p>
                <p className="text-sm text-[var(--text2)] mt-1">{step.keyPoint}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== TOOLS ===================== */
function ToolsPage() {
  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">銷售工具箱</h1>
        <p className="text-[var(--text2)]">常用銷售框架與異議處理話術</p>
      </div>

      {/* SPIN Framework */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 mb-6">
        <h3 className="text-lg font-bold mb-4" style={{ color: "var(--accent-light)" }}>
          SPIN 銷售框架
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { letter: "S", name: "Situation 情境", desc: "了解客戶目前的背景狀況", examples: ["請問您目前從事什麼工作？", "您之前有學過相關的嗎？", "是什麼契機讓您想了解的？"] },
            { letter: "P", name: "Problem 問題", desc: "發現客戶面臨的困擾和挑戰", examples: ["目前遇到最大的困難是什麼？", "有什麼讓您不太滿意的地方？", "這個問題困擾您多久了？"] },
            { letter: "I", name: "Implication 暗示", desc: "讓客戶意識到問題的嚴重性", examples: ["如果不解決這個問題，半年後會變怎樣？", "這個問題對您的收入影響大嗎？", "您有算過因為這個問題損失了多少？"] },
            { letter: "N", name: "Need-Payoff 需求回報", desc: "引導客戶看到解決方案的好處", examples: ["如果能解決這個問題，您覺得會有什麼改變？", "如果可以在 3 個月內學會，對您的職涯會有什麼幫助？"] },
          ].map((item) => (
            <div key={item.letter} className="p-4 bg-[var(--bg2)] rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-lg bg-[rgba(124,108,240,0.15)] text-[var(--accent)] flex items-center justify-center font-bold">
                  {item.letter}
                </span>
                <span className="font-bold text-sm">{item.name}</span>
              </div>
              <p className="text-xs text-[var(--text2)] mb-2">{item.desc}</p>
              {item.examples.map((ex, i) => (
                <p key={i} className="text-xs text-[var(--text3)] mb-1">• 「{ex}」</p>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Objection Handling */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <h3 className="text-lg font-bold mb-4" style={{ color: "var(--orange)" }}>
          異議處理話術
        </h3>
        <div className="space-y-4">
          {[
            {
              objection: "太貴了",
              response: "我理解您的考量。不過您有想過，如果這個投資能幫您在未來 X 個月內達到 Y，這個 ROI 其實是很高的。而且我們有分期方案，一個月只需要...",
              key: "轉化為投資概念，計算 ROI",
            },
            {
              objection: "我再想想",
              response: "當然可以！那方便讓我了解一下，您主要在考慮哪個部分呢？是課程內容、價格、還是時間安排？這樣我可以提供更完整的資訊幫您評估。",
              key: "找出真正的猶豫點，不要放客戶走",
            },
            {
              objection: "我要問家人",
              response: "很好！重要的決定當然要跟家人商量。我可以幫您準備一份完整的課程說明，讓您的家人也能了解。另外我們也有分期方案，可以降低每月的負擔。",
              key: "幫客戶準備說服家人的素材",
            },
          ].map((item, i) => (
            <div key={i} className="p-4 bg-[var(--bg2)] rounded-lg">
              <p className="font-bold text-sm text-[var(--red)] mb-2">
                客戶說：「{item.objection}」
              </p>
              <p className="text-sm text-[var(--text2)] mb-2">{item.response}</p>
              <p className="text-xs text-[var(--gold)]">💡 {item.key}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===================== PRICING ===================== */
function PricingPage({ brandId }: { brandId: string }) {
  const brand = brands[brandId];

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">報價方案</h1>
        <p className="text-[var(--text2)]">{brand.fullName} 課程方案一覽</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {brand.pricing.map((plan, i) => (
          <div
            key={i}
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 hover:border-[var(--accent)] transition-all"
          >
            <h3 className="font-bold text-lg mb-1">{plan.name}</h3>
            <p className="text-2xl font-bold mb-2" style={{ color: brand.color }}>
              {plan.price}
            </p>
            <p className="text-sm text-[var(--text2)]">{plan.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== KPI ===================== */
function KpiPage({ user, onUpdate }: { user: User; onUpdate: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const todayData = user.kpiData.find((k) => k.date === today);
  const [calls, setCalls] = useState(todayData?.calls || 0);
  const [validCalls, setValidCalls] = useState(todayData?.validCalls || 0);
  const [appointments, setAppointments] = useState(todayData?.appointments || 0);
  const [closures, setClosures] = useState(todayData?.closures || 0);

  const save = () => {
    addKpiEntry(user.email, { date: today, calls, validCalls, appointments, closures });
    syncKpiEntry(user.email, { date: today, calls, validCalls, appointments, closures });
    onUpdate();
  };

  // Weekly stats
  const weekData = user.kpiData.filter((k) => {
    const d = new Date(k.date);
    const now = new Date();
    return now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  });
  const weekCalls = weekData.reduce((s, k) => s + k.calls, 0);
  const weekValid = weekData.reduce((s, k) => s + k.validCalls, 0);
  const weekAppt = weekData.reduce((s, k) => s + k.appointments, 0);
  const weekClose = weekData.reduce((s, k) => s + k.closures, 0);

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">KPI 追蹤</h1>
        <p className="text-[var(--text2)]">記錄每日銷售數據，追蹤你的成長</p>
      </div>

      {/* Today Input */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 mb-6">
        <h3 className="font-bold mb-4">今日數據 — {today}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "撥打數", value: calls, set: setCalls },
            { label: "有效通話", value: validCalls, set: setValidCalls },
            { label: "預約數", value: appointments, set: setAppointments },
            { label: "成交數", value: closures, set: setClosures },
          ].map((item) => (
            <div key={item.label}>
              <label className="block text-xs text-[var(--text2)] mb-1">{item.label}</label>
              <input
                type="number"
                min="0"
                value={item.value}
                onChange={(e) => item.set(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg2)] text-[var(--text)] outline-none focus:border-[var(--accent)] text-center text-lg font-bold"
              />
            </div>
          ))}
        </div>
        <button
          onClick={save}
          className="mt-4 px-6 py-2 rounded-lg font-bold text-white"
          style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))" }}
        >
          儲存
        </button>
      </div>

      {/* Weekly Stats */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <h3 className="font-bold mb-4" style={{ color: "var(--teal)" }}>
          本週統計
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "總撥打", value: weekCalls, color: "var(--accent)" },
            { label: "有效通話率", value: weekCalls > 0 ? `${Math.round((weekValid / weekCalls) * 100)}%` : "0%", color: "var(--teal)" },
            { label: "預約數", value: weekAppt, color: "var(--gold)" },
            { label: "成交數", value: weekClose, color: "var(--green)" },
          ].map((s) => (
            <div key={s.label} className="bg-[var(--bg2)] rounded-lg p-4 text-center">
              <p className="text-xs text-[var(--text3)]">{s.label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===================== RECORDS ===================== */
function RecordsPage({ user }: { user: User }) {
  const [selected, setSelected] = useState<SparringRecord | null>(null);

  if (selected) {
    return (
      <div className="animate-fade-in max-w-4xl">
        <button
          onClick={() => setSelected(null)}
          className="text-sm text-[var(--text2)] hover:text-[var(--text)] mb-4"
        >
          ← 回到列表
        </button>
        <div className="flex items-center gap-4 mb-6">
          <div
            className="text-4xl font-bold"
            style={{ color: getScoreColor(selected.scores.overall) }}
          >
            {selected.scores.overall}
          </div>
          <div>
            <h1 className="text-xl font-bold">與 {selected.personaName} 的對練</h1>
            <p className="text-sm text-[var(--text2)]">
              {new Date(selected.date).toLocaleString("zh-TW")} · {Math.round(selected.duration / 60)} 分鐘
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
            <ScoreRadar scores={selected.scores} />
          </div>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
            <h3 className="font-bold mb-3">AI 評語</h3>
            <p className="text-sm text-[var(--text2)]">{selected.feedback}</p>
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 mt-6">
          <h3 className="font-bold mb-4">完整對話</h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {selected.messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] px-4 py-2.5 text-sm ${m.role === "user" ? "chat-user" : "chat-ai"}`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">對練紀錄</h1>
        <p className="text-[var(--text2)]">查看歷史對練表現與成長軌跡</p>
      </div>

      {user.sparringRecords.length === 0 ? (
        <div className="text-center py-16 text-[var(--text3)]">
          <p className="text-4xl mb-3">📝</p>
          <p>還沒有對練紀錄</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...user.sparringRecords].reverse().map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className="w-full flex items-center gap-4 p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl hover:border-[var(--accent)] transition-all text-left"
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold"
                style={{
                  background: `${getScoreColor(r.scores.overall)}20`,
                  color: getScoreColor(r.scores.overall),
                }}
              >
                {r.scores.overall}
              </div>
              <div className="flex-1">
                <p className="font-bold">{r.personaName}</p>
                <p className="text-xs text-[var(--text2)]">{r.feedback}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[var(--text2)]">
                  {new Date(r.date).toLocaleDateString("zh-TW")}
                </p>
                <p className="text-xs text-[var(--text3)]">
                  {Math.round(r.duration / 60)} 分鐘 · {r.messages.length} 則對話
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===================== FINANCE KNOWLEDGE ===================== */
function FinanceKnowledgePage() {
  const [activeTab, setActiveTab] = useState<"fundamental" | "technical" | "chip">("fundamental");

  const tabs = [
    { id: "fundamental" as const, label: "基本面", icon: "📊", color: "var(--accent)" },
    { id: "technical" as const, label: "技術面", icon: "📈", color: "var(--teal)" },
    { id: "chip" as const, label: "籌碼面", icon: "🏦", color: "var(--gold)" },
  ];

  const content = {
    fundamental: {
      title: "基本面分析",
      subtitle: "看公司體質，判斷值不值得投資",
      salesAngle: "客戶最常問：「這支股票好不好？」——基本面就是教他怎麼自己判斷，不用再問別人。",
      sections: [
        {
          title: "什麼是基本面？（跟客戶怎麼說）",
          content: "基本面就像幫公司做健康檢查。你去看醫生會看血壓、血糖、膽固醇，投資也一樣——我們看公司的營收、獲利、負債，來判斷它「健不健康」。健康的公司股價長期會往上走，不健康的再怎麼炒作最終都會回來。",
        },
        {
          title: "三大財報（簡單版）",
          items: [
            { name: "損益表", desc: "公司賺不賺錢？營收多少、成本多少、最後淨利多少。就像你的薪水扣掉房租、吃飯、娛樂後剩多少。" },
            { name: "資產負債表", desc: "公司有多少家產、欠多少錢？就像你有多少存款和房貸。負債太高的公司要小心。" },
            { name: "現金流量表", desc: "公司手上現金夠不夠？有些公司帳面賺錢但現金不夠，就像月光族——收入不錯但存不到錢。" },
          ],
        },
        {
          title: "關鍵指標（業務必背）",
          items: [
            { name: "EPS（每股盈餘）", desc: "公司每一股幫你賺多少錢。EPS 持續成長 = 公司越來越會賺。跟客戶說：「你買的每一股，一年幫你賺 X 元。」" },
            { name: "本益比（P/E）", desc: "股價 ÷ EPS = 你花幾年能回本。15 倍以下算便宜，30 倍以上要看成長性。跟客戶說：「就像買雞排攤，月賺 5 萬的攤子賣 100 萬，20 個月回本。」" },
            { name: "ROE（股東權益報酬率）", desc: "股東投入 100 元能賺多少回來。ROE > 15% 算優秀。跟客戶說：「你放 100 萬在這家公司，一年能幫你賺 15 萬以上。」" },
            { name: "殖利率", desc: "一年配多少股利 ÷ 股價。5% 以上算高殖利率。跟客戶說：「放 100 萬進去，一年光配息就有 5 萬，比定存好多了。」" },
          ],
        },
        {
          title: "Demo 時怎麼帶？",
          content: "帶客戶看一支營建股的財報，找到合約負債（預售屋收的錢）→ 說明這筆錢未來會變成營收 → 股價還沒反映 = 投資機會。讓客戶親眼看到「原來財報可以這樣用」，他就會覺得學了有用。",
        },
      ],
    },
    technical: {
      title: "技術面分析",
      subtitle: "看股價走勢，判斷什麼時候買賣",
      salesAngle: "客戶最怕的是：「買在最高點怎麼辦？」——技術面就是教他看時機，知道什麼時候該進場、該出場。",
      sections: [
        {
          title: "什麼是技術面？（跟客戶怎麼說）",
          content: "技術面就是看股價的「行為模式」。就像天氣預報看雲層、氣壓來預測天氣，技術面看K線、均線來預測股價走向。不是100%準，但可以大幅提高你的勝率。",
        },
        {
          title: "K 線基礎（業務必懂）",
          items: [
            { name: "紅K（陽線）", desc: "收盤價 > 開盤價 = 今天漲了。越長代表漲越多、買方越強。跟客戶說：「紅色的就是今天買的人比賣的人多。」" },
            { name: "黑K（陰線）", desc: "收盤價 < 開盤價 = 今天跌了。越長代表跌越多、賣方越強。" },
            { name: "上影線", desc: "盤中漲上去但被壓回來 = 上面有賣壓。跟客戶說：「有人在上面等著賣，所以拉不上去。」" },
            { name: "下影線", desc: "盤中跌下去但被拉回來 = 下面有支撐。跟客戶說：「跌到那個價位就有人搶著買。」" },
          ],
        },
        {
          title: "均線系統",
          items: [
            { name: "5日均線（週線）", desc: "短期趨勢，適合短線操作的人看。" },
            { name: "20日均線（月線）", desc: "中期趨勢，大部分投資人最常參考的。股價站上月線 = 中期看漲。" },
            { name: "60日均線（季線）", desc: "中長期趨勢。股價跌破季線 = 要小心了。" },
            { name: "黃金交叉 vs 死亡交叉", desc: "短期均線往上穿過長期均線 = 黃金交叉（買進訊號）。反過來 = 死亡交叉（賣出訊號）。" },
          ],
        },
        {
          title: "常見 K 棒組合（白話版）",
          items: [
            { name: "晨星（Morning Star）", desc: "連跌後出現小K棒再接大紅K = 底部反轉訊號。跟客戶說：「天快亮了，股價要反彈了。」" },
            { name: "吞噬（Engulfing）", desc: "大紅K完全包住前一根黑K = 多方強力反攻。跟客戶說：「買方一口氣把昨天跌的全部吃回來。」" },
            { name: "十字線（Doji）", desc: "開盤價 ≈ 收盤價，多空拉鋸 = 變盤訊號。跟客戶說：「多空雙方在猶豫，接下來要注意方向。」" },
          ],
        },
        {
          title: "Demo 時怎麼帶？",
          content: "打開一支股票的K線圖，帶客戶看均線排列 → 找出黃金交叉的時間點 → 對比當時買進到現在的報酬。讓客戶看到「如果當時懂技術面，就知道該進場」。重點是讓他有感，不是教他變分析師。",
        },
      ],
    },
    chip: {
      title: "籌碼面分析",
      subtitle: "看大戶動向，跟著聰明錢走",
      salesAngle: "客戶常說：「散戶怎麼贏得過法人？」——籌碼面就是教他看法人在幹嘛，跟著大戶方向走。",
      sections: [
        {
          title: "什麼是籌碼面？（跟客戶怎麼說）",
          content: "籌碼面就是看「誰在買、誰在賣」。股市裡有三大法人（外資、投信、自營商），他們的資金量是散戶的好幾百倍。當大戶持續買進一支股票，股價通常會漲；大戶持續賣，股價通常會跌。學會看籌碼，就不用猜——直接看大戶的動作跟著走。",
        },
        {
          title: "三大法人（業務必背）",
          items: [
            { name: "外資", desc: "國外投資機構（高盛、摩根等），資金量最大。外資連續買超 = 長期看好。跟客戶說：「全世界最聰明的錢在買，你要不要跟？」" },
            { name: "投信", desc: "國內基金公司（基金經理人）。投信買 = 基金在佈局，通常中長期看好。跟客戶說：「台灣的專業經理人也在買，代表他們做過研究。」" },
            { name: "自營商", desc: "券商自己的資金在操作。通常短線進出，參考價值相對低。但如果三大法人同步買超，訊號就很強。" },
          ],
        },
        {
          title: "關鍵籌碼指標",
          items: [
            { name: "法人買賣超", desc: "每天三大法人各買了多少、賣了多少。連續買超 = 看好；連續賣超 = 看壞。" },
            { name: "融資融券", desc: "融資 = 散戶借錢買股票（看多）。融券 = 借股票來賣（看空）。融資大增通常不是好事——代表散戶在追高。" },
            { name: "主力進出", desc: "特定券商分點的買賣紀錄。如果某個分點持續大量買進，可能是主力在吃貨。" },
            { name: "集保戶數", desc: "持有這支股票的人數變化。人數減少但張數增加 = 大戶在收集籌碼（好事）。跟客戶說：「小散戶在賣，大戶在收，等收夠了就要拉了。」" },
          ],
        },
        {
          title: "Demo 時怎麼帶？",
          content: "打開一支股票的籌碼分析頁面，帶客戶看外資連續買超 → 對比股價走勢 → 讓他發現「外資買的時候股價就在漲」。再問他：「如果你早一步知道外資在買，你會不會也想跟？這就是籌碼面的威力。」",
        },
      ],
    },
  };

  const current = content[activeTab];

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">專業知識</h1>
        <p className="text-[var(--text2)]">以業務角度理解財經知識，讓你 Demo 時講得出來、客戶聽得懂</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all border ${
              activeTab === tab.id
                ? "text-white shadow-lg border-transparent"
                : "bg-[var(--card)] border-[var(--border)] text-[var(--text2)] hover:border-[var(--accent)]"
            }`}
            style={activeTab === tab.id ? { background: tab.color, boxShadow: `0 4px 20px ${tab.color}40` } : undefined}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Header */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <h2 className="text-xl font-bold mb-1">{current.title}</h2>
          <p className="text-sm text-[var(--text3)] mb-3">{current.subtitle}</p>
          <div className="p-3 rounded-lg" style={{ background: "rgba(254,202,87,0.1)", borderLeft: "3px solid var(--gold)" }}>
            <p className="text-xs font-bold text-[var(--gold)] mb-1">業務角度</p>
            <p className="text-sm text-[var(--text2)]">{current.salesAngle}</p>
          </div>
        </div>

        {/* Sections */}
        {current.sections.map((section, si) => (
          <div key={si} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
            <h3 className="font-bold mb-3" style={{ color: tabs.find(t => t.id === activeTab)?.color }}>
              {section.title}
            </h3>
            {section.content && (
              <p className="text-sm text-[var(--text2)] leading-relaxed">{section.content}</p>
            )}
            {section.items && (
              <div className="space-y-3">
                {section.items.map((item, ii) => (
                  <div key={ii} className="p-3 bg-[var(--bg2)] rounded-lg">
                    <p className="font-bold text-sm mb-1">{item.name}</p>
                    <p className="text-xs text-[var(--text2)] leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== KNOWLEDGE ===================== */
/* ===================== ARTICLES PAGE (業務專欄) ===================== */

const ARTICLE_CATEGORIES = [
  { id: "all", label: "全部", icon: "📰" },
  { id: "sales", label: "銷售技巧", icon: "🎯" },
  { id: "mindset", label: "心態建設", icon: "💪" },
  { id: "finance", label: "財經時事", icon: "💹" },
  { id: "trend", label: "產業趨勢", icon: "📊" },
  { id: "success", label: "成功案例", icon: "🏆" },
];

const ARTICLES_DATA = [
  { id: 1, cat: "sales", title: "SPIN 銷售法：用問題引導客戶需求", summary: "SPIN 代表 Situation(現況)、Problem(問題)、Implication(影響)、Need-payoff(需求回報)。透過有系統的提問，讓客戶自己說出需求，而不是你去推銷。", takeaways: ["先問現況再問痛點，不要急著介紹產品", "Implication 問題讓客戶意識到不行動的代價", "Need-payoff 讓客戶自己說出解決方案的價值"], date: "2026-04-01" },
  { id: 2, cat: "sales", title: "電話行銷的黃金 30 秒：開場白決定一切", summary: "客戶接起電話的前 30 秒，決定了他會不會繼續聽下去。開場白要做到三件事：建立身分、引起興趣、取得許可繼續對話。", takeaways: ["開場不要問「方便嗎」，直接建立價值", "用「好不好」取代「想不想」", "語氣決定 80%，內容只佔 20%"], date: "2026-04-01" },
  { id: 3, cat: "sales", title: "處理「太貴了」異議的 5 種方法", summary: "客戶說太貴，不一定真的嫌貴。可能是不確定價值、沒有預算概念、或只是習慣性殺價。關鍵是分辨真假異議。", takeaways: ["先認同再轉化：「理解，所以更值得了解清楚」", "拆解成日均成本：「一天不到一杯咖啡」", "不要急著打折，先問「是跟什麼比覺得貴？」"], date: "2026-03-31" },
  { id: 4, cat: "sales", title: "從邀約到成交：Demo 的關鍵轉化點", summary: "Demo 不是產品說明會，是幫客戶規劃學習路徑。從破冰到客製化規劃，每個環節都要回扣客戶的初衷和痛點。", takeaways: ["P1-P3 先從「你是誰」開始，不要直接進產品", "務必給客戶看兩個課程影片，讓他感受 1+1>2", "收尾三次確認：複利觀念→為什麼投資→什麼時候開始"], date: "2026-03-31" },
  { id: 5, cat: "sales", title: "客戶說「我要想想」？3 步化解拖延", summary: "「我要想想」是最常見的軟拒絕。不要直接放棄，也不要硬逼。用三步法化解：確認顧慮→具體化→引導決策。", takeaways: ["問「想想哪個部分？」把模糊變具體", "幫客戶整理他已經認同的點", "給出限時方案或下次約定，不留模糊空間"], date: "2026-03-30" },
  { id: 6, cat: "mindset", title: "業務新人的第一週：如何度過挫折期", summary: "第一週是離職率最高的時期。被拒絕是常態，不是你的問題。重點是建立正確的心態框架：把每通電話當練習，不是考試。", takeaways: ["第一週的目標是「習慣被拒絕」，不是成交", "每天找到一個小進步，哪怕只是語氣更自然", "下班後跟師父聊 15 分鐘，不要把情緒帶回家"], date: "2026-03-30" },
  { id: 7, cat: "mindset", title: "被拒絕 100 次後的心態重建", summary: "頂尖業務的共同特質不是口才好，而是抗壓性強。被拒絕不代表你不好，只是時機不對、需求不匹配。調整心態的關鍵是「去個人化」。", takeaways: ["客戶拒絕的是產品時機，不是你這個人", "記錄拒絕原因，找出可以改善的模式", "每 10 通被拒絕，就會有 1 通成功，這是數學不是運氣"], date: "2026-03-29" },
  { id: 8, cat: "mindset", title: "為什麼頂尖業務都是自律的人", summary: "業績好的不一定很聰明，但一定自律、努力、正面、積極、抗壓性強。自律不是天生的，是透過習慣養成的。", takeaways: ["每天固定時間撥打，不要等「狀態好」才開始", "數據不會騙人：通次→通時→邀約→成交", "跟表現好的人待在一起，環境決定你的標準"], date: "2026-03-29" },
  { id: 9, cat: "finance", title: "2026 台股趨勢：AI 概念股持續領漲", summary: "AI 相關族群持續吸引資金流入，從上游晶片到下游應用，整個產業鏈都在受惠。投資人需要了解不同層次的受惠程度。", takeaways: ["AI 不只是台積電，整個供應鏈都有機會", "選股要看實際營收貢獻，不是只有題材", "ETF 是新手參與 AI 趨勢的最簡單方式"], date: "2026-04-01" },
  { id: 10, cat: "finance", title: "ETF 投資新手指南：從 0050 到主題式 ETF", summary: "ETF 是最適合新手的投資工具。從市值型 0050 到產業型 ETF，了解不同類型的風險和報酬特性。", takeaways: ["0050 適合長期定期定額，不用選股", "主題式 ETF 波動大但成長潛力高", "配息型 ETF 不代表穩賺，要看總報酬率"], date: "2026-03-31" },
  { id: 11, cat: "finance", title: "Fed 利率決策對台灣投資人的影響", summary: "美國聯準會的利率政策直接影響全球資金流向。降息有利股市，升息則讓資金回流美元。台灣投資人要懂得看這個指標。", takeaways: ["降息預期 → 資金往新興市場流 → 台股受惠", "利率高 → 定存和債券更有吸引力", "不要只看利率，要看整體經濟數據配合"], date: "2026-03-30" },
  { id: 12, cat: "trend", title: "線上理財教育市場 2026 展望", summary: "疫後線上教育持續成長，尤其理財教育需求爆發。年輕人不再滿足於「老師講、學生聽」，更需要實戰型、互動型的學習方式。", takeaways: ["市場規模持續擴大，需求遠大於供給", "客戶要的不只是知識，是「能用的技能」", "實戰模擬+教練指導是最有效的學習模式"], date: "2026-03-31" },
  { id: 13, cat: "trend", title: "Z 世代的投資行為：從短影音理財到專業學習", summary: "Z 世代透過 TikTok、YouTube 接觸理財概念，但碎片化資訊讓他們知其然不知其所以然。專業系統化學習是下一步需求。", takeaways: ["Z 世代有投資意願但缺系統化知識", "他們習慣線上學習，對實體課程接受度較低", "Demo 時強調「從碎片到系統」的學習路徑升級"], date: "2026-03-30" },
  { id: 14, cat: "success", title: "新人第一個月就成交：他做對了什麼？", summary: "不是天賦異稟，是做對了三件事：每天穩定 100 通以上、每通 Call 都做 CRM 紀錄、每天下班前跟師父做 2+1 回饋。量變帶來質變。", takeaways: ["量是一切的基礎，沒有量就沒有質", "CRM 紀錄是你的第二大腦，不要靠記憶", "師父的回饋讓你少走三個月彎路"], date: "2026-04-01" },
  { id: 15, cat: "success", title: "從月薪 3 萬到年收百萬：業務轉型之路", summary: "業務不是靠口才，是靠系統。建立自己的銷售流程、養成數據習慣、持續學習精進。三年內從菜鳥變頂尖，靠的是紀律不是天分。", takeaways: ["第一年學架構、第二年練深度、第三年帶團隊", "每月檢視轉化率，找到自己的瓶頸點", "教別人是最好的學習方式"], date: "2026-03-31" },
];

function ArticlesPage() {
  const [cat, setCat] = useState("all");
  const [search, setSearch] = useState("");
  const filtered = ARTICLES_DATA.filter(a => {
    if (cat !== "all" && a.cat !== cat) return false;
    if (search && !a.title.includes(search) && !a.summary.includes(search)) return false;
    return true;
  });
  const catColors: Record<string, string> = { sales: "var(--accent)", mindset: "var(--teal)", finance: "var(--gold)", trend: "var(--green)", success: "#f59e0b" };
  const catLabels: Record<string, string> = { sales: "銷售技巧", mindset: "心態建設", finance: "財經時事", trend: "產業趨勢", success: "成功案例" };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>📰 業務專欄</h2>
        <span style={{ fontSize: 11, color: "var(--text3)", background: "var(--bg2)", padding: "4px 10px", borderRadius: 6 }}>
          🤖 AI 每日自動更新 · 上次更新: {new Date().toLocaleDateString("zh-TW")}
        </span>
      </div>
      <p style={{ color: "var(--text3)", fontSize: 13, marginBottom: 20 }}>銷售技巧、財經時事、心態建設 — 讓你每天都在進步</p>

      {/* Categories */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {ARTICLE_CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)} style={{
            background: cat === c.id ? "var(--accent)" : "var(--bg2)", color: cat === c.id ? "#fff" : "var(--text2)",
            border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>{c.icon} {c.label}</button>
        ))}
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋文章..." style={{
        width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10,
        padding: "10px 14px", color: "var(--text)", fontSize: 14, outline: "none", marginBottom: 20, boxSizing: "border-box" as const,
      }} />

      {/* Articles */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map(a => (
          <div key={a.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
              <span style={{ background: (catColors[a.cat] || "var(--accent)") + "22", color: catColors[a.cat] || "var(--accent)", padding: "2px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                {catLabels[a.cat]}
              </span>
              <span style={{ fontSize: 11, color: "var(--text3)" }}>{a.date}</span>
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{a.title}</h3>
            <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7, marginBottom: 12 }}>{a.summary}</p>
            <div style={{ background: "var(--bg2)", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--teal)", marginBottom: 6 }}>🎯 關鍵重點</div>
              {a.takeaways.map((t, i) => (
                <div key={i} style={{ fontSize: 12, color: "var(--text2)", padding: "3px 0", display: "flex", gap: 6 }}>
                  <span style={{ color: "var(--accent)" }}>•</span> {t}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>找不到相關文章</div>}
    </div>
  );
}

function KnowledgePage({ brandId }: { brandId: string }) {
  const brand = brands[brandId];

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">品牌知識庫</h1>
        <p className="text-[var(--text2)]">{brand.fullName}</p>
      </div>

      <div className="space-y-6">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <h3 className="font-bold text-lg mb-3" style={{ color: brand.color }}>
            品牌介紹
          </h3>
          <p className="text-sm text-[var(--text2)]">{brand.description}</p>
          <p className="text-sm text-[var(--text2)] mt-2">專注領域：{brand.focus}</p>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <h3 className="font-bold text-lg mb-3" style={{ color: "var(--teal)" }}>
            課程產品
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {brand.courses.map((c, i) => (
              <div key={i} className="p-3 bg-[var(--bg2)] rounded-lg text-sm">
                {c}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <h3 className="font-bold text-lg mb-3" style={{ color: "var(--gold)" }}>
            聯絡資訊
          </h3>
          <div className="space-y-2 text-sm">
            <p>📧 Email：{brand.email}</p>
            <p>🌐 Website：{brand.website}</p>
            <p>💬 LINE：{brand.line}</p>
            <p>📷 Instagram：{brand.instagram}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
