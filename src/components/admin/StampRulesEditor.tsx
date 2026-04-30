"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Rule = {
  id: string;
  code: string;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  trigger_type: "module_complete" | "whisper_score" | "streak_days" | "first_action" | "manual";
  trigger_config: any;
  description: string | null;
  display_order: number;
  is_active: boolean;
  earned_count: number;
};

const RARITY_META: Record<string, { label: string; color: string; bg: string }> = {
  common: { label: "common · 初登場", color: "var(--ink-mid)", bg: "rgba(74,74,74,0.08)" },
  rare: { label: "rare · 初試啼聲", color: "#1e40af", bg: "rgba(30,64,175,0.08)" },
  epic: { label: "epic · 劍未配妥", color: "#a855f7", bg: "rgba(168,85,247,0.08)" },
  legendary: { label: "legendary · 出門已是江湖", color: "var(--accent-red)", bg: "rgba(185,28,28,0.10)" },
};

const TRIGGER_LABELS: Record<string, string> = {
  module_complete: "完成 module",
  whisper_score: "Whisper 評分",
  streak_days: "連續簽到",
  first_action: "首次行動",
  manual: "手動授予",
};

export default function StampRulesEditor() {
  const [items, setItems] = useState<Rule[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Rule> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/admin/stamp-rules");
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
    setDraft({
      code: "stamp_" + Date.now().toString(36),
      name: "新印章",
      rarity: "common",
      trigger_type: "manual",
      trigger_config: {},
      description: "",
      display_order: 999,
      is_active: true,
    });
    setActiveId("__new__");
    setDirty(true);
  }

  async function save() {
    if (!draft || !dirty) return;
    setSaving(true);
    const isNew = activeId === "__new__";
    const url = isNew ? "/api/admin/stamp-rules" : `/api/admin/stamp-rules?id=${draft.id}`;
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
    if (!confirm(`刪除「${draft.name}」?已蓋出去的不會撤回。`)) return;
    const r = await fetch(`/api/admin/stamp-rules?id=${draft.id}`, { method: "DELETE" });
    if (r.ok) { setActiveId(null); setDraft(null); refresh(); }
  }

  function patch(p: Partial<Rule>) {
    if (!draft) return;
    setDraft({ ...draft, ...p });
    setDirty(true);
  }

  function patchConfig(key: string, value: any) {
    if (!draft) return;
    const cfg = { ...(draft.trigger_config || {}), [key]: value };
    patch({ trigger_config: cfg });
  }

  if (loading) return <div className="p-12 text-center text-sm" style={{ color: "var(--ink-mid)" }}>載入印章規則…</div>;

  return (
    <div style={{ height: "calc(100vh - 60px)", background: "var(--bg-paper)", display: "grid", gridTemplateColumns: "380px 1fr" }}>
      <div style={{ borderRight: "1px solid var(--border-soft, rgba(26,26,26,0.10))", overflowY: "auto" }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--border-soft, rgba(26,26,26,0.10))", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--bg-paper)", zIndex: 1 }}>
          <div>
            <div style={labelStyle}>印 STAMPS · {items.length}</div>
            <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 18, color: "var(--ink-deep)", marginTop: 4, letterSpacing: 2 }}>印章規則</div>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={newItem} style={btnPrimary}>+ 新增</motion.button>
        </div>

        {note && (
          <div style={{ padding: 12, fontSize: 11, color: "var(--accent-red)", lineHeight: 1.6, background: "rgba(185,28,28,0.05)", margin: 8, borderRadius: 4 }}>
            {note}<br />
            執行 SQL:<code style={{ fontFamily: "var(--font-jetbrains-mono)" }}>gh workflow run "Apply Supabase Migration" --ref main -f sql_file=supabase-migration-D11-stamp-rules.sql</code>
          </div>
        )}

        <div style={{ padding: 8 }}>
          {items.map((it, idx) => {
            const active = it.id === activeId;
            const rarity = RARITY_META[it.rarity] || RARITY_META.common;
            return (
              <motion.button key={it.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }} whileHover={{ x: 2 }} onClick={() => setActiveId(it.id)}
                style={{ width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 4, marginBottom: 6, background: active ? "var(--ink-deep)" : "transparent", color: active ? "var(--bg-paper)" : "var(--ink-deep)", border: "1px solid", borderColor: active ? "var(--ink-deep)" : "transparent", cursor: "pointer", display: "block" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: rarity.color }} />
                  <span style={{ fontSize: 9, opacity: 0.7, letterSpacing: 1, textTransform: "uppercase" }}>{it.rarity}</span>
                  <span style={{ fontSize: 9, opacity: 0.6, marginLeft: "auto" }}>{TRIGGER_LABELS[it.trigger_type]}</span>
                  {!it.is_active && <span style={{ fontSize: 9, opacity: 0.5 }}>停用</span>}
                </div>
                <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{it.name}</div>
                <div style={{ fontSize: 10, opacity: 0.6, fontFamily: "var(--font-jetbrains-mono)" }}>
                  {it.code} · 已蓋 {it.earned_count}
                </div>
              </motion.button>
            );
          })}
          {items.length === 0 && !note && <div style={{ textAlign: "center", padding: 32, color: "var(--ink-mid)", fontSize: 13 }}>還沒印章規則</div>}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {draft ? (
          <motion.div key={draft.id || "new"} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.25 }} style={{ overflowY: "auto", padding: 32 }}>
            <div style={labelStyle}>編 EDITING</div>
            <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 22, color: "var(--ink-deep)", marginTop: 4, marginBottom: 24, letterSpacing: 2 }}>{draft.name}</div>
            <KintsugiLine />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="code (英數)">
                <input value={draft.code || ""} onChange={e => patch({ code: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="顯示名">
                <input value={draft.name || ""} onChange={e => patch({ name: e.target.value })} style={inputStyle} />
              </Field>
            </div>

            <Field label="說明">
              <input value={draft.description || ""} onChange={e => patch({ description: e.target.value })} placeholder="什麼條件會拿到這枚印章" style={inputStyle} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Field label="rarity">
                <select value={draft.rarity || "common"} onChange={e => patch({ rarity: e.target.value as any })} style={inputStyle}>
                  {Object.keys(RARITY_META).map(k => <option key={k} value={k}>{RARITY_META[k].label}</option>)}
                </select>
              </Field>
              <Field label="觸發類型">
                <select value={draft.trigger_type || "manual"} onChange={e => patch({ trigger_type: e.target.value as any, trigger_config: {} })} style={inputStyle}>
                  {Object.keys(TRIGGER_LABELS).map(k => <option key={k} value={k}>{TRIGGER_LABELS[k]}</option>)}
                </select>
              </Field>
              <Field label="排序">
                <input type="number" value={draft.display_order ?? 0} onChange={e => patch({ display_order: +e.target.value })} style={inputStyle} />
              </Field>
            </div>

            {/* 動態 trigger_config 編輯 */}
            <div style={{ background: "var(--bg-elev, rgba(247,241,227,0.85))", padding: 16, borderRadius: 4, marginBottom: 18 }}>
              <div style={labelStyle}>觸發條件</div>
              {draft.trigger_type === "whisper_score" && (
                <Field label="最低分數 (≥ X)">
                  <input type="number" value={draft.trigger_config?.min_score ?? 60} onChange={e => patchConfig("min_score", +e.target.value)} style={inputStyle} />
                </Field>
              )}
              {draft.trigger_type === "module_complete" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Day (1=Day1, 留空=任何 day)">
                    <input type="number" value={draft.trigger_config?.day ?? ""} onChange={e => patchConfig("day", e.target.value === "" ? undefined : +e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="Module ID (uuid, 選填)">
                    <input value={draft.trigger_config?.module_id ?? ""} onChange={e => patchConfig("module_id", e.target.value || undefined)} style={inputStyle} />
                  </Field>
                </div>
              )}
              {draft.trigger_type === "first_action" && (
                <Field label="動作">
                  <select value={draft.trigger_config?.action ?? "call"} onChange={e => patchConfig("action", e.target.value)} style={inputStyle}>
                    <option value="call">第一通電話</option>
                    <option value="appointment">第一個邀約</option>
                    <option value="demo">第一個 Demo</option>
                    <option value="close">第一筆成交</option>
                  </select>
                </Field>
              )}
              {draft.trigger_type === "streak_days" && (
                <Field label="連續天數 (≥ N)">
                  <input type="number" value={draft.trigger_config?.days ?? 7} onChange={e => patchConfig("days", +e.target.value)} style={inputStyle} />
                </Field>
              )}
              {draft.trigger_type === "manual" && (
                <div style={{ fontSize: 12, color: "var(--ink-mid)", padding: 8 }}>由主管 /admin → 養成 → 員工編輯,手動授予</div>
              )}
            </div>

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
              <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 32, color: "var(--ink-deep)", letterSpacing: 8, marginBottom: 12 }}>選 印</div>
              <div style={{ fontSize: 13, lineHeight: 1.7 }}>從左欄點印章編輯規則</div>
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
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 4, background: "var(--bg-paper)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", color: "var(--ink-deep)", fontSize: 13, fontFamily: "inherit" };
const btnPrimary: React.CSSProperties = { padding: "8px 16px", borderRadius: 4, background: "var(--ink-deep)", color: "var(--bg-paper)", fontSize: 13, fontFamily: "var(--font-noto-serif-tc)", letterSpacing: 4, border: "none", cursor: "pointer" };
const btnDanger: React.CSSProperties = { padding: "8px 16px", borderRadius: 4, background: "transparent", color: "var(--accent-red)", border: "1px solid var(--accent-red)", fontSize: 13, fontFamily: "var(--font-noto-serif-tc)", cursor: "pointer" };
