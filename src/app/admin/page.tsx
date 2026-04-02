"use client";

import { useState, useEffect, useCallback } from "react";
import { modules } from "@/data/modules";
import { trainingVideos, videoCategories } from "@/data/videos";

// ─── Types ─────────────────────────────────────────────────────────────────

type AdminTab = "dashboard" | "users" | "content" | "videos" | "mentorship" | "approvals";

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
  practice_task_override: string | null; updated_at: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const BRAND_LABELS: Record<string, string> = {
  nschool: "nSchool 財經", xuemi: "XUEMI 學米", ooschool: "OOschool 無限",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "超級管理員", brand_manager: "品牌主管", team_leader: "老祖宗",
  trainer: "武公", reserve_cadre: "師傅", mentor: "師傅（帶訓）", sales_rep: "業務人員",
};

const MODULE_TITLES: Record<number, string> = {
  1: "新人報到｜開發學習", 2: "架構對練｜後台學習", 3: "正式上機｜開發實戰",
  4: "學習 Demo", 5: "持續開發｜流程整合", 6: "進階開發｜架構精進",
  7: "Demo 實戰練習", 8: "綜合實戰", 9: "實戰考核",
};

const inputStyle: React.CSSProperties = {
  width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10,
  padding: "10px 14px", color: "var(--text)", fontSize: 14, outline: "none", boxSizing: "border-box",
};

// ─── Main Component ────────────────────────────────────────────────────────

export default function AdminPage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [tab, setTab] = useState<AdminTab>("dashboard");

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
    { id: "dashboard", label: "學員進度", icon: "📊" },
    { id: "users", label: "用戶管理", icon: "👥" },
    { id: "content", label: "內容管理", icon: "📝" },
    { id: "videos", label: "影片管理", icon: "🎬" },
    { id: "mentorship", label: "師徒管理", icon: "🤝" },
    { id: "approvals", label: "審核中心", icon: "✅" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {/* Sidebar */}
      <aside style={{ width: 240, background: "var(--bg2)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 10 }}>
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
      <main style={{ flex: 1, marginLeft: 240, padding: "28px 36px" }}>
        {tab === "dashboard" && <DashboardTab token={session.token} />}
        {tab === "users" && <UsersTab token={session.token} />}
        {tab === "content" && <ContentTab />}
        {tab === "videos" && <VideosTab token={session.token} />}
        {tab === "mentorship" && <MentorshipTab token={session.token} />}
        {tab === "approvals" && <ApprovalsTab token={session.token} />}
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
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "48px 40px", width: "100%", maxWidth: 420 }}>
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
          {error && <div style={{ background: "#f8717122", border: "1px solid #f8717144", borderRadius: 8, padding: "10px 14px", color: "#f87171", fontSize: 13 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ background: loading ? "var(--border)" : "linear-gradient(135deg, var(--accent), var(--teal))", color: "#fff", border: "none", borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", marginTop: 4 }}>
            {loading ? "登入中..." : "登入"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Dashboard Tab (學員進度) ──────────────────────────────────────────────

function DashboardTab({ token }: { token: string }) {
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandFilter, setBrandFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<EnrichedUser | null>(null);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/progress?brand=${brandFilter}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [token, brandFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = users.filter((u) => {
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Stats
  const totalUsers = users.length;
  const activeThisWeek = users.filter((u) => u.lastActivity && new Date(u.lastActivity) > new Date(Date.now() - 7 * 86400000)).length;
  const avgQuiz = users.filter((u) => u.avgQuizScore !== null).reduce((s, u) => s + (u.avgQuizScore || 0), 0) / Math.max(users.filter((u) => u.avgQuizScore !== null).length, 1);
  const avgSparring = users.filter((u) => u.avgSparringScore !== null).reduce((s, u) => s + (u.avgSparringScore || 0), 0) / Math.max(users.filter((u) => u.avgSparringScore !== null).length, 1);

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>學員進度總覽</h2>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "總人數", value: totalUsers, icon: "👥", color: "var(--accent)" },
          { label: "本週活躍", value: activeThisWeek, icon: "🔥", color: "var(--teal)" },
          { label: "平均測驗分", value: avgQuiz ? Math.round(avgQuiz) : "—", icon: "📝", color: "var(--gold)" },
          { label: "平均對練分", value: avgSparring ? Math.round(avgSparring) : "—", icon: "🎯", color: "var(--green)" },
        ].map((s) => (
          <div key={s.label} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20, background: s.color + "22", borderRadius: 8, padding: "4px 6px" }}>{s.icon}</span>
              <span style={{ color: "var(--text2)", fontSize: 13 }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋姓名或 Email..." style={{ ...inputStyle, maxWidth: 300 }} />
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} style={{ ...inputStyle, maxWidth: 200 }}>
          <option value="all">全部品牌</option>
          {Object.entries(BRAND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
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
                {["姓名", "品牌", "目前天數", "完成進度", "測驗分", "對練分", "影片", "通次", "最後活動"].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 12, color: "var(--text3)", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} onClick={() => setSelectedUser(u)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{u.email}</div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ background: "var(--accent)" + "22", color: "var(--accent)", padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
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
              ))}
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
    await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: userId, role }) });
    fetchUsers();
  };

  const toggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: userId, status: newStatus }) });
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
                    <span style={{ background: "var(--accent)22", color: "var(--accent)", padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{BRAND_LABELS[u.brand] || u.brand}</span>
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

// ─── Content Tab (內容管理) ────────────────────────────────────────────────

function ContentTab() {
  const [overrides, setOverrides] = useState<ModuleOverride[]>([]);
  const [editingModule, setEditingModule] = useState<number | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editKeyPoints, setEditKeyPoints] = useState("");
  const [editTips, setEditTips] = useState("");
  const [editTask, setEditTask] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/module-overrides").then((r) => r.json()).then((d) => setOverrides(d.overrides || []));
  }, []);

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
    const body: Record<string, unknown> = { moduleId: editingModule };
    if (editDesc) body.description = editDesc;
    if (editContent) body.content = editContent.split("\n").filter(Boolean);
    if (editKeyPoints) body.keyPoints = editKeyPoints.split("\n").filter(Boolean);
    if (editTips) body.trainerTips = editTips.split("\n").filter(Boolean);
    if (editTask) body.practiceTask = editTask;

    await fetch("/api/admin/module-overrides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const res = await fetch("/api/admin/module-overrides").then((r) => r.json());
    setOverrides(res.overrides || []);
    setEditingModule(null);
    setSaving(false);
  };

  const resetOverride = async (moduleId: number) => {
    await fetch(`/api/admin/module-overrides?moduleId=${moduleId}`, { method: "DELETE" });
    const res = await fetch("/api/admin/module-overrides").then((r) => r.json());
    setOverrides(res.overrides || []);
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>訓練內容管理</h2>
      <p style={{ color: "var(--text3)", fontSize: 14, marginBottom: 24 }}>編輯各天的訓練內容。修改後新人端會即時顯示更新內容。</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: 9 }, (_, i) => i + 1).map((day) => {
          const hasOverride = overrides.some((o) => o.module_id === day);
          return (
            <div key={day} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: hasOverride ? "var(--gold)" : "var(--accent)", color: hasOverride ? "#000" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>
                  {day}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Day {day} — {MODULE_TITLES[day]}</div>
                  {hasOverride && <div style={{ fontSize: 11, color: "var(--gold)" }}>已自訂內容</div>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => startEdit(day)} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  編輯
                </button>
                {hasOverride && (
                  <button onClick={() => resetOverride(day)} style={{ background: "var(--border)", color: "var(--text2)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>
                    重置
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
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
    </div>
  );
}

// ─── Videos Tab ────────────────────────────────────────────────────────────

interface DbVideo { id: string; title: string; category: string; brands: string[]; related_days: number[]; status: string; drive_file_id: string; description?: string }

function VideosTab({ token }: { token: string }) {
  const [dbVideos, setDbVideos] = useState<DbVideo[]>([]);
  const [loading, setLoading] = useState(true);
  // Step form state
  const [addStep, setAddStep] = useState(0); // 0=closed, 1=info, 2=brands, 3=days, 4=confirm
  const [newTitle, setNewTitle] = useState("");
  const [newDriveId, setNewDriveId] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newBrands, setNewBrands] = useState<string[]>([]);
  const [newDays, setNewDays] = useState<number[]>([]);
  // Filters
  const [filterBrand, setFilterBrand] = useState("all");
  // Editing
  const [editingVideo, setEditingVideo] = useState<string | null>(null);
  const [editBrands, setEditBrands] = useState<string[]>([]);
  const [editDays, setEditDays] = useState<number[]>([]);

  const BRAND_OPTIONS = [
    { id: "ooschool", name: "OOschool 無限", color: "#4F46E5" },
    { id: "xuemi", name: "XUEMI 學米", color: "#7c6cf0" },
    { id: "nschool", name: "nSchool 財經", color: "#feca57" },
    { id: "aischool", name: "AIschool AI", color: "#10B981" },
  ];

  const toggleArr = (arr: string[], item: string) => arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
  const toggleNum = (arr: number[], item: number) => arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item].sort((a, b) => a - b);

  const fetchVideos = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/videos", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setDbVideos((d.videos || []).map((v: DbVideo) => ({ ...v, brands: v.brands || [], related_days: v.related_days || [] }))))
      .catch(() => setDbVideos([]))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  const resetForm = () => { setAddStep(0); setNewTitle(""); setNewDriveId(""); setNewDescription(""); setNewBrands([]); setNewDays([]); };

  const addVideo = async () => {
    if (!newTitle || !newDriveId) return;
    await fetch("/api/admin/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: newTitle, drive_file_id: newDriveId, description: newDescription, status: "published", brands: newBrands, related_days: newDays }),
    });
    resetForm();
    fetchVideos();
  };

  const updateVideo = async (videoId: string, updates: Partial<DbVideo>) => {
    await fetch("/api/admin/videos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: videoId, ...updates }),
    });
    setEditingVideo(null);
    fetchVideos();
  };

  const deleteVideo = async (videoId: string) => {
    if (!confirm("確定要刪除這部影片嗎？")) return;
    await updateVideo(videoId, { status: "deleted" } as Partial<DbVideo>);
  };

  // Brand tag helper
  const BrandTags = ({ brands }: { brands: string[] }) => {
    if (!brands || brands.length === 0) return <span style={{ fontSize: 11, color: "var(--green)", background: "var(--green)15", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>全品牌</span>;
    return <>{brands.map((bid) => { const b = BRAND_OPTIONS.find(x => x.id === bid); return b ? <span key={bid} style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 5, background: `${b.color}18`, color: b.color }}>{b.name}</span> : null; })}</>;
  };

  const DayTags = ({ days }: { days: number[] }) => {
    if (!days || days.length === 0) return <span style={{ fontSize: 11, color: "var(--text3)" }}>未指定天數</span>;
    return <>{days.map(d => <span key={d} style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 5, background: "var(--accent)15", color: "var(--accent)" }}>Day {d}</span>)}</>;
  };

  // Filters
  const activeDbVideos = dbVideos.filter(v => v.status !== "deleted");
  const filteredStaticVideos = trainingVideos.filter(v => filterBrand === "all" || v.brands.length === 0 || v.brands.includes(filterBrand));
  const filteredDbVideos = activeDbVideos.filter(v => filterBrand === "all" || !v.brands || v.brands.length === 0 || v.brands.includes(filterBrand));
  const allBrandCount = (bid: string) => trainingVideos.filter(v => v.brands.length === 0 || v.brands.includes(bid)).length + activeDbVideos.filter(v => !v.brands || v.brands.length === 0 || v.brands.includes(bid)).length;

  // Group static by category
  const groupedVideos: Record<string, typeof trainingVideos> = {};
  for (const v of filteredStaticVideos) { if (!groupedVideos[v.category]) groupedVideos[v.category] = []; groupedVideos[v.category].push(v); }

  const stepLabel = ["", "Step 1：影片資訊", "Step 2：選擇品牌", "Step 3：選擇天數", "Step 4：確認送出"];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>影片管理</h2>
          <p style={{ color: "var(--text3)", fontSize: 13, marginTop: 4 }}>上傳影片 → 設定品牌 → 指定天數 → 發佈</p>
        </div>
        <button onClick={() => addStep === 0 ? setAddStep(1) : resetForm()} style={{ background: addStep > 0 ? "var(--red)" : "linear-gradient(135deg, var(--accent), var(--teal))", color: "#fff", border: "none", borderRadius: 10, padding: "8px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          {addStep > 0 ? "取消" : "+ 新增影片"}
        </button>
      </div>

      {/* Step-by-step Add Form */}
      {addStep > 0 && (
        <div style={{ background: "var(--card)", border: "2px solid var(--accent)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
          {/* Progress bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20 }}>
            {[1, 2, 3, 4].map(s => (
              <div key={s} style={{ flex: 1, display: "flex", alignItems: "center" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, background: addStep >= s ? "var(--accent)" : "var(--border)", color: addStep >= s ? "#fff" : "var(--text3)" }}>{s}</div>
                {s < 4 && <div style={{ flex: 1, height: 2, background: addStep > s ? "var(--accent)" : "var(--border)" }} />}
              </div>
            ))}
          </div>
          <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>{stepLabel[addStep]}</h4>

          {/* Step 1: Video Info */}
          {addStep === 1 && (
            <div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6 }}>影片標題 *</label>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} style={inputStyle} placeholder="例：學米 DEMO 流程教學" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6 }}>Google Drive 檔案 ID *</label>
                <input value={newDriveId} onChange={e => setNewDriveId(e.target.value)} style={inputStyle} placeholder="貼上 Google Drive 檔案 ID 或完整連結" />
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>從 Google Drive 分享連結中取得，格式如：1kn-z8VXrTFhc0J5mPTlSj6IhtUBovT2r</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6 }}>影片描述（選填）</label>
                <input value={newDescription} onChange={e => setNewDescription(e.target.value)} style={inputStyle} placeholder="簡短說明這部影片的內容" />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button disabled={!newTitle || !newDriveId} onClick={() => setAddStep(2)} style={{ background: newTitle && newDriveId ? "var(--accent)" : "var(--border)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: newTitle && newDriveId ? "pointer" : "not-allowed" }}>
                  下一步：選擇品牌 →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Brand Selection */}
          {addStep === 2 && (
            <div>
              <p style={{ color: "var(--text3)", fontSize: 13, marginBottom: 12 }}>選擇哪些品牌的業務人員可以看到這部影片。不選則全品牌可見。</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
                {BRAND_OPTIONS.map(b => (
                  <button key={b.id} onClick={() => setNewBrands(toggleArr(newBrands, b.id))}
                    style={{ padding: "14px 16px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10,
                      border: newBrands.includes(b.id) ? `2px solid ${b.color}` : "2px solid var(--border)",
                      background: newBrands.includes(b.id) ? `${b.color}15` : "var(--bg2)",
                      color: newBrands.includes(b.id) ? b.color : "var(--text3)" }}>
                    <span style={{ fontSize: 18 }}>{newBrands.includes(b.id) ? "✅" : "⬜"}</span>
                    {b.name}
                  </button>
                ))}
              </div>
              <div style={{ padding: "10px 14px", background: "var(--bg2)", borderRadius: 8, marginBottom: 16, fontSize: 12, color: "var(--text2)" }}>
                目前設定：{newBrands.length === 0 ? "🌐 全品牌可見" : newBrands.map(bid => BRAND_OPTIONS.find(b => b.id === bid)?.name).join("、")}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button onClick={() => setAddStep(1)} style={{ background: "var(--bg2)", color: "var(--text2)", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer" }}>← 上一步</button>
                <button onClick={() => setAddStep(3)} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  下一步：選擇天數 →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Day Selection */}
          {addStep === 3 && (
            <div>
              <p style={{ color: "var(--text3)", fontSize: 13, marginBottom: 12 }}>選擇這部影片要出現在第幾天的訓練課程中。可多選。不選則只出現在影片庫。</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
                {Array.from({ length: 9 }, (_, i) => i + 1).map(d => (
                  <button key={d} onClick={() => setNewDays(toggleNum(newDays, d))}
                    style={{ padding: "12px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
                      border: newDays.includes(d) ? "2px solid var(--accent)" : "2px solid var(--border)",
                      background: newDays.includes(d) ? "var(--accent)15" : "var(--bg2)",
                      color: newDays.includes(d) ? "var(--accent)" : "var(--text3)" }}>
                    {newDays.includes(d) ? "✅ " : ""}Day {d}
                    <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2 }}>{MODULE_TITLES[d] || ""}</div>
                  </button>
                ))}
              </div>
              <div style={{ padding: "10px 14px", background: "var(--bg2)", borderRadius: 8, marginBottom: 16, fontSize: 12, color: "var(--text2)" }}>
                目前設定：{newDays.length === 0 ? "📚 僅影片庫（不綁定天數）" : `Day ${newDays.join(", ")}`}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button onClick={() => setAddStep(2)} style={{ background: "var(--bg2)", color: "var(--text2)", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer" }}>← 上一步</button>
                <button onClick={() => setAddStep(4)} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  下一步：確認 →
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {addStep === 4 && (
            <div>
              <div style={{ background: "var(--bg2)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", fontSize: 13 }}>
                  <span style={{ color: "var(--text3)" }}>標題</span><span style={{ fontWeight: 600 }}>{newTitle}</span>
                  <span style={{ color: "var(--text3)" }}>Drive ID</span><span style={{ fontFamily: "monospace", fontSize: 12 }}>{newDriveId}</span>
                  <span style={{ color: "var(--text3)" }}>描述</span><span>{newDescription || "（無）"}</span>
                  <span style={{ color: "var(--text3)" }}>品牌</span><span>{newBrands.length === 0 ? "🌐 全品牌可見" : newBrands.map(bid => BRAND_OPTIONS.find(b => b.id === bid)?.name).join("、")}</span>
                  <span style={{ color: "var(--text3)" }}>天數</span><span>{newDays.length === 0 ? "📚 僅影片庫" : `Day ${newDays.join(", ")}`}</span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button onClick={() => setAddStep(3)} style={{ background: "var(--bg2)", color: "var(--text2)", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer" }}>← 上一步</button>
                <button onClick={addVideo} style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))", color: "#fff", border: "none", borderRadius: 10, padding: "10px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  ✓ 確認發佈
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Brand Filter Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", cursor: "pointer", outline: filterBrand === "all" ? "2px solid var(--accent)" : "none" }} onClick={() => setFilterBrand("all")}>
          <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>全部影片</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>{trainingVideos.length + activeDbVideos.length}</div>
        </div>
        {BRAND_OPTIONS.map(b => (
          <div key={b.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", cursor: "pointer", outline: filterBrand === b.id ? `2px solid ${b.color}` : "none" }} onClick={() => setFilterBrand(filterBrand === b.id ? "all" : b.id)}>
            <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>{b.name}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: b.color }}>{allBrandCount(b.id)}</div>
          </div>
        ))}
      </div>

      {/* DB Custom Videos - show first since these are admin-managed */}
      {filteredDbVideos.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>📌 後台管理影片</h3>
            <span style={{ fontSize: 12, color: "var(--text3)" }}>({filteredDbVideos.length} 部)</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {filteredDbVideos.map(v => (
              <div key={v.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>🎬 {v.title}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ background: v.status === "published" ? "var(--green)22" : "var(--gold)22", color: v.status === "published" ? "var(--green)" : "var(--gold)", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                      {v.status === "published" ? "已發佈" : "草稿"}
                    </span>
                    <button onClick={() => deleteVideo(v.id)} style={{ fontSize: 11, color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}>刪除</button>
                  </div>
                </div>
                {v.description && <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6 }}>{v.description}</div>}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "var(--text3)", marginRight: 2 }}>品牌：</span><BrandTags brands={v.brands} />
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 10, color: "var(--text3)", marginRight: 2 }}>天數：</span><DayTags days={v.related_days} />
                </div>

                {/* Edit button */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: editingVideo === v.id ? 8 : 0 }}>
                  <button onClick={() => { if (editingVideo === v.id) { setEditingVideo(null); } else { setEditingVideo(v.id); setEditBrands(v.brands || []); setEditDays(v.related_days || []); } }}
                    style={{ fontSize: 12, color: "var(--accent)", background: "var(--accent)10", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontWeight: 600 }}>
                    {editingVideo === v.id ? "取消編輯" : "✏️ 編輯設定"}
                  </button>
                  {v.drive_file_id && (
                    <a href={`https://drive.google.com/file/d/${v.drive_file_id}/view`} target="_blank" rel="noopener" style={{ color: "var(--accent)", fontSize: 11, textDecoration: "none" }}>開啟影片 ↗</a>
                  )}
                </div>

                {/* Edit panel */}
                {editingVideo === v.id && (
                  <div style={{ background: "var(--bg2)", borderRadius: 10, padding: 14 }}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>品牌設定（不選 = 全品牌）</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {BRAND_OPTIONS.map(b => (
                          <button key={b.id} onClick={() => setEditBrands(toggleArr(editBrands, b.id))}
                            style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                              border: editBrands.includes(b.id) ? `2px solid ${b.color}` : "2px solid var(--border)",
                              background: editBrands.includes(b.id) ? `${b.color}15` : "transparent",
                              color: editBrands.includes(b.id) ? b.color : "var(--text3)" }}>
                            {editBrands.includes(b.id) ? "✓ " : ""}{b.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>天數設定（不選 = 僅影片庫）</div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {Array.from({ length: 9 }, (_, i) => i + 1).map(d => (
                          <button key={d} onClick={() => setEditDays(toggleNum(editDays, d))}
                            style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                              border: editDays.includes(d) ? "2px solid var(--accent)" : "2px solid var(--border)",
                              background: editDays.includes(d) ? "var(--accent)15" : "transparent",
                              color: editDays.includes(d) ? "var(--accent)" : "var(--text3)" }}>
                            {editDays.includes(d) ? "✓ " : ""}Day {d}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => updateVideo(v.id, { brands: editBrands, related_days: editDays } as Partial<DbVideo>)}
                      style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      儲存設定
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredDbVideos.length === 0 && (
        <div style={{ textAlign: "center", padding: 32, color: "var(--text3)", fontSize: 13, background: "var(--card)", borderRadius: 12, border: "1px solid var(--border)", marginBottom: 28 }}>
          尚無後台管理影片，點擊上方「+ 新增影片」按步驟新增
        </div>
      )}

      {/* Static Videos (read-only reference) */}
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>📋 系統內建影片（唯讀）</h3>
        <p style={{ color: "var(--text3)", fontSize: 12 }}>以下影片為系統預設，品牌與天數已固定。如需新增同類影片請用上方新增功能。</p>
      </div>
      {Object.entries(groupedVideos).map(([catId, videos]) => {
        const cat = videoCategories.find(c => c.id === catId);
        return (
          <div key={catId} style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{cat ? `${cat.icon} ${cat.title}` : catId}</span>
              <span style={{ fontSize: 12, color: "var(--text3)" }}>({videos.length})</span>
              {cat && cat.brands.length > 0 && <BrandTags brands={cat.brands} />}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {videos.map(v => (
                <div key={v.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, opacity: 0.85 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{v.type === "slides" ? "📊 " : "🎬 "}{v.title}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", fontSize: 10 }}>
                    <BrandTags brands={v.brands} />
                    <span style={{ color: "var(--text3)", marginLeft: "auto" }}>Day {v.relatedDays.join(", ")} · {v.size}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
  const [feedbacks, setFeedbacks] = useState<Array<{ id: string; trainee_email: string; mentor_email: string; day: number; date: string; actual_calls: number; call_target: number; invites: number; demos: number; strength_1: string; strength_2: string; improvement: string }>>([]);
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
      fetch("/api/mentor-feedback", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({ feedbacks: [] })),
      loadPairs(),
    ]).then(([userData, fbData]) => {
      setUsers(userData.users || []);
      setFeedbacks(fbData.feedbacks || []);
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
                <span style={{ fontSize: 12, color: "var(--accent)", background: "var(--accent)22", padding: "4px 10px", borderRadius: 6, fontWeight: 600, whiteSpace: "nowrap" }}>{s.freq}</span>
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
                          <span style={{ fontSize: 10, color: "var(--gold)", background: "var(--gold)18", padding: "1px 6px", borderRadius: 4 }}>👑 據點主管</span>
                        </div>
                      )}
                      {p.manager_name && <div style={{ width: 2, height: 12, background: "var(--border)", marginLeft: 13 }} />}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, var(--accent), #5b4ec7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{p.mentor_name?.charAt(0) || "?"}</div>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{p.mentor_name || "未知"}</span>
                        <span style={{ fontSize: 10, color: "var(--accent-light)", background: "var(--accent)18", padding: "1px 6px", borderRadius: 4 }}>🛡️ 師父</span>
                      </div>
                      <div style={{ width: 2, height: 12, background: "var(--border)", marginLeft: 13 }} />
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, var(--teal), #2a9d8f)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{p.trainee_name?.charAt(0) || "?"}</div>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{p.trainee_name || "未知"}</span>
                        <span style={{ fontSize: 10, color: "var(--teal)", background: "var(--teal)18", padding: "1px 6px", borderRadius: 4 }}>🌱 新人</span>
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
                      <button onClick={() => handleStatusChange(p.id, "graduated")} style={{ flex: 1, padding: "6px 0", background: "var(--green)18", color: "var(--green)", border: "1px solid var(--green)40", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>🎓 結業</button>
                      <button onClick={() => handleStatusChange(p.id, "dissolved")} style={{ flex: 1, padding: "6px 0", background: "var(--red)18", color: "var(--red)", border: "1px solid var(--red)40", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>解除</button>
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
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 600, background: p.status === "graduated" ? "var(--green)22" : "var(--red)22", color: p.status === "graduated" ? "var(--green)" : "var(--red)" }}>
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
                  <span style={{ fontSize: 11, color: "var(--accent)", background: "var(--accent)22", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>{ROLE_LABELS[m.role]}</span>
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
                  <span style={{ fontSize: 11, color: "var(--gold)", background: "var(--gold)22", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>業務人員</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewMode === "feedback" && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>每日回饋紀錄</h3>
          {feedbacks.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
              <div>尚無回饋紀錄</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>師父在新人頁面填寫每日 1:1 回饋後，紀錄會顯示在這裡</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {feedbacks.map((f) => (
                <div key={f.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>Day {f.day}</span>
                      <span style={{ color: "var(--text3)", fontSize: 12, marginLeft: 8 }}>{f.date}</span>
                    </div>
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: f.actual_calls >= f.call_target ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
                        {f.actual_calls}/{f.call_target} 通
                      </span>
                      <span style={{ color: "var(--text3)", marginLeft: 8 }}>邀約 {f.invites} · Demo {f.demos}</span>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 12 }}>
                    <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ color: "var(--green)", fontWeight: 600, marginBottom: 2 }}>✅ 優點 1</div>
                      <div style={{ color: "var(--text2)" }}>{f.strength_1}</div>
                    </div>
                    <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ color: "var(--green)", fontWeight: 600, marginBottom: 2 }}>✅ 優點 2</div>
                      <div style={{ color: "var(--text2)" }}>{f.strength_2}</div>
                    </div>
                    <div style={{ background: "var(--bg2)", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ color: "var(--gold)", fontWeight: 600, marginBottom: 2 }}>💡 建議</div>
                      <div style={{ color: "var(--text2)" }}>{f.improvement}</div>
                    </div>
                  </div>
                </div>
              ))}
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
