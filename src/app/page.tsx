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
import { brands } from "@/data/brands";
import { modules } from "@/data/modules";
import { personas, getPersonasByBrand } from "@/data/personas";
import Sidebar from "@/components/Sidebar";
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
  | "knowledge";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setUser(getCurrentUser());
    setLoading(false);
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
        {page === "videos" && <VideosPage brandId={user.brand} />}
        {page === "sparring" && <SparringPage user={user} onUpdate={refreshUser} />}
        {page === "transcripts" && <TranscriptsPage brandId={user.brand} />}
        {page === "tools" && <ToolsPage />}
        {page === "pricing" && <PricingPage brandId={user.brand} />}
        {page === "kpi" && <KpiPage user={user} onUpdate={refreshUser} />}
        {page === "records" && <RecordsPage user={user} />}
        {page === "knowledge" && <KnowledgePage brandId={user.brand} />}
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

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          歡迎回來，{user.name}
        </h1>
        <p className="text-[var(--text2)]">
          {brand.fullName} | 加入 {Math.ceil((Date.now() - new Date(user.joinDate).getTime()) / (1000 * 60 * 60 * 24))} 天
        </p>
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

      {/* Recommended Actions */}
      <div className="grid grid-cols-2 gap-6">
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
    </div>
  );
}

/* ===================== VIDEOS ===================== */
function VideosPage({ brandId }: { brandId: string }) {
  const [selectedVideo, setSelectedVideo] = useState<TrainingVideo | null>(null);
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
                onClick={() => setSelectedVideo(null)}
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
            onClick={() => setSelectedVideo(video)}
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

  const mod = selectedModule !== null ? modules.find((m) => m.id === selectedModule) : null;

  const handleQuizSubmit = () => {
    if (!mod) return;
    const correct = mod.quiz.reduce(
      (c, q, i) => c + (answers[i] === q.answer ? 1 : 0),
      0
    );
    const score = Math.round((correct / mod.quiz.length) * 100);
    setQuizSubmitted(true);

    // Save score
    const newScores = [
      ...user.quizScores.filter((s) => s.moduleId !== mod.id),
      { moduleId: mod.id, score, date: new Date().toISOString() },
    ];

    const newCompleted = score >= 60
      ? [...new Set([...user.completedModules, mod.id])]
      : user.completedModules;

    updateUser(user.email, {
      quizScores: newScores,
      completedModules: newCompleted,
      progress: Math.round((newCompleted.length / 9) * 100),
    });
    onUpdate();
  };

  if (mod) {
    const prevScore = user.quizScores.find((s) => s.moduleId === mod.id);

    return (
      <div className="animate-fade-in max-w-3xl">
        <button
          onClick={() => {
            setSelectedModule(null);
            setQuizMode(false);
            setQuizSubmitted(false);
            setAnswers([]);
          }}
          className="text-sm text-[var(--text2)] hover:text-[var(--text)] mb-4 flex items-center gap-1"
        >
          ← 回到課程列表
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-xl bg-[var(--accent)] bg-opacity-15 flex items-center justify-center text-2xl font-bold text-[var(--accent-light)]">
            {mod.day}
          </div>
          <div>
            <h1 className="text-2xl font-bold">Day {mod.day} — {mod.title}</h1>
            <p className="text-[var(--text2)]">{mod.subtitle}</p>
          </div>
          {prevScore && (
            <span
              className="ml-auto px-3 py-1 rounded-lg text-sm font-bold"
              style={{
                background: `${getScoreColor(prevScore.score)}20`,
                color: getScoreColor(prevScore.score),
              }}
            >
              最高分 {prevScore.score}
            </span>
          )}
        </div>

        {!quizMode ? (
          <div className="space-y-6">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
              <h3 className="text-lg font-bold mb-2">{mod.description}</h3>
              <div className="space-y-3 mt-4">
                {mod.content.map((c, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-[var(--bg2)] rounded-lg">
                    <span className="text-[var(--accent)]">●</span>
                    <p className="text-sm">{c}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
              <h3 className="font-bold mb-3" style={{ color: "var(--gold)" }}>
                關鍵要點
              </h3>
              {mod.keyPoints.map((kp, i) => (
                <p key={i} className="text-sm text-[var(--text2)] mb-2">
                  💡 {kp}
                </p>
              ))}
            </div>

            {mod.videos && mod.videos.length > 0 && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
                <h3 className="font-bold mb-3" style={{ color: "var(--teal)" }}>
                  相關教學影片
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {mod.videos
                    .map((vId) => trainingVideos.find((v) => v.id === vId))
                    .filter(Boolean)
                    .map((video) => (
                      <a
                        key={video!.id}
                        href={getDriveLink(video!.driveFileId, video!.type)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-[var(--bg2)] rounded-lg hover:border-[var(--accent)] border border-transparent transition-all"
                      >
                        <div className="w-10 h-10 rounded-lg bg-[rgba(124,108,240,0.15)] flex items-center justify-center text-lg shrink-0">
                          {video!.type === "video" ? "🎬" : "📊"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{video!.title}</p>
                          <p className="text-[10px] text-[var(--text3)]">
                            {video!.description} · {video!.size}
                          </p>
                        </div>
                      </a>
                    ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setQuizMode(true);
                setAnswers(new Array(mod.quiz.length).fill(-1));
                setQuizSubmitted(false);
              }}
              className="px-6 py-3 rounded-lg font-bold text-white"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))" }}
            >
              開始測驗 ({mod.quiz.length} 題)
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {mod.quiz.map((q, qi) => (
              <div
                key={qi}
                className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5"
              >
                <p className="font-semibold mb-3">
                  {qi + 1}. {q.question}
                </p>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => {
                    const isSelected = answers[qi] === oi;
                    const isCorrect = quizSubmitted && oi === q.answer;
                    const isWrong = quizSubmitted && isSelected && oi !== q.answer;
                    return (
                      <button
                        key={oi}
                        onClick={() => {
                          if (quizSubmitted) return;
                          const newAnswers = [...answers];
                          newAnswers[qi] = oi;
                          setAnswers(newAnswers);
                        }}
                        className={`w-full text-left px-4 py-2.5 rounded-lg border transition-all text-sm ${
                          isCorrect
                            ? "border-[var(--green)] bg-[rgba(16,172,132,0.1)]"
                            : isWrong
                            ? "border-[var(--red)] bg-[rgba(238,90,82,0.1)]"
                            : isSelected
                            ? "border-[var(--accent)] bg-[rgba(124,108,240,0.1)]"
                            : "border-[var(--border)] hover:border-[var(--accent)]"
                        }`}
                        disabled={quizSubmitted}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {!quizSubmitted ? (
              <button
                onClick={handleQuizSubmit}
                disabled={answers.includes(-1)}
                className="px-6 py-3 rounded-lg font-bold text-white disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))" }}
              >
                提交測驗
              </button>
            ) : (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
                {(() => {
                  const correct = mod.quiz.reduce(
                    (c, q, i) => c + (answers[i] === q.answer ? 1 : 0),
                    0
                  );
                  const score = Math.round((correct / mod.quiz.length) * 100);
                  return (
                    <>
                      <p className="text-xl font-bold" style={{ color: getScoreColor(score) }}>
                        得分：{score} 分（{correct}/{mod.quiz.length} 正確）
                      </p>
                      <p className="text-sm text-[var(--text2)] mt-2">
                        {score >= 60
                          ? "恭喜通過！已解鎖下一個模組。"
                          : "未達 60 分及格線，請複習後重新測驗。"}
                      </p>
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

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">課程訓練</h1>
        <p className="text-[var(--text2)]">9 天系統化銷售訓練，完成測驗解鎖下一階段</p>
      </div>

      <div className="space-y-3">
        {modules.map((m) => {
          const completed = user.completedModules.includes(m.id);
          const prevCompleted = m.id === 1 || user.completedModules.includes(m.id - 1);
          const locked = !completed && !prevCompleted;
          const isCurrent = !completed && prevCompleted;
          const score = user.quizScores.find((s) => s.moduleId === m.id);

          return (
            <button
              key={m.id}
              onClick={() => !locked && setSelectedModule(m.id)}
              disabled={locked}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                locked
                  ? "opacity-40 cursor-not-allowed border-[var(--border)] bg-[var(--card)]"
                  : isCurrent
                  ? "border-[var(--teal)] bg-[var(--card)] hover:shadow-lg"
                  : completed
                  ? "border-[var(--green)] bg-[var(--card)] hover:shadow-lg"
                  : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                  completed
                    ? "bg-[rgba(16,172,132,0.15)] text-[var(--green)]"
                    : isCurrent
                    ? "bg-[rgba(0,210,211,0.15)] text-[var(--teal)]"
                    : "bg-[rgba(124,108,240,0.1)] text-[var(--accent-light)]"
                }`}
              >
                {completed ? "✓" : locked ? "🔒" : m.day}
              </div>
              <div className="flex-1">
                <p className="font-semibold">
                  Day {m.day} — {m.title}
                </p>
                <p className="text-xs text-[var(--text2)]">{m.subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                {m.hasSparring && (
                  <span className="px-2 py-0.5 rounded bg-[rgba(0,210,211,0.1)] text-[var(--teal)] text-[10px] font-bold">
                    含對練
                  </span>
                )}
                {score && (
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold"
                    style={{
                      background: `${getScoreColor(score.score)}20`,
                      color: getScoreColor(score.score),
                    }}
                  >
                    {score.score}分
                  </span>
                )}
                {isCurrent && (
                  <span className="px-2 py-0.5 rounded bg-[rgba(0,210,211,0.12)] text-[var(--teal)] text-[10px] font-bold">
                    進行中
                  </span>
                )}
              </div>
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
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Try to find a Chinese voice
    const voices = synthRef.current.getVoices();
    const zhVoice = voices.find(
      (v) => v.lang.startsWith("zh") && v.name.includes("Mei") // Prefer female voice
    ) || voices.find((v) => v.lang.startsWith("zh-TW"))
      || voices.find((v) => v.lang.startsWith("zh"));
    if (zhVoice) utterance.voice = zhVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // Auto-start listening after AI finishes speaking
      if (voiceEnabled) {
        // Small delay to let state settle
        setTimeout(() => {
          const recognition = recognitionRef.current;
          if (recognition && !wantListeningRef.current) {
            wantListeningRef.current = true;
            setIsListening(true);
            try { recognition.start(); } catch { /* */ }
          }
        }, 300);
      }
    };
    synthRef.current.speak(utterance);
  }, [voiceEnabled]);

  // Track whether we want to keep listening (user hasn't pressed stop)
  const wantListeningRef = useRef(false);

  // Start voice recognition
  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || sending || isSpeaking) return;

    // If already listening, don't restart
    if (wantListeningRef.current) return;

    wantListeningRef.current = true;
    setInterimText("");
    setIsListening(true);

    let finalTranscript = "";

    recognition.onresult = (event: { resultIndex: number; results: { length: number; [key: number]: { isFinal: boolean; [key: number]: { transcript: string } } } }) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(finalTranscript + interim);
      setInput(finalTranscript + interim);
    };

    recognition.onerror = (e: { error: string }) => {
      // Only stop on fatal errors, not on "no-speech"
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantListeningRef.current = false;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if user hasn't pressed stop
      if (wantListeningRef.current) {
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
  }, [sending, isSpeaking]);

  // Stop voice recognition
  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    const recognition = recognitionRef.current;
    if (recognition) {
      try { recognition.stop(); } catch { /* ignore */ }
    }
    setIsListening(false);
    setInterimText("");
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
    if (!text.trim() || !persona || sending) return;

    stopListening();

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

      // Speak AI response
      if (voiceEnabled) {
        speakText(data.reply);
      }

      // Fetch coaching tip in background
      fetchCoachingTip(updatedMessages, text.trim(), data.reply);
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "（系統錯誤，請稍後再試）" },
      ]);
    }
    setSending(false);
  };

  // Handle voice send: stop listening, then send what we have
  const handleVoiceSend = () => {
    if (input.trim()) {
      stopListening();
      sendMessage(input.trim());
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
                <p className="text-5xl mb-4">🎤</p>
                <p className="text-lg">語音對練模式</p>
                <p className="text-sm mt-2">你是 {brand.fullName} 的業務顧問</p>
                <p className="text-sm">客戶「{persona.name}」已接聽電話</p>
                <p className="text-sm mt-4 text-[var(--accent)]">
                  {voiceSupported ? "按下麥克風按鈕開始說話，或直接打字" : "你的瀏覽器不支援語音，請使用打字模式"}
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
                <span className="text-xs text-[var(--red)]">錄音中 — 說完後按停止鍵發送</span>
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

/* ===================== KNOWLEDGE ===================== */
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
