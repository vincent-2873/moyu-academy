"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Item = {
  id: string;
  code: string;
  name: string;
  category: string;
  message_type: "text" | "flex" | "image" | "sticker";
  content: string;
  variables: string[];
  example_payload: any;
  target_role: string | null;
  target_brand: string | null;
  is_active: boolean;
};

const CATEGORIES = [
  { value: "briefing", label: "簡報", color: "var(--ink-deep)" },
  { value: "alert", label: "警示", color: "var(--accent-red)" },
  { value: "reminder", label: "提醒", color: "var(--gold-thread, #c9a96e)" },
  { value: "celebration", label: "慶賀", color: "var(--accent-red)" },
  { value: "general", label: "一般", color: "var(--ink-mid)" },
];

export default function LineTemplatesEditor() {
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Item> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [previewVars, setPreviewVars] = useState("");

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/admin/line-templates");
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
    if (it) {
      setDraft({ ...it });
      setDirty(false);
      setPreviewVars(JSON.stringify(it.example_payload || {}, null, 2));
    }
  }, [activeId, items]);

  function newItem() {
    setDraft({ code: "new_template", name: "新模板", category: "general", message_type: "text", content: "你好 {user_name}!", variables: ["user_name"], example_payload: { user_name: "Yian" }, is_active: true });
    setActiveId("__new__");
    setDirty(true);
    setPreviewVars(JSON.stringify({ user_name: "Yian" }, null, 2));
  }

  async function save() {
    if (!draft || !dirty) return;
    setSaving(true);
    const isNew = activeId === "__new__";
    const url = isNew ? "/api/admin/line-templates" : `/api/admin/line-templates?id=${draft.id}`;
    const method = isNew ? "POST" : "PUT";
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    if (r.ok) {
      const d = await r.json();
      setDirty(false); await refresh();
      if (isNew && d.item?.id) setActiveId(d.item.id);
    } else {
      const d = await r.json();
      alert(`儲存失敗: ${d.error}`);
    }
    setSaving(false);
  }

  async function del() {
    if (!draft?.id) return;
    if (!confirm(`刪除「${draft.name}」?`)) return;
    const r = await fetch(`/api/admin/line-templates?id=${draft.id}`, { method: "DELETE" });
    if (r.ok) { setActiveId(null); setDraft(null); refresh(); }
  }

  function patch(p: Partial<Item>) {
    if (!draft) return;
    setDraft({ ...draft, ...p });
    setDirty(true);
  }

  // Live preview render variables
  let previewText = draft?.content || "";
  try {
    const vars = JSON.parse(previewVars || "{}");
    previewText = previewText.replace(/\{(\w+)\}/g, (_, k) => vars[k] != null ? String(vars[k]) : `{${k}}`);
  } catch {}

  if (loading) return <div className="p-12 text-center text-sm" style={{ color: "var(--ink-mid)" }}>載入模板…</div>;

  return (
    <div style={{ height: "calc(100vh - 60px)", background: "var(--bg-paper)", display: "grid", gridTemplateColumns: "320px 1fr 320px" }}>
      {/* List */}
      <div style={{ borderRight: "1px solid var(--border-soft, rgba(26,26,26,0.10))", overflowY: "auto" }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--border-soft, rgba(26,26,26,0.10))", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--bg-paper)", zIndex: 1 }}>
          <div>
            <div style={labelStyle}>訊 LINE TEMPLATES · {items.length}</div>
            <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 18, color: "var(--ink-deep)", marginTop: 4 }}>LINE 模板</div>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={newItem} style={btnPrimary}>+ 新增</motion.button>
        </div>
        {note && <div style={{ padding: 12, fontSize: 11, color: "var(--accent-red)", margin: 8, borderRadius: 4, background: "rgba(185,28,28,0.05)" }}>{note}<br/>(D10 SQL 補)</div>}
        <div className="p-2 space-y-1">
          {items.map((it, idx) => {
            const active = it.id === activeId;
            const cat = CATEGORIES.find(c => c.value === it.category);
            return (
              <motion.button key={it.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }} whileHover={{ x: 2 }} onClick={() => setActiveId(it.id)} style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 4, background: active ? "var(--ink-deep)" : "transparent", color: active ? "var(--bg-paper)" : "var(--ink-deep)", border: "1px solid", borderColor: active ? "var(--ink-deep)" : "transparent", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: cat?.color, display: "inline-block" }} />
                  <span style={{ fontSize: 9, opacity: 0.6, letterSpacing: 1, textTransform: "uppercase" }}>{cat?.label}</span>
                  {!it.is_active && <span style={{ fontSize: 9, opacity: 0.5, marginLeft: "auto" }}>停</span>}
                </div>
                <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{it.name}</div>
                <div style={{ fontSize: 10, opacity: 0.6, fontFamily: "var(--font-jetbrains-mono)" }}>{it.code}</div>
              </motion.button>
            );
          })}
          {items.length === 0 && !note && <div style={{ textAlign: "center", padding: 32, color: "var(--ink-mid)", fontSize: 13 }}>還沒模板</div>}
        </div>
      </div>

      {/* Editor */}
      <AnimatePresence mode="wait">
        {draft ? (
          <motion.div key={draft.id || "new"} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.25 }} style={{ overflowY: "auto", padding: 32, borderRight: "1px solid var(--border-soft, rgba(26,26,26,0.10))" }}>
            <div style={labelStyle}>編 EDITING</div>
            <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 22, color: "var(--ink-deep)", marginTop: 4, marginBottom: 24, letterSpacing: 2 }}>{draft.name}</div>
            <KintsugiLine />

            <Field label="代碼(內部 reference)"><input value={draft.code || ""} onChange={e => patch({ code: e.target.value })} style={{ ...inputStyle, fontFamily: "var(--font-jetbrains-mono)" }} /></Field>
            <Field label="名稱"><input value={draft.name || ""} onChange={e => patch({ name: e.target.value })} style={inputStyle} /></Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="分類">
                <select value={draft.category} onChange={e => patch({ category: e.target.value })} style={inputStyle}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="訊息類型">
                <select value={draft.message_type} onChange={e => patch({ message_type: e.target.value as any })} style={inputStyle}>
                  <option value="text">純文字</option>
                  <option value="flex">Flex JSON</option>
                  <option value="image">圖片</option>
                  <option value="sticker">貼圖</option>
                </select>
              </Field>
            </div>

            <Field label="內容(可用 {變數})">
              <textarea value={draft.content || ""} onChange={e => patch({ content: e.target.value })} rows={6} style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-jetbrains-mono)" }} />
            </Field>

            <Field label="可用變數(jsonb array)">
              <input value={JSON.stringify(draft.variables || [])} onChange={e => {
                try { patch({ variables: JSON.parse(e.target.value) }); } catch {}
              }} style={{ ...inputStyle, fontFamily: "var(--font-jetbrains-mono)" }} />
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
            <div style={{ textAlign: "center", color: "var(--ink-mid)" }}>
              <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 32, color: "var(--ink-deep)", letterSpacing: 8, marginBottom: 12 }}>選 一</div>
              <div style={{ fontSize: 13 }}>從左欄點模板</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live preview pane */}
      <div style={{ overflowY: "auto", padding: 24, background: "var(--bg-elev)" }}>
        <div style={labelStyle}>預覽 PREVIEW</div>
        {draft ? (
          <>
            <div style={{ marginTop: 12, marginBottom: 12, fontSize: 11, color: "var(--ink-mid)" }}>變數(JSON):</div>
            <textarea value={previewVars} onChange={e => setPreviewVars(e.target.value)} rows={6} style={{ ...inputStyle, fontFamily: "var(--font-jetbrains-mono)", marginBottom: 16 }} />
            <div style={labelStyle}>渲染後</div>
            <div style={{ marginTop: 8, padding: 16, background: "#06C755", color: "#fff", borderRadius: 12, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "var(--font-noto-sans-tc)" }}>
              {previewText || "(空)"}
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-mid)", marginTop: 8, opacity: 0.7 }}>LINE Bot 訊息預覽(綠泡泡 = LINE 標準)</div>
          </>
        ) : (
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--ink-mid)", lineHeight: 1.7 }}>點左欄模板看 live preview</div>
        )}
      </div>
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
