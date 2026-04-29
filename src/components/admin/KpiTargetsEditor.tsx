"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Item = {
  id: string;
  name: string;
  metric: string;
  target_value: number;
  period: "daily" | "weekly" | "monthly";
  applies_to_role: string | null;
  applies_to_stage: string | null;
  applies_to_brand: string | null;
  weight: number;
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

const STAGES = ["beginner 研墨者", "intermediate 執筆者", "advanced 點墨者", "master 執印者"];
const PERIODS = [{ value: "daily", label: "每日" }, { value: "weekly", label: "每週" }, { value: "monthly", label: "每月" }];

export default function KpiTargetsEditor() {
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Item> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/admin/kpi-targets");
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
    setDraft({ name: "新標準", metric: "calls", target_value: 100, period: "daily", weight: 1, is_active: true });
    setActiveId("__new__");
    setDirty(true);
  }

  async function save() {
    if (!draft || !dirty) return;
    setSaving(true);
    const isNew = activeId === "__new__";
    const url = isNew ? "/api/admin/kpi-targets" : `/api/admin/kpi-targets?id=${draft.id}`;
    const method = isNew ? "POST" : "PUT";
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    if (r.ok) {
      const d = await r.json();
      setDirty(false); await refresh();
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
    const r = await fetch(`/api/admin/kpi-targets?id=${draft.id}`, { method: "DELETE" });
    if (r.ok) { setActiveId(null); setDraft(null); refresh(); }
  }

  function patch(p: Partial<Item>) {
    if (!draft) return;
    setDraft({ ...draft, ...p });
    setDirty(true);
  }

  if (loading) return <div className="p-12 text-center text-sm" style={{ color: "var(--ink-mid)" }}>載入 KPI 標準…</div>;

  return (
    <div style={{ height: "calc(100vh - 60px)", background: "var(--bg-paper)", display: "grid", gridTemplateColumns: "360px 1fr" }}>
      <div style={{ borderRight: "1px solid var(--border-soft, rgba(26,26,26,0.10))", overflowY: "auto" }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--border-soft, rgba(26,26,26,0.10))", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--bg-paper)", zIndex: 1 }}>
          <div>
            <div style={labelStyle}>標 KPI · {items.length}</div>
            <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 18, color: "var(--ink-deep)", marginTop: 4 }}>KPI 標準</div>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={newItem} style={btnPrimary}>+ 新增</motion.button>
        </div>

        {note && <div style={{ padding: 12, fontSize: 11, color: "var(--accent-red)", lineHeight: 1.6, background: "rgba(185,28,28,0.05)", margin: 8, borderRadius: 4 }}>{note} (執行 D7 SQL 補表)</div>}

        <div className="p-2 space-y-1">
          {items.map((it, idx) => {
            const active = it.id === activeId;
            return (
              <motion.button key={it.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }} whileHover={{ x: 2 }} onClick={() => setActiveId(it.id)} style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 4, background: active ? "var(--ink-deep)" : "transparent", color: active ? "var(--bg-paper)" : "var(--ink-deep)", border: "1px solid", borderColor: active ? "var(--ink-deep)" : "transparent", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, opacity: 0.7, letterSpacing: 1, textTransform: "uppercase" }}>{it.period}</span>
                  {it.applies_to_stage && <span style={{ fontSize: 9, opacity: 0.6 }}>· {it.applies_to_stage}</span>}
                  {!it.is_active && <span style={{ fontSize: 9, opacity: 0.5, marginLeft: "auto" }}>停用</span>}
                </div>
                <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{it.name}</div>
                <div style={{ fontSize: 10, opacity: 0.6, fontFamily: "var(--font-jetbrains-mono)" }}>
                  {it.metric} ≥ {it.target_value.toLocaleString()}
                </div>
              </motion.button>
            );
          })}
          {items.length === 0 && !note && <div style={{ textAlign: "center", padding: 32, color: "var(--ink-mid)", fontSize: 13 }}>還沒 KPI 標準</div>}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {draft ? (
          <motion.div key={draft.id || "new"} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.25 }} style={{ overflowY: "auto", padding: 32 }}>
            <div style={labelStyle}>編 EDITING</div>
            <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 22, color: "var(--ink-deep)", marginTop: 4, marginBottom: 24, letterSpacing: 2 }}>{draft.name}</div>
            <KintsugiLine />

            <Field label="標題"><input value={draft.name || ""} onChange={e => patch({ name: e.target.value })} style={inputStyle} /></Field>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
              <Field label="指標">
                <select value={draft.metric} onChange={e => patch({ metric: e.target.value })} style={inputStyle}>
                  {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>
              <Field label="目標值"><input type="number" value={draft.target_value ?? 0} onChange={e => patch({ target_value: +e.target.value })} style={inputStyle} /></Field>
              <Field label="週期">
                <select value={draft.period} onChange={e => patch({ period: e.target.value as any })} style={inputStyle}>
                  {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Field label="適用階段(留空全部)">
                <select value={draft.applies_to_stage || ""} onChange={e => patch({ applies_to_stage: e.target.value || null })} style={inputStyle}>
                  <option value="">全階段</option>
                  <option value="beginner">研墨者(beginner)</option>
                  <option value="intermediate">執筆者(intermediate)</option>
                  <option value="advanced">點墨者(advanced)</option>
                  <option value="master">執印者(master)</option>
                </select>
              </Field>
              <Field label="適用角色(留空全部)">
                <input value={draft.applies_to_role || ""} onChange={e => patch({ applies_to_role: e.target.value || null })} placeholder="如 sales_rep" style={inputStyle} />
              </Field>
              <Field label="適用品牌(留空全部)">
                <input value={draft.applies_to_brand || ""} onChange={e => patch({ applies_to_brand: e.target.value || null })} placeholder="如 nschool" style={inputStyle} />
              </Field>
            </div>

            <Field label="加權(算總分用)">
              <input type="number" value={draft.weight ?? 1} onChange={e => patch({ weight: +e.target.value })} style={inputStyle} />
            </Field>

            <Field label="啟用">
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={draft.is_active ?? true} onChange={e => patch({ is_active: e.target.checked })} />
                <span style={{ fontSize: 13, color: "var(--ink-mid)" }}>{draft.is_active ?? true ? "啟用中" : "停用"}</span>
              </label>
            </Field>

            <div style={{ position: "sticky", bottom: 0, background: "var(--bg-paper)", padding: "16px 0", marginTop: 24, borderTop: "1px solid var(--border-soft, rgba(26,26,26,0.10))", display: "flex", gap: 12, justifyContent: "flex-end" }}>
              {draft.id && activeId !== "__new__" && <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={del} style={btnDanger}>刪除</motion.button>}
              <motion.button whileHover={{ scale: dirty ? 1.03 : 1 }} whileTap={{ scale: dirty ? 0.97 : 1 }} onClick={save} disabled={!dirty || saving} style={{ ...btnPrimary, opacity: dirty ? 1 : 0.4 }}>
                {saving ? "儲存中…" : dirty ? "儲 存" : "已儲存"}
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
            <div style={{ textAlign: "center", color: "var(--ink-mid)" }}>
              <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 32, color: "var(--ink-deep)", letterSpacing: 8, marginBottom: 12 }}>選 一</div>
              <div style={{ fontSize: 13, lineHeight: 1.7 }}>從左欄點 KPI 編輯</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
const btnDanger: React.CSSProperties = { padding: "8px 16px", borderRadius: 4, background: "transparent", color: "var(--accent-red)", border: "1px solid var(--accent-red)", fontSize: 13, fontFamily: "var(--font-noto-serif-tc)", cursor: "pointer" };
