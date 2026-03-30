"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type AdminTab = "dashboard" | "users" | "videos" | "approvals";

interface AdminSession {
  name: string;
  email: string;
  token: string;
}

interface StatsData {
  totalUsers: number;
  totalSparring: number;
  avgScore: number;
  pendingApprovals: number;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  brand: string;
  role: string;
  status: "active" | "inactive";
  joinDate: string;
}

interface VideoItem {
  id: string;
  title: string;
  category: string;
  brands: string[];
  status: "published" | "pending" | "draft";
  driveFileId: string;
}

interface ApprovalItem {
  id: string;
  type: string;
  action: string;
  submittedBy: string;
  submittedDate: string;
  status: "pending" | "approved" | "rejected";
  note?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  super_admin: "超級管理員",
  brand_manager: "品牌主管",
  team_leader: "業務主管",
  trainer: "培訓師",
  sales_rep: "業務人員",
};

const BRAND_LABELS: Record<string, string> = {
  nschool: "nSchool 財經學院",
  xuemi: "XUEMI 學米",
  ooschool: "OOschool 無限學院",
};

const ALL_BRANDS = Object.keys(BRAND_LABELS);

const VIDEO_CATEGORIES = [
  "產品知識",
  "銷售技巧",
  "客戶服務",
  "市場分析",
  "合規培訓",
  "新人培訓",
  "進階課程",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    active: { label: "啟用", color: "#10ac84" },
    inactive: { label: "停用", color: "#ee5a52" },
    published: { label: "已發布", color: "#10ac84" },
    pending: { label: "待審核", color: "#feca57" },
    draft: { label: "草稿", color: "#9898b0" },
    approved: { label: "已批准", color: "#10ac84" },
    rejected: { label: "已拒絕", color: "#ee5a52" },
  };
  const info = map[status] ?? { label: status, color: "#9898b0" };
  return (
    <span
      style={{
        background: info.color + "22",
        color: info.color,
        border: `1px solid ${info.color}44`,
        borderRadius: 6,
        padding: "2px 10px",
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {info.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "24px 28px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        flex: 1,
        minWidth: 180,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontSize: 22,
            background: color + "22",
            borderRadius: 10,
            padding: "6px 8px",
            lineHeight: 1,
          }}
        >
          {icon}
        </span>
        <span style={{ color: "var(--text2)", fontSize: 13 }}>{label}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color: "var(--text)", lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ color: "var(--text3)", fontSize: 12 }}>{sub}</div>}
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (session: AdminSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "登入失敗");
      onLogin({ name: data.name, email: data.email, token: data.token });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "登入失敗，請檢查帳號密碼");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          padding: "48px 40px",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg, var(--accent), var(--teal))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              margin: "0 auto 16px",
            }}
          >
            🎓
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
            墨宇學院 Admin
          </div>
          <div style={{ color: "var(--text3)", fontSize: 14, marginTop: 4 }}>
            管理後台登入
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label
              style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6 }}
            >
              管理員帳號
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              style={{
                width: "100%",
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "11px 14px",
                color: "var(--text)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label
              style={{ display: "block", color: "var(--text2)", fontSize: 13, marginBottom: 6 }}
            >
              密碼
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: "100%",
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "11px 14px",
                color: "var(--text)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                background: "#ee5a5222",
                border: "1px solid #ee5a5244",
                borderRadius: 8,
                padding: "10px 14px",
                color: "#ee5a52",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading
                ? "var(--border)"
                : "linear-gradient(135deg, var(--accent), #5f52d0)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "13px",
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: 4,
            }}
          >
            {loading ? "登入中..." : "登入"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab({ token }: { token: string }) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() =>
        setStats({ totalUsers: 0, totalSparring: 0, avgScore: 0, pendingApprovals: 0 })
      )
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingSpinner />;

  const s = stats!;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <h2 style={{ color: "var(--text)", fontSize: 22, fontWeight: 700, margin: 0 }}>
          總覽儀表板
        </h2>
        <p style={{ color: "var(--text3)", fontSize: 14, margin: "4px 0 0" }}>
          系統整體數據一覽
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatCard
          label="總用戶數"
          value={s.totalUsers.toLocaleString()}
          icon="👥"
          color="#7c6cf0"
          sub="已註冊帳號"
        />
        <StatCard
          label="總對練次數"
          value={s.totalSparring.toLocaleString()}
          icon="🥊"
          color="#00d2d3"
          sub="AI 對練記錄"
        />
        <StatCard
          label="平均得分"
          value={s.avgScore > 0 ? `${s.avgScore.toFixed(1)}` : "—"}
          icon="📊"
          color="#10ac84"
          sub="全體對練均分"
        />
        <StatCard
          label="待審核"
          value={s.pendingApprovals}
          icon="⏳"
          color="#feca57"
          sub="需要處理的申請"
        />
      </div>

      {/* Quick Info Cards */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {ALL_BRANDS.map((b) => (
          <div
            key={b}
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "18px 22px",
              flex: 1,
              minWidth: 200,
            }}
          >
            <div style={{ color: "var(--text2)", fontSize: 12, marginBottom: 6 }}>品牌</div>
            <div style={{ color: "var(--accent)", fontSize: 15, fontWeight: 600 }}>
              {BRAND_LABELS[b]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({ token }: { token: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBrand, setFilterBrand] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : d.users ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function updateUserRole(userId: string, role: string) {
    setSaving(userId + "_role");
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role }),
      });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    } finally {
      setSaving(null);
    }
  }

  async function toggleStatus(userId: string, current: "active" | "inactive") {
    const newStatus = current === "active" ? "inactive" : "active";
    setSaving(userId + "_status");
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
      );
    } finally {
      setSaving(null);
    }
  }

  const filtered = users.filter((u) => {
    const matchBrand = filterBrand === "all" || u.brand === filterBrand;
    const q = searchQ.toLowerCase();
    const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    return matchBrand && matchQ;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ color: "var(--text)", fontSize: 22, fontWeight: 700, margin: 0 }}>
            用戶管理
          </h2>
          <p style={{ color: "var(--text3)", fontSize: 14, margin: "4px 0 0" }}>
            共 {filtered.length} 位用戶
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="搜尋姓名 / 信箱..."
            style={inputStyle}
          />
          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            style={selectStyle}
          >
            <option value="all">全部品牌</option>
            {ALL_BRANDS.map((b) => (
              <option key={b} value={b}>
                {BRAND_LABELS[b]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["姓名", "信箱", "品牌", "角色", "狀態", "加入日期", "操作"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      color: "var(--text3)",
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "40px 16px", textAlign: "center", color: "var(--text3)" }}>
                    沒有找到符合條件的用戶
                  </td>
                </tr>
              ) : (
                filtered.map((user, idx) => (
                  <tr
                    key={user.id}
                    style={{
                      borderBottom: idx < filtered.length - 1 ? "1px solid var(--border)" : "none",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLTableRowElement).style.background = "var(--bg2)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")
                    }
                  >
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>{user.name}</div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ color: "var(--text2)", fontSize: 13 }}>{user.email}</div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: "var(--accent)", fontSize: 13 }}>
                        {BRAND_LABELS[user.brand] ?? user.brand}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <select
                        value={user.role}
                        disabled={saving === user.id + "_role"}
                        onChange={(e) => updateUserRole(user.id, e.target.value)}
                        style={{
                          ...selectStyle,
                          fontSize: 12,
                          padding: "4px 8px",
                          opacity: saving === user.id + "_role" ? 0.5 : 1,
                        }}
                      >
                        {Object.entries(ROLE_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge status={user.status} />
                    </td>
                    <td style={tdStyle}>
                      <div style={{ color: "var(--text3)", fontSize: 13 }}>
                        {new Date(user.joinDate).toLocaleDateString("zh-TW")}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <button
                        disabled={saving === user.id + "_status"}
                        onClick={() => toggleStatus(user.id, user.status)}
                        style={{
                          background:
                            user.status === "active" ? "#ee5a5222" : "#10ac8422",
                          color:
                            user.status === "active" ? "#ee5a52" : "#10ac84",
                          border: `1px solid ${user.status === "active" ? "#ee5a5244" : "#10ac8444"}`,
                          borderRadius: 6,
                          padding: "4px 12px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: saving === user.id + "_status" ? "not-allowed" : "pointer",
                          opacity: saving === user.id + "_status" ? 0.5 : 1,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {user.status === "active" ? "停用" : "啟用"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Videos Tab ───────────────────────────────────────────────────────────────

function VideosTab({ token }: { token: string }) {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<VideoItem | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    driveFileId: "",
    category: VIDEO_CATEGORIES[0],
    brands: [] as string[],
    status: "draft" as VideoItem["status"],
  });
  const [saving, setSaving] = useState(false);

  const fetchVideos = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/videos", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setVideos(Array.isArray(d) ? d : d.videos ?? []))
      .catch(() => setVideos([]))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  function openAdd() {
    setEditTarget(null);
    setFormData({ title: "", driveFileId: "", category: VIDEO_CATEGORIES[0], brands: [], status: "draft" });
    setShowForm(true);
  }

  function openEdit(v: VideoItem) {
    setEditTarget(v);
    setFormData({
      title: v.title,
      driveFileId: v.driveFileId,
      category: v.category,
      brands: v.brands,
      status: v.status,
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editTarget) {
        await fetch(`/api/admin/videos/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(formData),
        });
        setVideos((prev) =>
          prev.map((v) => (v.id === editTarget.id ? { ...v, ...formData } : v))
        );
      } else {
        const res = await fetch("/api/admin/videos", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(formData),
        });
        const created = await res.json();
        setVideos((prev) => [created, ...prev]);
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("確定要刪除這個影片嗎？")) return;
    await fetch(`/api/admin/videos/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setVideos((prev) => prev.filter((v) => v.id !== id));
  }

  function toggleBrand(b: string) {
    setFormData((prev) => ({
      ...prev,
      brands: prev.brands.includes(b) ? prev.brands.filter((x) => x !== b) : [...prev.brands, b],
    }));
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ color: "var(--text)", fontSize: 22, fontWeight: 700, margin: 0 }}>
            影片管理
          </h2>
          <p style={{ color: "var(--text3)", fontSize: 14, margin: "4px 0 0" }}>
            共 {videos.length} 個影片
          </p>
        </div>
        <button onClick={openAdd} style={primaryBtnStyle}>
          + 新增影片
        </button>
      </div>

      {/* Video Form Modal */}
      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 18,
              padding: "32px",
              width: "100%",
              maxWidth: 520,
              boxShadow: "0 32px 100px rgba(0,0,0,0.6)",
            }}
          >
            <h3 style={{ color: "var(--text)", fontSize: 18, fontWeight: 700, margin: "0 0 24px" }}>
              {editTarget ? "編輯影片" : "新增影片"}
            </h3>
            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>影片標題</label>
                <input
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  placeholder="請輸入影片標題"
                  required
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Google Drive 檔案 ID</label>
                <input
                  value={formData.driveFileId}
                  onChange={(e) => setFormData((p) => ({ ...p, driveFileId: e.target.value }))}
                  placeholder="例: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                  required
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>分類</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                  style={selectStyle}
                >
                  {VIDEO_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>適用品牌（可多選）</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                  {ALL_BRANDS.map((b) => {
                    const selected = formData.brands.includes(b);
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => toggleBrand(b)}
                        style={{
                          background: selected ? "var(--accent)" : "var(--bg2)",
                          color: selected ? "#fff" : "var(--text2)",
                          border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                          borderRadius: 8,
                          padding: "6px 14px",
                          fontSize: 13,
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        {BRAND_LABELS[b]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={labelStyle}>狀態</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as VideoItem["status"] }))}
                  style={selectStyle}
                >
                  <option value="draft">草稿</option>
                  <option value="pending">待審核</option>
                  <option value="published">已發布</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={ghostBtnStyle}
                >
                  取消
                </button>
                <button type="submit" disabled={saving} style={{ ...primaryBtnStyle, flex: 1 }}>
                  {saving ? "儲存中..." : editTarget ? "儲存變更" : "新增影片"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Video Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 16,
        }}
      >
        {videos.length === 0 ? (
          <div
            style={{
              gridColumn: "1/-1",
              textAlign: "center",
              color: "var(--text3)",
              padding: "60px 0",
            }}
          >
            尚無影片，點擊「新增影片」開始建立
          </div>
        ) : (
          videos.map((v) => (
            <div
              key={v.id}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                transition: "border-color 0.2s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)")
              }
            >
              {/* Thumbnail placeholder */}
              <div
                style={{
                  background: "var(--bg2)",
                  borderRadius: 10,
                  height: 140,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 36,
                  color: "var(--text3)",
                }}
              >
                🎬
              </div>
              <div>
                <div style={{ color: "var(--text)", fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>
                  {v.title}
                </div>
                <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 4 }}>
                  {v.category}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {v.brands.map((b) => (
                  <span
                    key={b}
                    style={{
                      background: "var(--accent)22",
                      color: "var(--accent)",
                      border: "1px solid var(--accent)44",
                      borderRadius: 5,
                      padding: "2px 8px",
                      fontSize: 11,
                    }}
                  >
                    {BRAND_LABELS[b] ?? b}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <StatusBadge status={v.status} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => openEdit(v)}
                    style={{
                      background: "var(--bg2)",
                      color: "var(--text2)",
                      border: "1px solid var(--border)",
                      borderRadius: 7,
                      padding: "5px 12px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    編輯
                  </button>
                  <button
                    onClick={() => handleDelete(v.id)}
                    style={{
                      background: "#ee5a5222",
                      color: "#ee5a52",
                      border: "1px solid #ee5a5244",
                      borderRadius: 7,
                      padding: "5px 12px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    刪除
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Approvals Tab ────────────────────────────────────────────────────────────

function ApprovalsTab({ token }: { token: string }) {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteModal, setNoteModal] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [note, setNote] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchApprovals = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/approvals", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : d.approvals ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  async function handleDecision(id: string, decision: "approve" | "reject", noteText?: string) {
    setProcessing(id);
    try {
      await fetch(`/api/admin/approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: decision === "approve" ? "approved" : "rejected", note: noteText }),
      });
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: decision === "approve" ? "approved" : "rejected", note: noteText }
            : item
        )
      );
    } finally {
      setProcessing(null);
      setNoteModal(null);
      setNote("");
    }
  }

  const pending = items.filter((i) => i.status === "pending");
  const processed = items.filter((i) => i.status !== "pending");

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ color: "var(--text)", fontSize: 22, fontWeight: 700, margin: 0 }}>
          審核管理
        </h2>
        <p style={{ color: "var(--text3)", fontSize: 14, margin: "4px 0 0" }}>
          {pending.length} 件待處理
        </p>
      </div>

      {/* Note Modal */}
      {noteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 18,
              padding: "28px",
              width: "100%",
              maxWidth: 420,
            }}
          >
            <h3 style={{ color: "var(--text)", fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>
              {noteModal.action === "approve" ? "批准申請" : "拒絕申請"}
            </h3>
            <label style={labelStyle}>備注（選填）</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="輸入審核備注..."
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
                marginTop: 6,
                fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                onClick={() => { setNoteModal(null); setNote(""); }}
                style={ghostBtnStyle}
              >
                取消
              </button>
              <button
                onClick={() => handleDecision(noteModal.id, noteModal.action, note || undefined)}
                disabled={!!processing}
                style={{
                  ...primaryBtnStyle,
                  flex: 1,
                  background:
                    noteModal.action === "approve"
                      ? "linear-gradient(135deg, #10ac84, #068368)"
                      : "linear-gradient(135deg, #ee5a52, #c0392b)",
                }}
              >
                {processing ? "處理中..." : noteModal.action === "approve" ? "確認批准" : "確認拒絕"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending */}
      <div>
        <div style={{ color: "var(--text2)", fontSize: 13, fontWeight: 600, marginBottom: 12, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          待審核 ({pending.length})
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pending.length === 0 ? (
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "32px",
                textAlign: "center",
                color: "var(--text3)",
              }}
            >
              🎉 目前沒有待審核的申請
            </div>
          ) : (
            pending.map((item) => (
              <ApprovalCard
                key={item.id}
                item={item}
                processing={processing}
                onApprove={() => setNoteModal({ id: item.id, action: "approve" })}
                onReject={() => setNoteModal({ id: item.id, action: "reject" })}
              />
            ))
          )}
        </div>
      </div>

      {/* Processed */}
      {processed.length > 0 && (
        <div>
          <div style={{ color: "var(--text3)", fontSize: 13, fontWeight: 600, marginBottom: 12, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            已處理 ({processed.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {processed.map((item) => (
              <ApprovalCard
                key={item.id}
                item={item}
                processing={processing}
                readonly
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalCard({
  item,
  processing,
  onApprove,
  onReject,
  readonly,
}: {
  item: ApprovalItem;
  processing: string | null;
  onApprove?: () => void;
  onReject?: () => void;
  readonly?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        opacity: readonly ? 0.7 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span
            style={{
              background: "var(--accent)22",
              color: "var(--accent)",
              borderRadius: 5,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {item.type}
          </span>
          <span style={{ color: "var(--text)", fontWeight: 600, fontSize: 14 }}>{item.action}</span>
        </div>
        <div style={{ color: "var(--text2)", fontSize: 13 }}>
          提交者：{item.submittedBy}
        </div>
        <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 2 }}>
          {new Date(item.submittedDate).toLocaleString("zh-TW")}
        </div>
        {item.note && (
          <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 4, fontStyle: "italic" }}>
            備注：{item.note}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <StatusBadge status={item.status} />
        {!readonly && (
          <>
            <button
              disabled={processing === item.id}
              onClick={onApprove}
              style={{
                background: "#10ac8422",
                color: "#10ac84",
                border: "1px solid #10ac8444",
                borderRadius: 8,
                padding: "6px 16px",
                fontSize: 13,
                fontWeight: 600,
                cursor: processing === item.id ? "not-allowed" : "pointer",
                opacity: processing === item.id ? 0.5 : 1,
              }}
            >
              批准
            </button>
            <button
              disabled={processing === item.id}
              onClick={onReject}
              style={{
                background: "#ee5a5222",
                color: "#ee5a52",
                border: "1px solid #ee5a5244",
                borderRadius: 8,
                padding: "6px 16px",
                fontSize: 13,
                fontWeight: 600,
                cursor: processing === item.id ? "not-allowed" : "pointer",
                opacity: processing === item.id ? 0.5 : 1,
              }}
            >
              拒絕
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Loading Spinner ──────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "3px solid var(--border)",
          borderTopColor: "var(--accent)",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Shared Styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg2)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "9px 12px",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  background: "var(--bg2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 12px",
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "var(--text2)",
  fontSize: 13,
  marginBottom: 6,
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  verticalAlign: "middle",
};

const primaryBtnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--accent), #5f52d0)",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "9px 18px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const ghostBtnStyle: React.CSSProperties = {
  background: "var(--bg2)",
  color: "var(--text2)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "9px 18px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  flex: 1,
};

// ─── Nav Item ─────────────────────────────────────────────────────────────────

function NavItem({
  label,
  icon,
  active,
  onClick,
  badge,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "10px 14px",
        borderRadius: 10,
        border: "none",
        background: active ? "var(--accent)" : "transparent",
        color: active ? "#fff" : "var(--text2)",
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.15s",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg2)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <span style={{ fontSize: 17 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          style={{
            background: "#feca57",
            color: "#08080c",
            borderRadius: 10,
            padding: "1px 7px",
            fontSize: 11,
            fontWeight: 700,
            minWidth: 20,
            textAlign: "center",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [pendingCount, setPendingCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("adminSession");
      if (raw) setSession(JSON.parse(raw));
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  // Fetch pending count for badge
  useEffect(() => {
    if (!session) return;
    fetch("/api/admin/approvals", { headers: { Authorization: `Bearer ${session.token}` } })
      .then((r) => r.json())
      .then((d) => {
        const arr: ApprovalItem[] = Array.isArray(d) ? d : d.approvals ?? [];
        setPendingCount(arr.filter((i) => i.status === "pending").length);
      })
      .catch(() => {});
  }, [session, tab]);

  function handleLogin(s: AdminSession) {
    sessionStorage.setItem("adminSession", JSON.stringify(s));
    setSession(s);
  }

  function handleLogout() {
    sessionStorage.removeItem("adminSession");
    setSession(null);
  }

  if (!hydrated) return null;
  if (!session) return <LoginScreen onLogin={handleLogin} />;

  const TABS: { id: AdminTab; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "users", label: "用戶管理", icon: "👥" },
    { id: "videos", label: "影片管理", icon: "🎬" },
    { id: "approvals", label: "審核管理", icon: "✅" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        fontFamily: '"SF Pro Display", "PingFang TC", "Microsoft JhengHei", sans-serif',
      }}
    >
      {/* ── Sidebar ── */}
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          background: "var(--bg2)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          padding: "24px 16px",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, var(--accent), var(--teal))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              🎓
            </div>
            <div>
              <div style={{ color: "var(--text)", fontWeight: 700, fontSize: 14 }}>
                墨宇學院
              </div>
              <div style={{ color: "var(--accent)", fontSize: 11, fontWeight: 600 }}>
                Admin Panel
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          <div style={{ color: "var(--text3)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", padding: "0 8px", marginBottom: 6 }}>
            管理選單
          </div>
          {TABS.map((t) => (
            <NavItem
              key={t.id}
              label={t.label}
              icon={t.icon}
              active={tab === t.id}
              onClick={() => setTab(t.id)}
              badge={t.id === "approvals" ? pendingCount : undefined}
            />
          ))}
        </nav>

        {/* User Info */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 16,
            marginTop: 16,
          }}
        >
          <div style={{ padding: "0 6px", marginBottom: 10 }}>
            <div style={{ color: "var(--text)", fontWeight: 600, fontSize: 14 }}>
              {session.name}
            </div>
            <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 2 }}>
              {session.email}
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              background: "#ee5a5215",
              color: "#ee5a52",
              border: "1px solid #ee5a5230",
              borderRadius: 8,
              padding: "8px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = "#ee5a5230")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = "#ee5a5215")
            }
          >
            登出
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main
        style={{
          flex: 1,
          padding: "32px 40px",
          overflowY: "auto",
          maxWidth: "100%",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 28,
            paddingBottom: 20,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <h1 style={{ color: "var(--text)", fontSize: 18, fontWeight: 700, margin: 0 }}>
              {TABS.find((t) => t.id === tab)?.label}
            </h1>
            <div style={{ color: "var(--text3)", fontSize: 13, marginTop: 3 }}>
              {new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "8px 14px",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#10ac84",
                boxShadow: "0 0 0 2px #10ac8433",
              }}
            />
            <span style={{ color: "var(--text2)", fontSize: 13 }}>系統正常運行</span>
          </div>
        </div>

        {/* Tab Content */}
        <div style={{ animation: "fadeIn 0.3s ease-out" }}>
          {tab === "dashboard" && <DashboardTab token={session.token} />}
          {tab === "users" && <UsersTab token={session.token} />}
          {tab === "videos" && <VideosTab token={session.token} />}
          {tab === "approvals" && <ApprovalsTab token={session.token} />}
        </div>
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        input::placeholder { color: var(--text3); }
        textarea::placeholder { color: var(--text3); }
        select option { background: var(--bg2); color: var(--text); }
      `}</style>
    </div>
  );
}
