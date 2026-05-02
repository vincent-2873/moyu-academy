"use client";

/**
 * PeopleManager — Wave 8 #3
 *
 * Vincent 拍板:投資人不另開 /board portal,直接走 admin/* 後台,用 persona_role 區分權限
 *  - human_ops 看到所有 button(approve/reject)
 *  - board_audience 自動 read-only
 *  - 加新成員(email + name + role)→ 拿 0000 預設密碼 → Vincent LINE 給對方
 *
 * 整合 3 個 API:
 *   GET  /api/admin/people/list
 *   POST /api/admin/people/role
 *   POST /api/admin/people/invite
 */

import { useEffect, useState } from "react";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  persona_role: string | null;
  brand: string | null;
  status: string | null;
  is_active: boolean | null;
  created_at: string;
}

interface RoleOption {
  value: string;
  label: string;
  danger: boolean;
}

interface ListResp {
  ok: boolean;
  users: UserRow[];
  summary: Record<string, number>;
  total: number;
  role_options: RoleOption[];
}

const ROLE_LABEL_SHORT: Record<string, string> = {
  human_ops: "🛠️ 副手",
  board_audience: "🏛️ 投資人",
  employee_sales: "📊 業務",
  employee_legal: "⚖️ 法務",
  claude_executive: "🤖 Claude",
  unset: "❓ 未設",
};

export default function PeopleManager() {
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invName, setInvName] = useState("");
  const [invRole, setInvRole] = useState("board_audience");
  const [invBrand, setInvBrand] = useState("");
  const [invPwd, setInvPwd] = useState("0000");
  const [invSubmitting, setInvSubmitting] = useState(false);
  const [invResult, setInvResult] = useState<{ user: { email: string; name: string }; instruction: string } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/people/list", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "list failed");
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }

  async function changeRole(userId: string, newRole: string) {
    if (!confirm(`確定把 persona_role 改成「${ROLE_LABEL_SHORT[newRole] || newRole}」?`)) return;
    setActingId(userId);
    try {
      const r = await fetch("/api/admin/people/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, persona_role: newRole }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      await load();
    } catch (e) {
      alert("改 role 失敗:" + (e instanceof Error ? e.message : "unknown"));
    } finally {
      setActingId(null);
    }
  }

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    setInvSubmitting(true);
    try {
      const r = await fetch("/api/admin/people/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: invEmail,
          name: invName,
          persona_role: invRole,
          brand: invBrand || null,
          temp_password: invPwd,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setInvResult({ user: j.user, instruction: j.instruction });
      // 重置但不關 modal
      setInvEmail("");
      setInvName("");
      setInvBrand("");
      await load();
    } catch (e) {
      alert("邀請失敗:" + (e instanceof Error ? e.message : "unknown"));
    } finally {
      setInvSubmitting(false);
    }
  }

  function closeInvite() {
    setShowInvite(false);
    setInvResult(null);
    setInvEmail("");
    setInvName("");
    setInvBrand("");
    setInvRole("board_audience");
    setInvPwd("0000");
  }

  if (loading && !data) return <div style={{ padding: 20, color: "var(--ds-text-3)" }}>載入會員資料中…</div>;
  if (err) return <div style={{ padding: 16, background: "var(--ds-danger-soft)", color: "var(--ds-danger)", borderRadius: 8 }}>錯誤:{err}</div>;
  if (!data) return null;

  const filtered = data.users.filter((u) => {
    if (filter !== "all" && (u.persona_role || "unset") !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.email.toLowerCase().includes(q) && !(u.name || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="people-mgr">
      {/* 頂部 stats */}
      <div className="people-stats">
        {data.role_options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilter(filter === opt.value ? "all" : opt.value)}
            className={`people-stat-card${filter === opt.value ? " people-stat-card--active" : ""}`}
          >
            <div className="people-stat-num">{data.summary[opt.value] || 0}</div>
            <div className="people-stat-label">{opt.label}</div>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`people-stat-card${filter === "all" ? " people-stat-card--active" : ""}`}
        >
          <div className="people-stat-num">{data.total}</div>
          <div className="people-stat-label">總計</div>
        </button>
      </div>

      {/* 工具列 */}
      <div className="people-toolbar">
        <input
          type="text"
          placeholder="搜尋 email / name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ds-input"
          style={{ flex: 1, maxWidth: 300 }}
        />
        <button onClick={load} className="ds-btn ds-btn--sm">↻ 重新載入</button>
        <button onClick={() => setShowInvite(true)} className="ds-btn ds-btn--primary ds-btn--sm" style={{ marginLeft: "auto" }}>
          + 邀請新成員
        </button>
      </div>

      {/* 表格 */}
      <div className="people-table-wrap">
        <table className="people-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>姓名</th>
              <th>persona_role</th>
              <th>品牌</th>
              <th>建立時間</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--ds-text-3)" }}>
                  沒有符合條件的成員
                </td>
              </tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id} data-acting={actingId === u.id ? "true" : "false"}>
                <td className="people-email">{u.email}</td>
                <td>{u.name || "-"}</td>
                <td>
                  <select
                    value={u.persona_role || ""}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    disabled={actingId === u.id}
                    className="people-role-select"
                  >
                    <option value="">未設</option>
                    {data.role_options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </td>
                <td>{u.brand || "-"}</td>
                <td className="people-date">{u.created_at?.slice(0, 10) || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 邀請 modal */}
      {showInvite && (
        <div className="people-modal-backdrop" onClick={closeInvite}>
          <div className="people-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>+ 邀請新成員</h3>
            {invResult ? (
              <div>
                <div style={{ padding: 14, background: "var(--ds-success-soft, #d1fae5)", borderRadius: 8, marginBottom: 12 }}>
                  <strong>✓ 已建帳號:{invResult.user.name} &lt;{invResult.user.email}&gt;</strong>
                </div>
                <pre className="people-instruction">{invResult.instruction}</pre>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                  <button onClick={() => setInvResult(null)} className="ds-btn ds-btn--sm">繼續邀請</button>
                  <button onClick={closeInvite} className="ds-btn ds-btn--primary ds-btn--sm">完成</button>
                </div>
              </div>
            ) : (
              <form onSubmit={submitInvite}>
                <label className="ds-label">Email</label>
                <input type="email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} required className="ds-input" placeholder="investor@example.com" autoFocus />

                <label className="ds-label" style={{ marginTop: 12 }}>姓名 / 顯示名</label>
                <input type="text" value={invName} onChange={(e) => setInvName(e.target.value)} required className="ds-input" placeholder="王投資" />

                <label className="ds-label" style={{ marginTop: 12 }}>persona_role</label>
                <select value={invRole} onChange={(e) => setInvRole(e.target.value)} className="ds-input">
                  {data.role_options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                <label className="ds-label" style={{ marginTop: 12 }}>品牌(employee 才需要)</label>
                <input type="text" value={invBrand} onChange={(e) => setInvBrand(e.target.value)} className="ds-input" placeholder="nschool / xuemi / ...(投資人留空)" />

                <label className="ds-label" style={{ marginTop: 12 }}>臨時密碼</label>
                <input type="text" value={invPwd} onChange={(e) => setInvPwd(e.target.value)} required className="ds-input" />
                <p style={{ fontSize: 12, color: "var(--ds-text-3)", marginTop: 4 }}>對方第一次登入用,登入後會被要求改密碼(系統未強制,但建議)</p>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                  <button type="button" onClick={closeInvite} className="ds-btn ds-btn--sm">取消</button>
                  <button type="submit" disabled={invSubmitting} className="ds-btn ds-btn--primary ds-btn--sm">
                    {invSubmitting ? "建立中…" : "建立帳號"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .people-mgr { font-family: var(--ds-font-sans); }
        .people-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 10px;
          margin-bottom: 18px;
        }
        .people-stat-card {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border);
          border-radius: 10px;
          padding: 14px;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .people-stat-card:hover {
          border-color: var(--ds-primary);
          transform: translateY(-1px);
        }
        .people-stat-card--active {
          border-color: var(--ds-primary);
          background: var(--ds-primary-soft, rgba(180, 60, 40, 0.06));
        }
        .people-stat-num { font-size: 22px; font-weight: 800; color: var(--ds-primary); }
        .people-stat-label { font-size: 12px; color: var(--ds-text-3); margin-top: 2px; }

        .people-toolbar {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }

        .people-table-wrap { overflow-x: auto; border: 1px solid var(--ds-border); border-radius: 10px; }
        .people-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .people-table thead { background: var(--ds-surface-2); }
        .people-table th {
          text-align: left;
          padding: 10px 12px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--ds-text-3);
          border-bottom: 1px solid var(--ds-border);
        }
        .people-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--ds-border-soft, rgba(120, 80, 30, 0.06));
        }
        .people-table tbody tr:last-child td { border-bottom: none; }
        .people-table tbody tr[data-acting="true"] { opacity: 0.5; pointer-events: none; }
        .people-email { font-family: var(--ds-font-mono); font-size: 12px; }
        .people-date { font-family: var(--ds-font-mono); font-size: 11px; color: var(--ds-text-3); }
        .people-role-select {
          background: white;
          border: 1px solid var(--ds-border);
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 12px;
          font-family: inherit;
        }

        .people-modal-backdrop {
          position: fixed; inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .people-modal {
          background: white;
          border-radius: 12px;
          padding: 24px;
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .people-instruction {
          background: var(--ds-surface-2);
          padding: 12px;
          border-radius: 6px;
          font-family: var(--ds-font-mono);
          font-size: 12px;
          white-space: pre-wrap;
          word-break: break-all;
        }
      `}</style>
    </div>
  );
}
