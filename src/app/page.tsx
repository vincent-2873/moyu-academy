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
  type CompanyType,
} from "@/lib/store";
import { syncKpiEntry, syncRegister, migrateLocalStorageToSupabase } from "@/lib/sync";
import { brands } from "@/data/brands";
import { personas, getPersonasByBrand } from "@/data/personas";
import Sidebar, { type UserRole } from "@/components/Sidebar";
import ProfilePage from "@/components/ProfilePage";
import DailyFeedbackModal, { shouldShowFeedback } from "@/components/DailyFeedbackModal";
import ScoreRadar from "@/components/ScoreRadar";
import {
  RecruiterDashboard,
  CandidatesPage,
  AddCandidatePage,
  FunnelPage,
} from "@/components/RecruiterPages";
import { scoreConversation, getScoreColor, getScoreLabel, SCORE_LABELS } from "@/lib/scoring";

type Page =
  | "dashboard"
  | "sparring"
  | "kpi"
  | "checkin"
  | "profile"
  // recruiter pages
  | "candidates"
  | "add_candidate"
  | "funnel";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [workSchedule, setWorkSchedule] = useState<{ endTime: string; workDays: number[] } | null>(null);

  useEffect(() => {
    // 1. 先檢查是否剛從 LINE OAuth 回來 — 有 moyu_oauth_session cookie 就 bootstrap local session
    const cookieMap = Object.fromEntries(
      document.cookie.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k, v.join("=")];
      })
    );
    // 檢查 URL 上的 line_oauth_error 並 alert 出來
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const oauthErr = urlParams.get("line_oauth_error");
      if (oauthErr) {
        // 清掉 URL query，避免重新整理又彈
        const clean = window.location.pathname;
        window.history.replaceState({}, "", clean);
        setTimeout(() => alert("LINE 登入失敗：" + oauthErr), 200);
      }
    }

    if (cookieMap.moyu_oauth_session) {
      try {
        const json = JSON.parse(
          atob(cookieMap.moyu_oauth_session.replace(/-/g, "+").replace(/_/g, "/"))
        );
        restoreUserFromCloud(json.email, json.email, {
          name: json.name,
          brand: json.brand,
          role: json.role,
          companyType: json.brand === "moyuhunt" ? "recruit" : json.brand === "hq" ? "hq" : json.brand === "legal" ? "legal" : "sales",
        });
        // 清掉 cookie
        document.cookie = "moyu_oauth_session=; Path=/; Max-Age=0";
        // 清掉 URL 上的 ?line_oauth_success=1
        if (window.location.search.includes("line_oauth_success")) {
          const clean = window.location.pathname;
          window.history.replaceState({}, "", clean);
        }
      } catch {
        /* ignore */
      }
    }

    const u = getCurrentUser();
    setUser(u);
    setLoading(false);
    // Migrate localStorage data to Supabase on login
    if (u) migrateLocalStorageToSupabase(u);
    // Fetch work schedule for feedback modal
    if (u) {
      fetch(`/api/work-schedule?brand=${u.brand}`).then(r => r.json()).then(d => {
        if (d.schedule) {
          setWorkSchedule({ endTime: d.schedule.endTime, workDays: d.schedule.workDays });
          if (shouldShowFeedback(u.email, d.schedule.endTime, d.schedule.workDays)) {
            setShowFeedbackModal(true);
          }
        }
      }).catch(() => {});
    }
  }, []);

  // Activity heartbeat — send every 60s so admin can see who is online
  useEffect(() => {
    if (!user) return;
    const sendHeartbeat = () => {
      fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, page }),
      }).catch(() => {});
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(interval);
  }, [user, page]);

  const refreshUser = () => setUser(getCurrentUser());

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-2xl font-bold animate-pulse" style={{ color: "var(--accent)" }}>
          墨宇戰情中樞
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onLogin={refreshUser} />;
  }

  const companyType: CompanyType = (user.companyType as CompanyType) || "sales";

  // 根據 brand + role 導向對應前台：
  // - 招聘 (moyuhunt / recruiter) → /recruit
  // - 法務 (legal) → /legal (TODO: 法務前台)
  // - 業務 (sales_rep) → /me
  // - 管理員 (super_admin / ceo / coo / director) 且 brand=hq → 留在 root dashboard
  const isAdmin = ["super_admin", "ceo", "coo", "cfo", "director"].includes(user.role || "");
  const isRecruit = user.brand === "moyuhunt" || user.role === "recruiter";
  const isLegal = user.brand === "legal";

  if (typeof window !== "undefined" && !isAdmin) {
    sessionStorage.setItem("moyu_current_user", user.email);
    let dest = "/me"; // 預設業務
    let label = "載入我的戰情中…";
    if (isRecruit) { dest = "/recruit"; label = "載入招聘中心…"; }
    else if (isLegal) { dest = "/me"; label = "載入法務中心…"; } // 法務暫時也走 /me
    window.location.replace(dest);
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-lg text-[var(--text2)] animate-pulse">{label}</div>
      </div>
    );
  }

  // 管理員 + 招聘角色（如 Lynn brand=hq role=director 但負責招聘）也設 session
  if (typeof window !== "undefined") {
    sessionStorage.setItem("moyu_current_user", user.email);
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        currentPage={page}
        onNavigate={(p) => { setPage(p as Page); setMobileMenuOpen(false); }}
        userName={user.name}
        brandId={user.brand}
        companyType={companyType}
        onLogout={() => {
          logout();
          setUser(null);
        }}
        userRole={(user.role || (companyType === "recruit" ? "recruiter" : "sales_rep")) as UserRole}
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
        {/* === 業務員前台 === */}
        {companyType === "sales" && (
          <>
            {page === "dashboard" && <DashboardPage user={user} onNavigate={(p) => setPage(p as Page)} />}
            {page === "sparring" && <SparringPage user={user} onUpdate={refreshUser} />}
            {page === "kpi" && <KpiPage user={user} onUpdate={refreshUser} />}
            {page === "checkin" && <CheckinPage user={user} />}
            {page === "profile" && (
              <ProfilePage
                userEmail={user.email}
                userName={user.name}
                brandId={user.brand}
                brandColor={brands[user.brand]?.color}
                onNameChange={(newName) => { updateUser(user.email, { name: newName }); refreshUser(); }}
              />
            )}
          </>
        )}

        {/* === 獵頭招聘員前台 === */}
        {companyType === "recruit" && (
          <>
            {page === "dashboard" && <RecruiterDashboard user={user} onNavigate={(p) => setPage(p as Page)} />}
            {page === "candidates" && <CandidatesPage user={user} onNavigate={(p) => setPage(p as Page)} />}
            {page === "add_candidate" && <AddCandidatePage user={user} onDone={() => setPage("candidates")} />}
            {page === "funnel" && <FunnelPage user={user} />}
            {page === "profile" && (
              <ProfilePage
                userEmail={user.email}
                userName={user.name}
                brandId={user.brand}
                brandColor="#fb923c"
                onNameChange={(newName) => { updateUser(user.email, { name: newName }); refreshUser(); }}
              />
            )}
          </>
        )}
      </main>
      <HelpBot />
      {/* Manual feedback button — always visible */}
      {workSchedule && !showFeedbackModal && (
        <button
          onClick={() => setShowFeedbackModal(true)}
          className="fixed bottom-6 left-6 md:left-[276px] px-4 py-2.5 rounded-full text-white text-sm font-bold shadow-lg z-40 transition-all hover:scale-105 flex items-center gap-2"
          style={{ background: "linear-gradient(135deg, var(--gold), #f59e0b)" }}
          title="填寫今日回饋"
        >
          <span>📝</span>
          <span className="hidden sm:inline">今日回饋</span>
        </button>
      )}
      {showFeedbackModal && workSchedule && (
        <DailyFeedbackModal
          userEmail={user.email}
          userName={user.name}
          brandId={user.brand}
          workEndTime={workSchedule.endTime}
          onSubmitted={() => setShowFeedbackModal(false)}
          onSkip={() => setShowFeedbackModal(false)}
        />
      )}
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
interface BindingInfo {
  code: string;
  lineFriendUrl: string | null;
  mode: "register" | "login";
}

function AuthPage({ onLogin }: { onLogin: () => void }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("nschool");
  const [companyType, setCompanyType] = useState<CompanyType>("hq");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [binding, setBinding] = useState<BindingInfo | null>(null);
  const [bindingPolling, setBindingPolling] = useState(false);

  // Poll LINE 綁定狀態，偵測到綁定完成就走完登入流程
  useEffect(() => {
    if (!binding) return;
    let cancelled = false;
    setBindingPolling(true);
    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/line/binding-status?code=${encodeURIComponent(binding.code)}`);
        const data = await res.json();
        if (data?.bound && data.user) {
          // 綁定完成：同步本地帳號並進入系統
          restoreUserFromCloud(email, password || email, data.user);
          setBinding(null);
          setBindingPolling(false);
          onLogin();
          return;
        }
      } catch {
        /* ignore, retry */
      }
    };
    const id = setInterval(tick, 3000);
    tick();
    return () => {
      cancelled = true;
      clearInterval(id);
      setBindingPolling(false);
    };
  }, [binding, email, password, onLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isRegister) {
      // 驗證邀請碼
      if (companyType === "sales") {
        const b = brands[brand];
        if (inviteCode !== b.inviteCode) {
          setError("邀請碼錯誤");
          return;
        }
      } else if (companyType === "recruit") {
        if (inviteCode !== "MOYUHUNT") {
          setError("獵頭邀請碼錯誤");
          return;
        }
      } else if (companyType === "hq") {
        if (inviteCode !== brands.hq.inviteCode) {
          setError("墨宇股份有限公司邀請碼錯誤");
          return;
        }
      } else if (companyType === "legal") {
        if (inviteCode !== brands.legal.inviteCode) {
          setError("法務顧問事務所邀請碼錯誤");
          return;
        }
      }
      const targetBrand =
        companyType === "recruit" ? "moyuhunt" :
        companyType === "hq" ? "hq" :
        companyType === "legal" ? "legal" :
        brand;
      const res = registerUser(email, password, name, targetBrand, companyType);
      if (!res.success) {
        setError(res.error || "註冊失敗");
        return;
      }
      // Sync to Supabase with error feedback
      const syncResult = await syncRegister(email, name, targetBrand);
      if (syncResult.error) {
        setError(`註冊成功但雲端同步失敗: ${syncResult.error}，管理員可能暫時看不到您的帳號。`);
        return;
      }
      // 強制 LINE 綁定：拿到綁定碼就跳綁定畫面，並直接打開 LINE 綁定流程
      if (syncResult.lineBindingRequired && syncResult.lineBindingCode) {
        setBinding({
          code: syncResult.lineBindingCode,
          lineFriendUrl: syncResult.lineFriendUrl || null,
          mode: "register",
        });
        // 自動彈出 LINE：手機會直接喚起 LINE app，桌面會開新分頁
        if (syncResult.lineFriendUrl) {
          try {
            window.open(syncResult.lineFriendUrl, "_blank", "noopener,noreferrer");
          } catch {
            /* popup blocker, user can still click button */
          }
        }
        return;
      }
      // 理論上不會走到這（後端一定會回綁定碼），保險：直接擋住並要求重試
      setError("註冊完成但沒拿到 LINE 綁定碼，請重新整理再試一次");
    } else {
      // 優先直接打後端：後端是 LINE 綁定真實來源
      try {
        const cloudRes = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const cloudData = await cloudRes.json();

        // 403 + LINE_BIND_REQUIRED → 跳綁定畫面，直接彈 LINE
        if (cloudRes.status === 403 && cloudData?.error === "LINE_BIND_REQUIRED") {
          if (cloudData.lineBindingCode) {
            setBinding({
              code: cloudData.lineBindingCode,
              lineFriendUrl: cloudData.lineFriendUrl || null,
              mode: "login",
            });
            if (cloudData.lineFriendUrl) {
              try {
                window.open(cloudData.lineFriendUrl, "_blank", "noopener,noreferrer");
              } catch {
                /* popup blocker */
              }
            }
            return;
          }
          setError("此帳號尚未綁定 LINE，且系統無法產生綁定碼，請聯繫管理員");
          return;
        }

        if (cloudRes.ok && cloudData?.user) {
          // 忘記密碼模式：用 email 當密碼重置 localStorage
          restoreUserFromCloud(email, forgotMode ? email : (password || email), cloudData.user);
          if (forgotMode) setForgotMode(false);
          onLogin();
          return;
        }

        if (cloudRes.status === 404) {
          setError("找不到此帳號，請先註冊");
          return;
        }
        setError(cloudData?.error || "登入失敗");
      } catch {
        setError("無法連接伺服器，請稍後再試");
      }
    }
  };

  // ── 綁定 LINE 畫面 ──（註冊或登入時尚未綁定會跳這一頁）
  if (binding) {
    // LINE Basic ID for oaMessage deep link — 從 friend URL 反推 @xxxx
    const basicIdMatch = binding.lineFriendUrl?.match(/%40([\w\d]+)|@([\w\d]+)/);
    const basicId = basicIdMatch?.[1] || basicIdMatch?.[2] || "";
    const sendCodeUrl = basicId
      ? `https://line.me/R/oaMessage/%40${basicId}/?${encodeURIComponent(binding.code)}`
      : null;

    return (
      <div className="h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">📱</div>
            <h1 className="text-2xl font-bold mb-2">用 LINE 一鍵綁定</h1>
            <p className="text-sm text-[var(--text3)]">
              {binding.mode === "register"
                ? "帳號已建立。系統的命令、警報、每日必做都走 LINE 推播，綁定完成才能進入。"
                : "此帳號尚未綁定 LINE，綁定完成才能登入。"}
            </p>
          </div>

          {/* 步驟 ①：加入 LINE 官方帳號 */}
          {binding.lineFriendUrl && (
            <a
              href={binding.lineFriendUrl}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center py-4 mb-3 rounded-xl font-bold text-white text-lg transition-all hover:shadow-xl active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #06C755, #00B900)" }}
            >
              ① 加入 墨宇小精靈 LINE
            </a>
          )}

          <div
            className="text-center py-5 mb-3 rounded-xl border-2 border-dashed"
            style={{ borderColor: "var(--accent)", background: "rgba(102,126,234,0.08)" }}
          >
            <div className="text-xs text-[var(--text3)] mb-1">你的綁定碼（24 小時內有效）</div>
            <div className="text-4xl font-black tracking-[0.3em] text-[var(--accent)] font-mono">
              {binding.code}
            </div>
          </div>

          {/* 步驟 ②：一鍵送出綁定碼（LINE oaMessage deep link） */}
          {sendCodeUrl && (
            <a
              href={sendCodeUrl}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center py-4 mb-3 rounded-xl font-bold text-white text-lg transition-all hover:shadow-xl active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))" }}
            >
              ② 一鍵送出綁定碼
            </a>
          )}

          <p className="text-xs text-[var(--text3)] text-center mb-4 leading-relaxed">
            手機：點「①」加好友 → 回來點「②」會直接開 LINE 聊天室並把碼填好，按送出即可
          </p>

          <div className="flex items-center justify-center gap-2 text-sm text-[var(--text2)] mb-4">
            <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <span>{bindingPolling ? "等待 LINE 綁定..." : "準備偵測綁定狀態"}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setBinding(null);
              setError("");
            }}
            className="w-full py-2.5 rounded-lg text-sm text-[var(--text2)] border border-[var(--border)] hover:bg-[var(--bg2)]"
          >
            取消，返回登入
          </button>
        </div>
      </div>
    );
  }

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
            墨宇戰情中樞
          </h1>
          <p className="text-[var(--text3)]">業務戰力 × 獵頭漏斗 · 數據蒐集前台</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="auth-card p-6 sm:p-8"
        >
          <h2 className="text-xl font-bold mb-6">
            {isRegister ? "建立帳號" : "登入"}
          </h2>

          {isRegister && (
            <>
              <div className="mb-4">
                <label className="block text-xs text-[var(--text2)] mb-1">我要加入</label>
                <select
                  value={companyType}
                  onChange={(e) => setCompanyType(e.target.value as CompanyType)}
                  className="auth-input"
                >
                  <option value="hq">🏛️ 墨宇股份有限公司</option>
                  <option value="sales">💼 業務公司</option>
                  <option value="recruit">🎯 獵頭公司</option>
                  <option value="legal">⚖️ 法務顧問事務所</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-xs text-[var(--text2)] mb-1">姓名</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="auth-input"
                  required
                />
              </div>
              {companyType === "sales" && (
                <div className="mb-4">
                  <label className="block text-xs text-[var(--text2)] mb-1">品牌</label>
                  <select
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="auth-input"
                  >
                    {Object.values(brands).filter((b) => !["moyuhunt", "hq"].includes(b.id)).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mb-4">
                <label className="block text-xs text-[var(--text2)] mb-1">邀請碼</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="auth-input"
                  placeholder={
                    companyType === "hq" ? "墨宇股份有限公司邀請碼" :
                    companyType === "recruit" ? "獵頭邀請碼" :
                    companyType === "legal" ? "法務顧問事務所邀請碼" :
                    "品牌邀請碼"
                  }
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
              className="auth-input"
              required
            />
          </div>

          {!(forgotMode && !isRegister) && (
            <div className="mb-2">
              <label className="block text-xs text-[var(--text2)] mb-1">密碼</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                required={!forgotMode}
              />
            </div>
          )}

          {!isRegister && (
            <div className="mb-4 text-right">
              <button
                type="button"
                onClick={() => { setForgotMode(!forgotMode); setError(""); }}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                {forgotMode ? "返回密碼登入" : "忘記密碼？用 Email 直接登入"}
              </button>
            </div>
          )}

          {forgotMode && !isRegister && <div className="mb-4" />}

          {error && (
            <p className="text-[var(--red)] text-sm mb-4">{error}</p>
          )}

          <button
            type="submit"
            className="auth-btn-primary"
          >
            {isRegister ? "註冊" : forgotMode ? "用 Email 登入" : "登入"}
          </button>

          {/* 或用 LINE 一鍵登入／註冊 — 註冊時必須先填 email + 姓名 */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-xs text-[var(--text3)]">或</span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>
          {(() => {
            const canLineRegister = !isRegister || (email.trim() && name.trim());
            const qs = isRegister
              ? `mode=register&registerEmail=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&brand=${encodeURIComponent(companyType === "recruit" ? "moyuhunt" : companyType === "hq" ? "hq" : companyType === "legal" ? "legal" : brand)}`
              : "mode=login";
            if (!canLineRegister) {
              return (
                <div
                  className="auth-btn-line flex items-center justify-center gap-2 no-underline"
                  style={{ opacity: 0.5, cursor: "not-allowed", pointerEvents: "none" }}
                  aria-disabled
                >
                  <span style={{ fontSize: 22 }}>📱</span>
                  <span>請先填姓名 + Email 再用 LINE 註冊</span>
                </div>
              );
            }
            return (
              <a
                href={`/api/line/oauth/start?${qs}`}
                className="auth-btn-line flex items-center justify-center gap-2 no-underline"
              >
                <span style={{ fontSize: 22 }}>📱</span>
                <span>用 LINE 一鍵{isRegister ? "註冊" : "登入"}</span>
              </a>
            );
          })()}

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

/* ===================== SALES DASHBOARD (數據蒐集入口) ===================== */
function DashboardPage({ user, onNavigate }: { user: User; onNavigate: (p: string) => void }) {
  const brand = brands[user.brand];
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayKpi = user.kpiData.find((k) => k.date === todayStr);

  // 連續上工天數
  const streakDays = (() => {
    const dates = new Set(user.kpiData.map((k) => k.date));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      if (dates.has(d.toISOString().slice(0, 10))) streak++;
      else if (i === 0) continue;
      else break;
    }
    return streak;
  })();

  // 本週統計
  const weekKpis = user.kpiData.filter((k) => {
    const d = new Date(k.date);
    return Date.now() - d.getTime() < 7 * 86400000;
  });
  const weekCalls = weekKpis.reduce((s, k) => s + (k.calls || 0), 0);
  const weekAppointments = weekKpis.reduce((s, k) => s + (k.appointments || 0), 0);
  const weekClosures = weekKpis.reduce((s, k) => s + (k.closures || 0), 0);

  const weekRecords = user.sparringRecords.filter((r) => {
    const d = new Date(r.date);
    return Date.now() - d.getTime() < 7 * 86400000;
  });
  const avgScore =
    user.sparringRecords.length > 0
      ? Math.round(
          user.sparringRecords.reduce((s, r) => s + r.scores.overall, 0) /
            user.sparringRecords.length
        )
      : 0;
  const latestSparring = user.sparringRecords[user.sparringRecords.length - 1];

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(iv);
  }, []);
  const greeting = (() => {
    const h = now.getHours();
    if (h < 6) return "深夜還在拼，記得補眠";
    if (h < 12) return "早安，今日戰況開始";
    if (h < 14) return "中午了，吃飽繼續打";
    if (h < 18) return "下午衝刺時段";
    if (h < 21) return "晚間衝鋒，最後一波";
    return "夜深了，今日複盤時間";
  })();

  // 今日目標達成率（4 個指標平均）
  const todayProgress = (() => {
    if (!todayKpi) return 0;
    const targets = { calls: 30, validCalls: 15, appointments: 3, closures: 1 };
    const pct =
      (Math.min(1, (todayKpi.calls || 0) / targets.calls) +
        Math.min(1, (todayKpi.validCalls || 0) / targets.validCalls) +
        Math.min(1, (todayKpi.appointments || 0) / targets.appointments) +
        Math.min(1, (todayKpi.closures || 0) / targets.closures)) /
      4;
    return Math.round(pct * 100);
  })();

  return (
    <div className="animate-fade-in">
      {/* === HERO === */}
      <div
        className="relative overflow-hidden rounded-3xl mb-8 p-6 md:p-8 border border-[var(--border-strong)]"
        style={{
          background: `
            radial-gradient(circle at 12% 20%, ${brand?.color || "#7c6cf0"}28 0%, transparent 50%),
            radial-gradient(circle at 88% 80%, rgba(52,211,153,0.15) 0%, transparent 50%),
            linear-gradient(135deg, var(--card) 0%, var(--card2) 100%)
          `,
        }}
      >
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />

        <div className="relative z-[1] flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase border backdrop-blur"
                style={{
                  borderColor: `${brand?.color}55`,
                  background: `${brand?.color}15`,
                  color: brand?.color,
                }}
              >
                <span className="status-dot live" />
                {brand?.name || user.brand} · 業務戰線
              </span>
              <span className="text-xs text-[var(--text3)]">{greeting}</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">
              {user.name}
              <span className="text-[var(--text2)] text-lg md:text-xl font-medium"> · 連續 {streakDays} 天上工</span>
            </h1>
            <p className="mt-2 text-sm md:text-base text-[var(--text2)]">
              今日目標達成 <span className="text-[var(--text)] font-bold tabular-nums">{todayProgress}%</span>
              {!todayKpi && <span className="text-[var(--gold)]"> · 記得填寫今日 KPI</span>}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => onNavigate("kpi")}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg hover:scale-105 transition-all"
                style={{ background: `linear-gradient(135deg, ${brand?.color || "#7c6cf0"}, #34d399)` }}
              >
                📈 填寫今日 KPI
              </button>
              <button
                onClick={() => onNavigate("sparring")}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--border-strong)] bg-[var(--bg2)]/60 text-[var(--text)] hover:border-[var(--accent)] backdrop-blur"
              >
                🎯 開始 AI 對練
              </button>
              <button
                onClick={() => onNavigate("checkin")}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--border-strong)] bg-[var(--bg2)]/60 text-[var(--text)] hover:border-[var(--gold)] backdrop-blur"
              >
                🌅 每日上工
              </button>
            </div>
          </div>

          {/* 進度環 */}
          <div className="relative flex flex-col items-center justify-center">
            <svg width="148" height="148" viewBox="0 0 148 148">
              <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={brand?.color || "#7c6cf0"} />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
              </defs>
              <circle cx="74" cy="74" r="62" fill="none" stroke="var(--border)" strokeWidth="10" />
              <circle
                cx="74" cy="74" r="62"
                fill="none"
                stroke="url(#ringGrad)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(todayProgress / 100) * 389.557} 389.557`}
                style={{ transition: "stroke-dasharray 0.8s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold tabular-nums gradient-text">{todayProgress}%</span>
              <span className="text-[10px] text-[var(--text3)] mt-0.5">今日達成率</span>
            </div>
          </div>
        </div>
      </div>

      {/* === 戰力指標 6 格 === */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {([
          { icon: "🔥", label: "連續上工", value: streakDays, sub: "天", color: "#fb923c" },
          { icon: "📞", label: "本週通次", value: weekCalls, sub: `今日 ${todayKpi?.calls || 0}`, color: brand?.color || "#7c6cf0" },
          { icon: "🤝", label: "本週邀約", value: weekAppointments, sub: `今日 ${todayKpi?.appointments || 0}`, color: "#34d399" },
          { icon: "💎", label: "本週成交", value: weekClosures, sub: `今日 ${todayKpi?.closures || 0}`, color: "#fbbf24" },
          { icon: "🎯", label: "對練平均", value: avgScore || "—", sub: `${user.sparringRecords.length} 場`, color: "#06b6d4" },
          { icon: "⚡", label: "本週對練", value: weekRecords.length, sub: "場", color: "#a594ff" },
        ] as const).map((s) => (
          <div
            key={s.label}
            className="metric-tile"
            style={{ ["--metric-color" as string]: s.color }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="text-base w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${s.color}20`, color: s.color }}
              >
                {s.icon}
              </span>
              <span className="text-[10px] text-[var(--text3)] uppercase tracking-wider font-bold">{s.label}</span>
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: s.color }}>
              {s.value}
            </p>
            <p className="text-[10px] text-[var(--text3)] mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* === 今日戰況 + 最新雷達 === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* 最新對練雷達 */}
        <div className="surface-elevated p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-1 h-5 rounded-full" style={{ background: "linear-gradient(180deg, var(--accent), var(--teal))" }} />
              <h3 className="text-sm font-bold">最新對練雷達</h3>
            </div>
            {latestSparring && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-md font-bold tabular-nums"
                style={{
                  background: `${getScoreColor(latestSparring.scores.overall)}20`,
                  color: getScoreColor(latestSparring.scores.overall),
                }}
              >
                {latestSparring.scores.overall} 分 · {getScoreLabel(latestSparring.scores.overall)}
              </span>
            )}
          </div>
          {latestSparring ? (
            <>
              <div className="flex items-center justify-center -my-1">
                <ScoreRadar scores={latestSparring.scores} size={200} />
              </div>
              <p className="text-[11px] text-center text-[var(--text3)] -mt-1">
                {latestSparring.personaName} · {new Date(latestSparring.date).toLocaleDateString("zh-TW")}
              </p>
            </>
          ) : (
            <div className="h-[210px] flex flex-col items-center justify-center text-center">
              <p className="text-4xl mb-2 opacity-60">🎯</p>
              <p className="text-sm text-[var(--text2)]">尚未開始對練</p>
              <button
                onClick={() => onNavigate("sparring")}
                className="mt-3 text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
                style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))" }}
              >
                立即開始第一場
              </button>
            </div>
          )}
        </div>

        {/* 今日戰況 */}
        <div className="surface-elevated p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-1 h-5 rounded-full" style={{ background: `linear-gradient(180deg, ${brand?.color || "#7c6cf0"}, var(--gold))` }} />
              <h3 className="text-sm font-bold">今日戰況快照</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--green)]/15 text-[var(--green)] font-bold">LIVE</span>
            </div>
            <span className="text-[10px] text-[var(--text3)] tabular-nums">{now.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "今日通次", value: todayKpi?.calls || 0, target: 30, color: brand?.color || "#7c6cf0" },
              { label: "有效通次", value: todayKpi?.validCalls || 0, target: 15, color: "#06b6d4" },
              { label: "邀約數", value: todayKpi?.appointments || 0, target: 3, color: "#34d399" },
              { label: "成交數", value: todayKpi?.closures || 0, target: 1, color: "#fbbf24" },
            ].map((m) => {
              const pct = Math.min(100, Math.round((m.value / m.target) * 100));
              return (
                <div key={m.label} className="bg-[var(--bg2)] rounded-xl p-3 border border-[var(--border)]">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[10px] text-[var(--text3)]">{m.label}</span>
                    <span className="text-[10px] text-[var(--text3)] tabular-nums">/ {m.target}</span>
                  </div>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: m.color }}>{m.value}</p>
                  <div className="h-1 mt-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${m.color}, ${m.color}80)` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {!todayKpi && (
            <button
              onClick={() => onNavigate("kpi")}
              className="mt-4 w-full py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, var(--gold), #f59e0b)" }}
            >
              📊 立即填寫今日 KPI
            </button>
          )}
        </div>
      </div>

      {/* 最近對練紀錄 */}
      <div className="surface-elevated p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-1 h-5 rounded-full" style={{ background: "linear-gradient(180deg, #06b6d4, var(--accent))" }} />
            <h3 className="text-sm font-bold">最近對練</h3>
          </div>
          <button
            onClick={() => onNavigate("sparring")}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            開始新對練 →
          </button>
        </div>
        {user.sparringRecords.length === 0 ? (
          <div className="text-center py-8 text-[var(--text3)]">
            <p className="text-3xl mb-2">🎯</p>
            <p className="text-sm">還沒有對練紀錄，去試試吧！</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {user.sparringRecords
              .slice(-6)
              .reverse()
              .map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-3 bg-[var(--bg2)] rounded-lg border border-[var(--border)]">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm tabular-nums"
                    style={{
                      background: `${getScoreColor(r.scores.overall)}20`,
                      color: getScoreColor(r.scores.overall),
                    }}
                  >
                    {r.scores.overall}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{r.personaName}</p>
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
  );
}

/* ===================== CHECK-IN (每日上工日誌) ===================== */
function CheckinPage({ user }: { user: User }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const storageKey = `moyu_checkin_${user.email}_${todayStr}`;
  const [mood, setMood] = useState<number>(3);
  const [energy, setEnergy] = useState<number>(3);
  const [goal, setGoal] = useState("");
  const [blocker, setBlocker] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const d = JSON.parse(raw);
        setMood(d.mood ?? 3);
        setEnergy(d.energy ?? 3);
        setGoal(d.goal ?? "");
        setBlocker(d.blocker ?? "");
        setSaved(true);
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ mood, energy, goal, blocker, t: Date.now() }));
      // TODO: POST to /api/human-state
      fetch("/api/human-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, date: todayStr, mood, energy, goal, blocker }),
      }).catch(() => {});
      setSaved(true);
    } catch { /* ignore */ }
  };

  const emoji = ["😩", "😕", "😐", "🙂", "🔥"];
  const energyLabel = ["💤", "😪", "⚡", "⚡⚡", "⚡⚡⚡"];

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">每日上工日誌</h1>
        <p className="text-[var(--text2)] text-sm">每天一分鐘，讓系統監測你的狀態與突破點</p>
      </div>

      <div className="surface-elevated p-6 mb-4">
        <h3 className="font-bold mb-4 text-sm">今日心情</h3>
        <div className="flex justify-between gap-2">
          {emoji.map((e, i) => (
            <button
              key={i}
              onClick={() => setMood(i + 1)}
              className="flex-1 aspect-square rounded-xl text-3xl border transition-all"
              style={{
                borderColor: mood === i + 1 ? "var(--accent)" : "var(--border)",
                background: mood === i + 1 ? "rgba(124,108,240,0.15)" : "var(--bg2)",
              }}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="surface-elevated p-6 mb-4">
        <h3 className="font-bold mb-4 text-sm">今日能量</h3>
        <div className="flex justify-between gap-2">
          {energyLabel.map((e, i) => (
            <button
              key={i}
              onClick={() => setEnergy(i + 1)}
              className="flex-1 py-4 rounded-xl text-base border transition-all"
              style={{
                borderColor: energy === i + 1 ? "var(--teal)" : "var(--border)",
                background: energy === i + 1 ? "rgba(45,212,191,0.12)" : "var(--bg2)",
              }}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="surface-elevated p-6 mb-4">
        <label className="block text-sm font-bold mb-2">今日最重要的一件事</label>
        <input
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="例如：打完 30 通電話 / 完成 3 場邀約"
          className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--bg2)] outline-none focus:border-[var(--accent)]"
        />
      </div>

      <div className="surface-elevated p-6 mb-6">
        <label className="block text-sm font-bold mb-2">目前遇到的卡點（選填）</label>
        <textarea
          value={blocker}
          onChange={(e) => setBlocker(e.target.value)}
          placeholder="例如：打電話被秒掛、不知道怎麼處理客戶的價格問題"
          rows={3}
          className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--bg2)] outline-none focus:border-[var(--accent)]"
        />
      </div>

      <button
        onClick={save}
        className="w-full py-3 rounded-xl font-bold text-white"
        style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))" }}
      >
        {saved ? "✅ 已儲存，更新數據" : "送出今日狀態"}
      </button>
      {saved && (
        <p className="text-center text-xs text-[var(--text3)] mt-3">
          今日已記錄，系統會同步到後台監測
        </p>
      )}
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
  const sendMessageRef = useRef<(text?: string) => void>(() => {});
  const startListeningRef = useRef<() => void>(() => {});

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
          if (!sendingRef.current) startListeningRef.current();
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
    sendMessageRef.current(text);
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
  startListeningRef.current = startListening;

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
  sendMessageRef.current = sendMessage;

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

