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
  restoreUserFromCloud,
  type User,
  type SparringRecord,
} from "@/lib/store";
import { syncProgress, syncQuizScore, syncKpiEntry, syncRegister, migrateLocalStorageToSupabase, syncVideoProgress } from "@/lib/sync";
import { brands } from "@/data/brands";
import { modules, TASK_ICONS, getModulesForBrand } from "@/data/modules";
import { personas, getPersonasByBrand } from "@/data/personas";
import Sidebar, { type UserRole } from "@/components/Sidebar";
import SOPPage from "@/components/SOPPage";
import CalendarDashboard from "@/components/CalendarDashboard";
import MentorTeamCard from "@/components/MentorTeamCard";
import MentorshipPage from "@/components/MentorshipPage";
import ProfilePage from "@/components/ProfilePage";
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
  | "courses"
  | "sop"
  | "knowledge"
  | "pricing"
  | "kpi"
  | "mentorship"
  | "profile";

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
        userRole={(user.role || "sales_rep") as UserRole}
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
        {page === "courses" && <CoursesPage />}
        {page === "sop" && <SOPPage brandId={user.brand} />}
        {page === "knowledge" && <KnowledgePage brandId={user.brand} />}
        {page === "pricing" && <PricingPage brandId={user.brand} />}
        {page === "kpi" && <KpiPage user={user} onUpdate={refreshUser} />}
        {page === "mentorship" && <MentorshipPage userEmail={user.email} userName={user.name} brandId={user.brand} userRole={user.role || "sales_rep"} />}
        {page === "profile" && <ProfilePage userEmail={user.email} userName={user.name} brandId={user.brand} brandColor={brands[user.brand]?.color} onNameChange={(newName) => { updateUser(user.email, { name: newName }); refreshUser(); }} />}
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

  const handleSubmit = async (e: React.FormEvent) => {
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
      // Sync to Supabase with error feedback
      const syncResult = await syncRegister(email, name, brand);
      if (syncResult.error) {
        setError(`註冊成功但雲端同步失敗: ${syncResult.error}，管理員可能暫時看不到您的帳號。`);
      }
      const loginRes = loginUser(email, password);
      if (loginRes.success) onLogin();
    } else {
      const res = loginUser(email, password);
      if (res.success) {
        onLogin();
        return;
      }
      // If not found locally, check Supabase (user may have cleared cache)
      if (res.error === "LOCAL_NOT_FOUND") {
        try {
          const cloudRes = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          if (cloudRes.ok) {
            const { user: cloudUser } = await cloudRes.json();
            restoreUserFromCloud(email, password, cloudUser);
            onLogin();
            return;
          }
        } catch {
          // Fall through to error
        }
        setError("找不到此帳號，請先註冊");
        return;
      }
      setError(res.error || "登入失敗");
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
  const brandModules = getModulesForBrand(user.brand);
  const progress = Math.round((user.completedModules.length / brandModules.length) * 100);
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
    { label: "課程進度", value: `${progress}%`, sub: `${user.completedModules.length}/${brandModules.length} 完成`, color: brand.color },
    { label: "對練平均分", value: avgScore || "—", sub: `${user.sparringRecords.length} 次對練`, color: "var(--teal)" },
    { label: "本週對練", value: weekRecords.length, sub: "次", color: "var(--gold)" },
    { label: "今日撥打", value: todayKpi?.calls || 0, sub: `有效 ${todayKpi?.validCalls || 0}`, color: "var(--green)" },
  ];

  // Determine next recommended action
  const nextModule = brandModules.find((m) => !user.completedModules.includes(m.id));
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
        const mod = brandModules.find((m) => m.day === d);
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
  const [dbVideos, setDbVideos] = useState<TrainingVideo[]>([]);

  // Fetch published DB custom videos for this brand
  useEffect(() => {
    fetch(`/api/videos?brand=${encodeURIComponent(brandId)}`)
      .then((r) => r.json())
      .then((d) => {
        const converted: TrainingVideo[] = (d.videos || []).map((v: { id: string; title: string; description?: string; drive_file_id?: string; brands?: string[]; related_days?: number[] }) => ({
          id: `db-${v.id}`,
          title: v.title,
          description: v.description || "",
          driveFileId: v.drive_file_id || "",
          type: "video" as const,
          size: "",
          brands: v.brands || [],
          relatedDays: v.related_days || [],
          category: "custom",
        }));
        setDbVideos(converted);
      })
      .catch(() => setDbVideos([]));
  }, [brandId]);

  const categories = getCategoriesForBrand(brandId);
  const staticVideos = getVideosForBrand(brandId);
  const allVideos = [...staticVideos, ...dbVideos];
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
        {dbVideos.length > 0 && (
          <button
            onClick={() => setActiveCategory("custom")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeCategory === "custom"
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg2)] text-[var(--text2)] hover:bg-[var(--border)]"
            }`}
          >
            ➕ 補充影片 ({dbVideos.length})
          </button>
        )}
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
  const brandModules = getModulesForBrand(user.brand);

  const mod = selectedModule !== null ? brandModules.find((m) => m.id === selectedModule) : null;

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
          <span className="text-sm font-bold text-[var(--accent)]">{user.completedModules.length}/{brandModules.length}</span>
        </div>
      </div>

      <div className="space-y-3">
        {brandModules.map((m) => {
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

/* ===================== COURSES (業務力課程) ===================== */

interface CourseArticle {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  source: string;
  source_url?: string;
  source_language?: string;
  key_takeaways: string[];
  tags: string[];
  ai_analysis?: string;
  created_at: string;
  is_ai_generated: boolean;
}

const COURSE_CAT_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  sales_technique: { label: "銷售技巧", color: "var(--teal)", icon: "🎯" },
  mindset: { label: "心態成長", color: "var(--gold)", icon: "🧠" },
  industry_trend: { label: "產業趨勢", color: "var(--accent)", icon: "📈" },
  negotiation: { label: "談判溝通", color: "var(--orange, #fb923c)", icon: "🤝" },
  client_management: { label: "客戶經營", color: "var(--green)", icon: "👥" },
  financial_news: { label: "財經時事", color: "#60a5fa", icon: "💰" },
  success_story: { label: "成功案例", color: "#f472b6", icon: "⭐" },
};

function CoursesPage() {
  const [articles, setArticles] = useState<CourseArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/articles?limit=50");
        if (res.ok) {
          const data = await res.json();
          setArticles(data.articles || []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const filtered = filter === "all" ? articles : articles.filter(a => a.category === filter);

  const categories = ["all", ...new Set(articles.map(a => a.category))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🔥</div>
          <p className="text-[var(--text2)]">載入業務力課程...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">🔥 業務力課程</h1>
        <p className="text-[var(--text2)] text-sm">
          AI 每半天自動更新 — 精選全球業務銷售文章與影片，附 AI 深度分析
        </p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map(cat => {
          const info = COURSE_CAT_LABELS[cat];
          const isActive = filter === cat;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: isActive
                  ? (info?.color || "var(--accent)")
                  : "var(--bg2)",
                color: isActive ? "#fff" : "var(--text2)",
                border: `1px solid ${isActive ? "transparent" : "var(--border)"}`,
              }}
            >
              {cat === "all" ? "📋 全部" : `${info?.icon || "📄"} ${info?.label || cat}`}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text3)]">
          <p className="text-4xl mb-3">📭</p>
          <p>尚無課程文章，AI 將在下次更新時自動產生</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(article => {
            const catInfo = COURSE_CAT_LABELS[article.category];
            const isOpen = expanded === article.id;
            const date = new Date(article.created_at);
            const dateStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours().toString().padStart(2,"0")}:${date.getMinutes().toString().padStart(2,"0")}`;

            return (
              <div
                key={article.id}
                className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden transition-all hover:border-[var(--accent)]"
              >
                {/* Header */}
                <button
                  onClick={() => setExpanded(isOpen ? null : article.id)}
                  className="w-full text-left p-5 flex items-start gap-4"
                >
                  <span className="text-2xl flex-shrink-0 mt-1">{catInfo?.icon || "📄"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${catInfo?.color || "var(--accent)"}20`, color: catInfo?.color || "var(--accent)" }}
                      >
                        {catInfo?.label || article.category}
                      </span>
                      {article.source_language === "en" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">🌐 國際</span>
                      )}
                      {article.is_ai_generated && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">🤖 AI 分析</span>
                      )}
                      <span className="text-[10px] text-[var(--text3)] ml-auto">{dateStr}</span>
                    </div>
                    <h3 className="font-bold text-[var(--text)] mb-1">{article.title}</h3>
                    <p className="text-sm text-[var(--text2)] line-clamp-2">{article.summary}</p>
                    {!isOpen && article.key_takeaways.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {article.key_takeaways.slice(0, 3).map((t, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg2)] text-[var(--text3)]">
                            💡 {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[var(--text3)] text-sm mt-2 flex-shrink-0">
                    {isOpen ? "▲" : "▼"}
                  </span>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div className="border-t border-[var(--border)] p-5 space-y-5">
                    {/* Key takeaways */}
                    <div className="bg-[var(--bg2)] rounded-lg p-4">
                      <h4 className="text-sm font-bold mb-2">📌 重點摘要</h4>
                      <ul className="space-y-1.5">
                        {article.key_takeaways.map((t, i) => (
                          <li key={i} className="text-sm text-[var(--text2)] flex items-start gap-2">
                            <span className="text-green-400 mt-0.5">✓</span> {t}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Main content */}
                    <div className="prose prose-invert max-w-none text-sm text-[var(--text2)] leading-relaxed whitespace-pre-wrap">
                      {article.content}
                    </div>

                    {/* AI Analysis */}
                    {article.ai_analysis && (
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                        <h4 className="text-sm font-bold text-purple-400 mb-2">🤖 AI 深度分析</h4>
                        <p className="text-sm text-[var(--text2)] leading-relaxed">{article.ai_analysis}</p>
                      </div>
                    )}

                    {/* Meta */}
                    <div className="flex items-center justify-between text-[10px] text-[var(--text3)] pt-2 border-t border-[var(--border)]">
                      <span>來源：{article.source}</span>
                      <div className="flex gap-2">
                        {article.tags?.map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-[var(--bg2)]">#{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ===================== KNOWLEDGE ===================== */

function KnowledgePage({ brandId }: { brandId: string }) {
  const brand = brands[brandId];
  const [activeSection, setActiveSection] = useState(0);
  const [activeTopic, setActiveTopic] = useState(0);

  // Dynamic import to keep page.tsx clean
  const knowledgeData = (() => {
    try {
      const { getKnowledgeForBrand } = require("@/data/knowledge");
      return getKnowledgeForBrand(brandId);
    } catch { return null; }
  })();

  const sections = knowledgeData?.sections || [];
  const currentSection = sections[activeSection];
  const currentTopic = currentSection?.topics?.[activeTopic];

  return (
    <div className="animate-fade-in max-w-4xl">
      <h1 className="text-2xl font-bold mb-1" style={{
        background: `linear-gradient(135deg, ${brand.color}, var(--teal))`,
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      }}>品牌知識庫</h1>
      <p className="text-sm text-[var(--text3)] mb-6">{brand.fullName} — 領域知識與品牌資訊</p>

      {/* Brand Info Card */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 mb-6">
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <div>
            <h3 className="font-bold" style={{ color: brand.color }}>{brand.fullName}</h3>
            <p className="text-xs text-[var(--text3)]">{brand.description}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="p-2 bg-[var(--bg2)] rounded-lg">🌐 {brand.website}</div>
          <div className="p-2 bg-[var(--bg2)] rounded-lg">💬 {brand.line}</div>
          <div className="p-2 bg-[var(--bg2)] rounded-lg">📷 {brand.instagram}</div>
          <div className="p-2 bg-[var(--bg2)] rounded-lg">📧 {brand.email}</div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {brand.courses.map((c, i) => (
            <span key={i} className="text-xs px-2 py-1 rounded-full" style={{
              color: brand.color, backgroundColor: brand.colorLight,
            }}>{c}</span>
          ))}
        </div>
      </div>

      {/* Domain Knowledge Sections */}
      {sections.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {sections.map((s: any, i: number) => (
              <button key={s.id} onClick={() => { setActiveSection(i); setActiveTopic(0); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeSection === i ? "text-white shadow-lg" : "bg-[var(--card)] text-[var(--text2)] border border-[var(--border)]"
                }`}
                style={activeSection === i ? { background: brand.color } : undefined}
              >{s.icon} {s.title}</button>
            ))}
          </div>

          {currentSection && (
            <div className="flex gap-4 flex-col md:flex-row">
              {/* Topic sidebar */}
              <div className="md:w-48 flex-shrink-0 space-y-1">
                {currentSection.topics.map((t: any, i: number) => (
                  <button key={t.id} onClick={() => setActiveTopic(i)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                      activeTopic === i ? "font-bold" : "text-[var(--text3)] hover:text-[var(--text2)]"
                    }`}
                    style={activeTopic === i ? { color: brand.color, backgroundColor: brand.colorLight } : undefined}
                  >{t.title}</button>
                ))}
              </div>

              {/* Topic content */}
              {currentTopic && (
                <div className="flex-1 space-y-4">
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
                    <h3 className="font-bold text-lg mb-3">{currentTopic.title}</h3>
                    {currentTopic.subtitle && <p className="text-sm text-[var(--text3)] mb-3">{currentTopic.subtitle}</p>}
                    {currentTopic.content?.map((c: string, i: number) => (
                      <p key={i} className="text-sm text-[var(--text2)] mb-2 leading-relaxed">{c}</p>
                    ))}
                  </div>

                  {currentTopic.examples && (
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
                      <h4 className="font-bold text-sm mb-3 text-[var(--teal)]">實際應用案例</h4>
                      <div className="space-y-2">
                        {currentTopic.examples.map((e: any, i: number) => (
                          <div key={i} className="flex gap-2 text-sm p-2 bg-[var(--bg2)] rounded-lg">
                            <span className="text-[var(--text3)] flex-shrink-0">💡</span>
                            <div><span className="text-[var(--text2)]">{e.scenario}</span> → <span className="font-medium" style={{ color: brand.color }}>{e.solution}</span></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentTopic.salaryInfo && (
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
                      <h4 className="font-bold text-sm mb-3 text-[var(--gold)]">正職薪資行情</h4>
                      <div className="space-y-2">
                        {currentTopic.salaryInfo.map((s: any, i: number) => (
                          <div key={i} className="flex justify-between items-center p-2 bg-[var(--bg2)] rounded-lg text-sm">
                            <span className="font-medium">{s.position}</span>
                            <span style={{ color: brand.color }}>{s.salary}</span>
                          </div>
                        ))}
                      </div>
                      {currentTopic.freelanceInfo && (
                        <>
                          <h4 className="font-bold text-sm mb-2 mt-4 text-[var(--teal)]">接案收入</h4>
                          {currentTopic.freelanceInfo.map((f: any, i: number) => (
                            <div key={i} className="flex justify-between items-center p-2 bg-[var(--bg2)] rounded-lg text-sm mb-1">
                              <span>{f.type}</span>
                              <span style={{ color: "var(--teal)" }}>{f.income}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
