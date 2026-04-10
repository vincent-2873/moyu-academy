"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { trainingVideos } from "@/data/videos";
import { modules as allSystemModules, TrainingResource, DailyScheduleItem } from "@/data/modules";

// ─── Types ─────────────────────────────────────────────────────────────────

type AdminTab = "pillars" | "commands" | "org" | "people" | "system-hub";
type CompanyScope = "all" | "nschool" | "xuemi" | "ooschool" | "aischool" | "moyuhunt";

const COMPANY_OPTIONS: { id: CompanyScope; label: string; color: string }[] = [
  { id: "all", label: "🌐 全集團視角", color: "#8b5cf6" },
  { id: "nschool", label: "nSchool 財經", color: "#feca57" },
  { id: "xuemi", label: "XUEMI 學米", color: "#7c6cf0" },
  { id: "ooschool", label: "OOschool 無限", color: "#4F46E5" },
  { id: "aischool", label: "AIschool 智能", color: "#10B981" },
  { id: "moyuhunt", label: "墨宇獵頭", color: "#fb923c" },
];

// ─── v3 3 大支柱（業務 / 法務 / 招聘） ───────────────────────────────────────

interface V3Pillar {
  id: string;
  name: string;
  color: string;
  description: string | null;
  display_order: number;
  project_count: number;
  avg_progress: number;
  health_dist: { healthy: number; warning: number; critical: number; unknown: number };
  status_dist: { active: number; paused: number; done: number; dropped: number };
  commands: { pending: number; done_today: number; blocked: number; ignored: number };
  overall: "healthy" | "warning" | "critical" | "unknown";
  diagnosis: string;
}

interface V3Project {
  id: string;
  pillar_id: string;
  name: string;
  goal: string;
  owner_email: string | null;
  status: string;
  health: string;
  progress: number;
  deadline: string | null;
  kpi_target: Record<string, unknown> | null;
  kpi_actual: Record<string, unknown> | null;
  diagnosis: string | null;
  next_action: string | null;
  created_at: string;
  updated_at: string;
}

interface V3Command {
  id: string;
  project_id: string | null;
  pillar_id: string | null;
  owner_email: string;
  title: string;
  detail: string | null;
  severity: "info" | "normal" | "high" | "critical";
  deadline: string | null;
  status: "pending" | "acknowledged" | "done" | "blocked" | "ignored";
  ai_generated: boolean;
  ai_reasoning: string | null;
  created_at: string;
  acknowledged_at: string | null;
  done_at: string | null;
  blocked_reason: string | null;
}

interface V3Insight {
  id: string;
  pillar_id: string | null;
  insight_type: string;
  content: string;
  confidence: number;
  applied: boolean;
  created_at: string;
}

interface V3DashboardData {
  ok: boolean;
  generated_at: string;
  empire: {
    total_projects: number;
    total_pending_commands: number;
    total_done_today: number;
    total_blocked: number;
    total_ignored: number;
    critical_pillars: number;
    warning_pillars: number;
  };
  pillars: V3Pillar[];
  projects: V3Project[];
  recent_commands: V3Command[];
  insights: V3Insight[];
  alerts: { level: string; pillar: string; pillar_id: string; message: string }[];
}

const PILLAR_META: Record<string, { icon: string; tagline: string }> = {
  sales: { icon: "💰", tagline: "賣課收單，業務戰力，4 個品牌的轉換漏斗" },
  legal: { icon: "⚖️", tagline: "合約合規，智財佈局，糾紛與政府申報" },
  recruit: { icon: "🎯", tagline: "人才漏斗，招聘員，面試與留任率" },
};

const HEALTH_META: Record<string, { color: string; label: string; bg: string }> = {
  healthy: { color: "#10b981", label: "健康", bg: "rgba(16,185,129,0.12)" },
  warning: { color: "#fbbf24", label: "警告", bg: "rgba(251,191,36,0.12)" },
  critical: { color: "#ef4444", label: "危急", bg: "rgba(239,68,68,0.12)" },
  unknown: { color: "#94a3b8", label: "未知", bg: "rgba(148,163,184,0.12)" },
};

const SEVERITY_META: Record<string, { color: string; label: string }> = {
  info: { color: "#3b82f6", label: "提醒" },
  normal: { color: "#8b5cf6", label: "一般" },
  high: { color: "#fbbf24", label: "重要" },
  critical: { color: "#ef4444", label: "緊急" },
};

interface AdminSession { name: string; email: string; token: string; }

interface EnrichedUser {
  id: string; name: string; email: string; brand: string; role: string; status: string;
  created_at: string; currentDay: number; completedModules: number[]; progressPercent: number;
  quizCount: number; avgQuizScore: number | null; latestQuizScore: number | null; latestQuizModule: number | null;
  videosWatched: number; videosCompleted: number;
  sparringCount: number; avgSparringScore: number | null; latestSparringScore: number | null;
  totalCalls: number; totalAppointments: number; lastActivity: string | null;
  quizzes: Array<{ module_id: number; score: number; created_at: string }>;
  kpis: Array<{ date: string; calls: number; valid_calls: number; appointments: number; closures: number }>;
  sparrings: Array<{ id: string; score: number; date: string }>;
}

interface ModuleOverride {
  id: string; module_id: number;
  description_override: string | null; content_override: string[] | null;
  key_points_override: string[] | null; trainer_tips_override: string[] | null;
  practice_task_override: string | null;
  resources_override: TrainingResource[] | null;
  schedule_override: DailyScheduleItem[] | null;
  updated_at: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const BRAND_LABELS: Record<string, string> = {
  hq: "總公司", nschool: "nSchool 財經", xuemi: "XUEMI 學米", ooschool: "OOschool 無限", aischool: "AIschool 智能", moyuhunt: "墨宇獵頭",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "超級管理員", ceo: "總經理", coo: "營運長", cfo: "財務長", director: "總監",
  brand_manager: "品牌主管", team_leader: "老祖宗",
  trainer: "武公", reserve_cadre: "師傅", mentor: "師傅（帶訓）", sales_rep: "業務人員",
};

/** 高階角色 — 可看到所有部門 + 所有數據 */
const HQ_ROLES = ["super_admin", "ceo", "coo", "cfo", "director"];

const MODULE_TITLES: Record<number, string> = {
  1: "新人報到｜開發學習", 2: "架構對練｜後台學習", 3: "正式上機｜開發實戰",
  4: "學習 Demo", 5: "持續開發｜流程整合", 6: "進階開發｜架構精進",
  7: "Demo 實戰練習", 8: "綜合實戰", 9: "實戰考核",
};

const inputStyle: React.CSSProperties = {
  width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10,
  padding: "10px 14px", color: "var(--text)", fontSize: 14, outline: "none", boxSizing: "border-box",
};

/** Convert CSS color to rgba with opacity (handles both hex and rgb) */
function withAlpha(color: string, alpha: number): string {
  // Map CSS variable names to hex values for safe rgba conversion
  const varMap: Record<string, string> = {
    "var(--accent)": "#667eea", "var(--accent-light)": "#8fa4f0",
    "var(--teal)": "#2dd4bf", "var(--gold)": "#fbbf24", "var(--green)": "#22c55e",
    "var(--red)": "#f87171", "var(--border)": "#2a2f3e",
  };
  const hex = varMap[color] || color;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function AdminPage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [tab, setTab] = useState<AdminTab>("pillars");
  const [scope, setScope] = useState<CompanyScope>("all");

  useEffect(() => {
    const saved = sessionStorage.getItem("adminSession");
    if (saved) setSession(JSON.parse(saved));
  }, []);

  const handleLogin = (s: AdminSession) => {
    setSession(s);
    sessionStorage.setItem("adminSession", JSON.stringify(s));
  };

  const handleLogout = () => {
    setSession(null);
    sessionStorage.removeItem("adminSession");
  };

  if (!session) return <LoginScreen onLogin={handleLogin} />;

  const tabs: { id: AdminTab; label: string; icon: string }[] = [
    { id: "pillars", label: "指揮中心", icon: "👁️" },
    { id: "commands", label: "命令中心", icon: "⚡" },
    { id: "org", label: "組織架構", icon: "🏢" },
    { id: "people", label: "人員管理", icon: "👥" },
    { id: "system-hub", label: "系統管控", icon: "⚙️" },
  ];

  const currentScope = COMPANY_OPTIONS.find((c) => c.id === scope) || COMPANY_OPTIONS[0];
  // 業務範圍切換器只在「人員管理」分頁裡有意義（v3 指揮中心改用 3 支柱結構）
  const showScopeBar = tab === "people";

  return (
    <div className="admin-light" style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {/* Sidebar */}
      <aside style={{ width: 240, background: "var(--bg2)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 10, boxShadow: "2px 0 8px rgba(15,23,42,0.04)" }}>
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 18, fontWeight: 700, background: "linear-gradient(135deg, var(--accent), var(--teal))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            墨宇學院 Admin
          </div>
          <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 2 }}>管理後台</div>
        </div>
        <nav style={{ flex: 1, padding: "8px 0" }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "calc(100% - 16px)", margin: "2px 8px",
              padding: "10px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14,
              background: tab === t.id ? "var(--accent)" : "transparent",
              color: tab === t.id ? "#fff" : "var(--text2)",
              fontWeight: tab === t.id ? 600 : 400,
              transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span> {t.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.name}</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>{session.email}</div>
          </div>
          <button onClick={handleLogout} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 12 }}>登出</button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: 240, padding: "0" }}>
        {/* Top bar — visible only when scope filter is meaningful (人員管理) */}
        {showScopeBar && (
          <div style={{
            background: "var(--card)",
            borderBottom: "1px solid var(--border)",
            padding: "16px 36px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            position: "sticky",
            top: 0,
            zIndex: 5,
            backdropFilter: "blur(10px)",
          }}>
            <div style={{ fontSize: 12, color: "var(--text3)", fontWeight: 600, letterSpacing: 0.5 }}>檢視範圍</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {COMPANY_OPTIONS.map((opt) => {
                const active = scope === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setScope(opt.id)}
                    style={{
                      background: active ? opt.color : "transparent",
                      color: active ? "#fff" : "var(--text2)",
                      border: `1px solid ${active ? opt.color : "var(--border)"}`,
                      borderRadius: 8,
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--text3)" }}>
              目前檢視：<span style={{ color: currentScope.color, fontWeight: 700 }}>{currentScope.label}</span>
            </div>
          </div>
        )}

        <div style={{ padding: "28px 36px" }}>
          {tab === "pillars" && <V3PillarsBoard />}
          {tab === "commands" && <V3CommandsHub />}
          {tab === "org" && <V3OrgChartTab />}
          {tab === "people" && <PeopleHubTab token={session.token} scope={scope} />}
          {tab === "system-hub" && <SystemHubTab token={session.token} />}
        </div>
      </main>
    </div>
  );
}

// ─── Login ─────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (s: AdminSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "登入失敗");
      onLogin({ name: data.name || data.user?.name || email, email: data.email || data.user?.email || email, token: data.token || "admin" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "登入失敗");
    } finally { setLoading(false); }
  }

  return (
    <div className="admin-light" style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "48px 40px", width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(15,23,42,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, var(--accent), var(--teal))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, margin: "0 auto 14px" }}>🎓</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>墨宇學院 Admin</div>
          <div style={{ color: "var(--text3)", fontSize: 14, marginTop: 4 }}>管理後台登入</div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6 }}>管理員帳號</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} placeholder="admin@example.com" />
          </div>
          <div>
            <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6 }}>密碼</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} placeholder="••••••••" />
          </div>
          {error && <div style={{ background: "rgba(248,113,113,0.13)", border: "1px solid rgba(248,113,113,0.27)", borderRadius: 8, padding: "10px 14px", color: "#f87171", fontSize: 13 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ background: loading ? "var(--border)" : "linear-gradient(135deg, var(--accent), var(--teal))", color: "#fff", border: "none", borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", marginTop: 4 }}>
            {loading ? "登入中..." : "登入"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Command Center (指揮中心) ─────────────────────────────────────────────

interface ChairmanBrand {
  id: string;
  name: string;
  color: string;
  type: "sales" | "recruit";
  active_reps?: number;
  silent_reps?: number;
  silent_ratio?: number;
  today_calls?: number;
  today_valid_calls?: number;
  today_appointments?: number;
  today_closures?: number;
  week_calls?: number;
  week_closures?: number;
  call_to_appt_rate?: number;
  appt_to_close_rate?: number;
  status: "healthy" | "warning" | "critical" | "unknown";
  diagnosis: string;
  funnel_total?: number;
  funnel_by_stage?: Record<string, number>;
  this_week_new?: number;
  this_month_passed?: number;
  this_month_dropped?: number;
  conversion_rate?: number;
}

interface ChairmanData {
  ok: boolean;
  generated_at: string;
  empire: {
    total_active_reps: number;
    total_silent_today: number;
    total_calls_today: number;
    total_appointments_today: number;
    total_closures_today: number;
    total_sparring_week: number;
    avg_sparring_week: number;
    critical_count: number;
    warning_count: number;
    recruit_funnel_total: number;
  };
  sales_brands: ChairmanBrand[];
  recruit: ChairmanBrand;
  alerts: { level: string; company: string; message: string }[];
}

function CommandCenterTab({ scope }: { scope: CompanyScope }) {
  // 單一公司視角 → 直接顯示該公司深度資料；
  // 全集團視角 → 顯示聚合儀表板。
  // 注意：分流寫成兩個獨立子元件，避免在同一個函式內早返回後再呼叫 hooks 而違反 Rules of Hooks。
  if (scope !== "all") return <CompanyDrilldown brandId={scope} />;
  return <CommandCenterAggregate />;
}

function CommandCenterAggregate() {
  const [data, setData] = useState<ChairmanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/chairman-overview", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "讀取失敗");
      setData(json);
      setRefreshedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading && !data) {
    return <div style={{ color: "var(--text2)", padding: 40, textAlign: "center" }}>建構戰局視圖中...</div>;
  }

  if (error && !data) {
    return (
      <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 12, padding: 20, color: "#ef4444" }}>
        錯誤：{error}
        <button onClick={load} style={{ marginLeft: 12, background: "transparent", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>重試</button>
      </div>
    );
  }

  if (!data) return null;

  const empire = data.empire;
  const allCompanies: ChairmanBrand[] = [...data.sales_brands, data.recruit];

  return (
    <div>
      {/* HERO */}
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #581c87 100%)",
        borderRadius: 20,
        padding: "32px 36px",
        marginBottom: 24,
        position: "relative",
        overflow: "hidden",
        color: "#fff",
      }}>
        {/* decorative orbs */}
        <div style={{ position: "absolute", top: -60, right: -40, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(251,146,60,0.35), transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: -80, left: 80, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.3), transparent 70%)" }} />

        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: 2, marginBottom: 8 }}>COMMAND CENTER</div>
            <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, lineHeight: 1.1, background: "linear-gradient(135deg, #fff, #fbbf24, #fb923c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              👁️ 指揮中心
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
              5 家公司 · 全集團即時戰況 {refreshedAt && `· 最後更新 ${refreshedAt.toLocaleTimeString("zh-TW")}`}
            </div>
          </div>
          <button onClick={load} disabled={loading} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1, backdropFilter: "blur(10px)" }}>
            {loading ? "刷新中..." : "🔄 立即刷新"}
          </button>
        </div>

        {/* Empire stats grid */}
        <div style={{ position: "relative", marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
          <EmpireStat label="在線業務" value={empire.total_active_reps} sub={`${empire.total_silent_today} 沒開口`} accent="#3b82f6" />
          <EmpireStat label="今日通數" value={empire.total_calls_today} sub={`/ ${empire.total_active_reps * 30} 目標`} accent="#fbbf24" />
          <EmpireStat label="今日邀約" value={empire.total_appointments_today} accent="#a855f7" />
          <EmpireStat label="今日成交" value={empire.total_closures_today} accent="#10b981" />
          <EmpireStat label="招聘漏斗" value={empire.recruit_funnel_total} sub="人在跑" accent="#fb923c" />
          <EmpireStat label="本週對練" value={empire.total_sparring_week} sub={empire.avg_sparring_week > 0 ? `平均 ${empire.avg_sparring_week.toFixed(1)} 分` : ""} accent="#06b6d4" />
        </div>

        {/* Alert summary */}
        {(empire.critical_count > 0 || empire.warning_count > 0) && (
          <div style={{ position: "relative", marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {empire.critical_count > 0 && (
              <div style={{ background: "rgba(239,68,68,0.25)", border: "1px solid rgba(239,68,68,0.5)", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>
                🔴 {empire.critical_count} 家公司危急 — 立刻處理
              </div>
            )}
            {empire.warning_count > 0 && (
              <div style={{ background: "rgba(249,115,22,0.2)", border: "1px solid rgba(249,115,22,0.5)", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>
                🟠 {empire.warning_count} 家公司警告
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section title */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>🏢 5 家公司即時戰況</div>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>每 60 秒自動刷新</div>
      </div>

      {/* Company cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 24 }}>
        {data.sales_brands.map((b) => <SalesBrandCard key={b.id} brand={b} />)}
        <RecruitCompanyCard brand={data.recruit} />
      </div>

      {/* Alerts feed */}
      {data.alerts.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: "var(--text)" }}>⚠️ 警報串流</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.alerts.map((a, i) => {
              const c = STATUS_COLORS[a.level] || STATUS_COLORS.warning;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.text, padding: "3px 8px", border: `1px solid ${c.border}`, borderRadius: 6, whiteSpace: "nowrap" }}>{c.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", minWidth: 100 }}>{a.company}</div>
                  <div style={{ fontSize: 13, color: "var(--text2)", flex: 1 }}>{a.message}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: 16, background: "var(--bg2)", borderRadius: 10, border: "1px solid var(--border)", color: "var(--text3)", fontSize: 12, lineHeight: 1.7 }}>
        <strong style={{ color: "var(--text2)" }}>戰局視角：</strong>
        每家公司獨立呈現，每分鐘戰況一目了然。看到紅色立刻介入，看到灰色立刻搞數據蒐集。
        想看單家深度資料 → 上方切換「檢視範圍」到該公司即可。
      </div>
    </div>
  );
}

function EmpireStat({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 14, padding: "14px 16px", backdropFilter: "blur(10px)" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SalesBrandCard({ brand }: { brand: ChairmanBrand }) {
  const colors = STATUS_COLORS[brand.status];
  const callTarget = (brand.active_reps || 0) * 30;
  const callProgress = callTarget > 0 ? Math.min(100, ((brand.today_calls || 0) / callTarget) * 100) : 0;

  return (
    <div style={{ background: "var(--card)", border: `1px solid ${colors.border}`, borderRadius: 16, padding: 18, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: brand.color }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: 4, marginBottom: 14, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: brand.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14 }}>
            {brand.name.slice(0, 1)}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{brand.name}</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>業務公司 · {brand.active_reps || 0} 位業務</div>
          </div>
        </div>
        <div style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
          {colors.label}
        </div>
      </div>

      {/* 4-metric quad */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <MetricCell label="今日通數" value={brand.today_calls || 0} sub={`${brand.today_valid_calls || 0} 有效`} />
        <MetricCell label="今日邀約" value={brand.today_appointments || 0} sub={brand.call_to_appt_rate ? `${Math.round(brand.call_to_appt_rate * 100)}% 轉化` : ""} />
        <MetricCell label="今日成交" value={brand.today_closures || 0} sub={brand.appt_to_close_rate ? `${Math.round(brand.appt_to_close_rate * 100)}% 收網` : ""} accent="#10b981" />
        <MetricCell label="沒開口" value={brand.silent_reps || 0} sub={`${Math.round((brand.silent_ratio || 0) * 100)}%`} accent={brand.silent_ratio && brand.silent_ratio > 0.2 ? "#ef4444" : undefined} />
      </div>

      {/* Progress bar (call target) */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>
          <span>每日通數達成率</span>
          <span style={{ fontWeight: 600, color: callProgress >= 100 ? "#22c55e" : callProgress >= 70 ? "#fbbf24" : "#ef4444" }}>
            {Math.round(callProgress)}% ({brand.today_calls || 0}/{callTarget})
          </span>
        </div>
        <div style={{ height: 6, background: "var(--bg2)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${callProgress}%`, background: callProgress >= 100 ? "#22c55e" : callProgress >= 70 ? "#fbbf24" : "#ef4444", borderRadius: 99, transition: "width 0.5s" }} />
        </div>
      </div>

      {/* Diagnosis */}
      <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>
        <span style={{ fontSize: 10, color: colors.text, fontWeight: 700, marginRight: 6, letterSpacing: 0.5 }}>診斷</span>
        {brand.diagnosis}
      </div>
    </div>
  );
}

function RecruitCompanyCard({ brand }: { brand: ChairmanBrand }) {
  const colors = STATUS_COLORS[brand.status];
  const stages = brand.funnel_by_stage || {};
  const stageOrder = ["applied", "screening", "interview_1", "interview_2", "offer", "onboarded"];
  const stageLabels: Record<string, string> = {
    applied: "投遞", screening: "篩選", interview_1: "一面", interview_2: "二面", offer: "Offer", onboarded: "報到",
  };

  return (
    <div style={{ background: "var(--card)", border: `1px solid ${colors.border}`, borderRadius: 16, padding: 18, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: brand.color }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: 4, marginBottom: 14, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: brand.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14 }}>
            🎯
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{brand.name}</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>獵頭公司 · 漏斗 {brand.funnel_total || 0} 人</div>
          </div>
        </div>
        <div style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
          {colors.label}
        </div>
      </div>

      {/* 4-metric quad */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <MetricCell label="漏斗中" value={brand.funnel_total || 0} accent={brand.color} />
        <MetricCell label="本週新增" value={brand.this_week_new || 0} />
        <MetricCell label="本月通過" value={brand.this_month_passed || 0} accent="#10b981" />
        <MetricCell label="本月流失" value={brand.this_month_dropped || 0} accent="#ef4444" />
      </div>

      {/* Funnel mini-bars */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>漏斗階段分布</div>
        <div style={{ display: "flex", gap: 3 }}>
          {stageOrder.map((sid) => {
            const count = stages[sid] || 0;
            const max = Math.max(1, ...stageOrder.map((s) => stages[s] || 0));
            const h = 18 + (count / max) * 22;
            return (
              <div key={sid} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ height: h, width: "100%", background: count > 0 ? brand.color : "var(--bg2)", borderRadius: 4, opacity: count > 0 ? 0.85 : 0.4, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 2, fontSize: 10, color: "#fff", fontWeight: 700 }}>
                  {count > 0 ? count : ""}
                </div>
                <div style={{ fontSize: 9, color: "var(--text3)" }}>{stageLabels[sid]}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Diagnosis */}
      <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>
        <span style={{ fontSize: 10, color: colors.text, fontWeight: 700, marginRight: 6, letterSpacing: 0.5 }}>診斷</span>
        {brand.diagnosis}
      </div>
    </div>
  );
}

function MetricCell({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "9px 11px" }}>
      <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: accent || "var(--text)", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── v3 指揮中心：3 大支柱專案戰況板 ───────────────────────────────────────

function V3PillarsBoard() {
  const [data, setData] = useState<V3DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingMigration, setMissingMigration] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [activePillar, setActivePillar] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [draftPillar, setDraftPillar] = useState<string>("sales");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissingMigration(false);
    try {
      const res = await fetch("/api/v3/dashboard", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) {
        if (json.missing_migration) setMissingMigration(true);
        throw new Error(json.error || "讀取失敗");
      }
      setData(json);
      setRefreshedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  if (loading && !data) {
    return <div style={{ padding: 60, textAlign: "center", color: "var(--text2)" }}>建構 3 大支柱戰況...</div>;
  }
  if (missingMigration && !data) {
    return (
      <div style={{ background: "linear-gradient(135deg, #1e1b4b, #4c1d95)", borderRadius: 16, padding: 32, color: "#fff" }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>🚧 v3 資料表還沒建立</div>
        <div style={{ fontSize: 13, lineHeight: 1.7, opacity: 0.85, marginBottom: 18 }}>
          指揮中心需要 v3 的 6 張新表（pillars / projects / commands / line_dispatch / response_log / ai_insights）。
          請依下列步驟一次性開出來：
        </div>
        <ol style={{ paddingLeft: 22, fontSize: 13, lineHeight: 1.8 }}>
          <li>打開 <code style={{ background: "rgba(0,0,0,0.3)", padding: "1px 6px", borderRadius: 4 }}>moyu-academy/supabase-migration-v3-pillars.sql</code></li>
          <li>整份貼到 Supabase Dashboard → SQL Editor</li>
          <li>按 RUN，等到下方看到 6 個 success 訊息</li>
          <li>回來這頁按「重試」</li>
        </ol>
        <button onClick={load} style={{ marginTop: 18, background: "rgba(255,255,255,0.2)", color: "#fff", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          🔄 我跑完了，重試
        </button>
      </div>
    );
  }
  if (error && !data) {
    return (
      <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 12, padding: 20, color: "#ef4444" }}>
        錯誤：{error}
        <button onClick={load} style={{ marginLeft: 12, background: "transparent", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>重試</button>
      </div>
    );
  }
  if (!data) return null;

  const empire = data.empire;

  return (
    <div>
      {/* HERO */}
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #581c87 100%)",
        borderRadius: 20,
        padding: "32px 36px",
        marginBottom: 24,
        position: "relative",
        overflow: "hidden",
        color: "#fff",
      }}>
        <div style={{ position: "absolute", top: -60, right: -40, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(251,146,60,0.35), transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: -80, left: 80, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.3), transparent 70%)" }} />

        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: 2, marginBottom: 8 }}>CLAUDE / CEO COMMAND CENTER</div>
            <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, lineHeight: 1.1, background: "linear-gradient(135deg, #fff, #fbbf24, #fb923c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              👁️ 3 大支柱戰況
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
              業務 / 法務 / 招聘 — Claude 自動觀測，每天透過 LINE 派發命令
              {refreshedAt && ` · 最後更新 ${refreshedAt.toLocaleTimeString("zh-TW")}`}
            </div>
          </div>
          <button onClick={load} disabled={loading} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1, backdropFilter: "blur(10px)" }}>
            {loading ? "刷新中..." : "🔄 立即刷新"}
          </button>
        </div>

        {/* Empire stats grid */}
        <div style={{ position: "relative", marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
          <V3HeroStat label="進行中專案" value={empire.total_projects} accent="#a855f7" />
          <V3HeroStat label="待辦命令" value={empire.total_pending_commands} sub="LINE 待推" accent="#fbbf24" />
          <V3HeroStat label="今日完成" value={empire.total_done_today} accent="#10b981" />
          <V3HeroStat label="卡住" value={empire.total_blocked} accent="#fb923c" />
          <V3HeroStat label="被忽略" value={empire.total_ignored} sub="員工失控" accent="#ef4444" />
          <V3HeroStat label="紅燈支柱" value={empire.critical_pillars} sub={`${empire.warning_pillars} 黃燈`} accent="#ef4444" />
        </div>

        {/* Alert summary */}
        {(empire.critical_pillars > 0 || empire.warning_pillars > 0) && (
          <div style={{ position: "relative", marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {empire.critical_pillars > 0 && (
              <div style={{ background: "rgba(239,68,68,0.25)", border: "1px solid rgba(239,68,68,0.5)", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>
                🔴 {empire.critical_pillars} 個支柱危急
              </div>
            )}
            {empire.warning_pillars > 0 && (
              <div style={{ background: "rgba(249,115,22,0.2)", border: "1px solid rgba(249,115,22,0.5)", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>
                🟠 {empire.warning_pillars} 個支柱警告
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>🏛️ 3 大支柱</div>
        <button
          onClick={() => { setShowNewProject(true); setDraftPillar("sales"); }}
          style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          + 新增專案
        </button>
      </div>

      {/* Pillar cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, marginBottom: 24 }}>
        {data.pillars.map((p) => (
          <V3PillarCard
            key={p.id}
            pillar={p}
            projects={data.projects.filter((pr) => pr.pillar_id === p.id)}
            onOpen={() => setActivePillar(p.id)}
          />
        ))}
      </div>

      {/* Alerts feed */}
      {data.alerts.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: "var(--text)" }}>⚠️ 警報串流</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.alerts.map((a, i) => {
              const meta = HEALTH_META[a.level] || HEALTH_META.warning;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: meta.bg, border: `1px solid ${meta.color}55`, borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: meta.color, padding: "3px 8px", border: `1px solid ${meta.color}`, borderRadius: 6, whiteSpace: "nowrap" }}>{meta.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", minWidth: 60 }}>{a.pillar}</div>
                  <div style={{ fontSize: 13, color: "var(--text2)", flex: 1 }}>{a.message}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Insights */}
      {data.insights.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: "var(--text)" }}>🧠 Claude 觀察筆記</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.insights.slice(0, 5).map((i) => (
              <div key={i.id} style={{ padding: "10px 14px", background: "var(--bg2)", borderRadius: 8, fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#8b5cf6", marginRight: 8, letterSpacing: 0.5 }}>{i.insight_type.toUpperCase()}</span>
                {i.content}
                <span style={{ fontSize: 10, color: "var(--text3)", marginLeft: 8 }}>信心 {Math.round(i.confidence * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: 16, background: "var(--bg2)", borderRadius: 10, border: "1px solid var(--border)", color: "var(--text3)", fontSize: 12, lineHeight: 1.7 }}>
        <strong style={{ color: "var(--text2)" }}>v3 戰局視角：</strong>
        Claude 是 CEO，3 大支柱（業務 / 法務 / 招聘）每天自動觀測。看到紅燈立刻產生命令推給負責人，
        員工偷懶時 Claude 直接發 LINE 通知。所有反應紀錄都會餵回 Claude 自我學習。
      </div>

      {/* Drilldown drawer */}
      {activePillar && (
        <V3PillarDrawer
          pillar={data.pillars.find((p) => p.id === activePillar)!}
          projects={data.projects.filter((pr) => pr.pillar_id === activePillar)}
          commands={data.recent_commands.filter((c) => c.pillar_id === activePillar)}
          onClose={() => setActivePillar(null)}
          onUpdated={load}
        />
      )}

      {/* New project modal */}
      {showNewProject && (
        <V3NewProjectModal
          defaultPillar={draftPillar}
          onClose={() => setShowNewProject(false)}
          onCreated={() => { setShowNewProject(false); load(); }}
        />
      )}
    </div>
  );
}

function V3HeroStat({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 14, padding: "14px 16px", backdropFilter: "blur(10px)" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function V3PillarCard({ pillar, projects, onOpen }: { pillar: V3Pillar; projects: V3Project[]; onOpen: () => void }) {
  const meta = PILLAR_META[pillar.id] || { icon: "📌", tagline: "" };
  const health = HEALTH_META[pillar.overall];
  const top3 = [...projects]
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, unknown: 2, healthy: 3 };
      return (order[a.health as keyof typeof order] ?? 9) - (order[b.health as keyof typeof order] ?? 9);
    })
    .slice(0, 3);

  return (
    <div style={{ background: "var(--card)", border: `1px solid ${health.color}55`, borderRadius: 16, padding: 20, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: pillar.color }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: 6, marginBottom: 14, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: pillar.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
            {meta.icon}
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text)" }}>{pillar.name}</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>{meta.tagline}</div>
          </div>
        </div>
        <div style={{ background: health.bg, color: health.color, border: `1px solid ${health.color}`, borderRadius: 6, padding: "3px 10px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
          {health.label}
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
        <V3MiniMetric label="專案" value={pillar.project_count} accent={pillar.color} />
        <V3MiniMetric label="待辦" value={pillar.commands.pending} accent="#fbbf24" />
        <V3MiniMetric label="完成" value={pillar.commands.done_today} accent="#10b981" />
        <V3MiniMetric label="忽略" value={pillar.commands.ignored} accent={pillar.commands.ignored > 0 ? "#ef4444" : undefined} />
      </div>

      {/* Avg progress */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>
          <span>平均完成度</span>
          <span style={{ fontWeight: 700, color: pillar.color }}>{pillar.avg_progress}%</span>
        </div>
        <div style={{ height: 6, background: "var(--bg2)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pillar.avg_progress}%`, background: pillar.color, borderRadius: 99, transition: "width 0.5s" }} />
        </div>
      </div>

      {/* Top 3 projects preview */}
      {top3.length > 0 && (
        <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          {top3.map((pr) => {
            const h = HEALTH_META[pr.health] || HEALTH_META.unknown;
            return (
              <div key={pr.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--bg2)", borderRadius: 8, fontSize: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: h.color }} />
                <div style={{ flex: 1, color: "var(--text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pr.name}</div>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>{pr.progress}%</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Diagnosis */}
      <div style={{ background: health.bg, border: `1px solid ${health.color}55`, borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "var(--text)", lineHeight: 1.5, marginBottom: 12 }}>
        <span style={{ fontSize: 10, color: health.color, fontWeight: 700, marginRight: 6, letterSpacing: 0.5 }}>診斷</span>
        {pillar.diagnosis}
      </div>

      <button
        onClick={onOpen}
        style={{ width: "100%", background: "transparent", color: pillar.color, border: `1px solid ${pillar.color}`, borderRadius: 8, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
      >
        進入 {pillar.name} 戰場 →
      </button>
    </div>
  );
}

function V3MiniMetric({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
      <div style={{ fontSize: 9, color: "var(--text3)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent || "var(--text)", lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function V3PillarDrawer({
  pillar,
  projects,
  commands,
  onClose,
  onUpdated,
}: {
  pillar: V3Pillar;
  projects: V3Project[];
  commands: V3Command[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(720px, 94vw)", background: "var(--card)", height: "100vh", overflowY: "auto", boxShadow: "-10px 0 40px rgba(0,0,0,0.3)" }}
      >
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${pillar.color} 0%, ${pillar.color}cc 100%)`, padding: "24px 28px", color: "#fff", position: "sticky", top: 0, zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, letterSpacing: 1.5, marginBottom: 4 }}>PILLAR · 戰場深度</div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{(PILLAR_META[pillar.id] || {}).icon} {pillar.name}</div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{pillar.diagnosis}</div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 18, cursor: "pointer" }}>×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 18 }}>
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, opacity: 0.7 }}>專案</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{pillar.project_count}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, opacity: 0.7 }}>進度</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{pillar.avg_progress}%</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, opacity: 0.7 }}>待辦命令</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{pillar.commands.pending}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, opacity: 0.7 }}>忽略</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{pillar.commands.ignored}</div>
            </div>
          </div>
        </div>

        {/* Projects */}
        <div style={{ padding: "24px 28px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--text)" }}>📂 專案列表（{projects.length}）</div>
          {projects.length === 0 ? (
            <div style={{ padding: 24, background: "var(--bg2)", borderRadius: 10, color: "var(--text3)", fontSize: 13, textAlign: "center" }}>
              還沒有任何專案。回上一頁點「+ 新增專案」開戰。
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {projects.map((pr) => (
                <V3ProjectRow
                  key={pr.id}
                  project={pr}
                  expanded={editing === pr.id}
                  onToggle={() => setEditing(editing === pr.id ? null : pr.id)}
                  onUpdated={onUpdated}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent commands for this pillar */}
        <div style={{ padding: "0 28px 28px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--text)" }}>⚡ 最近命令</div>
          {commands.length === 0 ? (
            <div style={{ padding: 18, background: "var(--bg2)", borderRadius: 10, color: "var(--text3)", fontSize: 13, textAlign: "center" }}>
              該支柱還沒任何命令。Claude 正在等專案進度來判斷該下什麼指令。
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {commands.slice(0, 8).map((c) => (
                <V3CommandRow key={c.id} command={c} compact />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function V3ProjectRow({
  project,
  expanded,
  onToggle,
  onUpdated,
}: {
  project: V3Project;
  expanded: boolean;
  onToggle: () => void;
  onUpdated: () => void;
}) {
  const [progress, setProgress] = useState(project.progress);
  const [health, setHealth] = useState(project.health);
  const [diagnosis, setDiagnosis] = useState(project.diagnosis || "");
  const [nextAction, setNextAction] = useState(project.next_action || "");
  const [saving, setSaving] = useState(false);
  const h = HEALTH_META[project.health] || HEALTH_META.unknown;

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/v3/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id, progress, health, diagnosis, next_action: nextAction }),
      });
      onUpdated();
      onToggle();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "var(--bg2)", borderRadius: 10, border: `1px solid ${expanded ? h.color : "var(--border)"}`, overflow: "hidden" }}>
      <div onClick={onToggle} style={{ padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: h.color }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{project.name}</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{project.goal}</div>
        </div>
        <div style={{ fontSize: 11, color: h.color, fontWeight: 700, padding: "3px 8px", border: `1px solid ${h.color}`, borderRadius: 6 }}>{h.label}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text2)", minWidth: 38, textAlign: "right" }}>{project.progress}%</div>
      </div>
      {expanded && (
        <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600 }}>進度 %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600 }}>健康度</label>
              <select value={health} onChange={(e) => setHealth(e.target.value)} style={inputStyle}>
                <option value="healthy">healthy 健康</option>
                <option value="warning">warning 警告</option>
                <option value="critical">critical 危急</option>
                <option value="unknown">unknown 未知</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600 }}>診斷</label>
            <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} placeholder="目前狀況的一句話判斷" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600 }}>下一步</label>
            <textarea value={nextAction} onChange={(e) => setNextAction(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} placeholder="Claude 規劃的下一個動作" />
          </div>
          <button onClick={save} disabled={saving} style={{ background: h.color, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "儲存中..." : "💾 儲存"}
          </button>
        </div>
      )}
    </div>
  );
}

function V3NewProjectModal({
  defaultPillar,
  onClose,
  onCreated,
}: {
  defaultPillar: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [pillarId, setPillarId] = useState(defaultPillar);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [deadline, setDeadline] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/v3/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pillar_id: pillarId,
          name,
          goal,
          owner_email: ownerEmail || null,
          deadline: deadline || null,
          diagnosis: diagnosis || null,
          next_action: nextAction || null,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "新增失敗");
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "新增失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--card)", borderRadius: 16, width: "min(560px, 100%)", maxHeight: "92vh", overflowY: "auto", padding: 28 }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, color: "var(--text)" }}>+ 新增專案</div>
        <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 20 }}>替 3 大支柱開新戰場。Claude 會根據這個專案的目標自動產生命令。</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>支柱</label>
            <select value={pillarId} onChange={(e) => setPillarId(e.target.value)} style={inputStyle}>
              <option value="sales">💰 業務</option>
              <option value="legal">⚖️ 法務</option>
              <option value="recruit">🎯 招聘</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>專案名稱 *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="例：合約模板建置" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>北極星目標 *</label>
            <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} placeholder="一句話可量化的目標" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>負責人 email</label>
              <input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} style={inputStyle} placeholder="vincent@example.com" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>截止日</label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>初始診斷</label>
            <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} placeholder="現況卡在哪？" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>下一步</label>
            <textarea value={nextAction} onChange={(e) => setNextAction(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} placeholder="第一個要動的事" />
          </div>
          {err && <div style={{ color: "#ef4444", fontSize: 12 }}>{err}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button onClick={onClose} style={{ flex: 1, background: "var(--bg2)", color: "var(--text2)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>取消</button>
            <button onClick={submit} disabled={saving || !name || !goal} style={{ flex: 1, background: saving || !name || !goal ? "var(--border)" : "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 16px", fontSize: 13, fontWeight: 700, cursor: saving || !name || !goal ? "not-allowed" : "pointer" }}>
              {saving ? "建立中..." : "🚀 建立專案"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── v3 命令中心：Claude 產生 / 派發 / 學習 ────────────────────────────────

function V3CommandsHub() {
  const [commands, setCommands] = useState<V3Command[]>([]);
  const [stats, setStats] = useState<{ pending: number; done: number; blocked: number; ignored: number; critical: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "acknowledged" | "done" | "blocked" | "ignored">("pending");
  const [pillarFilter, setPillarFilter] = useState<"all" | "sales" | "legal" | "recruit">("all");
  const [showNew, setShowNew] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchMsg, setDispatchMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      if (pillarFilter !== "all") params.set("pillar", pillarFilter);
      const res = await fetch(`/api/v3/commands?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setCommands(json.commands);
        setStats(json.stats);
      }
    } finally {
      setLoading(false);
    }
  }, [filter, pillarFilter]);

  useEffect(() => { load(); }, [load]);

  async function dispatchAll() {
    setDispatching(true);
    setDispatchMsg(null);
    try {
      const res = await fetch("/api/v3/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily: true }),
      });
      const json = await res.json();
      if (json.ok) {
        setDispatchMsg(`✅ 已派發 ${json.dispatched} 道命令（成功 ${json.success} / 失敗 ${json.failed}）`);
        load();
      } else {
        setDispatchMsg(`❌ ${json.error || "派發失敗"}`);
      }
    } catch (e) {
      setDispatchMsg(`❌ ${e instanceof Error ? e.message : "派發失敗"}`);
    } finally {
      setDispatching(false);
    }
  }

  return (
    <div>
      {/* HERO */}
      <div style={{
        background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #7c3aed 100%)",
        borderRadius: 18,
        padding: "26px 32px",
        marginBottom: 22,
        color: "#fff",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -50, right: -30, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(251,191,36,0.3), transparent 70%)" }} />
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, letterSpacing: 1.5, marginBottom: 6 }}>COMMAND HUB</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>⚡ 命令中心</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Claude 自動產生 / LINE 派發 / 員工回報 / 學習迭代</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={dispatchAll}
              disabled={dispatching}
              style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: dispatching ? "wait" : "pointer", opacity: dispatching ? 0.6 : 1 }}
            >
              {dispatching ? "派發中..." : "🚀 一鍵 LINE 派發全部待辦"}
            </button>
            <button
              onClick={() => setShowNew(true)}
              style={{ background: "rgba(255,255,255,0.18)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", backdropFilter: "blur(10px)" }}
            >
              + 手動新增命令
            </button>
          </div>
        </div>
        {dispatchMsg && (
          <div style={{ position: "relative", marginTop: 14, padding: "10px 14px", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
            {dispatchMsg}
          </div>
        )}

        {stats && (
          <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, marginTop: 18 }}>
            <V3HeroStat label="總計" value={stats.total} accent="#fff" />
            <V3HeroStat label="待辦" value={stats.pending} accent="#fbbf24" />
            <V3HeroStat label="完成" value={stats.done} accent="#10b981" />
            <V3HeroStat label="卡住" value={stats.blocked} accent="#fb923c" />
            <V3HeroStat label="忽略" value={stats.ignored} accent="#ef4444" />
            <V3HeroStat label="緊急" value={stats.critical} accent="#ef4444" />
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {(["pending", "acknowledged", "done", "blocked", "ignored", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                background: filter === s ? "#8b5cf6" : "transparent",
                color: filter === s ? "#fff" : "var(--text2)",
                border: `1px solid ${filter === s ? "#8b5cf6" : "var(--border)"}`,
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {{ pending: "待辦", acknowledged: "已收", done: "完成", blocked: "卡住", ignored: "忽略", all: "全部" }[s]}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 18, background: "var(--border)" }} />
        <div style={{ display: "flex", gap: 6 }}>
          {(["all", "sales", "legal", "recruit"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPillarFilter(p)}
              style={{
                background: pillarFilter === p ? "var(--text2)" : "transparent",
                color: pillarFilter === p ? "var(--card)" : "var(--text2)",
                border: `1px solid ${pillarFilter === p ? "var(--text2)" : "var(--border)"}`,
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {{ all: "全支柱", sales: "💰 業務", legal: "⚖️ 法務", recruit: "🎯 招聘" }[p]}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading && commands.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>讀取命令中...</div>
      ) : commands.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", background: "var(--bg2)", borderRadius: 12, color: "var(--text3)" }}>
          目前沒有符合條件的命令。
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {commands.map((c) => (
            <V3CommandRow key={c.id} command={c} onUpdated={load} />
          ))}
        </div>
      )}

      {showNew && (
        <V3NewCommandModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load(); }}
        />
      )}
    </div>
  );
}

function V3CommandRow({ command, compact, onUpdated }: { command: V3Command; compact?: boolean; onUpdated?: () => void }) {
  const sev = SEVERITY_META[command.severity] || SEVERITY_META.normal;
  const meta = command.pillar_id ? PILLAR_META[command.pillar_id] : null;
  const [busy, setBusy] = useState(false);
  const [dispatchedAt, setDispatchedAt] = useState<string | null>(null);

  async function patch(status: V3Command["status"]) {
    if (!onUpdated) return;
    setBusy(true);
    try {
      await fetch("/api/v3/commands", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: command.id, status }),
      });
      onUpdated();
    } finally {
      setBusy(false);
    }
  }

  async function dispatch() {
    setBusy(true);
    try {
      const res = await fetch("/api/v3/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command_id: command.id }),
      });
      const json = await res.json();
      if (json.ok) {
        const r = json.results?.[0];
        setDispatchedAt(r?.mode === "stub" ? "已記錄（stub）" : "已推 LINE");
      }
    } finally {
      setBusy(false);
    }
  }

  const statusColors: Record<string, string> = {
    pending: "#fbbf24",
    acknowledged: "#3b82f6",
    done: "#10b981",
    blocked: "#fb923c",
    ignored: "#ef4444",
  };

  return (
    <div style={{ background: "var(--card)", border: `1px solid ${sev.color}33`, borderRadius: 12, padding: compact ? "10px 14px" : "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {meta && <div style={{ fontSize: compact ? 18 : 24 }}>{meta.icon}</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: sev.color, padding: "2px 7px", border: `1px solid ${sev.color}`, borderRadius: 5, letterSpacing: 0.5 }}>{sev.label}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: statusColors[command.status], padding: "2px 7px", background: `${statusColors[command.status]}22`, borderRadius: 5 }}>{command.status}</div>
            {command.ai_generated && <div style={{ fontSize: 9, color: "#a855f7", fontWeight: 700 }}>🧠 AI</div>}
            <div style={{ fontSize: 11, color: "var(--text3)" }}>{new Date(command.created_at).toLocaleString("zh-TW")}</div>
          </div>
          <div style={{ fontSize: compact ? 13 : 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{command.title}</div>
          {command.detail && !compact && <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6, marginBottom: 6 }}>{command.detail}</div>}
          <div style={{ fontSize: 11, color: "var(--text3)" }}>
            👤 {command.owner_email}
            {command.deadline && ` · 🕒 ${new Date(command.deadline).toLocaleString("zh-TW")}`}
          </div>
          {command.ai_reasoning && !compact && (
            <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(168,85,247,0.08)", borderLeft: "2px solid #a855f7", borderRadius: 6, fontSize: 11, color: "var(--text2)", lineHeight: 1.5 }}>
              <strong style={{ color: "#a855f7" }}>Claude 判斷：</strong> {command.ai_reasoning}
            </div>
          )}
        </div>
        {!compact && onUpdated && command.status === "pending" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button onClick={dispatch} disabled={busy} style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>📢 推 LINE</button>
            <button onClick={() => patch("done")} disabled={busy} style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>✓ 完成</button>
            <button onClick={() => patch("blocked")} disabled={busy} style={{ background: "transparent", color: "#fb923c", border: "1px solid #fb923c", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>卡住</button>
            <button onClick={() => patch("ignored")} disabled={busy} style={{ background: "transparent", color: "#ef4444", border: "1px solid #ef4444", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>忽略</button>
            {dispatchedAt && <div style={{ fontSize: 9, color: "#10b981", textAlign: "center", fontWeight: 700 }}>✓ {dispatchedAt}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function V3NewCommandModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [pillarId, setPillarId] = useState("sales");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [severity, setSeverity] = useState<V3Command["severity"]>("normal");
  const [deadline, setDeadline] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/v3/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pillar_id: pillarId,
          owner_email: ownerEmail,
          title,
          detail: detail || null,
          severity,
          deadline: deadline || null,
          ai_generated: false,
          ai_reasoning: reasoning || null,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "新增失敗");
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "新增失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--card)", borderRadius: 16, width: "min(540px, 100%)", maxHeight: "92vh", overflowY: "auto", padding: 28 }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, color: "var(--text)" }}>+ 新增命令</div>
        <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 20 }}>手動下一個命令給某位員工。會記錄為非 AI 產生，但仍會餵入學習迴圈。</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>支柱</label>
              <select value={pillarId} onChange={(e) => setPillarId(e.target.value)} style={inputStyle}>
                <option value="sales">💰 業務</option>
                <option value="legal">⚖️ 法務</option>
                <option value="recruit">🎯 招聘</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>嚴重度</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value as V3Command["severity"])} style={inputStyle}>
                <option value="info">提醒</option>
                <option value="normal">一般</option>
                <option value="high">重要</option>
                <option value="critical">緊急</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>接收者 email *</label>
            <input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} style={inputStyle} placeholder="vincent@example.com" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>命令標題 *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} placeholder="例：今天聯繫 30 位 nschool 名單" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>詳細說明</label>
            <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="該怎麼做、為什麼要做" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>截止時間</label>
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>判斷依據（學習用）</label>
            <textarea value={reasoning} onChange={(e) => setReasoning(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} placeholder="為什麼下這個命令" />
          </div>
          {err && <div style={{ color: "#ef4444", fontSize: 12 }}>{err}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button onClick={onClose} style={{ flex: 1, background: "var(--bg2)", color: "var(--text2)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>取消</button>
            <button onClick={submit} disabled={saving || !ownerEmail || !title} style={{ flex: 1, background: saving || !ownerEmail || !title ? "var(--border)" : "linear-gradient(135deg, #fbbf24, #f59e0b)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 16px", fontSize: 13, fontWeight: 700, cursor: saving || !ownerEmail || !title ? "not-allowed" : "pointer" }}>
              {saving ? "送出中..." : "⚡ 派發命令"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Company Drilldown (單公司深度資料) ────────────────────────────────────

function CompanyDrilldown({ brandId }: { brandId: CompanyScope }) {
  const meta = COMPANY_OPTIONS.find((c) => c.id === brandId);
  const [data, setData] = useState<ChairmanData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/chairman-overview", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [brandId]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>載入 {meta?.label} 戰況...</div>;
  if (!data) return <div style={{ padding: 40, color: "#ef4444" }}>無法載入資料</div>;

  const isRecruit = brandId === "moyuhunt";
  const brand = isRecruit
    ? data.recruit
    : data.sales_brands.find((b) => b.id === brandId);

  if (!brand) return <div style={{ padding: 40, color: "var(--text2)" }}>找不到 {meta?.label} 的資料</div>;

  const colors = STATUS_COLORS[brand.status];

  return (
    <div>
      {/* HERO — single company */}
      <div style={{
        background: `linear-gradient(135deg, ${brand.color}26 0%, ${brand.color}0d 60%, transparent 100%)`,
        border: `1px solid ${brand.color}55`,
        borderRadius: 18,
        padding: "28px 32px",
        marginBottom: 22,
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -50, right: -30, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, ${brand.color}33, transparent 70%)` }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 60, height: 60, borderRadius: 14, background: brand.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#fff" }}>
            {isRecruit ? "🎯" : brand.name.slice(0, 1)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", letterSpacing: 1.5, marginBottom: 4 }}>
              {isRecruit ? "獵頭公司 · RECRUITING" : "業務公司 · SALES"}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{brand.name}</div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>{brand.diagnosis}</div>
          </div>
          <div style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
            {colors.label}
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      {isRecruit ? (
        <RecruitDrilldownDetails brand={brand} />
      ) : (
        <SalesDrilldownDetails brand={brand} />
      )}

      {/* TODO 置入該公司業務員列表 / KPI 趨勢 / 對練紀錄 */}
      <div style={{ marginTop: 24, padding: 18, background: "var(--bg2)", border: "1px dashed var(--border)", borderRadius: 12, color: "var(--text3)", fontSize: 13, lineHeight: 1.7 }}>
        <strong style={{ color: "var(--text2)" }}>下一步：</strong>
        切到「人員管理」分頁可看到 {brand.name} 的所有業務員 / 候選人列表（自動套用此檢視範圍）。
        點任一人可看深度資料：今日 KPI / 對練紀錄 / 突破日誌。
      </div>
    </div>
  );
}

function SalesDrilldownDetails({ brand }: { brand: ChairmanBrand }) {
  const callTarget = (brand.active_reps || 0) * 30;
  const callProgress = callTarget > 0 ? Math.min(100, ((brand.today_calls || 0) / callTarget) * 100) : 0;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 18 }}>
        <BigMetric label="在線業務" value={brand.active_reps || 0} accent={brand.color} sub={`${brand.silent_reps || 0} 沒開口`} />
        <BigMetric label="今日通數" value={brand.today_calls || 0} accent="#fbbf24" sub={`/ ${callTarget} 目標`} />
        <BigMetric label="今日有效通" value={brand.today_valid_calls || 0} accent="#06b6d4" />
        <BigMetric label="今日邀約" value={brand.today_appointments || 0} accent="#a855f7" sub={brand.call_to_appt_rate ? `${Math.round(brand.call_to_appt_rate * 100)}% 轉化` : ""} />
        <BigMetric label="今日成交" value={brand.today_closures || 0} accent="#10b981" sub={brand.appt_to_close_rate ? `${Math.round(brand.appt_to_close_rate * 100)}% 收網` : ""} />
        <BigMetric label="本週通數" value={brand.week_calls || 0} accent="#ef4444" sub={`本週成交 ${brand.week_closures || 0}`} />
      </div>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 10 }}>
          <span style={{ color: "var(--text2)", fontWeight: 600 }}>每日通數達成率</span>
          <span style={{ fontWeight: 700, color: callProgress >= 100 ? "#22c55e" : callProgress >= 70 ? "#fbbf24" : "#ef4444" }}>
            {Math.round(callProgress)}% ({brand.today_calls || 0}/{callTarget})
          </span>
        </div>
        <div style={{ height: 12, background: "var(--bg2)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${callProgress}%`, background: callProgress >= 100 ? "#22c55e" : callProgress >= 70 ? "#fbbf24" : "#ef4444", borderRadius: 99, transition: "width 0.5s" }} />
        </div>
      </div>
    </div>
  );
}

function RecruitDrilldownDetails({ brand }: { brand: ChairmanBrand }) {
  const stages = brand.funnel_by_stage || {};
  const stageOrder = ["applied", "screening", "interview_1", "interview_2", "offer", "onboarded", "probation", "passed"];
  const stageLabels: Record<string, string> = {
    applied: "投遞", screening: "篩選", interview_1: "一面", interview_2: "二面", offer: "Offer", onboarded: "報到", probation: "試用", passed: "通過",
  };
  const max = Math.max(1, ...stageOrder.map((s) => stages[s] || 0));
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 18 }}>
        <BigMetric label="漏斗中" value={brand.funnel_total || 0} accent={brand.color} />
        <BigMetric label="本週新增" value={brand.this_week_new || 0} accent="#06b6d4" />
        <BigMetric label="本月通過" value={brand.this_month_passed || 0} accent="#10b981" />
        <BigMetric label="本月流失" value={brand.this_month_dropped || 0} accent="#ef4444" />
        <BigMetric label="轉換率" value={`${Math.round((brand.conversion_rate || 0) * 100)}%`} accent="#a855f7" />
      </div>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "var(--text)" }}>漏斗階段分布</div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 140 }}>
          {stageOrder.map((sid) => {
            const count = stages[sid] || 0;
            const h = 24 + (count / max) * 100;
            return (
              <div key={sid} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: count > 0 ? brand.color : "var(--text3)" }}>{count}</div>
                <div style={{ height: h, width: "100%", background: count > 0 ? brand.color : "var(--bg2)", borderRadius: 6, opacity: count > 0 ? 0.85 : 0.4 }} />
                <div style={{ fontSize: 10, color: "var(--text3)" }}>{stageLabels[sid]}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BigMetric({ label, value, accent, sub }: { label: string; value: number | string; accent: string; sub?: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ─── v3 Org Chart Tab (組織架構：部門 / 職位 CRUD) ────────────────────────

interface V3Department {
  id: string;
  code: string;
  name: string;
  icon: string;
  color: string;
  brand: string | null;
  description: string | null;
  lead_email: string | null;
  display_order: number;
  position_count: number;
  user_count: number;
  positions: V3Position[];
}

interface V3Position {
  id: string;
  department_id: string;
  title: string;
  level: string;
  description: string | null;
  responsibilities: string[];
  base_kpi: { metric: string; target: number }[];
  display_order: number;
  user_count?: number;
}

const LEVEL_LABEL: Record<string, string> = {
  staff: "員工",
  lead: "組長",
  manager: "主管",
  director: "總監",
};
const LEVEL_COLOR: Record<string, string> = {
  staff: "#94a3b8",
  lead: "#06b6d4",
  manager: "#7c6cf0",
  director: "#fb923c",
};

interface OrgUser {
  id: string;
  email: string;
  name: string;
  brand: string;
  role: string;
  department_id: string | null;
  position_id: string | null;
  manager_email: string | null;
}

function V3OrgChartTab() {
  const [departments, setDepartments] = useState<V3Department[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingMigration, setMissingMigration] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [showNewDept, setShowNewDept] = useState(false);
  const [showNewPos, setShowNewPos] = useState(false);
  const [editingPos, setEditingPos] = useState<V3Position | null>(null);
  const [showAssign, setShowAssign] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [deptRes, userRes] = await Promise.all([
        fetch("/api/v3/departments", { cache: "no-store" }),
        fetch("/api/admin/users", { cache: "no-store" }),
      ]);
      const deptJson = await deptRes.json();
      const userJson = await userRes.json();

      if (!deptJson.ok) {
        if (deptJson.missing_migration) {
          setMissingMigration(true);
          return;
        }
        throw new Error(deptJson.error || "讀取部門失敗");
      }

      setDepartments(deptJson.departments || []);
      setUsers(userJson.users || []);
      setSelectedDeptId((prev) => prev || deptJson.departments?.[0]?.id || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unassignUser = async (userId: string) => {
    if (!confirm("確定要從這個部門移除該員工嗎？")) return;
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId, department_id: null, position_id: null }),
    });
    const json = await res.json();
    if (json.user) load();
    else alert(json.error || "更新失敗");
  };

  const selectedDept = departments.find((d) => d.id === selectedDeptId);

  if (missingMigration) {
    return (
      <div style={{ background: "var(--card)", border: "1px solid rgba(124,108,240,0.4)", borderRadius: 16, padding: 32, maxWidth: 720 }}>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>🚧 ERP 資料表還沒建立</div>
        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>請到 Supabase SQL Editor 執行：</div>
        <code style={{ display: "block", padding: "12px 16px", background: "var(--bg2)", borderRadius: 8, fontSize: 13, color: "var(--accent)", marginBottom: 12 }}>
          supabase-migration-v3-erp.sql
        </code>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>跑完會建立 v3_departments / v3_positions 並擴充 users 表。</div>
      </div>
    );
  }

  if (loading && departments.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>載入組織架構中...</div>;
  }

  if (error) {
    return (
      <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 12, padding: 20, color: "#ef4444" }}>
        ⚠️ {error}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, color: "var(--text)" }}>🏢 組織架構</div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>定義部門 → 職位 → 職責，新人註冊後就清楚自己該做什麼</div>
        </div>
        <button
          onClick={() => setShowNewDept(true)}
          style={{
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + 新增部門
        </button>
      </div>

      {/* Two-column layout: 部門 list 在左、職位 detail 在右 */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
        {/* 部門列表 */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 12, height: "fit-content" }}>
          <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, padding: "4px 8px 8px", letterSpacing: 0.5 }}>部門 ({departments.length})</div>
          {departments.map((d) => {
            const active = d.id === selectedDeptId;
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDeptId(d.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "12px 12px",
                  background: active ? `${d.color}18` : "transparent",
                  border: active ? `1px solid ${d.color}55` : "1px solid transparent",
                  borderRadius: 10,
                  cursor: "pointer",
                  textAlign: "left",
                  marginBottom: 4,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 22 }}>{d.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: active ? d.color : "var(--text)" }}>{d.name}</div>
                  <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>
                    {d.position_count} 職位 · {d.user_count} 人
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 職位 detail */}
        <div>
          {selectedDept ? (
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                    <span style={{ fontSize: 32 }}>{selectedDept.icon}</span>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: selectedDept.color }}>{selectedDept.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "monospace" }}>{selectedDept.code}</div>
                    </div>
                  </div>
                  {selectedDept.description && (
                    <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 8 }}>{selectedDept.description}</div>
                  )}
                  <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: "var(--text3)" }}>
                    <span>👤 部門人數：<strong style={{ color: selectedDept.color }}>{selectedDept.user_count}</strong></span>
                    <span>📋 職位數：<strong style={{ color: selectedDept.color }}>{selectedDept.position_count}</strong></span>
                    {selectedDept.lead_email && <span>👑 主管：{selectedDept.lead_email}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setShowNewPos(true)}
                  style={{
                    background: selectedDept.color,
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  + 新增職位
                </button>
              </div>

              {/* 職位 list */}
              <div style={{ display: "grid", gap: 12 }}>
                {selectedDept.positions.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", color: "var(--text3)", border: "1px dashed var(--border)", borderRadius: 12 }}>
                    這個部門還沒任何職位 — 點上方「+ 新增職位」開始
                  </div>
                ) : (
                  selectedDept.positions.map((p) => (
                    <V3PositionCard
                      key={p.id}
                      position={p}
                      onEdit={() => setEditingPos(p)}
                      onDelete={async () => {
                        if (!confirm(`確定刪除職位「${p.title}」？此操作會解除所有此職位用戶的綁定。`)) return;
                        const res = await fetch(`/api/v3/positions?id=${p.id}`, { method: "DELETE" });
                        const json = await res.json();
                        if (json.ok) load();
                        else alert(json.error || "刪除失敗");
                      }}
                    />
                  ))
                )}
              </div>

              {/* 部門成員 */}
              <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>👥 部門成員 ({selectedDept.user_count})</div>
                  <button
                    onClick={() => setShowAssign(true)}
                    style={{
                      background: "transparent",
                      color: selectedDept.color,
                      border: `1px solid ${selectedDept.color}66`,
                      borderRadius: 8,
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    + 指派員工
                  </button>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {users.filter((u) => u.department_id === selectedDept.id).length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: "var(--text3)", border: "1px dashed var(--border)", borderRadius: 10, fontSize: 12 }}>
                      還沒有員工 — 點「+ 指派員工」把人放進這個部門
                    </div>
                  ) : (
                    users
                      .filter((u) => u.department_id === selectedDept.id)
                      .map((u) => {
                        const pos = selectedDept.positions.find((p) => p.id === u.position_id);
                        return (
                          <div
                            key={u.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              background: "var(--bg2)",
                              border: "1px solid var(--border)",
                              borderRadius: 10,
                              padding: "10px 14px",
                            }}
                          >
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                background: `${selectedDept.color}22`,
                                color: selectedDept.color,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: 13,
                              }}
                            >
                              {(u.name || u.email || "?").slice(0, 1).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{u.name || "(未命名)"}</div>
                              <div style={{ fontSize: 11, color: "var(--text3)" }}>{u.email}</div>
                            </div>
                            {pos ? (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: "4px 10px",
                                  borderRadius: 6,
                                  background: `${LEVEL_COLOR[pos.level] || "#94a3b8"}22`,
                                  color: LEVEL_COLOR[pos.level] || "#94a3b8",
                                }}
                              >
                                {pos.title}
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, color: "var(--text3)" }}>未指派職位</span>
                            )}
                            <button
                              onClick={() => unassignUser(u.id)}
                              style={{
                                background: "transparent",
                                border: "1px solid var(--border)",
                                borderRadius: 6,
                                padding: "4px 10px",
                                fontSize: 11,
                                cursor: "pointer",
                                color: "var(--text3)",
                              }}
                            >
                              移除
                            </button>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 60, textAlign: "center", color: "var(--text3)" }}>← 從左邊選一個部門</div>
          )}
        </div>
      </div>

      {showAssign && selectedDept && (
        <V3AssignMemberModal
          department={selectedDept}
          users={users}
          onClose={() => setShowAssign(false)}
          onSaved={() => {
            setShowAssign(false);
            load();
          }}
        />
      )}

      {showNewDept && (
        <V3DepartmentModal
          onClose={() => setShowNewDept(false)}
          onSaved={() => {
            setShowNewDept(false);
            load();
          }}
        />
      )}
      {showNewPos && selectedDept && (
        <V3PositionModal
          departmentId={selectedDept.id}
          onClose={() => setShowNewPos(false)}
          onSaved={() => {
            setShowNewPos(false);
            load();
          }}
        />
      )}
      {editingPos && (
        <V3PositionModal
          departmentId={editingPos.department_id}
          existing={editingPos}
          onClose={() => setEditingPos(null)}
          onSaved={() => {
            setEditingPos(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function V3PositionCard({ position, onEdit, onDelete }: { position: V3Position; onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{position.title}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: `${LEVEL_COLOR[position.level] || "#94a3b8"}22`, color: LEVEL_COLOR[position.level] || "#94a3b8" }}>
              {LEVEL_LABEL[position.level] || position.level}
            </span>
            {position.user_count !== undefined && position.user_count > 0 && (
              <span style={{ fontSize: 11, color: "var(--text3)" }}>· {position.user_count} 人</span>
            )}
          </div>
          {position.description && <div style={{ fontSize: 12, color: "var(--text2)" }}>{position.description}</div>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onEdit} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 11, cursor: "pointer", color: "var(--text2)" }}>編輯</button>
          <button onClick={onDelete} style={{ background: "transparent", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 8, padding: "6px 12px", fontSize: 11, cursor: "pointer", color: "#ef4444" }}>刪除</button>
        </div>
      </div>

      {position.responsibilities && position.responsibilities.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase" }}>職責</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--text2)", lineHeight: 1.7 }}>
            {position.responsibilities.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {position.base_kpi && position.base_kpi.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {position.base_kpi.map((k, i) => (
            <span key={i} style={{ fontSize: 11, padding: "4px 10px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text2)" }}>
              📊 {k.metric} ≥ <strong style={{ color: "var(--accent)" }}>{k.target}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function V3DepartmentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ code: "", name: "", icon: "🏢", color: "#7c6cf0", description: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.code || !form.name) {
      alert("代碼和名稱必填");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/v3/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setSaving(false);
    if (json.ok) onSaved();
    else alert(json.error || "新增失敗");
  };

  return (
    <ModalShell title="新增部門" onClose={onClose}>
      <ModalField label="代碼 (英文，唯一)">
        <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. sales" style={modalInputStyle} />
      </ModalField>
      <ModalField label="部門名稱">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 業務部" style={modalInputStyle} />
      </ModalField>
      <ModalField label="Icon (emoji)">
        <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} style={modalInputStyle} />
      </ModalField>
      <ModalField label="顏色 (hex)">
        <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={modalInputStyle} />
      </ModalField>
      <ModalField label="說明">
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} style={{ ...modalInputStyle, resize: "vertical" }} />
      </ModalField>
      <ModalActions onCancel={onClose} onSubmit={submit} submitLabel={saving ? "儲存中..." : "新增"} />
    </ModalShell>
  );
}

function V3AssignMemberModal({
  department,
  users,
  onClose,
  onSaved,
}: {
  department: V3Department;
  users: OrgUser[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedPositionId, setSelectedPositionId] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // 顯示「不在當前部門」的用戶（可加入的對象）
  const candidates = users
    .filter((u) => u.department_id !== department.id)
    .filter((u) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (u.name || "").toLowerCase().includes(s) || (u.email || "").toLowerCase().includes(s);
    });

  const submit = async () => {
    if (!selectedUserId) {
      alert("請先選擇員工");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedUserId,
        department_id: department.id,
        position_id: selectedPositionId || null,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.user) onSaved();
    else alert(json.error || "指派失敗");
  };

  return (
    <ModalShell title={`指派員工到 ${department.icon} ${department.name}`} onClose={onClose}>
      <ModalField label="搜尋員工">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="姓名 / Email"
          style={modalInputStyle}
        />
      </ModalField>
      <ModalField label={`選擇員工 (${candidates.length} 位可指派)`}>
        <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
          {candidates.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
              所有員工都已在這個部門 — 或先到 人員管理 新增員工
            </div>
          ) : (
            candidates.map((u) => {
              const active = u.id === selectedUserId;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUserId(u.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "10px 12px",
                    background: active ? `${department.color}22` : "transparent",
                    border: "none",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: active ? department.color : "var(--bg2)",
                      color: active ? "#fff" : "var(--text2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {(u.name || u.email || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{u.name || "(未命名)"}</div>
                    <div style={{ fontSize: 10, color: "var(--text3)" }}>{u.email}</div>
                  </div>
                  {u.department_id && <span style={{ fontSize: 10, color: "var(--text3)" }}>已在其他部門</span>}
                </button>
              );
            })
          )}
        </div>
      </ModalField>
      <ModalField label="指派職位 (選填)">
        <select
          value={selectedPositionId}
          onChange={(e) => setSelectedPositionId(e.target.value)}
          style={modalInputStyle}
        >
          <option value="">— 暫不指派職位 —</option>
          {department.positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} ({LEVEL_LABEL[p.level] || p.level})
            </option>
          ))}
        </select>
      </ModalField>
      <ModalActions onCancel={onClose} onSubmit={submit} submitLabel={saving ? "指派中..." : "指派"} />
    </ModalShell>
  );
}

function V3PositionModal({
  departmentId,
  existing,
  onClose,
  onSaved,
}: {
  departmentId: string;
  existing?: V3Position;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(existing?.title || "");
  const [level, setLevel] = useState(existing?.level || "staff");
  const [description, setDescription] = useState(existing?.description || "");
  const [responsibilitiesText, setResponsibilitiesText] = useState((existing?.responsibilities || []).join("\n"));
  const [kpiText, setKpiText] = useState(JSON.stringify(existing?.base_kpi || [], null, 2));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title) {
      alert("職位名稱必填");
      return;
    }
    let kpi: { metric: string; target: number }[] = [];
    try {
      kpi = JSON.parse(kpiText || "[]");
    } catch {
      alert("KPI JSON 格式錯誤");
      return;
    }
    const responsibilities = responsibilitiesText.split("\n").map((s) => s.trim()).filter(Boolean);

    setSaving(true);
    const url = "/api/v3/positions";
    const method = existing ? "PATCH" : "POST";
    const body = existing
      ? { id: existing.id, title, level, description, responsibilities, base_kpi: kpi }
      : { department_id: departmentId, title, level, description, responsibilities, base_kpi: kpi };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    setSaving(false);
    if (json.ok) onSaved();
    else alert(json.error || "儲存失敗");
  };

  return (
    <ModalShell title={existing ? "編輯職位" : "新增職位"} onClose={onClose}>
      <ModalField label="職位名稱">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 業務員" style={modalInputStyle} />
      </ModalField>
      <ModalField label="層級">
        <select value={level} onChange={(e) => setLevel(e.target.value)} style={modalInputStyle}>
          <option value="staff">員工</option>
          <option value="lead">組長</option>
          <option value="manager">主管</option>
          <option value="director">總監</option>
        </select>
      </ModalField>
      <ModalField label="說明">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...modalInputStyle, resize: "vertical" }} />
      </ModalField>
      <ModalField label="職責 (一行一條)">
        <textarea value={responsibilitiesText} onChange={(e) => setResponsibilitiesText(e.target.value)} rows={5} placeholder={"每日 30 通電話\n每週 5 邀約\n每月成交 ≥10 單"} style={{ ...modalInputStyle, resize: "vertical" }} />
      </ModalField>
      <ModalField label='KPI (JSON: [{"metric":"...","target":...}])'>
        <textarea value={kpiText} onChange={(e) => setKpiText(e.target.value)} rows={4} style={{ ...modalInputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 12 }} />
      </ModalField>
      <ModalActions onCancel={onClose} onSubmit={submit} submitLabel={saving ? "儲存中..." : existing ? "更新" : "新增"} />
    </ModalShell>
  );
}

const modalInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--bg2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 13,
  color: "var(--text)",
};

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card)",
          borderRadius: 16,
          padding: 24,
          maxWidth: 560,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 60px rgba(15,23,42,0.25)",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, color: "var(--text)" }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
      {children}
    </div>
  );
}

function ModalActions({ onCancel, onSubmit, submitLabel }: { onCancel: () => void; onSubmit: () => void; submitLabel: string }) {
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
      <button onClick={onCancel} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 18px", fontSize: 13, cursor: "pointer", color: "var(--text2)" }}>取消</button>
      <button onClick={onSubmit} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{submitLabel}</button>
    </div>
  );
}

// ─── Reusable section dropdown (取代分頁標籤的左上角下拉式選單) ────────────

interface SectionDropdownOption {
  id: string;
  label: string;
  icon: string;
  desc?: string;
}

function SectionDropdown({
  options,
  value,
  onChange,
}: {
  options: readonly SectionDropdownOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.id === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "10px 14px",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 700,
          color: "var(--text)",
          minWidth: 220,
          boxShadow: open ? "0 6px 20px rgba(15,23,42,0.08)" : "0 1px 3px rgba(15,23,42,0.04)",
          transition: "all 0.15s",
        }}
      >
        <span style={{ fontSize: 18 }}>{current.icon}</span>
        <span style={{ flex: 1, textAlign: "left" }}>{current.label}</span>
        <span style={{ fontSize: 10, color: "var(--text3)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▼</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 6,
            minWidth: 280,
            boxShadow: "0 12px 32px rgba(15,23,42,0.14)",
            zIndex: 50,
          }}
        >
          {options.map((opt) => {
            const active = opt.id === value;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "10px 12px",
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "#fff" : "var(--text)",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                <span style={{ fontSize: 18 }}>{opt.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{opt.label}</div>
                  {opt.desc && (
                    <div style={{ fontSize: 10, color: active ? "rgba(255,255,255,0.85)" : "var(--text3)", marginTop: 2, fontWeight: 400 }}>
                      {opt.desc}
                    </div>
                  )}
                </div>
                {active && <span style={{ fontSize: 12 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── People Hub Tab (人員管理 — 業務員權限/姓名設定) ────────────────────────

function PeopleHubTab({ token, scope }: { token: string; scope: CompanyScope }) {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, color: "var(--text)" }}>👥 人員管理</div>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>
          業務公司員工 — 帳號 / 權限 / 姓名設定
          {scope !== "all" && (
            <span style={{ marginLeft: 8, color: COMPANY_OPTIONS.find((c) => c.id === scope)?.color, fontWeight: 700 }}>
              · 範圍：{COMPANY_OPTIONS.find((c) => c.id === scope)?.label}
            </span>
          )}
        </div>
      </div>

      <UsersTab token={token} />
    </div>
  );
}

// ─── System Hub Tab (系統管控 — 統籌 Claude/審核/系統設定) ─────────────────

type SystemSubTab = "claude-tasks" | "approvals" | "system";

function SystemHubTab({ token }: { token: string }) {
  const [sub, setSub] = useState<SystemSubTab>("claude-tasks");

  const subTabs: { id: SystemSubTab; label: string; icon: string; desc: string }[] = [
    { id: "claude-tasks", label: "Claude 指派", icon: "🤖", desc: "AI 待辦任務 / 自動化指派" },
    { id: "approvals", label: "審核中心", icon: "✅", desc: "註冊 / 變更請求審核" },
    { id: "system", label: "系統設定", icon: "⚙️", desc: "全局參數 / 資料庫設定" },
  ];

  const current = subTabs.find((s) => s.id === sub) || subTabs[0];

  return (
    <div>
      {/* Section header — title + dropdown selector on the left */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "0 0 auto" }}>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: "var(--text)" }}>⚙️ 系統管控</div>
          <SectionDropdown
            options={subTabs}
            value={sub}
            onChange={(v) => setSub(v as SystemSubTab)}
          />
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 8, maxWidth: 320 }}>
            {current.desc}
          </div>
        </div>
      </div>

      <div>
        {sub === "claude-tasks" && <ClaudeTasksTab token={token} />}
        {sub === "approvals" && <ApprovalsTab token={token} />}
        {sub === "system" && <SystemTab />}
      </div>
    </div>
  );
}

// ─── Growth Dashboard Tab (業務監測生長儀表板) ─────────────────────────────

interface ProjectMetric {
  id: string;
  name: string;
  category: string;
  status: "healthy" | "warning" | "critical" | "unknown";
  primary_metric: { label: string; value: string | number };
  secondary_metric: { label: string; value: string | number };
  diagnosis: string;
  next_action: string;
}

interface BoardroomData {
  ok: boolean;
  generated_at: string;
  summary: {
    total_users: number;
    active_managers: number;
    in_recruitment_funnel: number;
    pending_claude_tasks: number;
    critical_claude_tasks: number;
  };
  projects: ProjectMetric[];
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  critical: { bg: "rgba(239,68,68,0.13)", border: "rgba(239,68,68,0.5)", text: "#ef4444", label: "🔴 危急" },
  warning: { bg: "rgba(249,115,22,0.13)", border: "rgba(249,115,22,0.5)", text: "#f97316", label: "🟠 警告" },
  healthy: { bg: "rgba(34,197,94,0.13)", border: "rgba(34,197,94,0.4)", text: "#22c55e", label: "🟢 正常" },
  unknown: { bg: "rgba(148,163,184,0.13)", border: "rgba(148,163,184,0.4)", text: "#94a3b8", label: "⚪ 未知" },
};

function GrowthDashboardTab() {
  const [data, setData] = useState<BoardroomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/boardroom", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "讀取失敗");
      setData(json);
      setRefreshedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000); // 每分鐘自動刷新
    return () => clearInterval(interval);
  }, [load]);

  if (loading && !data) {
    return <div style={{ color: "var(--text2)", padding: 40, textAlign: "center" }}>載入中...</div>;
  }

  if (error && !data) {
    return (
      <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 12, padding: 20, color: "#ef4444" }}>
        錯誤：{error}
        <button onClick={load} style={{ marginLeft: 12, background: "transparent", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>重試</button>
      </div>
    );
  }

  if (!data) return null;

  const criticalCount = data.projects.filter((p) => p.status === "critical").length;
  const warningCount = data.projects.filter((p) => p.status === "warning").length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 6, background: "linear-gradient(135deg, #ef4444, #f97316, #fbbf24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            🔥 業務監測生長儀表板
          </div>
          <div style={{ color: "var(--text3)", fontSize: 13 }}>
            違反人性、強迫成長 — {refreshedAt ? `最後更新 ${refreshedAt.toLocaleTimeString("zh-TW")}` : ""}
            {criticalCount > 0 && <span style={{ color: "#ef4444", marginLeft: 12, fontWeight: 600 }}>⚠️ {criticalCount} 個專案危急</span>}
            {warningCount > 0 && <span style={{ color: "#f97316", marginLeft: 8, fontWeight: 600 }}>· {warningCount} 個警告</span>}
          </div>
        </div>
        <button onClick={load} disabled={loading} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1 }}>
          {loading ? "刷新中..." : "🔄 立即刷新"}
        </button>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <SummaryCard label="活躍業務" value={data.summary.total_users} accent="#3b82f6" />
        <SummaryCard label="在線主管" value={data.summary.active_managers} accent="#22c55e" />
        <SummaryCard label="招聘漏斗中" value={data.summary.in_recruitment_funnel} accent="#fbbf24" />
        <SummaryCard label="Claude 待辦" value={data.summary.pending_claude_tasks} accent="#a855f7" />
        <SummaryCard label="緊急任務" value={data.summary.critical_claude_tasks} accent="#ef4444" />
      </div>

      {/* Project cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
        {data.projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 24, padding: 16, background: "var(--bg2)", borderRadius: 10, border: "1px solid var(--border)", color: "var(--text3)", fontSize: 12, lineHeight: 1.7 }}>
        <strong style={{ color: "var(--text2)" }}>儀表板哲學：</strong>
        系統預設「不舒服才對」。每個專案都在主動戳破偷懶、強迫突破舒適圈。
        危急（🔴）= 立刻處理；警告（🟠）= 今日內處理；正常（🟢）= 繼續盯。
        資料每 60 秒自動刷新。
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ color: "var(--text3)", fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: accent }}>{value}</div>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectMetric }) {
  const colors = STATUS_COLORS[project.status];
  return (
    <div style={{
      background: "var(--card)",
      border: `1px solid ${colors.border}`,
      borderRadius: 14,
      padding: 18,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Status stripe */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: colors.text }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)" }}>{project.name}</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{project.category}</div>
        </div>
        <div style={{
          background: colors.bg,
          color: colors.text,
          border: `1px solid ${colors.border}`,
          borderRadius: 6,
          padding: "3px 9px",
          fontSize: 11,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}>
          {colors.label}
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 3 }}>{project.primary_metric.label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: colors.text }}>{project.primary_metric.value}</div>
        </div>
        <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 3 }}>{project.secondary_metric.label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{project.secondary_metric.value}</div>
        </div>
      </div>

      {/* Diagnosis */}
      <div style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        padding: "10px 12px",
        fontSize: 13,
        color: "var(--text)",
        lineHeight: 1.5,
      }}>
        <div style={{ fontSize: 10, color: colors.text, fontWeight: 700, marginBottom: 3, letterSpacing: 0.5 }}>診斷</div>
        {project.diagnosis}
      </div>

      {/* Next action */}
      <div style={{
        borderTop: "1px dashed var(--border)",
        paddingTop: 10,
        fontSize: 12,
        color: "var(--text2)",
        lineHeight: 1.5,
      }}>
        <span style={{ color: colors.text, fontWeight: 700 }}>下一步：</span>
        {project.next_action}
      </div>
    </div>
  );
}

// ─── Recruits Tab (招聘漏斗) ───────────────────────────────────────────────

interface Recruit {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  brand: string;
  source: string | null;
  stage: string;
  notes: string | null;
  created_at: string;
  stage_entered_at: string | null;
}

const RECRUIT_STAGES: { id: string; label: string; color: string }[] = [
  { id: "applied", label: "投遞", color: "#94a3b8" },
  { id: "screening", label: "篩選", color: "#3b82f6" },
  { id: "interview_1", label: "一面", color: "#8b5cf6" },
  { id: "interview_2", label: "二面", color: "#a855f7" },
  { id: "offer", label: "Offer", color: "#fbbf24" },
  { id: "onboarded", label: "報到", color: "#22c55e" },
  { id: "probation", label: "試用期", color: "#10b981" },
  { id: "passed", label: "通過", color: "#059669" },
  { id: "dropped", label: "流失", color: "#ef4444" },
  { id: "rejected", label: "拒絕", color: "#dc2626" },
];

// 漏斗階段（不含最終 dropped/rejected）
const FUNNEL_STAGES = RECRUIT_STAGES.filter((s) => !["dropped", "rejected"].includes(s.id));
const FINAL_STAGES = RECRUIT_STAGES.filter((s) => ["dropped", "rejected"].includes(s.id));

function RecruitsTab() {
  const [recruits, setRecruits] = useState<Recruit[]>([]);
  const [stageCount, setStageCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedRecruit, setSelectedRecruit] = useState<Recruit | null>(null);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/recruits", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "讀取失敗");
      setRecruits(json.recruits);
      setStageCount(json.stage_count);
      // Refresh selected recruit if open
      if (selectedRecruit) {
        const updated = json.recruits.find((r: Recruit) => r.id === selectedRecruit.id);
        if (updated) setSelectedRecruit(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
  }, [selectedRecruit]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function moveStage(id: string, newStage: string) {
    try {
      const res = await fetch("/api/admin/recruits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stage: newStage }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      load();
    } catch (err) {
      alert("失敗：" + (err instanceof Error ? err.message : "unknown"));
    }
  }

  async function removeRecruit(id: string) {
    if (!confirm("確定刪除這位候選人？")) return;
    try {
      const res = await fetch(`/api/admin/recruits?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setSelectedRecruit(null);
      load();
    } catch (err) {
      alert("失敗：" + (err instanceof Error ? err.message : "unknown"));
    }
  }

  // Apply search + brand filter
  const filtered = recruits.filter((r) => {
    if (brandFilter !== "all" && r.brand !== brandFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        (r.phone && r.phone.includes(q)) ||
        (r.email && r.email.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const inFunnel = recruits.filter(
    (r) => !["passed", "dropped", "rejected"].includes(r.stage)
  ).length;
  const passed = stageCount["passed"] || 0;
  const dropped = stageCount["dropped"] || 0;
  const rejected = stageCount["rejected"] || 0;
  const conversionRate =
    recruits.length > 0 ? Math.round((passed / recruits.length) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4, background: "linear-gradient(135deg, #fbbf24, #f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            🎯 招聘漏斗
          </div>
          <div style={{ color: "var(--text3)", fontSize: 13 }}>
            點擊任一候選人可查看完整資訊與時間軸
          </div>
        </div>
        <button onClick={() => setShowForm(true)} style={{ background: "linear-gradient(135deg, #fbbf24, #f97316)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(251,191,36,0.3)" }}>
          + 新增候選人
        </button>
      </div>

      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        <BigStat label="漏斗中" value={inFunnel} accent="#fbbf24" />
        <BigStat label="已通過" value={passed} accent="#22c55e" />
        <BigStat label="流失" value={dropped} accent="#ef4444" />
        <BigStat label="拒絕" value={rejected} accent="#94a3b8" />
        <BigStat label="轉換率" value={`${conversionRate}%`} accent="#a855f7" />
      </div>

      {/* Toolbar: search + brand filter + view toggle */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 搜尋姓名 / 電話 / Email / 備註"
          style={{ ...inputStyle, flex: 1, minWidth: 200, maxWidth: 320 }}
        />
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 140 }}>
          <option value="all">所有品牌</option>
          {Object.entries(BRAND_LABELS).map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
        <div style={{ display: "flex", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: 3 }}>
          <button onClick={() => setView("kanban")} style={{ background: view === "kanban" ? "var(--accent)" : "transparent", color: view === "kanban" ? "#fff" : "var(--text2)", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            📋 看板
          </button>
          <button onClick={() => setView("list")} style={{ background: view === "list" ? "var(--accent)" : "transparent", color: view === "list" ? "#fff" : "var(--text2)", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            ☰ 列表
          </button>
        </div>
      </div>

      {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", color: "#ef4444", padding: 12, borderRadius: 8, marginBottom: 12 }}>{error}</div>}
      {loading && <div style={{ color: "var(--text3)", padding: 20, textAlign: "center" }}>載入中...</div>}

      {!loading && recruits.length === 0 && (
        <div style={{ background: "var(--card)", border: "1px dashed var(--border)", borderRadius: 14, padding: 60, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <div style={{ color: "var(--text2)", marginBottom: 16, fontSize: 15 }}>招聘系統還沒有任何資料</div>
          <button onClick={() => setShowForm(true)} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            新增第一位候選人
          </button>
        </div>
      )}

      {/* Kanban view */}
      {!loading && view === "kanban" && recruits.length > 0 && (
        <div style={{ overflowX: "auto", paddingBottom: 12 }}>
          <div style={{ display: "flex", gap: 12, minWidth: "max-content" }}>
            {FUNNEL_STAGES.map((s) => {
              const items = filtered.filter((r) => r.stage === s.id);
              return (
                <div key={s.id} style={{ minWidth: 240, width: 240, background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)", display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 320px)" }}>
                  {/* Column header */}
                  <div style={{ padding: "10px 14px", borderBottom: `2px solid ${s.color}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
                      <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{s.label}</span>
                    </div>
                    <span style={{ background: s.color, color: "#fff", borderRadius: 10, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>{items.length}</span>
                  </div>
                  {/* Cards */}
                  <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flex: 1 }}>
                    {items.length === 0 && (
                      <div style={{ color: "var(--text3)", fontSize: 11, padding: 14, textAlign: "center", fontStyle: "italic" }}>無候選人</div>
                    )}
                    {items.map((r) => (
                      <KanbanCard key={r.id} recruit={r} onClick={() => setSelectedRecruit(r)} />
                    ))}
                  </div>
                </div>
              );
            })}
            {/* Final lane */}
            <div style={{ minWidth: 200, width: 200, background: "var(--bg2)", borderRadius: 12, border: "1px dashed var(--border)", display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 320px)" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text2)" }}>已結束</span>
              </div>
              <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flex: 1 }}>
                {FINAL_STAGES.map((s) => {
                  const items = filtered.filter((r) => r.stage === s.id);
                  if (items.length === 0) return null;
                  return (
                    <div key={s.id}>
                      <div style={{ fontSize: 10, color: s.color, fontWeight: 700, padding: "4px 6px" }}>{s.label} · {items.length}</div>
                      {items.map((r) => (
                        <KanbanCard key={r.id} recruit={r} onClick={() => setSelectedRecruit(r)} compact />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List view */}
      {!loading && view === "list" && recruits.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.length === 0 && (
            <div style={{ color: "var(--text3)", textAlign: "center", padding: 30 }}>沒有符合條件的候選人</div>
          )}
          {filtered.map((r) => {
            const stageInfo = RECRUIT_STAGES.find((s) => s.id === r.stage);
            return (
              <div key={r.id} onClick={() => setSelectedRecruit(r)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = stageInfo?.color || "var(--accent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                <div style={{ width: 4, alignSelf: "stretch", background: stageInfo?.color || "#666", borderRadius: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
                    {BRAND_LABELS[r.brand] || r.brand}
                    {r.phone && ` · ${r.phone}`}
                    {r.source && ` · ${r.source}`}
                    {` · ${formatRelativeTime(r.stage_entered_at || r.created_at)}`}
                  </div>
                </div>
                <span style={{ background: stageInfo?.color || "#666", color: "#fff", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {stageInfo?.label || r.stage}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {showForm && <RecruitForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {selectedRecruit && (
        <RecruitDrawer
          recruit={selectedRecruit}
          onClose={() => setSelectedRecruit(null)}
          onMove={moveStage}
          onDelete={removeRecruit}
        />
      )}
    </div>
  );
}

function BigStat({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", borderLeft: `3px solid ${accent}` }}>
      <div style={{ color: "var(--text3)", fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent }}>{value}</div>
    </div>
  );
}

function KanbanCard({ recruit, onClick, compact }: { recruit: Recruit; onClick: () => void; compact?: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: compact ? "8px 10px" : "10px 12px",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateX(2px)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateX(0)"; e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <div style={{ fontSize: compact ? 12 : 13, fontWeight: 600, color: "var(--text)" }}>{recruit.name}</div>
      {!compact && (
        <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}>
          {BRAND_LABELS[recruit.brand] || recruit.brand}
          {recruit.source && ` · ${recruit.source}`}
        </div>
      )}
      <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}>
        {formatRelativeTime(recruit.stage_entered_at || recruit.created_at)}
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  if (days >= 7) return `${Math.floor(days / 7)} 週前`;
  if (days >= 1) return `${days} 天前`;
  if (hours >= 1) return `${hours} 小時前`;
  return "剛才";
}

function RecruitDrawer({ recruit, onClose, onMove, onDelete }: { recruit: Recruit; onClose: () => void; onMove: (id: string, stage: string) => void; onDelete: (id: string) => void }) {
  const stageInfo = RECRUIT_STAGES.find((s) => s.id === recruit.stage);
  const stageIndex = FUNNEL_STAGES.findIndex((s) => s.id === recruit.stage);
  const nextStage = stageIndex >= 0 && stageIndex < FUNNEL_STAGES.length - 1 ? FUNNEL_STAGES[stageIndex + 1] : null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 90 }} />
      {/* Drawer */}
      <div style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 460,
        maxWidth: "100vw",
        background: "var(--card)",
        borderLeft: "1px solid var(--border)",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        boxShadow: "-10px 0 30px rgba(0,0,0,0.4)",
        animation: "slideInRight 0.25s ease-out",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{recruit.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ background: stageInfo?.color || "#666", color: "#fff", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                {stageInfo?.label}
              </span>
              <span style={{ color: "var(--text3)", fontSize: 12 }}>
                {BRAND_LABELS[recruit.brand] || recruit.brand}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text2)", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Quick promote */}
          {nextStage && (
            <button
              onClick={() => onMove(recruit.id, nextStage.id)}
              style={{
                background: `linear-gradient(135deg, ${stageInfo?.color || "#fbbf24"}, ${nextStage.color})`,
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              🚀 推進到下一階段：{nextStage.label} →
            </button>
          )}

          {/* Stage timeline */}
          <DrawerSection title="漏斗進度">
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              {FUNNEL_STAGES.map((s, idx) => {
                const isPassed = idx <= stageIndex;
                const isCurrent = idx === stageIndex;
                return (
                  <div key={s.id} style={{ flex: 1, height: 6, borderRadius: 3, background: isPassed ? s.color : "var(--border)", boxShadow: isCurrent ? `0 0 8px ${s.color}` : "none" }} />
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text3)" }}>
              {FUNNEL_STAGES.map((s) => (
                <div key={s.id} style={{ textAlign: "center", flex: 1 }}>{s.label}</div>
              ))}
            </div>
          </DrawerSection>

          {/* Contact */}
          <DrawerSection title="聯絡資訊">
            <Field label="電話" value={recruit.phone} />
            <Field label="Email" value={recruit.email} />
            <Field label="來源" value={recruit.source} />
          </DrawerSection>

          {/* Notes */}
          <DrawerSection title="備註">
            <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "var(--text2)", minHeight: 40, lineHeight: 1.6 }}>
              {recruit.notes || <span style={{ color: "var(--text3)", fontStyle: "italic" }}>無備註</span>}
            </div>
          </DrawerSection>

          {/* Raw documents */}
          <RecruitDocumentsSection recruitId={recruit.id} />

          {/* Timestamps */}
          <DrawerSection title="時間紀錄">
            <Field label="加入時間" value={new Date(recruit.created_at).toLocaleString("zh-TW")} />
            <Field label="此階段進入" value={recruit.stage_entered_at ? new Date(recruit.stage_entered_at).toLocaleString("zh-TW") : "—"} />
            <Field label="待在此階段" value={recruit.stage_entered_at ? formatRelativeTime(recruit.stage_entered_at) : "—"} />
          </DrawerSection>

          {/* Move to specific stage */}
          <DrawerSection title="手動切換階段">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
              {RECRUIT_STAGES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onMove(recruit.id, s.id)}
                  disabled={s.id === recruit.stage}
                  style={{
                    background: s.id === recruit.stage ? s.color : "var(--bg2)",
                    border: `1px solid ${s.color}`,
                    color: s.id === recruit.stage ? "#fff" : s.color,
                    borderRadius: 6,
                    padding: "7px 10px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: s.id === recruit.stage ? "default" : "pointer",
                    opacity: s.id === recruit.stage ? 1 : 0.85,
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </DrawerSection>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", background: "var(--bg2)" }}>
          <button onClick={() => onDelete(recruit.id)} style={{ width: "100%", background: "transparent", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 8, padding: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            🗑 刪除候選人
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
      <span style={{ color: "var(--text3)" }}>{label}</span>
      <span style={{ color: "var(--text)", fontWeight: 500 }}>{value || <span style={{ color: "var(--text3)" }}>—</span>}</span>
    </div>
  );
}

// ─── Recruit Documents (原始資料) ──────────────────────────────────────────

interface RecruitDocument {
  id: string;
  recruit_id: string;
  doc_type: string;
  title: string;
  content: string | null;
  file_url: string | null;
  source: string | null;
  created_by: string | null;
  created_at: string;
}

const DOC_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  resume: { label: "履歷", icon: "📄", color: "#4f46e5" },
  screenshot: { label: "截圖", icon: "🖼", color: "#0d9488" },
  conversation: { label: "對話紀錄", icon: "💬", color: "#a855f7" },
  interview_note: { label: "面試筆記", icon: "📝", color: "#f59e0b" },
  reference: { label: "推薦人", icon: "🤝", color: "#ec4899" },
  background: { label: "背景調查", icon: "🔍", color: "#dc2626" },
  other: { label: "其他", icon: "📎", color: "#64748b" },
};

function RecruitDocumentsSection({ recruitId }: { recruitId: string }) {
  const [docs, setDocs] = useState<RecruitDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/recruit-documents?recruit_id=${recruitId}`);
      const json = await res.json();
      if (json.ok) setDocs(json.documents);
    } finally {
      setLoading(false);
    }
  }, [recruitId]);

  useEffect(() => {
    load();
  }, [load]);

  async function removeDoc(id: string) {
    if (!confirm("確定刪除這筆原始資料？")) return;
    const res = await fetch(`/api/admin/recruit-documents?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.ok) load();
    else alert("刪除失敗：" + json.error);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
          原始資料 ({docs.length})
        </div>
        <button onClick={() => setAdding(true)} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          + 新增
        </button>
      </div>

      {loading && <div style={{ color: "var(--text3)", fontSize: 12, padding: 8 }}>載入中...</div>}

      {!loading && docs.length === 0 && (
        <div style={{ background: "var(--bg2)", border: "1px dashed var(--border)", borderRadius: 8, padding: 16, textAlign: "center", color: "var(--text3)", fontSize: 12, fontStyle: "italic" }}>
          還沒有任何原始資料 — 點「新增」存履歷 / 截圖 / 對話 / 面試筆記
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {docs.map((d) => {
          const meta = DOC_TYPE_LABELS[d.doc_type] || DOC_TYPE_LABELS.other;
          const isExpanded = expandedDoc === d.id;
          return (
            <div key={d.id} style={{ background: "var(--bg2)", border: `1px solid var(--border)`, borderLeft: `3px solid ${meta.color}`, borderRadius: 8, overflow: "hidden" }}>
              <div
                onClick={() => setExpandedDoc(isExpanded ? null : d.id)}
                style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
              >
                <span style={{ fontSize: 16 }}>{meta.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
                  <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>
                    <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                    {d.source && ` · ${d.source}`}
                    {` · ${formatRelativeTime(d.created_at)}`}
                  </div>
                </div>
                <span style={{ color: "var(--text3)", fontSize: 12 }}>{isExpanded ? "▲" : "▼"}</span>
              </div>
              {isExpanded && (
                <div style={{ padding: "8px 12px 12px", borderTop: "1px solid var(--border)" }}>
                  {d.content && (
                    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: 10, fontSize: 12, color: "var(--text2)", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>
                      {d.content}
                    </div>
                  )}
                  {d.file_url && (
                    <a href={d.file_url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 6, color: "var(--accent)", fontSize: 12, textDecoration: "underline" }}>
                      🔗 開啟檔案連結
                    </a>
                  )}
                  <button onClick={() => removeDoc(d.id)} style={{ marginTop: 8, background: "transparent", border: "1px solid #dc2626", color: "#dc2626", borderRadius: 5, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>
                    刪除
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {adding && (
        <RecruitDocumentForm
          recruitId={recruitId}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); load(); }}
        />
      )}
    </div>
  );
}

function RecruitDocumentForm({ recruitId, onClose, onSaved }: { recruitId: string; onClose: () => void; onSaved: () => void }) {
  const [docType, setDocType] = useState("interview_note");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [source, setSource] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/recruit-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recruit_id: recruitId,
          doc_type: docType,
          title,
          content,
          source,
          file_url: fileUrl,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14, color: "var(--text)" }}>+ 新增原始資料</div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)" }}>類型</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} style={inputStyle}>
              {Object.entries(DOC_TYPE_LABELS).map(([id, meta]) => (
                <option key={id} value={id}>{meta.icon} {meta.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)" }}>標題 *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="例如：第一次電訪 / 履歷正本 / IG 對話" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)" }}>內容（純文字）</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder="貼上對話內容、面試筆記、履歷文字、觀察紀錄..."
              style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text2)" }}>來源</label>
              <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="104 / IG / LINE / 電話" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text2)" }}>檔案連結（可選）</label>
              <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="Drive / Dropbox URL" style={inputStyle} />
            </div>
          </div>
          {error && <div style={{ color: "#dc2626", fontSize: 13 }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text2)", borderRadius: 8, padding: 10, cursor: "pointer" }}>
              取消
            </button>
            <button type="submit" disabled={saving} style={{ flex: 2, background: "var(--accent)", border: "none", color: "#fff", borderRadius: 8, padding: 10, fontWeight: 600, cursor: saving ? "wait" : "pointer" }}>
              {saving ? "儲存中..." : "儲存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecruitForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [brand, setBrand] = useState("nschool");
  const [source, setSource] = useState("");
  const [stage, setStage] = useState("applied");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/recruits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, brand, source, stage, notes }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "新增失敗");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ background: "var(--card)", borderRadius: 14, padding: 24, width: "100%", maxWidth: 480, border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>新增候選人</div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)" }}>姓名 *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text2)" }}>電話</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text2)" }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text2)" }}>品牌 *</label>
              <select value={brand} onChange={(e) => setBrand(e.target.value)} style={inputStyle}>
                {Object.entries(BRAND_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text2)" }}>階段</label>
              <select value={stage} onChange={(e) => setStage(e.target.value)} style={inputStyle}>
                {RECRUIT_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)" }}>來源（104 / IG / 內介…）</label>
            <input value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)" }}>備註</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }} />
          </div>
          {error && <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text2)", borderRadius: 8, padding: 10, cursor: "pointer" }}>
              取消
            </button>
            <button type="submit" disabled={saving} style={{ flex: 2, background: "var(--accent)", border: "none", color: "#fff", borderRadius: 8, padding: 10, cursor: saving ? "wait" : "pointer", fontWeight: 600 }}>
              {saving ? "儲存中..." : "新增"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Claude Tasks Tab (Claude AI 主動指派任務) ──────────────────────────────

interface ClaudeTask {
  id: string;
  title: string;
  description: string;
  category: "setup" | "data" | "decision" | "fix" | "review";
  priority: "critical" | "high" | "normal" | "low";
  status: "pending" | "in_progress" | "done" | "cancelled" | "blocked";
  why: string | null;
  expected_input: string | null;
  blocked_features: string[];
  created_at: string;
  updated_at: string;
  done_at: string | null;
  user_response: string | null;
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  normal: "#3b82f6",
  low: "#94a3b8",
};

const PRIORITY_LABEL: Record<string, string> = {
  critical: "🔴 緊急",
  high: "🟠 高",
  normal: "🟡 一般",
  low: "🔵 低",
};

const CATEGORY_LABEL: Record<string, string> = {
  setup: "🔧 系統設定",
  data: "📊 資料提供",
  decision: "🎯 決策需求",
  fix: "🛠️ 修正",
  review: "👀 確認",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "待辦",
  in_progress: "進行中",
  done: "完成",
  cancelled: "取消",
  blocked: "卡住",
};

function ClaudeTasksTab({ token }: { token: string }) {
  const [tasks, setTasks] = useState<ClaudeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<Record<string, string>>({});

  const fetchTasks = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/claude-tasks", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const updateStatus = async (id: string, status: ClaudeTask["status"]) => {
    const user_response = responseText[id] || undefined;
    const res = await fetch("/api/admin/claude-tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, user_response }),
    });
    if (res.ok) {
      fetchTasks();
      setResponseText((prev) => { const next = { ...prev }; delete next[id]; return next; });
    } else {
      alert("更新失敗");
    }
  };

  const filtered = tasks.filter((t) => {
    if (filter === "all") return true;
    if (filter === "active") return t.status === "pending" || t.status === "in_progress" || t.status === "blocked";
    return t.status === filter;
  });

  const counts = {
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    blocked: tasks.filter((t) => t.status === "blocked").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>🤖 Claude 指派任務</h2>
        <p style={{ color: "var(--text2)", fontSize: 14 }}>
          這裡是 Claude AI 主動指派給你的事項。需要你提供資訊、做決策或確認的任務都在這裡。
        </p>
      </div>

      {/* 統計卡 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { key: "pending", label: "待辦", count: counts.pending, color: "#3b82f6" },
          { key: "in_progress", label: "進行中", count: counts.in_progress, color: "#f59e0b" },
          { key: "blocked", label: "卡住", count: counts.blocked, color: "#ef4444" },
          { key: "done", label: "已完成", count: counts.done, color: "#10b981" },
        ].map((c) => (
          <div key={c.key} style={{ padding: 16, borderRadius: 12, background: "var(--card)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{c.count}</div>
          </div>
        ))}
      </div>

      {/* Filter 列 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { id: "active", label: "進行中" },
          { id: "pending", label: "待辦" },
          { id: "in_progress", label: "進行中" },
          { id: "blocked", label: "卡住" },
          { id: "done", label: "已完成" },
          { id: "all", label: "全部" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: filter === f.id ? "var(--accent)" : "transparent",
              color: filter === f.id ? "#fff" : "var(--text2)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={fetchTasks}
          style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 999, border: "1px solid var(--border)", background: "transparent", color: "var(--text2)", fontSize: 13, cursor: "pointer" }}
        >
          🔄 重整
        </button>
      </div>

      {/* 任務列表 */}
      {loading && <div style={{ color: "var(--text2)" }}>載入中...</div>}
      {!loading && filtered.length === 0 && (
        <div style={{ padding: 48, textAlign: "center", color: "var(--text2)", borderRadius: 12, background: "var(--card)", border: "1px dashed var(--border)" }}>
          ✨ 目前沒有 {filter === "active" ? "進行中" : STATUS_LABEL[filter] || ""} 的任務
        </div>
      )}
      {!loading && filtered.map((t) => {
        const isExpanded = expandedId === t.id;
        const isDone = t.status === "done" || t.status === "cancelled";
        return (
          <div
            key={t.id}
            style={{
              marginBottom: 12,
              borderRadius: 12,
              background: "var(--card)",
              border: `1px solid ${isExpanded ? PRIORITY_COLOR[t.priority] : "var(--border)"}`,
              borderLeft: `4px solid ${PRIORITY_COLOR[t.priority]}`,
              opacity: isDone ? 0.6 : 1,
              overflow: "hidden",
            }}
          >
            <div
              onClick={() => setExpandedId(isExpanded ? null : t.id)}
              style={{ padding: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: PRIORITY_COLOR[t.priority], fontWeight: 600 }}>
                    {PRIORITY_LABEL[t.priority]}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text2)" }}>{CATEGORY_LABEL[t.category]}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "var(--bg)", color: "var(--text2)" }}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, textDecoration: isDone ? "line-through" : "none" }}>
                  {t.title}
                </div>
                {!isExpanded && (
                  <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.description}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: "var(--text2)" }}>
                {new Date(t.created_at).toLocaleDateString("zh-TW")}
              </div>
            </div>

            {isExpanded && (
              <div style={{ padding: "0 16px 16px 16px", borderTop: "1px solid var(--border)" }}>
                <div style={{ marginTop: 12, marginBottom: 12, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {t.description}
                </div>
                {t.why && (
                  <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: "var(--bg)", borderLeft: "3px solid #3b82f6" }}>
                    <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 4 }}>為什麼需要</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{t.why}</div>
                  </div>
                )}
                {t.expected_input && (
                  <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: "var(--bg)", borderLeft: "3px solid #10b981" }}>
                    <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 4 }}>需要你提供</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{t.expected_input}</div>
                  </div>
                )}
                {t.blocked_features && t.blocked_features.length > 0 && (
                  <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: "var(--bg)", borderLeft: "3px solid #ef4444" }}>
                    <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 4 }}>卡住的功能</div>
                    <div style={{ fontSize: 13 }}>{t.blocked_features.join(" / ")}</div>
                  </div>
                )}
                {t.user_response && (
                  <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: "var(--bg)", borderLeft: "3px solid #f59e0b" }}>
                    <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 4 }}>你的回應</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{t.user_response}</div>
                  </div>
                )}

                {!isDone && (
                  <>
                    <textarea
                      placeholder="回應內容（選填）— 例如：LINE token、API 連結、決策結果..."
                      value={responseText[t.id] || ""}
                      onChange={(e) => setResponseText((prev) => ({ ...prev, [t.id]: e.target.value }))}
                      style={{ width: "100%", minHeight: 80, padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 12, resize: "vertical" }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      {t.status === "pending" && (
                        <button
                          onClick={() => updateStatus(t.id, "in_progress")}
                          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#f59e0b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                        >
                          開始處理
                        </button>
                      )}
                      <button
                        onClick={() => updateStatus(t.id, "done")}
                        style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                      >
                        ✓ 完成
                      </button>
                      <button
                        onClick={() => updateStatus(t.id, "blocked")}
                        style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontSize: 13, cursor: "pointer" }}
                      >
                        卡住了
                      </button>
                      <button
                        onClick={() => updateStatus(t.id, "cancelled")}
                        style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text2)", fontSize: 13, cursor: "pointer" }}
                      >
                        取消
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Dashboard Tab (業務戰力總覽) ──────────────────────────────────────────────

interface UserActivity { user_email: string; current_page: string; last_heartbeat: string; }

function DashboardTab({ token }: { token: string }) {
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandFilter, setBrandFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<EnrichedUser | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "day" | "progress" | "quiz" | "sparring" | "activity">("activity");
  const [sortAsc, setSortAsc] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/progress?brand=${brandFilter}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch("/api/activity").then(r => r.json()),
    ])
      .then(([progressData, activityData]) => {
        setUsers(progressData.users || []);
        setActivities(activityData.activities || []);
      })
      .catch(() => { setUsers([]); setActivities([]); })
      .finally(() => setLoading(false));
  }, [token, brandFilter]);

  // Auto-refresh every 30s for live activity
  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 30000); return () => clearInterval(iv); }, [fetchData]);

  const getActivity = (email: string): UserActivity | undefined => activities.find(a => a.user_email === email);
  const isOnline = (a?: UserActivity) => a ? (Date.now() - new Date(a.last_heartbeat).getTime()) < 120000 : false;
  const getIdleMinutes = (a?: UserActivity) => a ? Math.floor((Date.now() - new Date(a.last_heartbeat).getTime()) / 60000) : null;

  const PAGE_LABELS: Record<string, string> = {
    dashboard: "首頁", training: "訓練", videos: "影片", sparring: "對練",
    courses: "課程", sop: "SOP", knowledge: "知識庫", pricing: "費率",
    kpi: "KPI", mentorship: "師徒", profile: "個人",
  };

  const filtered = users.filter((u) => {
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Stats
  const totalUsers = users.length;
  const onlineNow = users.filter(u => isOnline(getActivity(u.email))).length;
  const activeThisWeek = users.filter((u) => u.lastActivity && new Date(u.lastActivity) > new Date(Date.now() - 7 * 86400000)).length;
  const avgQuiz = users.filter((u) => u.avgQuizScore !== null).reduce((s, u) => s + (u.avgQuizScore || 0), 0) / Math.max(users.filter((u) => u.avgQuizScore !== null).length, 1);
  const avgSparring = users.filter((u) => u.avgSparringScore !== null).reduce((s, u) => s + (u.avgSparringScore || 0), 0) / Math.max(users.filter((u) => u.avgSparringScore !== null).length, 1);

  const sorted = filtered.sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    switch (sortBy) {
      case "name": return dir * a.name.localeCompare(b.name);
      case "day": return dir * (a.currentDay - b.currentDay);
      case "progress": return dir * (a.progressPercent - b.progressPercent);
      case "quiz": return dir * ((a.avgQuizScore || 0) - (b.avgQuizScore || 0));
      case "sparring": return dir * ((a.avgSparringScore || 0) - (b.avgSparringScore || 0));
      case "activity": return dir * (new Date(a.lastActivity || 0).getTime() - new Date(b.lastActivity || 0).getTime());
      default: return 0;
    }
  });

  const exportCSV = () => {
    const headers = ["姓名", "Email", "品牌", "天數", "進度%", "測驗分", "對練分", "影片", "通次", "邀約", "最後活動"];
    const rows = sorted.map(u => [u.name, u.email, BRAND_LABELS[u.brand] || u.brand, u.currentDay, u.progressPercent, u.avgQuizScore ?? "", u.avgSparringScore ?? "", u.videosWatched, u.totalCalls, u.totalAppointments, u.lastActivity || ""]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `業務戰力_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) { setSortAsc(!sortAsc); } else { setSortBy(col); setSortAsc(false); }
  };
  const sortIcon = (col: typeof sortBy) => sortBy === col ? (sortAsc ? " ▲" : " ▼") : "";

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>業務戰力總覽</h2>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "總人數", value: totalUsers, icon: "👥", color: "var(--accent)" },
          { label: "目前在線", value: onlineNow, icon: "🟢", color: "#22c55e" },
          { label: "本週活躍", value: activeThisWeek, icon: "🔥", color: "var(--teal)" },
          { label: "平均測驗分", value: avgQuiz ? Math.round(avgQuiz) : "—", icon: "📝", color: "var(--gold)" },
          { label: "平均對練分", value: avgSparring ? Math.round(avgSparring) : "—", icon: "🎯", color: "var(--green)" },
        ].map((s) => (
          <div key={s.label} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20, background: withAlpha(s.color, 0.13), borderRadius: 8, padding: "4px 6px" }}>{s.icon}</span>
              <span style={{ color: "var(--text2)", fontSize: 13 }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋姓名或 Email..." style={{ ...inputStyle, maxWidth: 300 }} />
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} style={{ ...inputStyle, maxWidth: 200 }}>
          <option value="all">全部品牌</option>
          {Object.entries(BRAND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={exportCSV} style={{ marginLeft: "auto", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
          📥 匯出 CSV
        </button>
      </div>

      {/* User Progress Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>載入中...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>
          {users.length === 0 ? "尚無用戶資料。請先在 Supabase SQL Editor 執行 supabase-migration.sql" : "找不到符合條件的用戶"}
        </div>
      ) : (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {([
                  { label: "姓名", key: "name" as const },
                  { label: "狀態", key: null },
                  { label: "品牌", key: null },
                  { label: "目前天數", key: "day" as const },
                  { label: "完成進度", key: "progress" as const },
                  { label: "測驗分", key: "quiz" as const },
                  { label: "對練分", key: "sparring" as const },
                  { label: "影片", key: null },
                  { label: "通次", key: null },
                  { label: "最後活動", key: "activity" as const },
                ]).map((h) => (
                  <th key={h.label} onClick={h.key ? () => handleSort(h.key!) : undefined} style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, color: "var(--text3)", fontWeight: 600, cursor: h.key ? "pointer" : "default", userSelect: "none" }}>
                    {h.label}{h.key ? sortIcon(h.key) : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => {
                const act = getActivity(u.email);
                const actOnline = isOnline(act);
                const actIdle = getIdleMinutes(act);
                return (
                <tr key={u.id} onClick={() => setSelectedUser(u)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{u.email}</div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        background: actOnline ? "#22c55e22" : actIdle !== null && actIdle < 60 ? "#feca5722" : "#f8717122",
                        color: actOnline ? "#22c55e" : actIdle !== null && actIdle < 60 ? "#feca57" : "#f87171",
                        padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: "currentColor", display: "inline-block" }} />
                        {actOnline ? "在線" : actIdle !== null ? (actIdle < 60 ? `${actIdle} 分前` : actIdle < 1440 ? `${Math.floor(actIdle / 60)} 小時前` : `${Math.floor(actIdle / 1440)} 天前`) : "離線"}
                      </span>
                      {actOnline && act && <span style={{ fontSize: 10, color: "var(--text3)" }}>{PAGE_LABELS[act.current_page] || act.current_page}</span>}
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ background: "rgba(102,126,234,0.13)", color: "var(--accent)", padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                      {BRAND_LABELS[u.brand] || u.brand}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", fontWeight: 700, color: "var(--teal)" }}>Day {u.currentDay}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden", maxWidth: 100 }}>
                        <div style={{ width: `${u.progressPercent}%`, height: "100%", background: "linear-gradient(90deg, var(--accent), var(--teal))", borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text2)" }}>{u.progressPercent}%</span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>
                      {u.completedModules.length}/9 完成
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: u.avgQuizScore && u.avgQuizScore >= 60 ? "var(--green)" : "var(--text2)" }}>
                    {u.avgQuizScore ?? "—"}
                  </td>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: u.avgSparringScore && u.avgSparringScore >= 70 ? "var(--green)" : "var(--text2)" }}>
                    {u.avgSparringScore ?? "—"}
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 13 }}>{u.videosWatched} 部</td>
                  <td style={{ padding: "12px 14px", fontSize: 13 }}>{u.totalCalls}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--text3)" }}>
                    {u.lastActivity ? new Date(u.lastActivity).toLocaleDateString("zh-TW") : "—"}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setSelectedUser(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: 32, width: "100%", maxWidth: 700, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 24 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{selectedUser.name}</h3>
                <p style={{ color: "var(--text3)", fontSize: 13, margin: "4px 0" }}>{selectedUser.email} · {BRAND_LABELS[selectedUser.brand]} · {ROLE_LABELS[selectedUser.role] || selectedUser.role}</p>
                <p style={{ color: "var(--text3)", fontSize: 12 }}>加入：{new Date(selectedUser.created_at).toLocaleDateString("zh-TW")}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} style={{ background: "var(--border)", border: "none", borderRadius: 8, padding: "6px 12px", color: "var(--text2)", cursor: "pointer" }}>✕</button>
            </div>

            {/* Progress overview */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "目前天數", value: `Day ${selectedUser.currentDay}`, color: "var(--accent)" },
                { label: "完成進度", value: `${selectedUser.progressPercent}%`, color: "var(--teal)" },
                { label: "測驗次數", value: selectedUser.quizCount, color: "var(--gold)" },
                { label: "對練次數", value: selectedUser.sparringCount, color: "var(--green)" },
              ].map((s) => (
                <div key={s.label} style={{ background: "var(--bg2)", borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Module completion timeline */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text2)" }}>模組完成狀態</h4>
              <div style={{ display: "flex", gap: 4 }}>
                {Array.from({ length: 9 }, (_, i) => i + 1).map((day) => {
                  const completed = selectedUser.completedModules.includes(day);
                  const quiz = selectedUser.quizzes.find((q) => q.module_id === day);
                  return (
                    <div key={day} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{
                        height: 32, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600,
                        background: completed ? "var(--green)" : "var(--border)", color: completed ? "#fff" : "var(--text3)",
                      }}>
                        D{day}
                      </div>
                      {quiz && <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{quiz.score}分</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quiz scores */}
            {selectedUser.quizzes.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text2)" }}>測驗紀錄</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedUser.quizzes.slice(0, 10).map((q, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg2)", borderRadius: 8, fontSize: 13 }}>
                      <span>Day {q.module_id} — {MODULE_TITLES[q.module_id] || `模組 ${q.module_id}`}</span>
                      <span style={{ fontWeight: 700, color: q.score >= 60 ? "var(--green)" : "var(--red)" }}>{q.score} 分</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* KPI data */}
            {selectedUser.kpis.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text2)" }}>KPI 紀錄（近 7 天）</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedUser.kpis.slice(0, 7).map((k, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg2)", borderRadius: 8, fontSize: 13 }}>
                      <span>{k.date}</span>
                      <div style={{ display: "flex", gap: 16 }}>
                        <span>通次 <b>{k.calls}</b></span>
                        <span>有效 <b>{k.valid_calls}</b></span>
                        <span>邀約 <b>{k.appointments}</b></span>
                        <span>成交 <b>{k.closures}</b></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sparring records */}
            {selectedUser.sparrings.length > 0 && (
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text2)" }}>對練紀錄</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedUser.sparrings.map((s, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg2)", borderRadius: 8, fontSize: 13 }}>
                      <span>{new Date(s.date).toLocaleDateString("zh-TW")}</span>
                      <span style={{ fontWeight: 700, color: s.score >= 70 ? "var(--green)" : "var(--gold)" }}>{s.score} 分</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Users Tab ─────────────────────────────────────────────────────────────

function UsersTab({ token }: { token: string }) {
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; brand: string; role: string; status: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [brandFilter, setBrandFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newBrand, setNewBrand] = useState("nschool");
  const [newRole, setNewRole] = useState("sales_rep");
  const [addError, setAddError] = useState("");

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const url = brandFilter === "all" ? "/api/admin/users" : `/api/admin/users?brand=${brandFilter}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [token, brandFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const updateRole = async (userId: string, role: string) => {
    try {
      const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: userId, role }) });
      const json = await res.json();
      if (!json.user) alert(json.error || "更新角色失敗");
    } catch { alert("網路錯誤"); }
    fetchUsers();
  };

  const toggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: userId, status: newStatus }) });
      const json = await res.json();
      if (!json.user) alert(json.error || "更新狀態失敗");
    } catch { alert("網路錯誤"); }
    fetchUsers();
  };

  const addUser = async () => {
    if (!newName || !newEmail) { setAddError("請填寫姓名和 Email"); return; }
    setAddError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newEmail, name: newName, brand: newBrand, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "新增失敗");
      setNewName(""); setNewEmail(""); setShowAdd(false);
      fetchUsers();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "新增失敗");
    }
  };

  const filtered = users.filter((u) => {
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeCount = users.filter((u) => u.status === "active").length;
  const inactiveCount = users.filter((u) => u.status !== "active").length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>用戶管理</h2>
          <p style={{ color: "var(--text3)", fontSize: 13, marginTop: 4 }}>
            共 {users.length} 人 · 啟用 {activeCount} · 停用 {inactiveCount}
          </p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))", color: "#fff", border: "none", borderRadius: 10, padding: "8px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          + 新增用戶
        </button>
      </div>

      {showAdd && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>新增用戶</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6 }}>姓名 *</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} style={inputStyle} placeholder="輸入姓名" />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6 }}>Email *</label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={inputStyle} placeholder="輸入 Email" />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6 }}>品牌</label>
              <select value={newBrand} onChange={(e) => setNewBrand(e.target.value)} style={inputStyle}>
                {Object.entries(BRAND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6 }}>角色</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={inputStyle}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          {addError && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 8 }}>{addError}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addUser} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, padding: "8px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>新增</button>
            <button onClick={() => setShowAdd(false)} style={{ background: "var(--border)", color: "var(--text2)", border: "none", borderRadius: 10, padding: "8px 20px", fontSize: 14, cursor: "pointer" }}>取消</button>
          </div>
        </div>
      )}

      {/* Role Reference Card */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>角色權限說明</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, fontSize: 12 }}>
          {[
            { role: "super_admin", label: "超級管理員", desc: "系統最高權限，可管理所有品牌、用戶、設定", perms: "全部功能", color: "var(--red)" },
            { role: "ceo", label: "總經理", desc: "集團總經理，掌控所有部門與品牌的全局戰況", perms: "全部功能 + 所有部門數據", color: "var(--red)" },
            { role: "coo", label: "營運長 COO", desc: "集團營運長，負責各品牌營運效率與流程優化", perms: "全部功能 + 所有部門數據", color: "#dc2626" },
            { role: "cfo", label: "財務長 CFO", desc: "集團財務長，負責財務規劃與成本控制", perms: "全部功能 + 所有部門數據", color: "#dc2626" },
            { role: "director", label: "總監", desc: "部門總監，跨品牌管理特定職能", perms: "全部功能 + 所有部門數據", color: "#ea580c" },
            { role: "brand_manager", label: "品牌主管", desc: "管理所屬品牌的團隊、訓練進度、KPI 審核", perms: "品牌管理、審核、報表", color: "var(--gold)" },
            { role: "team_leader", label: "老祖宗", desc: "據點最資深主管，負責整體帶隊方向與人員調配", perms: "團隊管理、師徒配對、KPI 審核", color: "var(--accent)" },
            { role: "trainer", label: "武公", desc: "負責新人培訓課程授課、SOP 教學、技能考核", perms: "訓練內容管理、測驗管理", color: "var(--teal)" },
            { role: "reserve_cadre", label: "師傅（儲幹）", desc: "儲備幹部，協助帶訓新人、示範實戰、精神領袖", perms: "師徒帶訓、回饋填寫、對練陪練", color: "var(--green)" },
            { role: "mentor", label: "師傅（帶訓）", desc: "正式帶訓師父，負責每日 1:1 回饋與實戰陪跑", perms: "師徒帶訓、回饋填寫", color: "var(--green)" },
            { role: "sales_rep", label: "業務人員", desc: "新進業務人員，接受培訓、對練、KPI 考核", perms: "學習、對練、KPI 填寫", color: "var(--text3)" },
          ].map(r => (
            <div key={r.role} style={{ background: "var(--bg2)", borderRadius: 10, padding: "10px 12px", borderLeft: `3px solid ${r.color}` }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: r.color, marginBottom: 2 }}>{r.label}</div>
              <div style={{ color: "var(--text2)", marginBottom: 4 }}>{r.desc}</div>
              <div style={{ color: "var(--text3)", fontSize: 11 }}>權限：{r.perms}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋姓名或 Email..." style={{ ...inputStyle, maxWidth: 300 }} />
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} style={{ ...inputStyle, maxWidth: 200 }}>
          <option value="all">全部品牌</option>
          {Object.entries(BRAND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>載入中...</div> : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>找不到符合條件的用戶</div>
      ) : (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["姓名", "Email", "品牌", "角色", "狀態", "加入日期", "操作"].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, color: "var(--text3)", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 600, fontSize: 14 }}>{u.name}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--text2)" }}>{u.email}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ background: "rgba(102,126,234,0.13)", color: "var(--accent)", padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{BRAND_LABELS[u.brand] || u.brand}</span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value)} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", color: "var(--text)", fontSize: 12 }}>
                      {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ background: u.status === "active" ? "#22c55e22" : "#f8717122", color: u.status === "active" ? "var(--green)" : "var(--red)", padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                      {u.status === "active" ? "啟用" : "停用"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--text3)" }}>{new Date(u.created_at).toLocaleDateString("zh-TW")}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <button onClick={() => toggleStatus(u.id, u.status)} style={{ background: "var(--border)", border: "none", borderRadius: 6, padding: "4px 10px", color: "var(--text2)", cursor: "pointer", fontSize: 12 }}>
                      {u.status === "active" ? "停用" : "啟用"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Training Tab (訓練管理 = 內容 + 影片) ──────────────────────────────────

interface DbVideo { id: string; title: string; category: string; brands: string[]; related_days: number[]; status: string; drive_file_id: string; description?: string }

function TrainingTab({ token }: { token: string }) {
  // Content overrides state
  const [overrides, setOverrides] = useState<ModuleOverride[]>([]);
  const [editingModule, setEditingModule] = useState<number | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editKeyPoints, setEditKeyPoints] = useState("");
  const [editTips, setEditTips] = useState("");
  const [editTask, setEditTask] = useState("");
  const [saving, setSaving] = useState(false);
  // Video state
  const [dbVideos, setDbVideos] = useState<DbVideo[]>([]);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  // Video add form
  const [addingVideoDay, setAddingVideoDay] = useState<number | null>(null);
  const [addStep, setAddStep] = useState(0);
  const [newTitle, setNewTitle] = useState("");
  const [newDriveId, setNewDriveId] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newBrands, setNewBrands] = useState<string[]>([]);

  const BRAND_TABS = [
    { id: "nschool", name: "nSchool 財經", color: "#feca57" },
    { id: "ooschool", name: "OOschool 無限", color: "#4F46E5" },
    { id: "xuemi", name: "XUEMI 學米", color: "#7c6cf0" },
    { id: "aischool", name: "AIschool AI", color: "#10B981" },
  ];
  const BRAND_OPTIONS = BRAND_TABS;

  const toggleArr = (arr: string[], item: string) => arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];

  useEffect(() => {
    fetch("/api/admin/module-overrides").then((r) => r.json()).then((d) => setOverrides(d.overrides || []));
  }, []);

  const fetchVideos = useCallback(() => {
    fetch("/api/admin/videos", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setDbVideos((d.videos || []).map((v: DbVideo) => ({ ...v, brands: v.brands || [], related_days: v.related_days || [] }))))
      .catch(() => setDbVideos([]));
  }, [token]);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  const startEdit = (moduleId: number) => {
    const existing = overrides.find((o) => o.module_id === moduleId);
    setEditingModule(moduleId);
    setEditDesc(existing?.description_override || "");
    setEditContent(existing?.content_override ? existing.content_override.join("\n") : "");
    setEditKeyPoints(existing?.key_points_override ? existing.key_points_override.join("\n") : "");
    setEditTips(existing?.trainer_tips_override ? existing.trainer_tips_override.join("\n") : "");
    setEditTask(existing?.practice_task_override || "");
  };

  const saveOverride = async () => {
    if (!editingModule) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { moduleId: editingModule };
      if (editDesc) body.description = editDesc;
      if (editContent) body.content = editContent.split("\n").filter(Boolean);
      if (editKeyPoints) body.keyPoints = editKeyPoints.split("\n").filter(Boolean);
      if (editTips) body.trainerTips = editTips.split("\n").filter(Boolean);
      if (editTask) body.practiceTask = editTask;

      const saveRes = await fetch("/api/admin/module-overrides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const saveData = await saveRes.json();
      if (saveData.error) { alert("儲存失敗：" + saveData.error); setSaving(false); return; }
      const res = await fetch("/api/admin/module-overrides").then((r) => r.json());
      setOverrides(res.overrides || []);
      setEditingModule(null);
    } catch { alert("儲存失敗：網路錯誤"); }
    setSaving(false);
  };

  const resetOverride = async (moduleId: number) => {
    await fetch(`/api/admin/module-overrides?moduleId=${moduleId}`, { method: "DELETE" });
    const res = await fetch("/api/admin/module-overrides").then((r) => r.json());
    setOverrides(res.overrides || []);
  };

  const resetAddForm = () => { setAddingVideoDay(null); setAddStep(0); setNewTitle(""); setNewDriveId(""); setNewDescription(""); setNewBrands([]); setNewDays([]); };

  const addVideo = async () => {
    if (!newTitle || !newDriveId) return;
    const days = addingVideoDay ? [addingVideoDay] : newDays;
    await fetch("/api/admin/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: newTitle, drive_file_id: newDriveId, description: newDescription, status: "published", brands: newBrands, related_days: days }),
    });
    resetAddForm();
    fetchVideos();
  };

  const deleteVideo = async (videoId: string) => {
    if (!confirm("確定要刪除這部影片嗎？")) return;
    await fetch("/api/admin/videos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: videoId, status: "deleted" }),
    });
    fetchVideos();
  };

  // Hidden system videos
  const [hiddenSystemVideos, setHiddenSystemVideos] = useState<string[]>([]);
  const [trainingView, setTrainingView] = useState<"days" | "videos">("days");
  const [videoSearch, setVideoSearch] = useState("");
  const [newDays, setNewDays] = useState<number[]>([]);

  // Links & Schedule state (inline in day view)
  const [selectedBrand, setSelectedBrand] = useState("nschool");
  const [brandOverrides, setBrandOverrides] = useState<ModuleOverride[]>([]);
  const [editingLink, setEditingLink] = useState<{ day: number; index: number } | null>(null);
  const [addingLink, setAddingLink] = useState<number | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<{ day: number; index: number } | null>(null);
  const [addingSchedule, setAddingSchedule] = useState<number | null>(null);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDesc, setLinkDesc] = useState("");
  const [linkType, setLinkType] = useState<"notion" | "document" | "video" | "recording">("notion");
  const [schedTime, setSchedTime] = useState("");
  const [schedTask, setSchedTask] = useState("");
  const [schedDesc, setSchedDesc] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(d => {
      const s = (d.settings || []).find((x: { key: string }) => x.key === "hidden_videos");
      if (s) try { setHiddenSystemVideos(JSON.parse(typeof s.value === "string" ? s.value : JSON.stringify(s.value))); } catch { /* */ }
    }).catch(() => {});
  }, []);

  const [videoSaveMsg, setVideoSaveMsg] = useState<string | null>(null);

  const saveHiddenVideos = async (updated: string[]): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "hidden_videos", value: updated, updated_by: "admin" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        alert("儲存失敗：" + (d.error || `HTTP ${res.status}`));
        return false;
      }
      const d = await res.json();
      if (d.error) {
        alert("儲存失敗：" + d.error);
        return false;
      }
      setVideoSaveMsg("✅ 已儲存");
      setTimeout(() => setVideoSaveMsg(null), 2000);
      return true;
    } catch {
      alert("儲存失敗：網路錯誤");
      return false;
    }
  };

  const hideSystemVideo = async (videoId: string) => {
    const previous = [...hiddenSystemVideos];
    const updated = [...previous, videoId];
    setHiddenSystemVideos(updated);
    const ok = await saveHiddenVideos(updated);
    if (!ok) setHiddenSystemVideos(previous);
  };
  const unhideSystemVideo = async (videoId: string) => {
    const previous = [...hiddenSystemVideos];
    const updated = previous.filter(id => id !== videoId);
    setHiddenSystemVideos(updated);
    const ok = await saveHiddenVideos(updated);
    if (!ok) setHiddenSystemVideos(previous);
  };

  const getVideosForDay = (day: number) => {
    const staticV = trainingVideos.filter(v => v.relatedDays.includes(day) && !hiddenSystemVideos.includes(v.id));
    const hiddenV = trainingVideos.filter(v => v.relatedDays.includes(day) && hiddenSystemVideos.includes(v.id));
    const dbV = dbVideos.filter(v => v.status !== "deleted" && v.related_days?.includes(day));
    return { staticVideos: staticV, hiddenVideos: hiddenV, customVideos: dbV };
  };

  const hiddenCount = trainingVideos.filter(v => hiddenSystemVideos.includes(v.id)).length;

  const BrandTags = ({ brands }: { brands: string[] }) => {
    if (!brands || brands.length === 0) return <span style={{ fontSize: 10, color: "var(--green)", background: "rgba(34,197,94,0.08)", padding: "1px 6px", borderRadius: 5, fontWeight: 600 }}>全品牌</span>;
    return <>{brands.map((bid) => { const b = BRAND_OPTIONS.find(x => x.id === bid); return b ? <span key={bid} style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 5, background: withAlpha(b.color, 0.09), color: b.color }}>{b.name}</span> : null; })}</>;
  };

  // ─── Links & Schedule helpers ───
  const fetchBrandOverrides = useCallback(() => {
    fetch(`/api/admin/module-overrides?brand=${selectedBrand}`)
      .then(r => r.json()).then(d => setBrandOverrides(d.overrides || [])).catch(() => setBrandOverrides([]));
  }, [selectedBrand]);
  useEffect(() => { fetchBrandOverrides(); }, [fetchBrandOverrides]);

  const getLinksForDay = (day: number): TrainingResource[] => {
    const ov = brandOverrides.find(o => o.module_id === day);
    if (ov?.resources_override) return ov.resources_override;
    const mod = allSystemModules.find(m => m.day === day && (m.brand === selectedBrand || (!m.brand && selectedBrand === "nschool")))
      || allSystemModules.find(m => m.day === day && (!m.brand || m.brand === "nschool"));
    return mod?.resources?.filter(r => r.type !== "video") || [];
  };
  const getScheduleForDay = (day: number): DailyScheduleItem[] => {
    const ov = brandOverrides.find(o => o.module_id === day);
    if (ov?.schedule_override) return ov.schedule_override;
    const mod = allSystemModules.find(m => m.day === day && (m.brand === selectedBrand || (!m.brand && selectedBrand === "nschool")))
      || allSystemModules.find(m => m.day === day && (!m.brand || m.brand === "nschool"));
    return mod?.schedule || [];
  };
  const saveDayResources = async (day: number, resources: TrainingResource[]) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/module-overrides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ moduleId: day, brand: selectedBrand, resources }) });
      const d = await res.json(); if (d.error) alert("儲存失敗：" + d.error); else fetchBrandOverrides();
    } catch { alert("儲存失敗"); }
    setSaving(false);
  };
  const saveDaySchedule = async (day: number, schedule: DailyScheduleItem[]) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/module-overrides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ moduleId: day, brand: selectedBrand, schedule }) });
      const d = await res.json(); if (d.error) alert("儲存失敗：" + d.error); else fetchBrandOverrides();
    } catch { alert("儲存失敗"); }
    setSaving(false);
  };
  const handleFileUpload = async (day: number, file: File) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("folder", `day-${day}`);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) { alert("上傳失敗：" + data.error); } else {
        const links = [...getLinksForDay(day)];
        links.push({ title: file.name, url: data.url, description: `上傳檔案 (${(file.size / 1024).toFixed(0)} KB)`, type: "document" });
        await saveDayResources(day, links);
      }
    } catch { alert("上傳失敗"); }
    setUploading(false);
  };
  // ─── Link & Schedule save handlers ───
  const saveEditLink = async () => {
    if (!editingLink || !linkTitle || !linkUrl) return;
    const links = [...getLinksForDay(editingLink.day)];
    links[editingLink.index] = { title: linkTitle, url: linkUrl, description: linkDesc || undefined, type: linkType };
    await saveDayResources(editingLink.day, links);
    setEditingLink(null);
  };
  const saveAddLink = async () => {
    if (addingLink === null || !linkTitle || !linkUrl) return;
    const links = [...getLinksForDay(addingLink)];
    links.push({ title: linkTitle, url: linkUrl, description: linkDesc || undefined, type: linkType });
    await saveDayResources(addingLink, links);
    setAddingLink(null);
  };
  const saveEditSchedule = async () => {
    if (!editingSchedule || !schedTime || !schedTask) return;
    const items = [...getScheduleForDay(editingSchedule.day)];
    items[editingSchedule.index] = { time: schedTime, task: schedTask, description: schedDesc || undefined };
    await saveDaySchedule(editingSchedule.day, items);
    setEditingSchedule(null);
  };
  const saveAddSchedule = async () => {
    if (addingSchedule === null || !schedTime || !schedTask) return;
    const items = [...getScheduleForDay(addingSchedule)];
    items.push({ time: schedTime, task: schedTask, description: schedDesc || undefined });
    await saveDaySchedule(addingSchedule, items);
    setAddingSchedule(null);
  };

  const linkIcon = (type: string) => type === "video" ? "🎬" : type === "recording" ? "🎙️" : type === "notion" ? "📝" : "📄";
  const LINK_TYPE_OPTIONS = [
    { value: "notion", label: "📝 Notion", color: "var(--accent)" },
    { value: "document", label: "📄 文件", color: "var(--teal)" },
    { value: "video", label: "🎬 影片連結", color: "var(--gold)" },
    { value: "recording", label: "🎙️ 錄音", color: "var(--green)" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>訓練管理</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {(["days", "videos"] as const).map(v => (
            <button key={v} onClick={() => setTrainingView(v)} style={{ background: trainingView === v ? "var(--accent)" : "var(--bg2)", color: trainingView === v ? "#fff" : "var(--text2)", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {v === "days" ? "📅 按天數" : "🎬 影片總覽"}
            </button>
          ))}
        </div>
      </div>
      {videoSaveMsg && (
        <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid var(--green)", borderRadius: 10, padding: "8px 16px", marginBottom: 12, fontSize: 13, color: "var(--green)", fontWeight: 600 }}>{videoSaveMsg}</div>
      )}
      {/* Brand selector for links & schedule */}
      {trainingView === "days" && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text3)", marginRight: 4 }}>連結/行程品牌：</span>
          {BRAND_TABS.map(b => (
            <button key={b.id} onClick={() => setSelectedBrand(b.id)}
              style={{ padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: selectedBrand === b.id ? `2px solid ${b.color}` : "1px solid var(--border)",
                background: selectedBrand === b.id ? withAlpha(b.color, 0.1) : "transparent",
                color: selectedBrand === b.id ? b.color : "var(--text3)" }}>
              {b.name}
            </button>
          ))}
        </div>
      )}
      <p style={{ color: "var(--text3)", fontSize: 14, marginBottom: 20 }}>
        {trainingView === "days" ? "管理每天的訓練內容、影片、連結與行程。點擊展開查看/編輯。" : "管理所有影片：可新增、刪除自訂影片，隱藏/恢復系統內建影片。"}
      </p>

      {/* ========= VIDEO OVERVIEW TAB ========= */}
      {trainingView === "videos" && (
        <div>
          <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
            <input value={videoSearch} onChange={e => setVideoSearch(e.target.value)} placeholder="搜尋影片名稱..." style={{ ...inputStyle, maxWidth: 300 }} />
            <button onClick={() => { setAddingVideoDay(0); setNewDays([]); setAddStep(1); }} style={{ marginLeft: "auto", background: "linear-gradient(135deg, var(--accent), var(--teal))", color: "#fff", border: "none", borderRadius: 10, padding: "8px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              + 新增影片
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "系統內建", value: trainingVideos.filter(v => !hiddenSystemVideos.includes(v.id)).length, icon: "📋" },
              { label: "自訂新增", value: dbVideos.filter(v => v.status !== "deleted").length, icon: "📌" },
              { label: "已隱藏", value: hiddenCount, icon: "🙈" },
              { label: "總計可見", value: trainingVideos.filter(v => !hiddenSystemVideos.includes(v.id)).length + dbVideos.filter(v => v.status !== "deleted").length, icon: "🎬" },
            ].map(s => (
              <div key={s.label} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 18, marginBottom: 2 }}>{s.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* System videos */}
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--accent)" }}>📋 系統內建影片</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
            {trainingVideos.filter(v => !hiddenSystemVideos.includes(v.id)).filter(v => !videoSearch || v.title.toLowerCase().includes(videoSearch.toLowerCase())).map(v => (
              <div key={v.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <span>{v.type === "slides" ? "📊" : "🎬"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title}</div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 2 }}>
                    <BrandTags brands={v.brands} />
                    <span style={{ fontSize: 10, color: "var(--text3)" }}>Day {v.relatedDays.join(",")}</span>
                    <span style={{ fontSize: 10, color: "var(--text3)" }}>{v.size}</span>
                  </div>
                </div>
                <button onClick={() => hideSystemVideo(v.id)} style={{ fontSize: 11, color: "var(--gold)", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>隱藏</button>
              </div>
            ))}
          </div>

          {/* Custom DB videos */}
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--teal)" }}>📌 自訂影片</h4>
          {dbVideos.filter(v => v.status !== "deleted").length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text3)", background: "var(--card)", borderRadius: 12, border: "1px solid var(--border)", marginBottom: 24 }}>尚無自訂影片，點擊上方「新增影片」按鈕新增</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
              {dbVideos.filter(v => v.status !== "deleted").filter(v => !videoSearch || v.title.toLowerCase().includes(videoSearch.toLowerCase())).map(v => (
                <div key={v.id} style={{ background: "var(--card)", border: "1px solid rgba(45,212,191,0.2)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <span>🎬</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title}</div>
                    <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 2 }}>
                      <BrandTags brands={v.brands || []} />
                      {v.related_days?.length > 0 && <span style={{ fontSize: 10, color: "var(--text3)" }}>Day {v.related_days.join(",")}</span>}
                    </div>
                  </div>
                  <button onClick={() => deleteVideo(v.id)} style={{ fontSize: 11, color: "var(--red)", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>刪除</button>
                </div>
              ))}
            </div>
          )}

          {/* Hidden videos */}
          {hiddenCount > 0 && (
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--text3)" }}>🙈 已隱藏 ({hiddenCount})</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {trainingVideos.filter(v => hiddenSystemVideos.includes(v.id)).map(v => (
                  <div key={v.id} style={{ background: "var(--card)", border: "1px dashed var(--border)", borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.5 }}>
                    <span style={{ fontSize: 13 }}>{v.title} <span style={{ fontSize: 10, color: "var(--text3)" }}>Day {v.relatedDays.join(",")}</span></span>
                    <button onClick={() => unhideSystemVideo(v.id)} style={{ fontSize: 11, color: "var(--green)", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontWeight: 600 }}>恢復</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========= DAY VIEW TAB ========= */}
      {trainingView === "days" && (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: 9 }, (_, i) => i + 1).map((day) => {
          const hasOverride = overrides.some((o) => o.module_id === day);
          const { staticVideos: dayStaticVideos, hiddenVideos: dayHiddenVideos, customVideos: dayCustomVideos } = getVideosForDay(day);
          const totalVideos = dayStaticVideos.length + dayCustomVideos.length;
          const isExpanded = expandedDay === day;
          const dayLinks = getLinksForDay(day);
          const daySched = getScheduleForDay(day);
          const hasLinkOv = !!brandOverrides.find(o => o.module_id === day)?.resources_override;
          const hasSchedOv = !!brandOverrides.find(o => o.module_id === day)?.schedule_override;

          return (
            <div key={day} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
              <div onClick={() => setExpandedDay(isExpanded ? null : day)} style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: hasOverride ? "var(--gold)" : "var(--accent)", color: hasOverride ? "#000" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15 }}>{day}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>Day {day} — {MODULE_TITLES[day]}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>🎬 {totalVideos} 部</span>
                      {dayHiddenVideos.length > 0 && <span style={{ fontSize: 11, color: "var(--gold)" }}>🙈 {dayHiddenVideos.length} 隱藏</span>}
                      {hasOverride && <span style={{ fontSize: 11, color: "var(--gold)" }}>✏️ 已自訂</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={(e) => { e.stopPropagation(); startEdit(day); }} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>編輯內容</button>
                  {hasOverride && <button onClick={(e) => { e.stopPropagation(); resetOverride(day); }} style={{ background: "var(--border)", color: "var(--text2)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>重置</button>}
                  <span style={{ fontSize: 18, color: "var(--text3)", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--border)" }}>
                  <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>影片 ({totalVideos})</div>
                    <button onClick={() => { setAddingVideoDay(day); setNewDays([day]); setAddStep(1); }} style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))", color: "#fff", border: "none", borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ 新增影片</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                    {dayStaticVideos.map(v => (
                      <div key={v.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{v.type === "slides" ? "📊" : "🎬"} {v.title}</div>
                          <button onClick={() => hideSystemVideo(v.id)} style={{ fontSize: 10, color: "var(--gold)", background: "none", border: "none", cursor: "pointer" }}>隱藏</button>
                        </div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", fontSize: 10, marginTop: 4 }}>
                          <BrandTags brands={v.brands} />
                          <span style={{ color: "var(--text3)", marginLeft: "auto" }}>{v.size}</span>
                        </div>
                      </div>
                    ))}
                    {dayCustomVideos.map(v => (
                      <div key={v.id} style={{ background: "var(--bg2)", border: "1px solid rgba(45,212,191,0.2)", borderRadius: 10, padding: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>🎬 {v.title}</div>
                          <button onClick={() => deleteVideo(v.id)} style={{ fontSize: 10, color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}>刪除</button>
                        </div>
                        {v.description && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{v.description}</div>}
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}><BrandTags brands={v.brands || []} /></div>
                      </div>
                    ))}
                  </div>
                  {totalVideos === 0 && <div style={{ padding: 16, textAlign: "center", color: "var(--text3)", fontSize: 12, background: "var(--bg2)", borderRadius: 10 }}>此天尚無影片</div>}
                  {dayHiddenVideos.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>🙈 已隱藏 ({dayHiddenVideos.length})</div>
                      {dayHiddenVideos.map(v => (
                        <div key={v.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 10px", background: "var(--bg2)", borderRadius: 6, marginBottom: 3, opacity: 0.5, fontSize: 12 }}>
                          <span>{v.title}</span>
                          <button onClick={() => unhideSystemVideo(v.id)} style={{ fontSize: 10, color: "var(--green)", background: "none", border: "none", cursor: "pointer" }}>恢復</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ─── Links Section ─── */}
                  <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>🔗 連結與資源 ({dayLinks.length})</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {hasLinkOv && <button onClick={async () => { if(!confirm("重置連結回預設？")) return; setSaving(true); await fetch("/api/admin/module-overrides", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ moduleId: day, brand: selectedBrand, resources: null }) }); fetchBrandOverrides(); setSaving(false); }} style={{ fontSize: 10, color: "var(--gold)", background: "none", border: "1px solid var(--gold)", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>重置</button>}
                        <label style={{ fontSize: 11, color: "var(--teal)", background: withAlpha("var(--teal)", 0.1), border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontWeight: 600 }}>
                          {uploading ? "..." : "📁 上傳"}
                          <input type="file" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(day, f); e.target.value = ""; }} disabled={uploading} />
                        </label>
                        <button onClick={() => { setAddingLink(day); setLinkTitle(""); setLinkUrl(""); setLinkDesc(""); setLinkType("notion"); }} style={{ fontSize: 11, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, padding: "3px 10px", fontWeight: 600, cursor: "pointer" }}>+ 新增</button>
                      </div>
                    </div>
                    {dayLinks.length === 0 && <div style={{ padding: 12, textAlign: "center", color: "var(--text3)", fontSize: 11, background: "var(--bg2)", borderRadius: 8 }}>尚無連結</div>}
                    {dayLinks.map((link, li) => (
                      <div key={li} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", background: "var(--bg2)", borderRadius: 8, marginBottom: 4, border: "1px solid var(--border)" }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{linkIcon(link.type)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link.title}</div>
                          {link.description && <div style={{ fontSize: 10, color: "var(--text3)" }}>{link.description}</div>}
                        </div>
                        <button onClick={() => { const lnks = [...dayLinks]; if (li > 0) { [lnks[li], lnks[li-1]] = [lnks[li-1], lnks[li]]; saveDayResources(day, lnks); }}} disabled={li === 0} style={{ fontSize: 10, background: "none", border: "none", cursor: li === 0 ? "default" : "pointer", opacity: li === 0 ? 0.3 : 1, padding: 1 }}>▲</button>
                        <button onClick={() => { const lnks = [...dayLinks]; if (li < dayLinks.length - 1) { [lnks[li], lnks[li+1]] = [lnks[li+1], lnks[li]]; saveDayResources(day, lnks); }}} disabled={li === dayLinks.length - 1} style={{ fontSize: 10, background: "none", border: "none", cursor: li === dayLinks.length - 1 ? "default" : "pointer", opacity: li === dayLinks.length - 1 ? 0.3 : 1, padding: 1 }}>▼</button>
                        <button onClick={() => { setEditingLink({ day, index: li }); setLinkTitle(link.title); setLinkUrl(link.url || ""); setLinkDesc(link.description || ""); setLinkType(link.type as typeof linkType); }} style={{ fontSize: 10, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>編輯</button>
                        <button onClick={() => { if(confirm("刪除？")) { const lnks = [...dayLinks]; lnks.splice(li, 1); saveDayResources(day, lnks); }}} style={{ fontSize: 10, color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}>刪除</button>
                      </div>
                    ))}
                  </div>

                  {/* ─── Schedule Section ─── */}
                  <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--teal)" }}>📅 每日行程 ({daySched.length})</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {hasSchedOv && <button onClick={async () => { if(!confirm("重置行程回預設？")) return; setSaving(true); await fetch("/api/admin/module-overrides", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ moduleId: day, brand: selectedBrand, schedule: null }) }); fetchBrandOverrides(); setSaving(false); }} style={{ fontSize: 10, color: "var(--gold)", background: "none", border: "1px solid var(--gold)", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>重置</button>}
                        <button onClick={() => { setAddingSchedule(day); setSchedTime(""); setSchedTask(""); setSchedDesc(""); }} style={{ fontSize: 11, background: "var(--teal)", color: "#fff", border: "none", borderRadius: 6, padding: "3px 10px", fontWeight: 600, cursor: "pointer" }}>+ 新增</button>
                      </div>
                    </div>
                    {daySched.length === 0 && <div style={{ padding: 12, textAlign: "center", color: "var(--text3)", fontSize: 11, background: "var(--bg2)", borderRadius: 8 }}>尚無行程</div>}
                    {daySched.map((item, si) => (
                      <div key={si} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--bg2)", borderRadius: 8, marginBottom: 4, border: "1px solid var(--border)" }}>
                        <div style={{ fontWeight: 700, fontSize: 11, color: "var(--accent)", minWidth: 80, flexShrink: 0 }}>{item.time}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{item.task}</div>
                          {item.description && <div style={{ fontSize: 10, color: "var(--text3)" }}>{item.description}</div>}
                        </div>
                        <button onClick={() => { const items = [...daySched]; if (si > 0) { [items[si], items[si-1]] = [items[si-1], items[si]]; saveDaySchedule(day, items); }}} disabled={si === 0} style={{ fontSize: 10, background: "none", border: "none", cursor: si === 0 ? "default" : "pointer", opacity: si === 0 ? 0.3 : 1, padding: 1 }}>▲</button>
                        <button onClick={() => { const items = [...daySched]; if (si < daySched.length - 1) { [items[si], items[si+1]] = [items[si+1], items[si]]; saveDaySchedule(day, items); }}} disabled={si === daySched.length - 1} style={{ fontSize: 10, background: "none", border: "none", cursor: si === daySched.length - 1 ? "default" : "pointer", opacity: si === daySched.length - 1 ? 0.3 : 1, padding: 1 }}>▼</button>
                        <button onClick={() => { setEditingSchedule({ day, index: si }); setSchedTime(item.time); setSchedTask(item.task); setSchedDesc(item.description || ""); }} style={{ fontSize: 10, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>編輯</button>
                        <button onClick={() => { if(confirm("刪除？")) { const items = [...daySched]; items.splice(si, 1); saveDaySchedule(day, items); }}} style={{ fontSize: 10, color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}>刪除</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {/* Add Video Modal */}
      {addingVideoDay !== null && addStep > 0 && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={resetAddForm}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--card)", border: "2px solid var(--accent)", borderRadius: 20, padding: 32, width: "100%", maxWidth: 560 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{addingVideoDay ? `新增影片到 Day ${addingVideoDay}` : "新增影片"}</h3>
            <p style={{ color: "var(--text3)", fontSize: 12, marginBottom: 20 }}>{addingVideoDay ? MODULE_TITLES[addingVideoDay] : "選擇要加入的天數和品牌"}</p>

            {/* Progress */}
            <div style={{ display: "flex", gap: 0, marginBottom: 20 }}>
              {[1, 2, 3].map(s => (
                <div key={s} style={{ flex: 1, display: "flex", alignItems: "center" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: addStep >= s ? "var(--accent)" : "var(--border)", color: addStep >= s ? "#fff" : "var(--text3)" }}>{s}</div>
                  {s < 3 && <div style={{ flex: 1, height: 2, background: addStep > s ? "var(--accent)" : "var(--border)" }} />}
                </div>
              ))}
            </div>

            {/* Step 1: Info */}
            {addStep === 1 && (
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Step 1：影片資訊</h4>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6 }}>影片標題 *</label>
                  <input value={newTitle} onChange={e => setNewTitle(e.target.value)} style={inputStyle} placeholder="例：學米 DEMO 流程教學" />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6 }}>Google Drive 檔案 ID *</label>
                  <input value={newDriveId} onChange={e => setNewDriveId(e.target.value)} style={inputStyle} placeholder="貼上 Google Drive 檔案 ID 或完整連結" />
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>格式如：1kn-z8VXrTFhc0J5mPTlSj6IhtUBovT2r</div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6 }}>描述（選填）</label>
                  <input value={newDescription} onChange={e => setNewDescription(e.target.value)} style={inputStyle} placeholder="簡短說明" />
                </div>
                {/* Day selection — shown when adding from video overview */}
                {addingVideoDay === 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6 }}>關聯天數（可多選）</label>
                    <div style={{ display: "flex", gap: 4 }}>
                      {Array.from({ length: 9 }, (_, i) => i + 1).map(d => (
                        <button key={d} onClick={() => setNewDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                          style={{ width: 36, height: 36, borderRadius: 8, border: newDays.includes(d) ? "2px solid var(--accent)" : "1px solid var(--border)", background: newDays.includes(d) ? "var(--accent)" : "transparent", color: newDays.includes(d) ? "#fff" : "var(--text3)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button onClick={resetAddForm} style={{ background: "var(--border)", color: "var(--text2)", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer" }}>取消</button>
                  <button disabled={!newTitle || !newDriveId} onClick={() => setAddStep(2)} style={{ background: newTitle && newDriveId ? "var(--accent)" : "var(--border)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: newTitle && newDriveId ? "pointer" : "not-allowed" }}>
                    下一步：選擇品牌 →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Brands */}
            {addStep === 2 && (
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Step 2：選擇品牌</h4>
                <p style={{ color: "var(--text3)", fontSize: 12, marginBottom: 12 }}>不選則全品牌可見</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 16 }}>
                  {BRAND_OPTIONS.map(b => (
                    <button key={b.id} onClick={() => setNewBrands(toggleArr(newBrands, b.id))}
                      style={{ padding: "12px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left",
                        border: newBrands.includes(b.id) ? `2px solid ${b.color}` : "2px solid var(--border)",
                        background: newBrands.includes(b.id) ? withAlpha(b.color, 0.08) : "var(--bg2)",
                        color: newBrands.includes(b.id) ? b.color : "var(--text3)" }}>
                      {newBrands.includes(b.id) ? "✅ " : "⬜ "}{b.name}
                    </button>
                  ))}
                </div>
                <div style={{ padding: "8px 12px", background: "var(--bg2)", borderRadius: 8, marginBottom: 16, fontSize: 12, color: "var(--text2)" }}>
                  {newBrands.length === 0 ? "🌐 全品牌可見" : newBrands.map(bid => BRAND_OPTIONS.find(b => b.id === bid)?.name).join("、")}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button onClick={() => setAddStep(1)} style={{ background: "var(--border)", color: "var(--text2)", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer" }}>← 上一步</button>
                  <button onClick={() => setAddStep(3)} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    下一步：確認 →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Confirm */}
            {addStep === 3 && (
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Step 3：確認送出</h4>
                <div style={{ background: "var(--bg2)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px", fontSize: 13 }}>
                    <span style={{ color: "var(--text3)" }}>標題</span><span style={{ fontWeight: 600 }}>{newTitle}</span>
                    <span style={{ color: "var(--text3)" }}>Drive ID</span><span style={{ fontFamily: "monospace", fontSize: 12 }}>{newDriveId}</span>
                    <span style={{ color: "var(--text3)" }}>天數</span><span style={{ fontWeight: 600 }}>{addingVideoDay ? `Day ${addingVideoDay}` : newDays.length > 0 ? `Day ${newDays.join(", ")}` : "未指定"}</span>
                    <span style={{ color: "var(--text3)" }}>品牌</span><span>{newBrands.length === 0 ? "🌐 全品牌" : newBrands.map(bid => BRAND_OPTIONS.find(b => b.id === bid)?.name).join("、")}</span>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button onClick={() => setAddStep(2)} style={{ background: "var(--border)", color: "var(--text2)", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer" }}>← 上一步</button>
                  <button onClick={addVideo} style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))", color: "#fff", border: "none", borderRadius: 10, padding: "10px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                    ✓ 確認發佈
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content Edit Modal */}
      {editingModule && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setEditingModule(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: 32, width: "100%", maxWidth: 700, maxHeight: "85vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
              編輯 Day {editingModule} — {MODULE_TITLES[editingModule]}
            </h3>
            <p style={{ color: "var(--text3)", fontSize: 12, marginBottom: 20 }}>
              留空的欄位會使用預設內容。只需填寫要修改的部分。
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6, fontWeight: 600 }}>前言說明</label>
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="留空使用預設" />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6, fontWeight: 600 }}>學習內容（每行一項）</label>
                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={5} style={{ ...inputStyle, resize: "vertical" }} placeholder="每行一項內容..." />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6, fontWeight: 600 }}>關鍵要點（每行一項）</label>
                <textarea value={editKeyPoints} onChange={(e) => setEditKeyPoints(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="每行一項..." />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6, fontWeight: 600 }}>講師提醒（每行一項）</label>
                <textarea value={editTips} onChange={(e) => setEditTips(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="每行一項..." />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6, fontWeight: 600 }}>實作任務</label>
                <textarea value={editTask} onChange={(e) => setEditTask(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} placeholder="留空使用預設" />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
              <button onClick={() => setEditingModule(null)} style={{ background: "var(--border)", color: "var(--text2)", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer" }}>取消</button>
              <button onClick={saveOverride} disabled={saving} style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
                {saving ? "儲存中..." : "儲存修改"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Link Edit/Add Modal ─── */}
      {(editingLink || addingLink !== null) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => { setEditingLink(null); setAddingLink(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--card)", border: "2px solid var(--accent)", borderRadius: 20, padding: 32, width: "100%", maxWidth: 500 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{editingLink ? "編輯連結" : "新增連結"}</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text3)", marginBottom: 6 }}>類型</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {LINK_TYPE_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setLinkType(opt.value as typeof linkType)}
                    style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      border: linkType === opt.value ? `2px solid ${opt.color}` : "1px solid var(--border)",
                      background: linkType === opt.value ? withAlpha(opt.color, 0.1) : "transparent",
                      color: linkType === opt.value ? opt.color : "var(--text3)" }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>標題 *</label>
              <input value={linkTitle} onChange={e => setLinkTitle(e.target.value)} style={inputStyle} placeholder="例：開發 Call 逐字稿" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>網址 *</label>
              <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} style={inputStyle} placeholder="https://..." />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>說明（選填）</label>
              <input value={linkDesc} onChange={e => setLinkDesc(e.target.value)} style={inputStyle} placeholder="簡短說明..." />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => { setEditingLink(null); setAddingLink(null); }} style={{ background: "var(--border)", color: "var(--text2)", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer" }}>取消</button>
              <button onClick={editingLink ? saveEditLink : saveAddLink} disabled={!linkTitle || !linkUrl || saving}
                style={{ background: linkTitle && linkUrl ? "linear-gradient(135deg, var(--accent), var(--teal))" : "var(--border)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: linkTitle && linkUrl ? "pointer" : "not-allowed" }}>
                {saving ? "儲存中..." : editingLink ? "儲存修改" : "新增"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Schedule Edit/Add Modal ─── */}
      {(editingSchedule || addingSchedule !== null) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => { setEditingSchedule(null); setAddingSchedule(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--card)", border: "2px solid var(--teal)", borderRadius: 20, padding: 32, width: "100%", maxWidth: 500 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{editingSchedule ? "編輯行程" : "新增行程"}</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>時間 *</label>
              <input value={schedTime} onChange={e => setSchedTime(e.target.value)} style={inputStyle} placeholder="例：09:00-10:00" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>項目 *</label>
              <input value={schedTask} onChange={e => setSchedTask(e.target.value)} style={inputStyle} placeholder="例：晨會" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>說明（選填）</label>
              <input value={schedDesc} onChange={e => setSchedDesc(e.target.value)} style={inputStyle} placeholder="詳細說明..." />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => { setEditingSchedule(null); setAddingSchedule(null); }} style={{ background: "var(--border)", color: "var(--text2)", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer" }}>取消</button>
              <button onClick={editingSchedule ? saveEditSchedule : saveAddSchedule} disabled={!schedTime || !schedTask || saving}
                style={{ background: schedTime && schedTask ? "linear-gradient(135deg, var(--teal), var(--green))" : "var(--border)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: schedTime && schedTask ? "pointer" : "not-allowed" }}>
                {saving ? "儲存中..." : editingSchedule ? "儲存修改" : "新增"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// (LinksScheduleManager removed - merged into TrainingTab)

// ─── Mentorship Tab (師徒管理) ─────────────────────────────────────────────

const WEEK_CONFIGS = [
  { week: 1, title: "建立習慣", mentorRole: "教練 (Coach)", emoji: "🏋️", summary: "示範 (Show Me) — 我做你看，建立信任", callRange: "30→60", retention: "80%" },
  { week: 2, title: "標準對齊", mentorRole: "標竿 (Model)", emoji: "🎯", summary: "觀摩 (Watch Me) — 量能達標，看我成交", callRange: "80", retention: "持續跟進" },
  { week: 3, title: "實戰上手", mentorRole: "副駕駛 (Co-pilot)", emoji: "✈️", summary: "陪同 (Help Me) — 你做我改，即時救援", callRange: "100", retention: "穩定產出" },
  { week: 4, title: "獨立驗收", mentorRole: "顧問 (Advisor)", emoji: "🏆", summary: "獨立 (Let Me) — 你做我評，準備獨立", callRange: "120", retention: "成功留存" },
];

const MENTOR_SOP = [
  { category: "實戰示範", freq: "每天 3-5 通 / 每週 3 場", purpose: "讓新人看見正確的成交路徑", icon: "📞" },
  { category: "旁聽指導", freq: "前兩週累計 10 通以上", purpose: "抓出話術致命傷，避免錯誤習慣", icon: "🎧" },
  { category: "每日回饋", freq: "每天 15-30 分鐘", purpose: "2+1 格式：2 優點 + 1 建議", icon: "📝" },
  { category: "心態引導", freq: "視新人狀態調整", purpose: "降低第一週離職率", icon: "💪" },
  { category: "數據監控", freq: "每日填寫 / 每週五回報", purpose: "將輔導轉化為數據供主管決策", icon: "📊" },
];

function MentorshipTab({ token }: { token: string }) {
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; brand: string; role: string; status: string }>>([]);
  const [feedbacks, setFeedbacks] = useState<Array<{ id: string; trainee_email: string; mentor_email: string; day: number; date: string; actual_calls: number; call_target: number; invites: number; demos: number; strength_1: string; strength_2: string; improvement: string; mood?: number; notes?: string }>>([]);
  const [feedbackFilter, setFeedbackFilter] = useState("");
  const [feedbackBrand, setFeedbackBrand] = useState("all");
  const [pairs, setPairs] = useState<Array<{ id: string; trainee_id: string; mentor_id: string; manager_id: string; brand: string; status: string; start_date: string; trainee_name?: string; mentor_name?: string; manager_name?: string; trainee_email?: string; mentor_email?: string; manager_email?: string; ceremony_completed?: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"overview" | "pairs" | "feedback">("overview");
  const [bindForm, setBindForm] = useState({ trainee_id: "", mentor_id: "", manager_id: "", brand: "" });
  const [binding, setBinding] = useState(false);
  const [bindMsg, setBindMsg] = useState("");

  const loadPairs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/mentorship", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setPairs(data.pairs || []);
    } catch { setPairs([]); }
  }, [token]);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/mentor-feedback").then((r) => r.json()).catch(() => ({ data: [] })),
      loadPairs(),
    ]).then(([userData, fbData]) => {
      setUsers(userData.users || []);
      setFeedbacks(fbData.data || fbData.feedbacks || []);
    }).finally(() => setLoading(false));
  }, [token, loadPairs]);

  const handleBind = async () => {
    if (!bindForm.trainee_id || !bindForm.mentor_id) { setBindMsg("請選擇師父和新人"); return; }
    setBinding(true); setBindMsg("");
    try {
      const brand = bindForm.brand || users.find(u => u.id === bindForm.trainee_id)?.brand || "";
      const res = await fetch("/api/admin/mentorship", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ trainee_id: bindForm.trainee_id, mentor_id: bindForm.mentor_id, manager_id: bindForm.manager_id || undefined, brand }),
      });
      if (res.ok) {
        setBindMsg("✅ 師徒配對成功！");
        setBindForm({ trainee_id: "", mentor_id: "", manager_id: "", brand: "" });
        await loadPairs();
      } else {
        const err = await res.json();
        setBindMsg(`❌ ${err.error || "配對失敗"}`);
      }
    } catch { setBindMsg("❌ 網路錯誤"); }
    setBinding(false);
  };

  const handleStatusChange = async (pairId: string, newStatus: string) => {
    try {
      await fetch("/api/admin/mentorship", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: pairId, status: newStatus }),
      });
      await loadPairs();
    } catch { /* ignore */ }
  };

  const mentors = users.filter((u) => ["reserve_cadre", "mentor", "team_leader", "trainer", "super_admin", "brand_manager"].includes(u.role));
  const trainees = users.filter((u) => u.role === "sales_rep");

  // Filter feedbacks by brand
  const brandFilteredFeedbacks = feedbackBrand === "all"
    ? feedbacks
    : feedbacks.filter(f => {
        const u = users.find(x => x.email === f.trainee_email);
        return u?.brand === feedbackBrand;
      });
  const filteredFeedbacks = brandFilteredFeedbacks.filter(f => !feedbackFilter || f.trainee_email === feedbackFilter);

  // Pre-compute feedback stats (avoid IIFE in JSX)
  const fbTotalCalls = brandFilteredFeedbacks.reduce((s, f) => s + f.actual_calls, 0);
  const fbTotalInvites = brandFilteredFeedbacks.reduce((s, f) => s + f.invites, 0);
  const fbMoodEntries = brandFilteredFeedbacks.filter(f => f.mood);
  const fbAvgMood = fbMoodEntries.length > 0 ? (fbMoodEntries.reduce((s, f) => s + (f.mood || 0), 0) / fbMoodEntries.length).toFixed(1) : null;
  const fbUniqueTrainees = [...new Set(brandFilteredFeedbacks.map(f => f.trainee_email))];

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>師徒管理</h2>
      <p style={{ color: "var(--text3)", fontSize: 13, marginBottom: 20 }}>
        4 週師徒制訓練系統 · 師徒 SOP · 每日回饋追蹤
      </p>

      {/* View Toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["overview", "pairs", "feedback"] as const).map((v) => (
          <button key={v} onClick={() => setViewMode(v)} style={{
            background: viewMode === v ? "var(--accent)" : "var(--bg2)", color: viewMode === v ? "#fff" : "var(--text2)",
            border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            {v === "overview" ? "📋 訓練總覽" : v === "pairs" ? "🤝 師徒配對" : "📝 回饋紀錄"}
          </button>
        ))}
      </div>

      {viewMode === "overview" && (
        <div>
          {/* 4-Week Timeline */}
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>4 週爬坡邏輯</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
            {WEEK_CONFIGS.map((w) => (
              <div key={w.week} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 24 }}>{w.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Week {w.week}</div>
                    <div style={{ fontSize: 12, color: "var(--text3)" }}>{w.title}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--teal)", fontWeight: 600, marginBottom: 4 }}>{w.mentorRole}</div>
                <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 8 }}>{w.summary}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text3)" }}>
                  <span>通次：{w.callRange}</span>
                  <span>留存：{w.retention}</span>
                </div>
              </div>
            ))}
          </div>

          {/* SOP Tasks */}
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>師徒 SOP 任務清單</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
            {MENTOR_SOP.map((s) => (
              <div key={s.category} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 24, background: "var(--bg2)", borderRadius: 10, padding: "8px 10px" }}>{s.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.category}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>{s.purpose}</div>
                </div>
                <span style={{ fontSize: 12, color: "var(--accent)", background: "rgba(102,126,234,0.13)", padding: "4px 10px", borderRadius: 6, fontWeight: 600, whiteSpace: "nowrap" }}>{s.freq}</span>
              </div>
            ))}
          </div>

          {/* QA Section */}
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>核心要點 Q&A</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { q: "為什麼把「新訓」跟「師徒」分開？", a: "會教課的人不一定會打仗。訓練人員負責把 SOP 講清楚（結構價值），師父負責在現場示範怎麼活下來（實戰價值）。避免新人學了一堆理論，上機卻因為挫折感太重而離開。" },
              { q: "儲備幹部的「功能」與「價值」？", a: "儲備幹部是團隊的精神領袖和標竿。透過示範和下班後的 1:1 關懷，讓新人覺得這份工作有未來、這家公司有人幫。這是維護團隊氣氛、降低流動率的關鍵。" },
              { q: "為什麼第一週數據要慢慢要求？", a: "第一週重點是讓新人愛上這份工作、建立信心。如果第一天就逼 120 通，新人只會覺得自己是撥號機器。師徒全力示範，是為了讓新人開始衝刺時，已經具備「想贏」的心態。" },
            ].map((item) => (
              <div key={item.q} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px" }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--gold)", marginBottom: 6 }}>Q: {item.q}</div>
                <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === "pairs" && (
        <div>
          {/* Binding Form */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 24 }}>🏮</span> 建立師徒配對
            </h3>
            <p style={{ color: "var(--text3)", fontSize: 12, marginBottom: 16 }}>選擇師父、新人與據點主管，建立正式師徒關係</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              {/* Mentor Select */}
              <div>
                <label style={{ fontSize: 12, color: "var(--text2)", marginBottom: 4, display: "block" }}>🛡️ 師父</label>
                <select value={bindForm.mentor_id} onChange={e => setBindForm({...bindForm, mentor_id: e.target.value})} style={{ width: "100%", padding: "10px 12px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 13 }}>
                  <option value="">選擇師父...</option>
                  {mentors.map(m => <option key={m.id} value={m.id}>{m.name} ({ROLE_LABELS[m.role]}) - {m.brand}</option>)}
                </select>
              </div>
              {/* Trainee Select */}
              <div>
                <label style={{ fontSize: 12, color: "var(--text2)", marginBottom: 4, display: "block" }}>🌱 新人</label>
                <select value={bindForm.trainee_id} onChange={e => setBindForm({...bindForm, trainee_id: e.target.value})} style={{ width: "100%", padding: "10px 12px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 13 }}>
                  <option value="">選擇新人...</option>
                  {trainees.filter(t => !pairs.some(p => p.trainee_id === t.id && p.status === "active")).map(t => <option key={t.id} value={t.id}>{t.name} - {t.brand}</option>)}
                </select>
              </div>
              {/* Manager Select */}
              <div>
                <label style={{ fontSize: 12, color: "var(--text2)", marginBottom: 4, display: "block" }}>👑 據點主管（選填）</label>
                <select value={bindForm.manager_id} onChange={e => setBindForm({...bindForm, manager_id: e.target.value})} style={{ width: "100%", padding: "10px 12px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 13 }}>
                  <option value="">選擇據點主管...</option>
                  {users.filter(u => ["team_leader", "brand_manager", "super_admin"].includes(u.role)).map(m => <option key={m.id} value={m.id}>{m.name} ({ROLE_LABELS[m.role]})</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={handleBind} disabled={binding} style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))", color: "#fff", border: "none", borderRadius: 10, padding: "10px 28px", fontWeight: 700, fontSize: 14, cursor: binding ? "not-allowed" : "pointer", opacity: binding ? 0.6 : 1 }}>
                {binding ? "配對中..." : "🏮 正式拜師"}
              </button>
              {bindMsg && <span style={{ fontSize: 13, color: bindMsg.startsWith("✅") ? "var(--green)" : "var(--red)" }}>{bindMsg}</span>}
            </div>
          </div>

          {/* Active Pairs */}
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>目前配對 ({pairs.filter(p => p.status === "active").length})</h3>
          {pairs.filter(p => p.status === "active").length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text3)", background: "var(--card)", borderRadius: 16, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏮</div>
              <div>尚無師徒配對</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>使用上方表單建立第一組師徒關係</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {pairs.filter(p => p.status === "active").map(p => {
                const days = Math.ceil((Date.now() - new Date(p.start_date).getTime()) / (1000*60*60*24));
                const week = Math.min(4, Math.ceil(days / 7));
                return (
                  <div key={p.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, var(--accent), var(--teal))" }} />
                    {/* 3-level hierarchy */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                      {p.manager_name && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, var(--gold), #b8860b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{p.manager_name?.charAt(0)}</div>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{p.manager_name}</span>
                          <span style={{ fontSize: 10, color: "var(--gold)", background: "rgba(251,191,36,0.09)", padding: "1px 6px", borderRadius: 4 }}>👑 據點主管</span>
                        </div>
                      )}
                      {p.manager_name && <div style={{ width: 2, height: 12, background: "var(--border)", marginLeft: 13 }} />}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, var(--accent), #5b4ec7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{p.mentor_name?.charAt(0) || "?"}</div>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{p.mentor_name || "未知"}</span>
                        <span style={{ fontSize: 10, color: "var(--accent-light)", background: "rgba(102,126,234,0.09)", padding: "1px 6px", borderRadius: 4 }}>🛡️ 師父</span>
                      </div>
                      <div style={{ width: 2, height: 12, background: "var(--border)", marginLeft: 13 }} />
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, var(--teal), #2a9d8f)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{p.trainee_name?.charAt(0) || "?"}</div>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{p.trainee_name || "未知"}</span>
                        <span style={{ fontSize: 10, color: "var(--teal)", background: "rgba(45,212,191,0.09)", padding: "1px 6px", borderRadius: 4 }}>🌱 新人</span>
                      </div>
                    </div>
                    {/* Stats */}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text2)", marginBottom: 12 }}>
                      <span>第 {days} 天 / 28 天</span>
                      <span>Week {week}</span>
                      <span>{p.ceremony_completed ? "✅ 已拜師" : "⏳ 待拜師"}</span>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: 4, background: "var(--border)", borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
                      <div style={{ height: "100%", borderRadius: 4, background: "linear-gradient(90deg, var(--accent), var(--teal))", width: `${Math.min(100, (days / 28) * 100)}%`, transition: "width 0.5s" }} />
                    </div>
                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleStatusChange(p.id, "graduated")} style={{ flex: 1, padding: "6px 0", background: "rgba(34,197,94,0.09)", color: "var(--green)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>🎓 結業</button>
                      <button onClick={() => handleStatusChange(p.id, "dissolved")} style={{ flex: 1, padding: "6px 0", background: "rgba(248,113,113,0.09)", color: "var(--red)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>解除</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Graduated/Past Pairs */}
          {pairs.filter(p => p.status !== "active").length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "var(--text2)" }}>歷史紀錄 ({pairs.filter(p => p.status !== "active").length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pairs.filter(p => p.status !== "active").map(p => (
                  <div key={p.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.7 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 600, background: p.status === "graduated" ? "rgba(34,197,94,0.13)" : "rgba(248,113,113,0.13)", color: p.status === "graduated" ? "var(--green)" : "var(--red)" }}>
                        {p.status === "graduated" ? "🎓 結業" : "已解除"}
                      </span>
                      <span style={{ fontSize: 13 }}>{p.mentor_name || "?"} → {p.trainee_name || "?"}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>{p.start_date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available lists */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }}>
            <div>
              <h4 style={{ fontSize: 14, color: "var(--teal)", marginBottom: 8 }}>可擔任師父 ({mentors.length})</h4>
              {loading ? <div style={{ color: "var(--text3)" }}>載入中...</div> : mentors.length === 0 ? (
                <div style={{ color: "var(--text3)", fontSize: 13, padding: 16, background: "var(--card)", borderRadius: 10 }}>尚無可用師父。請在用戶管理中設定角色為「儲備幹部」或「師父（帶訓）」</div>
              ) : mentors.map((m) => (
                <div key={m.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{m.email}</div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--accent)", background: "rgba(102,126,234,0.13)", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>{ROLE_LABELS[m.role]}</span>
                </div>
              ))}
            </div>
            <div>
              <h4 style={{ fontSize: 14, color: "var(--gold)", marginBottom: 8 }}>新人 ({trainees.length})</h4>
              {loading ? <div style={{ color: "var(--text3)" }}>載入中...</div> : trainees.length === 0 ? (
                <div style={{ color: "var(--text3)", fontSize: 13, padding: 16, background: "var(--card)", borderRadius: 10 }}>尚無新人。新人註冊後會自動出現在這裡</div>
              ) : trainees.map((t) => (
                <div key={t.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{t.email}</div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--gold)", background: "rgba(251,191,36,0.13)", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>業務人員</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewMode === "feedback" && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>每日回饋紀錄</h3>

          {/* Brand Filter */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            <button onClick={() => { setFeedbackBrand("all"); setFeedbackFilter(""); }} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: feedbackBrand === "all" ? "2px solid var(--accent)" : "1px solid var(--border)", background: feedbackBrand === "all" ? withAlpha("var(--accent)", 0.1) : "var(--bg2)", color: feedbackBrand === "all" ? "var(--accent)" : "var(--text3)" }}>全部品牌</button>
            {[
              { id: "nschool", name: "nSchool", color: "#feca57" },
              { id: "ooschool", name: "OOschool", color: "#4F46E5" },
              { id: "xuemi", name: "XUEMI", color: "#7c6cf0" },
              { id: "aischool", name: "AIschool", color: "#10B981" },
            ].map(b => (
              <button key={b.id} onClick={() => { setFeedbackBrand(b.id); setFeedbackFilter(""); }}
                style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  border: feedbackBrand === b.id ? `2px solid ${b.color}` : "1px solid var(--border)",
                  background: feedbackBrand === b.id ? withAlpha(b.color, 0.1) : "var(--bg2)",
                  color: feedbackBrand === b.id ? b.color : "var(--text3)" }}>
                {b.name} ({feedbacks.filter(f => users.find(x => x.email === f.trainee_email)?.brand === b.id).length})
              </button>
            ))}
          </div>

          {/* Feedback Stats Summary */}
          {brandFilteredFeedbacks.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "回饋筆數", value: brandFilteredFeedbacks.length, icon: "📝" },
                  { label: "回饋人數", value: fbUniqueTrainees.length, icon: "👥" },
                  { label: "總撥打", value: fbTotalCalls, icon: "📞" },
                  { label: "總邀約", value: fbTotalInvites, icon: "📋" },
                  { label: "平均心情", value: fbAvgMood ? `${fbAvgMood}/5` : "—", icon: "😊" },
                ].map(s => (
                  <div key={s.label} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{s.label}</div>
                  </div>
                ))}
              </div>
          )}

          {/* Person Filter */}
          {brandFilteredFeedbacks.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <select value={feedbackFilter} onChange={e => setFeedbackFilter(e.target.value)} style={{ ...inputStyle, maxWidth: 300 }}>
                <option value="">全部人員</option>
                {[...new Set(brandFilteredFeedbacks.map(f => f.trainee_email))].map(email => {
                  const u = users.find(x => x.email === email);
                  return <option key={email} value={email}>{u ? `${u.name} (${BRAND_LABELS[u.brand] || u.brand})` : email}</option>;
                })}
              </select>
            </div>
          )}

          {filteredFeedbacks.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
              <div>尚無回饋紀錄</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>新人下班後填寫每日回饋，或師父填寫 1:1 回饋後，紀錄會顯示在這裡</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredFeedbacks.map((f) => {
                const MOOD_EMOJIS = ["", "😫", "😕", "😐", "🙂", "🔥"];
                const trainee = users.find(u => u.email === f.trainee_email);
                return (
                  <div key={f.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600 }}>{trainee?.name || f.trainee_email}</span>
                        {trainee?.brand && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 5, fontWeight: 600, background: "rgba(102,126,234,0.1)", color: "var(--accent)" }}>{BRAND_LABELS[trainee.brand] || trainee.brand}</span>}
                        <span style={{ color: "var(--text3)", fontSize: 12 }}>Day {f.day} · {f.date}</span>
                        {f.mood && <span style={{ fontSize: 16 }} title={`心情 ${f.mood}/5`}>{MOOD_EMOJIS[f.mood] || ""}</span>}
                      </div>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: "var(--accent)", fontWeight: 700 }}>{f.actual_calls} 通</span>
                        <span style={{ color: "var(--text3)", marginLeft: 8 }}>邀約 {f.invites} · Demo {f.demos}</span>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 12 }}>
                      <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ color: "var(--green)", fontWeight: 600, marginBottom: 2 }}>✅ 優點 1</div>
                        <div style={{ color: "var(--text2)" }}>{f.strength_1 || "—"}</div>
                      </div>
                      <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ color: "var(--green)", fontWeight: 600, marginBottom: 2 }}>✅ 優點 2</div>
                        <div style={{ color: "var(--text2)" }}>{f.strength_2 || "—"}</div>
                      </div>
                      <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ color: "var(--gold)", fontWeight: 600, marginBottom: 2 }}>💡 改善</div>
                        <div style={{ color: "var(--text2)" }}>{f.improvement || "—"}</div>
                      </div>
                    </div>
                    {f.notes && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "var(--text3)", background: "var(--bg2)", borderRadius: 8, padding: "6px 10px" }}>
                        備註：{f.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Approvals Tab ─────────────────────────────────────────────────────────

function ApprovalsTab({ token }: { token: string }) {
  const [approvals, setApprovals] = useState<Array<{ id: string; type: string; action: string; submitted_by: string; created_at: string; status: string; review_note: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/approvals?status=all", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setApprovals(d.approvals || []))
      .catch(() => setApprovals([]))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAction = async (id: string, status: "approved" | "rejected") => {
    await fetch("/api/admin/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, status, reviewed_by: "admin" }),
    });
    // Refresh
    const res = await fetch("/api/admin/approvals?status=all", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    setApprovals(res.approvals || []);
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>載入中...</div>;

  const pending = approvals.filter((a) => a.status === "pending");
  const processed = approvals.filter((a) => a.status !== "pending");

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>審核中心</h2>

      {pending.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--gold)", marginBottom: 12 }}>待審核 ({pending.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pending.map((a) => (
              <div key={a.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{a.action || a.type}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>提交者：{a.submitted_by} · {new Date(a.created_at).toLocaleDateString("zh-TW")}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleAction(a.id, "approved")} style={{ background: "var(--green)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>批准</button>
                  <button onClick={() => handleAction(a.id, "rejected")} style={{ background: "var(--red)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>拒絕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {processed.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text2)", marginBottom: 12 }}>已處理 ({processed.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: 0.7 }}>
            {processed.slice(0, 20).map((a) => (
              <div key={a.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{a.action || a.type}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>{a.submitted_by}</div>
                </div>
                <span style={{
                  background: a.status === "approved" ? "#22c55e22" : "#f8717122",
                  color: a.status === "approved" ? "var(--green)" : "var(--red)",
                  padding: "2px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                }}>
                  {a.status === "approved" ? "已批准" : "已拒絕"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {approvals.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>目前沒有審核項目</div>
      )}
    </div>
  );
}

/* ─── System Control Tab ─────────────────────────────────────────── */

interface SystemSetting { key: string; value: string; description: string; updated_at: string; }
interface AnnouncementItem { id: string; title: string; content: string; type: string; is_pinned: boolean; created_at: string; }

interface WorkScheduleData {
  type: string;
  label: string;
  startTime: string;
  endTime: string;
  workDays: number[];
}

function SystemTab() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState("info");
  const [newPinned, setNewPinned] = useState(false);
  const [cronResult, setCronResult] = useState<string | null>(null);
  const [cronRunning, setCronRunning] = useState(false);
  const [schedules, setSchedules] = useState<Record<string, WorkScheduleData>>({});
  // Cohort management
  const [cohortName, setCohortName] = useState("");
  const [cohortDate, setCohortDate] = useState("");

  const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

  const loadData = useCallback(async () => {
    try {
      const [settingsRes, announcementsRes, scheduleRes] = await Promise.all([
        fetch("/api/admin/settings"),
        fetch("/api/announcements"),
        fetch("/api/work-schedule"),
      ]);
      if (settingsRes.ok) { const d = await settingsRes.json(); setSettings(d.settings || []); }
      if (announcementsRes.ok) { const d = await announcementsRes.json(); setAnnouncements(d.announcements || []); }
      if (scheduleRes.ok) { const d = await scheduleRes.json(); if (d.schedules) setSchedules(d.schedules); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const updateSetting = async (key: string, value: string) => {
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: JSON.parse(value), updated_by: "admin" }),
    });
    loadData();
  };

  const createAnnouncement = async () => {
    if (!newTitle || !newContent) return;
    await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, content: newContent, type: newType, is_pinned: newPinned, created_by: "admin" }),
    });
    setNewTitle(""); setNewContent(""); setNewPinned(false);
    loadData();
  };

  const triggerCron = async (endpoint: string) => {
    setCronRunning(true); setCronResult(null);
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      setCronResult(JSON.stringify(data, null, 2));
    } catch (err) { setCronResult("Error: " + String(err)); }
    setCronRunning(false);
  };

  const settingLabels: Record<string, { label: string; type: "toggle" | "number" | "date" }> = {
    cohort_start_date: { label: "梯次開訓日期", type: "date" },
    auto_article_enabled: { label: "AI 自動文章生成", type: "toggle" },
    auto_quiz_enabled: { label: "AI 每日自動測驗", type: "toggle" },
    auto_notification_enabled: { label: "AI 異常警報通知", type: "toggle" },
    auto_weekly_report_enabled: { label: "AI 週報自動生成", type: "toggle" },
    inactive_days_threshold: { label: "未登入警報天數", type: "number" },
    low_kpi_threshold: { label: "KPI 低標（通數）", type: "number" },
  };

  // Pre-compute cohort info (avoid IIFE in JSX)
  const cohortSetting = settings.find(s => s.key === "cohort_start_date");
  const cohortCurrentVal = cohortSetting ? (typeof cohortSetting.value === "string" ? cohortSetting.value.replace(/"/g, "") : String(cohortSetting.value)) : "";
  const cohortDayNum = cohortCurrentVal ? Math.max(1, Math.ceil((Date.now() - new Date(cohortCurrentVal).getTime()) / 86400000)) : null;

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>⚙️ 系統控制中心</h2>

      {/* AI Automation Toggles */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🤖 AI 自動化開關</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {settings.map(s => {
            const info = settingLabels[s.key];
            if (!info) return null;
            const val = typeof s.value === "string" ? s.value : JSON.stringify(s.value);
            return (
              <div key={s.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{info.label}</div>
                  <div style={{ fontSize: 10, color: "var(--text3)" }}>{s.description}</div>
                </div>
                {info.type === "toggle" ? (
                  <button
                    onClick={() => updateSetting(s.key, val === "true" ? '"false"' : '"true"')}
                    style={{
                      width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer", position: "relative",
                      background: val === "true" ? "var(--accent)" : "var(--border)", transition: "all 0.3s",
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: 10, background: "white", position: "absolute", top: 3,
                      left: val === "true" ? 25 : 3, transition: "all 0.3s",
                    }} />
                  </button>
                ) : info.type === "date" ? (
                  <input type="date" value={val.replace(/"/g, "")} onChange={e => updateSetting(s.key, `"${e.target.value}"`)}
                    style={{ width: 150, padding: "4px 8px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 13 }}
                  />
                ) : (
                  <input type="number" value={val.replace(/"/g, "")} onChange={e => updateSetting(s.key, `"${e.target.value}"`)}
                    style={{ width: 60, padding: "4px 8px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", textAlign: "center" as const, fontSize: 14 }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Work Schedule Management */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🕐 上下班時間設定</h3>
        <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 16 }}>設定各組別的上班時間、下班時間和工作日。下班後系統會強制彈出每日回饋表單。</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {Object.entries(schedules).map(([key, sched]) => (
            <div key={key} style={{ padding: 16, background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: key === "finance" ? "#feca57" : "var(--accent)" }}>
                {key === "finance" ? "💰 財經組（nSchool）" : "💻 職能組（無限/學米/AI未來）"}
              </div>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--text3)", display: "block", marginBottom: 4 }}>上班時間</label>
                  <input type="time" value={sched.startTime}
                    onChange={e => {
                      const updated = { ...schedules, [key]: { ...sched, startTime: e.target.value } };
                      setSchedules(updated);
                      fetch("/api/work-schedule", { method: "PATCH", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: key, startTime: e.target.value, endTime: sched.endTime, workDays: sched.workDays, updated_by: "admin" }) });
                    }}
                    style={{ padding: "6px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--text3)", display: "block", marginBottom: 4 }}>下班時間</label>
                  <input type="time" value={sched.endTime}
                    onChange={e => {
                      const updated = { ...schedules, [key]: { ...sched, endTime: e.target.value } };
                      setSchedules(updated);
                      fetch("/api/work-schedule", { method: "PATCH", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: key, startTime: sched.startTime, endTime: e.target.value, workDays: sched.workDays, updated_by: "admin" }) });
                    }}
                    style={{ padding: "6px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 14 }}
                  />
                </div>
              </div>
              <label style={{ fontSize: 11, color: "var(--text3)", display: "block", marginBottom: 6 }}>工作日</label>
              <div style={{ display: "flex", gap: 4 }}>
                {DAY_LABELS.map((label, dayIdx) => {
                  const isActive = sched.workDays.includes(dayIdx);
                  return (
                    <button key={dayIdx} onClick={() => {
                      const newDays = isActive ? sched.workDays.filter(d => d !== dayIdx) : [...sched.workDays, dayIdx].sort();
                      const updated = { ...schedules, [key]: { ...sched, workDays: newDays } };
                      setSchedules(updated);
                      fetch("/api/work-schedule", { method: "PATCH", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: key, startTime: sched.startTime, endTime: sched.endTime, workDays: newDays, updated_by: "admin" }) });
                    }}
                    style={{
                      width: 32, height: 32, borderRadius: 8, border: isActive ? "2px solid var(--accent)" : "1px solid var(--border)",
                      background: isActive ? "var(--accent)" : "transparent", color: isActive ? "white" : "var(--text3)",
                      fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                    }}>{label}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cohort Management */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🎓 梯次管理</h3>
        <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 16 }}>設定新訓梯次的開訓日期。目前開訓日期會影響所有新人的「訓練第 N 天」計算。</p>
        {/* Current cohort date */}
            <div>
              <div style={{ display: "flex", gap: 12, alignItems: "end", marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>目前開訓日期</label>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)" }}>{cohortCurrentVal || "未設定"}</div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>今天是訓練第幾天</label>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--teal)" }}>
                    {cohortDayNum ? `Day ${cohortDayNum}` : "—"}
                  </div>
                </div>
              </div>
              {/* Create new cohort */}
              <div style={{ background: "var(--bg2)", borderRadius: 12, padding: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>新增 / 更新梯次</h4>
                <div style={{ display: "flex", gap: 12, alignItems: "end" }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>梯次名稱（備註用）</label>
                    <input value={cohortName} onChange={e => setCohortName(e.target.value)} placeholder="例：第 5 梯" style={{ ...inputStyle, width: 200 }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>開訓日期 *</label>
                    <input type="date" value={cohortDate} onChange={e => setCohortDate(e.target.value)} style={{ ...inputStyle, width: 180 }} />
                  </div>
                  <button onClick={async () => {
                    if (!cohortDate) return;
                    await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ key: "cohort_start_date", value: cohortDate, description: cohortName ? `梯次：${cohortName}` : "開訓日期", updated_by: "admin" }) });
                    setCohortName(""); setCohortDate("");
                    loadData();
                  }} disabled={!cohortDate} style={{ background: cohortDate ? "linear-gradient(135deg, var(--accent), var(--teal))" : "var(--border)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: cohortDate ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}>
                    設定開訓日
                  </button>
                </div>
              </div>
            </div>
      </div>

      {/* Manual Cron Trigger */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🔧 手動觸發</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          <button onClick={() => triggerCron("/api/cron/update-articles")} disabled={cronRunning}
            style={{ padding: "8px 16px", background: "var(--accent)", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, opacity: cronRunning ? 0.5 : 1 }}>
            📰 生成文章
          </button>
          <button onClick={() => triggerCron("/api/cron/daily-automation")} disabled={cronRunning}
            style={{ padding: "8px 16px", background: "var(--teal)", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, opacity: cronRunning ? 0.5 : 1 }}>
            🤖 執行每日自動化
          </button>
        </div>
        {cronResult && (
          <pre style={{ marginTop: 12, padding: 12, background: "var(--bg)", borderRadius: 8, fontSize: 11, color: "var(--text2)", overflowX: "auto" as const, maxHeight: 200 }}>
            {cronResult}
          </pre>
        )}
      </div>

      {/* Announcement Management */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📢 公告管理</h3>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 16 }}>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="公告標題"
            style={{ ...inputStyle, padding: "8px 12px" }} />
          <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="公告內容"
            style={{ ...inputStyle, padding: "8px 12px", minHeight: 80, resize: "vertical" as const }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={newType} onChange={e => setNewType(e.target.value)}
              style={{ ...inputStyle, width: "auto", padding: "6px 12px" }}>
              <option value="info">一般公告</option>
              <option value="important">重要公告</option>
              <option value="update">系統更新</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--text2)", cursor: "pointer" }}>
              <input type="checkbox" checked={newPinned} onChange={e => setNewPinned(e.target.checked)} /> 置頂
            </label>
            <button onClick={createAnnouncement}
              style={{ marginLeft: "auto", padding: "8px 20px", background: "var(--accent)", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              發布
            </button>
          </div>
        </div>
        {/* Existing announcements */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {announcements.map(a => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
              <span>{a.is_pinned ? "📌" : "📢"}</span>
              <span style={{ flex: 1, fontSize: 13 }}>{a.title}</span>
              <span style={{ fontSize: 10, color: "var(--text3)" }}>{new Date(a.created_at).toLocaleDateString("zh-TW")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
