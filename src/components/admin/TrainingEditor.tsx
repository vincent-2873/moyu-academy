"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * TrainingEditor v2 — Master-Detail two-pane
 *
 * 取代 v1 的「list + modal」設計
 * Layout:
 *   ┌─ left rail ─┬─ middle list ─┬─ right detail editor ─┐
 *   │ paths       │ modules by Day │ form (inline edit)   │
 *   │ (3 tab)     │ + new btn      │                       │
 *   └─────────────┴────────────────┴───────────────────────┘
 */

type Path = {
  id: string;
  code: string;
  path_type: "business" | "recruit";
  brand: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
};

type Module = {
  id: string;
  path_id: string;
  day_offset: number;
  sequence: number;
  module_type: string;
  title: string;
  description: string | null;
  content: Record<string, any>;
  duration_min: number | null;
  required: boolean;
  reward: Record<string, any>;
  unlock_condition: Record<string, any>;
};

const MODULE_TYPE_OPTIONS = ["video", "reading", "quiz", "sparring", "task", "reflection", "live_session"];
const TYPE_LABEL: Record<string, string> = {
  video: "影片",
  reading: "閱讀",
  quiz: "測驗",
  sparring: "對練",
  task: "任務",
  reflection: "反思",
  live_session: "現場",
};

export default function TrainingEditor() {
  const [paths, setPaths] = useState<Path[]>([]);
  const [modulesByPath, setModulesByPath] = useState<Record<string, Module[]>>({});
  const [activePathId, setActivePathId] = useState<string | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Module | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterDay, setFilterDay] = useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/admin/training");
    const d = await r.json();
    setPaths(d.paths || []);
    setModulesByPath(d.modules_by_path || {});
    if (!activePathId && d.paths?.[0]) setActivePathId(d.paths[0].id);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  const activePath = paths.find(p => p.id === activePathId);
  const modules = activePathId ? (modulesByPath[activePathId] || []) : [];
  const days = useMemo(() => Array.from(new Set(modules.map(m => m.day_offset))).sort((a, b) => a - b), [modules]);
  const filteredModules = filterDay === null ? modules : modules.filter(m => m.day_offset === filterDay);

  useEffect(() => {
    if (!activeModuleId) { setDraft(null); return; }
    const m = modules.find(x => x.id === activeModuleId);
    if (m) { setDraft({ ...m }); setDirty(false); }
  }, [activeModuleId, modules]);

  async function save() {
    if (!draft || !dirty) return;
    setSaving(true);
    const isNew = !draft.id;
    const url = isNew ? "/api/admin/training/module" : `/api/admin/training/module?id=${draft.id}`;
    const method = isNew ? "POST" : "PUT";
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (r.ok) {
      const d = await r.json();
      setDirty(false);
      await refresh();
      if (isNew && d.module?.id) setActiveModuleId(d.module.id);
    } else {
      const d = await r.json();
      alert(`儲存失敗: ${d.error || r.status}`);
    }
    setSaving(false);
  }

  async function deleteModule() {
    if (!draft?.id) return;
    if (!confirm(`刪除「${draft.title}」?(無法復原)`)) return;
    const r = await fetch(`/api/admin/training/module?id=${draft.id}`, { method: "DELETE" });
    if (r.ok) {
      setActiveModuleId(null);
      setDraft(null);
      refresh();
    }
  }

  function newModule() {
    if (!activePathId) return;
    const maxDay = days.length ? Math.max(...days) : 0;
    const newDraft: Module = {
      id: "",
      path_id: activePathId,
      day_offset: filterDay ?? maxDay,
      sequence: (modules.filter(m => m.day_offset === (filterDay ?? maxDay)).length || 0) + 1,
      module_type: "reading",
      title: "新 module",
      description: "",
      content: {},
      duration_min: 30,
      required: true,
      reward: {},
      unlock_condition: {},
    };
    setDraft(newDraft);
    setActiveModuleId("__new__");
    setDirty(true);
  }

  function patchDraft(patch: Partial<Module>) {
    if (!draft) return;
    setDraft({ ...draft, ...patch });
    setDirty(true);
  }

  if (loading) {
    return <div className="p-12 text-center text-sm" style={{ color: "var(--ink-mid)" }}>載入訓練教材…</div>;
  }

  return (
    <div style={{ height: "calc(100vh - 60px)", background: "var(--bg-paper, #f7f1e3)", display: "grid", gridTemplateColumns: "240px 360px 1fr" }}>
      {/* ── Left Rail: Paths ── */}
      <div style={{ borderRight: "1px solid var(--border-soft, rgba(26,26,26,0.10))", padding: "20px 16px", overflowY: "auto" }}>
        <div style={labelStyle}>養 PATHS · {paths.length}</div>
        <div className="space-y-1">
          {paths.map(p => (
            <motion.button
              key={p.id}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setActivePathId(p.id); setActiveModuleId(null); setFilterDay(null); }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                borderRadius: 4,
                background: p.id === activePathId ? "var(--ink-deep, #1a1a1a)" : "transparent",
                color: p.id === activePathId ? "var(--bg-paper)" : "var(--ink-deep)",
                border: "1px solid",
                borderColor: p.id === activePathId ? "var(--ink-deep)" : "var(--border-soft, rgba(26,26,26,0.10))",
                fontFamily: "var(--font-noto-serif-tc, serif)",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                {(modulesByPath[p.id] || []).length} module · {p.path_type}
              </div>
            </motion.button>
          ))}
        </div>

        {activePathId && days.length > 0 && (
          <>
            <div style={{ ...labelStyle, marginTop: 32 }}>篩 DAYS</div>
            <div className="flex flex-wrap gap-1">
              <DayChip label="全部" active={filterDay === null} onClick={() => setFilterDay(null)} />
              {days.map(d => (
                <DayChip key={d} label={`D${d}`} active={filterDay === d} onClick={() => setFilterDay(d)} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Middle: Modules list ── */}
      <div style={{ borderRight: "1px solid var(--border-soft, rgba(26,26,26,0.10))", overflowY: "auto" }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--border-soft, rgba(26,26,26,0.10))", background: "var(--bg-paper)", position: "sticky", top: 0, zIndex: 1 }}>
          <div className="flex items-center justify-between">
            <div>
              <div style={labelStyle}>節 MODULES · {filteredModules.length}</div>
              <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 16, color: "var(--ink-deep)", marginTop: 4 }}>
                {activePath?.name || "—"}
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={newModule}
              style={{
                padding: "8px 14px",
                borderRadius: 4,
                background: "var(--accent-red, #b91c1c)",
                color: "var(--bg-paper)",
                fontSize: 12,
                fontFamily: "var(--font-noto-serif-tc)",
                border: "none",
                cursor: "pointer",
              }}
            >
              + 新增
            </motion.button>
          </div>
        </div>
        <div className="p-2 space-y-1">
          {filteredModules.map((m, idx) => (
            <ModuleRow
              key={m.id}
              module={m}
              active={m.id === activeModuleId}
              onClick={() => setActiveModuleId(m.id)}
              idx={idx}
            />
          ))}
          {filteredModules.length === 0 && (
            <div style={{ textAlign: "center", padding: 32, color: "var(--ink-mid)", fontSize: 13 }}>
              此 path 沒有 module — 點右上「+ 新增」
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Detail editor ── */}
      <AnimatePresence mode="wait">
        {draft ? (
          <motion.div
            key={draft.id || "new"}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.25 }}
            style={{ overflowY: "auto", padding: 32, position: "relative" }}
          >
            <div style={labelStyle}>編 EDITING</div>
            <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 22, color: "var(--ink-deep)", marginTop: 4, marginBottom: 24, letterSpacing: 2 }}>
              {draft.title || "(無標題)"}
            </div>

            <KintsugiLine />

            <Field label="標題">
              <input value={draft.title} onChange={e => patchDraft({ title: e.target.value })} style={inputStyle} />
            </Field>

            <Field label="說明">
              <textarea value={draft.description || ""} onChange={e => patchDraft({ description: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Field label="Day">
                <input type="number" value={draft.day_offset} onChange={e => patchDraft({ day_offset: +e.target.value })} style={inputStyle} />
              </Field>
              <Field label="順序">
                <input type="number" value={draft.sequence} onChange={e => patchDraft({ sequence: +e.target.value })} style={inputStyle} />
              </Field>
              <Field label="時長(分)">
                <input type="number" value={draft.duration_min || 0} onChange={e => patchDraft({ duration_min: +e.target.value })} style={inputStyle} />
              </Field>
            </div>

            <Field label="類型">
              <div className="flex flex-wrap gap-2">
                {MODULE_TYPE_OPTIONS.map(t => (
                  <motion.button
                    key={t}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => patchDraft({ module_type: t })}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 4,
                      background: draft.module_type === t ? "var(--ink-deep)" : "transparent",
                      color: draft.module_type === t ? "var(--bg-paper)" : "var(--ink-deep)",
                      border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
                      fontFamily: "var(--font-noto-serif-tc)",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {TYPE_LABEL[t] || t}
                  </motion.button>
                ))}
              </div>
            </Field>

            <Field label="必修">
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={draft.required} onChange={e => patchDraft({ required: e.target.checked })} />
                <span style={{ fontSize: 13, color: "var(--ink-mid)" }}>{draft.required ? "必修" : "選修"}</span>
              </label>
            </Field>

            <Field label="content (JSON)" hint="影片 url / 對練 persona / 測驗題目 等彈性內容">
              <JsonField value={draft.content} onChange={v => patchDraft({ content: v })} />
            </Field>

            <Field label="reward (JSON)" hint='例 {"stamp":"初登場","rarity":"common"}'>
              <JsonField value={draft.reward} onChange={v => patchDraft({ reward: v })} />
            </Field>

            <Field label="unlock_condition (JSON)" hint="預留: 必須先完成哪 module">
              <JsonField value={draft.unlock_condition} onChange={v => patchDraft({ unlock_condition: v })} />
            </Field>

            {/* Bottom action bar */}
            <div style={{ position: "sticky", bottom: 0, background: "var(--bg-paper)", padding: "16px 0", marginTop: 24, borderTop: "1px solid var(--border-soft, rgba(26,26,26,0.10))", display: "flex", gap: 12, justifyContent: "flex-end" }}>
              {draft.id && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={deleteModule}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 4,
                    background: "transparent",
                    color: "var(--accent-red)",
                    border: "1px solid var(--accent-red)",
                    fontSize: 13,
                    fontFamily: "var(--font-noto-serif-tc)",
                    cursor: "pointer",
                  }}
                >
                  刪除
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: dirty ? 1.03 : 1 }}
                whileTap={{ scale: dirty ? 0.97 : 1 }}
                onClick={save}
                disabled={!dirty || saving}
                style={{
                  padding: "10px 24px",
                  borderRadius: 4,
                  background: dirty ? "var(--ink-deep)" : "var(--border-soft, rgba(26,26,26,0.10))",
                  color: dirty ? "var(--bg-paper)" : "var(--ink-mid)",
                  border: "none",
                  fontSize: 13,
                  fontFamily: "var(--font-noto-serif-tc)",
                  letterSpacing: 4,
                  cursor: dirty && !saving ? "pointer" : "default",
                }}
              >
                {saving ? "儲存中…" : dirty ? "儲 存" : "已儲存"}
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}
          >
            <div style={{ textAlign: "center", color: "var(--ink-mid)" }}>
              <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 32, color: "var(--ink-deep)", letterSpacing: 8, marginBottom: 12 }}>選 一</div>
              <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                從中間欄點 module 開始編輯<br/>或右上「+ 新增」建一個
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModuleRow({ module, active, onClick, idx }: { module: Module; active: boolean; onClick: () => void; idx: number }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.02, duration: 0.2 }}
      whileHover={{ x: 2 }}
      onClick={onClick}
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
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 14, fontWeight: 700, opacity: active ? 1 : 0.6, color: active ? "var(--bg-paper)" : "var(--accent-red)" }}>
          D{module.day_offset}
        </span>
        <span style={{ fontSize: 10, opacity: 0.5 }}>#{module.sequence}</span>
        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 2, background: active ? "rgba(255,255,255,0.15)" : "rgba(26,26,26,0.06)", marginLeft: "auto" }}>
          {TYPE_LABEL[module.module_type] || module.module_type}
        </span>
      </div>
      <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>
        {module.title}
      </div>
      {module.duration_min && (
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{module.duration_min} 分</div>
      )}
    </motion.button>
  );
}

function DayChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: 4,
        background: active ? "var(--accent-red)" : "transparent",
        color: active ? "var(--bg-paper)" : "var(--ink-deep)",
        border: "1px solid",
        borderColor: active ? "var(--accent-red)" : "var(--border-soft, rgba(26,26,26,0.10))",
        fontSize: 11,
        fontFamily: "var(--font-noto-serif-tc)",
        cursor: "pointer",
      }}
    >
      {label}
    </motion.button>
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

function JsonField({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const [text, setText] = useState(JSON.stringify(value || {}, null, 2));
  const [err, setErr] = useState<string | null>(null);
  const lastVal = useRef(value);

  useEffect(() => {
    if (JSON.stringify(value) !== JSON.stringify(lastVal.current)) {
      setText(JSON.stringify(value || {}, null, 2));
      lastVal.current = value;
    }
  }, [value]);

  return (
    <div>
      <textarea
        value={text}
        onChange={e => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value);
            onChange(parsed);
            setErr(null);
          } catch (ex: any) {
            setErr(ex.message);
          }
        }}
        rows={4}
        style={{
          ...inputStyle,
          fontFamily: "var(--font-jetbrains-mono, monospace)",
          fontSize: 12,
          resize: "vertical",
        }}
      />
      {err && <div style={{ color: "var(--accent-red)", fontSize: 11, marginTop: 4 }}>JSON 錯: {err}</div>}
    </div>
  );
}

function KintsugiLine() {
  return (
    <svg width="100%" height="3" style={{ marginBottom: 24, display: "block" }}>
      <line x1="0" y1="1.5" x2="100%" y2="1.5" stroke="var(--gold-thread, #c9a96e)" strokeWidth="1" strokeDasharray="2 4" />
    </svg>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--ink-mid)",
  letterSpacing: 2,
  fontWeight: 600,
  textTransform: "uppercase",
  marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 4,
  background: "var(--bg-paper)",
  border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
  color: "var(--ink-deep)",
  fontSize: 13,
  fontFamily: "var(--font-noto-sans-tc, sans-serif)",
};
