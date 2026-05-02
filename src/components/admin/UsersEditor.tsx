"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

type User = {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  module_role: string | null;
  capability_scope: string | null;
  brand: string | null;
  stage: string | null;
  stage_path: string | null;
  is_active: boolean;
  created_at: string;
};

const STAGES = [
  { value: "beginner", label: "研墨者(beginner)" },
  { value: "intermediate", label: "執筆者(intermediate)" },
  { value: "advanced", label: "點墨者(advanced)" },
  { value: "master", label: "執印者(master)" },
];

const PATHS = [
  { value: "business", label: "業務" },
  { value: "legal", label: "法務" },
  { value: "common", label: "通用" },
];

const SCOPES = [
  { value: "super_admin", label: "super_admin 超管", color: "var(--accent-red)" },
  { value: "brand_manager", label: "brand_manager 主管", color: "var(--gold-thread, #c9a96e)" },
  { value: "team_leader", label: "team_leader 組長", color: "var(--ink-deep)" },
  { value: "member", label: "member 成員", color: "var(--ink-mid)" },
  { value: "trainee", label: "trainee 新人", color: "var(--ink-mid)" },
];

const ROLES = [
  "super_admin", "ceo", "coo", "cfo", "director",
  "brand_manager", "sales_manager", "legal_manager",
  "team_leader", "trainer", "mentor",
  "legal_staff", "sales_rep",
  "sales_rookie", "intern",
];

export default function UsersEditor() {
  const [users, setUsers] = useState<User[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<User> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/admin/users-edit");
    const d = await r.json();
    setUsers(d.users || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!activeId) { setDraft(null); return; }
    const u = users.find(x => x.id === activeId);
    if (u) { setDraft({ ...u }); setDirty(false); }
  }, [activeId, users]);

  const filtered = useMemo(() => {
    let arr = users;
    if (filter) {
      const lf = filter.toLowerCase();
      arr = arr.filter(u =>
        (u.email || "").toLowerCase().includes(lf) ||
        (u.name || "").toLowerCase().includes(lf) ||
        (u.role || "").toLowerCase().includes(lf)
      );
    }
    if (scopeFilter) arr = arr.filter(u => u.capability_scope === scopeFilter);
    return arr;
  }, [users, filter, scopeFilter]);

  const scopeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    users.forEach(u => {
      if (u.capability_scope) c[u.capability_scope] = (c[u.capability_scope] || 0) + 1;
    });
    return c;
  }, [users]);

  async function save() {
    if (!draft || !dirty || !draft.id) return;
    setSaving(true);
    const r = await fetch(`/api/admin/users-edit?id=${draft.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (r.ok) { setDirty(false); await refresh(); }
    else {
      const d = await r.json();
      alert(`儲存失敗: ${d.error}`);
    }
    setSaving(false);
  }

  function patch(p: Partial<User>) {
    if (!draft) return;
    setDraft({ ...draft, ...p });
    setDirty(true);
  }

  if (loading) return <div className="p-12 text-center text-sm" style={{ color: "var(--ink-mid)" }}>載入員工…</div>;

  return (
    <div style={{ height: "calc(100vh - 60px)", background: "var(--bg-paper)", display: "grid", gridTemplateColumns: "380px 1fr" }}>
      {/* List */}
      <div style={{ borderRight: "1px solid var(--border-soft, rgba(26,26,26,0.10))", overflowY: "auto" }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--border-soft, rgba(26,26,26,0.10))", position: "sticky", top: 0, background: "var(--bg-paper)", zIndex: 1 }}>
          <div style={labelStyle}>人 USERS · {filtered.length}/{users.length}</div>
          <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 18, color: "var(--ink-deep)", marginTop: 4, marginBottom: 12 }}>員工管理</div>

          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="搜:email / 姓名 / 角色"
            style={{ ...inputStyle, marginBottom: 8 }}
          />

          {/* scope filter chips */}
          <div className="flex flex-wrap gap-1">
            <ScopeChip label="全部" active={scopeFilter === null} onClick={() => setScopeFilter(null)} count={users.length} />
            {SCOPES.map(s => (
              <ScopeChip key={s.value} label={s.label.split(" ")[1] || s.value} active={scopeFilter === s.value} onClick={() => setScopeFilter(s.value)} count={scopeCounts[s.value] || 0} color={s.color} />
            ))}
          </div>
        </div>

        <div className="p-2 space-y-1">
          {filtered.map((u, idx) => {
            const active = u.id === activeId;
            const stageName = STAGES.find(s => s.value === u.stage)?.label.split("(")[0].trim() || "";
            const scope = SCOPES.find(s => s.value === u.capability_scope);
            return (
              <motion.button
                key={u.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.01, 0.2) }}
                whileHover={{ x: 2 }}
                onClick={() => setActiveId(u.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 4,
                  background: active ? "var(--ink-deep)" : "transparent",
                  color: active ? "var(--bg-paper)" : "var(--ink-deep)",
                  border: "1px solid",
                  borderColor: active ? "var(--ink-deep)" : "transparent",
                  cursor: "pointer",
                  opacity: u.is_active ? 1 : 0.5,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                  {scope && <span style={{ width: 6, height: 6, borderRadius: "50%", background: scope.color, display: "inline-block" }} />}
                  <span style={{ fontSize: 9, opacity: 0.6, letterSpacing: 1, textTransform: "uppercase" }}>{u.capability_scope || "—"}</span>
                  {!u.is_active && <span style={{ fontSize: 9, opacity: 0.5, marginLeft: "auto" }}>停用</span>}
                </div>
                <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
                  {u.name || "(無名)"} {stageName && <span style={{ fontSize: 10, color: active ? "rgba(255,255,255,0.7)" : "var(--accent-red)" }}>· {stageName}</span>}
                </div>
                <div style={{ fontSize: 10, opacity: 0.6, fontFamily: "var(--font-jetbrains-mono)" }}>
                  {u.email}
                </div>
              </motion.button>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 32, color: "var(--ink-mid)", fontSize: 13 }}>無符合條件員工</div>
          )}
        </div>
      </div>

      {/* Editor */}
      <AnimatePresence mode="wait">
        {draft ? (
          <motion.div key={draft.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.25 }} style={{ overflowY: "auto", padding: 32 }}>
            <div style={labelStyle}>編 EDITING</div>
            <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 24, color: "var(--ink-deep)", marginTop: 4, marginBottom: 8, letterSpacing: 2 }}>
              {draft.name || "(無名)"}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-mid)", marginBottom: 24, fontFamily: "var(--font-jetbrains-mono)" }}>{draft.email}</div>
            <KintsugiLine />

            <Field label="姓名"><input value={draft.name || ""} onChange={e => patch({ name: e.target.value })} style={inputStyle} /></Field>

            <Field label="capability_scope (5 個)">
              <div className="flex flex-wrap gap-2">
                {SCOPES.map(s => (
                  <motion.button
                    key={s.value}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => patch({ capability_scope: s.value })}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 4,
                      background: draft.capability_scope === s.value ? s.color : "transparent",
                      color: draft.capability_scope === s.value ? "var(--bg-paper)" : "var(--ink-deep)",
                      border: `1px solid ${draft.capability_scope === s.value ? s.color : "var(--border-soft, rgba(26,26,26,0.10))"}`,
                      fontSize: 11,
                      fontFamily: "var(--font-noto-serif-tc)",
                      cursor: "pointer",
                    }}
                  >
                    {s.label}
                  </motion.button>
                ))}
              </div>
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="role(階級)">
                <select value={draft.role || ""} onChange={e => patch({ role: e.target.value })} style={inputStyle}>
                  <option value="">—</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="module_role">
                <select value={draft.module_role || ""} onChange={e => patch({ module_role: e.target.value })} style={inputStyle}>
                  <option value="">—</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Field label="養成階段">
                <select value={draft.stage || ""} onChange={e => patch({ stage: e.target.value })} style={inputStyle}>
                  <option value="">—</option>
                  {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="path">
                <select value={draft.stage_path || ""} onChange={e => patch({ stage_path: e.target.value })} style={inputStyle}>
                  <option value="">—</option>
                  {PATHS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="brand">
                <input value={draft.brand || ""} onChange={e => patch({ brand: e.target.value })} placeholder="如 nschool" style={inputStyle} />
              </Field>
            </div>

            <Field label="啟用狀態">
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={draft.is_active ?? true} onChange={e => patch({ is_active: e.target.checked })} />
                <span style={{ fontSize: 13, color: "var(--ink-mid)" }}>{draft.is_active ?? true ? "啟用中" : "停用"}</span>
              </label>
            </Field>

            <div style={{ position: "sticky", bottom: 0, background: "var(--bg-paper)", padding: "16px 0", marginTop: 24, borderTop: "1px solid var(--border-soft, rgba(26,26,26,0.10))", display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <motion.button whileHover={{ scale: dirty ? 1.03 : 1 }} whileTap={{ scale: dirty ? 0.97 : 1 }} onClick={save} disabled={!dirty || saving} style={{ ...btnPrimary, opacity: dirty ? 1 : 0.4 }}>
                {saving ? "儲存中…" : dirty ? "儲 存" : "已儲存"}
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
            <div style={{ textAlign: "center", color: "var(--ink-mid)" }}>
              <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 32, color: "var(--ink-deep)", letterSpacing: 8, marginBottom: 12 }}>選 一</div>
              <div style={{ fontSize: 13, lineHeight: 1.7 }}>從左欄點員工開始編輯<br/>capability_scope / 階段 / 角色 / 品牌</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScopeChip({ label, active, count, onClick, color }: { label: string; active: boolean; count: number; onClick: () => void; color?: string }) {
  return (
    <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }} onClick={onClick} style={{
      padding: "3px 8px",
      borderRadius: 3,
      background: active ? (color || "var(--ink-deep)") : "transparent",
      color: active ? "var(--bg-paper)" : "var(--ink-deep)",
      border: `1px solid ${active ? (color || "var(--ink-deep)") : "var(--border-soft, rgba(26,26,26,0.10))"}`,
      fontSize: 10,
      fontFamily: "var(--font-noto-serif-tc)",
      cursor: "pointer",
    }}>
      {label} <span style={{ opacity: 0.6 }}>{count}</span>
    </motion.button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function KintsugiLine() {
  return <svg width="100%" height="3" style={{ marginBottom: 24, display: "block" }}><line x1="0" y1="1.5" x2="100%" y2="1.5" stroke="var(--gold-thread, #c9a96e)" strokeWidth="1" strokeDasharray="2 4" /></svg>;
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600, textTransform: "uppercase" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 4, background: "var(--bg-paper)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", color: "var(--ink-deep)", fontSize: 13 };
const btnPrimary: React.CSSProperties = { padding: "8px 16px", borderRadius: 4, background: "var(--ink-deep)", color: "var(--bg-paper)", fontSize: 13, fontFamily: "var(--font-noto-serif-tc)", letterSpacing: 4, border: "none", cursor: "pointer" };
