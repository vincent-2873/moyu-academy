"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Rule = {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  comparator: string;
  severity: "info" | "warning" | "danger";
  action: "notify_self" | "notify_manager" | "notify_both" | "log_only";
  target_role: string | null;
  target_brand: string | null;
  message_template: string | null;
  is_active: boolean;
};

const METRICS = [
  { value: "calls", label: "撥打通數" },
  { value: "call_minutes", label: "通話時長(分)" },
  { value: "connected", label: "接通數" },
  { value: "raw_appointments", label: "原始邀約" },
  { value: "appointments_show", label: "邀約出席" },
  { value: "raw_demos", label: "Demo 數" },
  { value: "closures", label: "成交數" },
  { value: "net_revenue_daily", label: "今日營收" },
];

const COMPARATORS = ["<", "<=", ">", ">=", "=", "!="];

const SEVERITIES = [
  { value: "info", label: "資訊", color: "var(--ink-mid)" },
  { value: "warning", label: "警示", color: "var(--gold-thread, #c9a96e)" },
  { value: "danger", label: "危急", color: "var(--accent-red)" },
];

const ACTIONS = [
  { value: "notify_self", label: "推給自己" },
  { value: "notify_manager", label: "推給主管" },
  { value: "notify_both", label: "雙推" },
  { value: "log_only", label: "只 log" },
];

export default function SalesRulesEditor() {
  const [items, setItems] = useState<Rule[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Rule> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/admin/sales-rules");
    const d = await r.json();
    setItems(d.items || []);
    setNote(d.note || null);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!activeId) { setDraft(null); return; }
    if (activeId === "__new__") return;
    const it = items.find(x => x.id === activeId);
    if (it) { setDraft({ ...it }); setDirty(false); }
  }, [activeId, items]);

  function newItem() {
    setDraft({ name: "新規則", metric: "calls", threshold: 100, comparator: "<", severity: "warning", action: "notify_self", message_template: "今日 {metric} = {value},低於門檻 {threshold}", is_active: true });
    setActiveId("__new__");
    setDirty(true);
  }

  async function save() {
    if (!draft || !dirty) return;
    setSaving(true);
    const isNew = activeId === "__new__";
    const url = isNew ? "/api/admin/sales-rules" : `/api/admin/sales-rules?id=${draft.id}`;
    const method = isNew ? "POST" : "PUT";
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    if (r.ok) {
      const d = await r.json();
      setDirty(false);
      await refresh();
      if (isNew && d.item?.id) setActiveId(d.item.id);
    } else {
      const d = await r.json();
      alert(`儲存失敗: ${d.error || r.status}`);
    }
    setSaving(false);
  }

  async function del() {
    if (!draft?.id) return;
    if (!confirm(`刪除「${draft.name}」?`)) return;
    const r = await fetch(`/api/admin/sales-rules?id=${draft.id}`, { method: "DELETE" });
    if (r.ok) { setActiveId(null); setDraft(null); refresh(); }
  }

  function patch(p: Partial<Rule>) {
    if (!draft) return;
    setDraft({ ...draft, ...p });
    setDirty(true);
  }

  if (loading) return <div className="p-12 text-center text-sm" style={{ color: "var(--ink-mid)" }}>載入規則…</div>;

  return (
    <div style={{ height: "calc(100vh - 60px)", background: "var(--bg-paper)", display: "grid", gridTemplateColumns: "360px 1fr" }}>
      {/* List */}
      <div style={{ borderRight: "1px solid var(--border-soft, rgba(26,26,26,0.10))", overflowY: "auto" }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--border-soft, rgba(26,26,26,0.10))", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--bg-paper)", zIndex: 1 }}>
          <div>
            <div style={labelStyle}>規 RULES · {items.length}</div>
            <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 18, color: "var(--ink-deep)", marginTop: 4 }}>業務 KPI 規則</div>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={newItem} style={btnPrimary}>+ 新增</motion.button>
        </div>

        {note && (
          <div style={{ padding: 12, fontSize: 11, color: "var(--accent-red)", lineHeight: 1.6, background: "rgba(185,28,28,0.05)", margin: 8, borderRadius: 4 }}>
            {note}<br/>
            (執行 supabase-migration-D6-sales-rules.sql 補表)
          </div>
        )}

        <div className="p-2 space-y-1">
          {items.map((it, idx) => {
            const active = it.id === activeId;
            const sev = SEVERITIES.find(s => s.value === it.severity);
            return (
              <motion.button
                key={it.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                whileHover={{ x: 2 }}
                onClick={() => setActiveId(it.id)}
                style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 4, background: active ? "var(--ink-deep)" : "transparent", color: active ? "var(--bg-paper)" : "var(--ink-deep)", border: "1px solid", borderColor: active ? "var(--ink-deep)" : "transparent", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: sev?.color || "var(--ink-mid)", display: "inline-block" }} />
                  <span style={{ fontSize: 9, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1 }}>{sev?.label}</span>
                  {!it.is_active && <span style={{ fontSize: 9, opacity: 0.5 }}>停用</span>}
                </div>
                <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{it.name}</div>
                <div style={{ fontSize: 10, opacity: 0.6, fontFamily: "var(--font-jetbrains-mono)" }}>
                  {it.metric} {it.comparator} {it.threshold}
                </div>
              </motion.button>
            );
          })}
          {items.length === 0 && !note && (
            <div style={{ textAlign: "center", padding: 32, color: "var(--ink-mid)", fontSize: 13 }}>還沒規則 — 點右上「+ 新增」</div>
          )}
        </div>
      </div>

      {/* Editor */}
      <AnimatePresence mode="wait">
        {draft ? (
          <motion.div key={draft.id || "new"} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.25 }} style={{ overflowY: "auto", padding: 32 }}>
            <div style={labelStyle}>編 EDITING</div>
            <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 22, color: "var(--ink-deep)", marginTop: 4, marginBottom: 24, letterSpacing: 2 }}>
              {draft.name}
            </div>
            <KintsugiLine />

            <Field label="規則名稱">
              <input value={draft.name || ""} onChange={e => patch({ name: e.target.value })} style={inputStyle} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
              <Field label="指標">
                <select value={draft.metric} onChange={e => patch({ metric: e.target.value })} style={inputStyle}>
                  {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>
              <Field label="比較">
                <select value={draft.comparator} onChange={e => patch({ comparator: e.target.value })} style={inputStyle}>
                  {COMPARATORS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="門檻">
                <input type="number" value={draft.threshold ?? 0} onChange={e => patch({ threshold: +e.target.value })} style={inputStyle} />
              </Field>
            </div>

            <Field label="嚴重度">
              <div className="flex gap-2">
                {SEVERITIES.map(s => (
                  <motion.button
                    key={s.value}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => patch({ severity: s.value as any })}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 4,
                      background: draft.severity === s.value ? s.color : "transparent",
                      color: draft.severity === s.value ? "var(--bg-paper)" : "var(--ink-deep)",
                      border: `1px solid ${draft.severity === s.value ? s.color : "var(--border-soft, rgba(26,26,26,0.10))"}`,
                      fontFamily: "var(--font-noto-serif-tc)",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {s.label}
                  </motion.button>
                ))}
              </div>
            </Field>

            <Field label="觸發動作">
              <select value={draft.action} onChange={e => patch({ action: e.target.value as any })} style={inputStyle}>
                {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="目標角色(留空全部)">
                <input value={draft.target_role || ""} onChange={e => patch({ target_role: e.target.value || null })} placeholder="如 sales_rep" style={inputStyle} />
              </Field>
              <Field label="目標品牌(留空全部)">
                <input value={draft.target_brand || ""} onChange={e => patch({ target_brand: e.target.value || null })} placeholder="如 nschool" style={inputStyle} />
              </Field>
            </div>

            <Field label="訊息模板" hint="可用 {metric} {value} {threshold} 變數">
              <textarea value={draft.message_template || ""} onChange={e => patch({ message_template: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </Field>

            <Field label="啟用">
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={draft.is_active ?? true} onChange={e => patch({ is_active: e.target.checked })} />
                <span style={{ fontSize: 13, color: "var(--ink-mid)" }}>{draft.is_active ?? true ? "啟用中" : "停用"}</span>
              </label>
            </Field>

            <div style={{ position: "sticky", bottom: 0, background: "var(--bg-paper)", padding: "16px 0", marginTop: 24, borderTop: "1px solid var(--border-soft, rgba(26,26,26,0.10))", display: "flex", gap: 12, justifyContent: "flex-end" }}>
              {draft.id && activeId !== "__new__" && (
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={del} style={btnDanger}>刪除</motion.button>
              )}
              <motion.button whileHover={{ scale: dirty ? 1.03 : 1 }} whileTap={{ scale: dirty ? 0.97 : 1 }} onClick={save} disabled={!dirty || saving} style={{ ...btnPrimary, opacity: dirty ? 1 : 0.4 }}>
                {saving ? "儲存中…" : dirty ? "儲 存" : "已儲存"}
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
            <div style={{ textAlign: "center", color: "var(--ink-mid)" }}>
              <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 32, color: "var(--ink-deep)", letterSpacing: 8, marginBottom: 12 }}>選 一</div>
              <div style={{ fontSize: 13, lineHeight: 1.7 }}>從左欄點規則編輯<br/>或右上「+ 新增」</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
        {hint && <span style={{ fontSize: 11, color: "var(--ink-mid)", opacity: 0.7 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function KintsugiLine() {
  return <svg width="100%" height="3" style={{ marginBottom: 24, display: "block" }}><line x1="0" y1="1.5" x2="100%" y2="1.5" stroke="var(--gold-thread, #c9a96e)" strokeWidth="1" strokeDasharray="2 4" /></svg>;
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600, textTransform: "uppercase" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 4, background: "var(--bg-paper)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", color: "var(--ink-deep)", fontSize: 13, fontFamily: "var(--font-noto-sans-tc, sans-serif)" };
const btnPrimary: React.CSSProperties = { padding: "8px 16px", borderRadius: 4, background: "var(--ink-deep)", color: "var(--bg-paper)", fontSize: 13, fontFamily: "var(--font-noto-serif-tc)", letterSpacing: 4, border: "none", cursor: "pointer" };
const btnDanger: React.CSSProperties = { padding: "8px 16px", borderRadius: 4, background: "transparent", color: "var(--accent-red)", border: "1px solid var(--accent-red)", fontSize: 13, fontFamily: "var(--font-noto-serif-tc)", cursor: "pointer" };
