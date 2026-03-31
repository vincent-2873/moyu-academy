"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────

type AdminTab = "dashboard" | "users" | "content" | "videos" | "approvals";

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
  super_admin: "超級管理員", brand_manager: "品牌主管", team_leader: "業務主管", trainer: "培訓師", sales_rep: "業務人員",
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

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>用戶管理</h2>
      <div style={{ marginBottom: 16 }}>
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} style={{ ...inputStyle, maxWidth: 200 }}>
          <option value="all">全部品牌</option>
          {Object.entries(BRAND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>載入中...</div> : (
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
              {users.map((u) => (
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

function VideosTab({ token }: { token: string }) {
  const [videos, setVideos] = useState<Array<{ id: string; title: string; category: string; brands: string[]; status: string; drive_file_id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDriveId, setNewDriveId] = useState("");
  const [newCategory, setNewCategory] = useState("新人培訓");

  const fetchVideos = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/videos", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setVideos(d.videos || []))
      .catch(() => setVideos([]))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  const addVideo = async () => {
    if (!newTitle || !newDriveId) return;
    await fetch("/api/admin/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: newTitle, url: newDriveId, category: newCategory, status: "published", brands: [] }),
    });
    setNewTitle(""); setNewDriveId(""); setShowAdd(false);
    fetchVideos();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>影片管理</h2>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: "linear-gradient(135deg, var(--accent), var(--teal))", color: "#fff", border: "none", borderRadius: 10, padding: "8px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          + 新增影片
        </button>
      </div>

      {showAdd && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6 }}>影片標題</label>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={inputStyle} placeholder="例：後台操作教學" />
            </div>
            <div>
              <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6 }}>Google Drive 檔案 ID</label>
              <input value={newDriveId} onChange={(e) => setNewDriveId(e.target.value)} style={inputStyle} placeholder="貼上 Drive 檔案 ID" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "end" }}>
            <div>
              <label style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6 }}>分類</label>
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ ...inputStyle, maxWidth: 200 }}>
                {["新人培訓", "銷售技巧", "產品知識", "進階課程"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button onClick={addVideo} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>新增</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>載入中...</div> : videos.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>尚無影片</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {videos.map((v) => (
            <div key={v.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{v.title}</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>分類：{v.category}</div>
              <div style={{ fontSize: 11, color: "var(--text3)", wordBreak: "break-all" }}>ID: {v.drive_file_id || "—"}</div>
            </div>
          ))}
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
