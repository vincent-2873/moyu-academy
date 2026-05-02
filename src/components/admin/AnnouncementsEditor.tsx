"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Item = {
  id: string;
  title: string | null;
  content: string;
  category: string | null;
  severity: string | null;
  target_brand: string | null;
  target_role: string | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export default function AnnouncementsEditor() {
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Item> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/admin/announcements");
    const d = await r.json();
    setItems(d.items || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!activeId) { setDraft(null); return; }
    const it = items.find(x => x.id === activeId);
    if (it) { setDraft({ ...it }); setDirty(false); }
  }, [activeId, items]);

  function newItem() {
    setDraft({ title: "", content: "", category: "general", severity: "info", target_brand: null, target_role: null, is_active: true, expires_at: null });
    setActiveId("__new__");
    setDirty(true);
  }

  async function save() {
    if (!draft || !dirty) return;
    setSaving(true);
    const isNew = !draft.id || draft.id === "__new__" || activeId === "__new__";
    const url = isNew ? "/api/admin/announcements" : `/api/admin/announcements?id=${draft.id}`;
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
      if (isNew && d.item?.id) setActiveId(d.item.id);
    } else {
      const d = await r.json();
      alert(`儲存失敗: ${d.error || r.status}`);
    }
    setSaving(false);
  }

  async function del() {
    if (!draft?.id) return;
    if (!confirm(`刪除「${draft.title || draft.content?.slice(0, 30)}」?`)) return;
    const r = await fetch(`/api/admin/announcements?id=${draft.id}`, { method: "DELETE" });
    if (r.ok) {
      setActiveId(null); setDraft(null); refresh();
    }
  }

  function patch(p: Partial<Item>) {
    if (!draft) return;
    setDraft({ ...draft, ...p });
    setDirty(true);
  }

  if (loading) return <div className="p-12 text-center text-sm" style={{ color: "var(--ink-mid)" }}>載入公告…</div>;

  return (
    <div style={{ height: "calc(100vh - 60px)", background: "var(--bg-paper, #f7f1e3)", display: "grid", gridTemplateColumns: "360px 1fr" }}>
      {/* List */}
      <div style={{ borderRight: "1px solid var(--border-soft, rgba(26,26,26,0.10))", overflowY: "auto" }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--border-soft, rgba(26,26,26,0.10))", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--bg-paper)", zIndex: 1 }}>
          <div>
            <div style={labelStyle}>公 ANNOUNCEMENTS · {items.length}</div>
            <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 18, color: "var(--ink-deep)", marginTop: 4 }}>跑馬燈 · 公告</div>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={newItem} style={btnPrimary}>+ 新增</motion.button>
        </div>
        <div className="p-2 space-y-1">
          {items.map((it, idx) => {
            const active = it.id === activeId;
            return (
              <motion.button
                key={it.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                whileHover={{ x: 2 }}
                onClick={() => setActiveId(it.id)}
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
                  {it.severity && <Badge severity={it.severity} />}
                  {!it.is_active && <span style={{ fontSize: 10, opacity: 0.5 }}>停用</span>}
                  <span style={{ fontSize: 10, opacity: 0.6, marginLeft: "auto" }}>{new Date(it.created_at).toISOString().slice(5, 10)}</span>
                </div>
                <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 13, fontWeight: 500, lineHeight: 1.4, marginBottom: 2 }}>
                  {it.title || "(無標題)"}
                </div>
                <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
                  {it.content}
                </div>
              </motion.button>
            );
          })}
          {items.length === 0 && (
            <div style={{ textAlign: "center", padding: 32, color: "var(--ink-mid)", fontSize: 13 }}>
              還沒有公告 — 點右上「+ 新增」
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <AnimatePresence mode="wait">
        {draft ? (
          <motion.div key={draft.id || "new"} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.25 }} style={{ overflowY: "auto", padding: 32 }}>
            <div style={labelStyle}>編 EDITING</div>
            <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 22, color: "var(--ink-deep)", marginTop: 4, marginBottom: 24, letterSpacing: 2 }}>
              {draft.title || "(無標題公告)"}
            </div>
            <KintsugiLine />

            <Field label="標題">
              <input value={draft.title || ""} onChange={e => patch({ title: e.target.value })} style={inputStyle} />
            </Field>

            <Field label="內容">
              <textarea value={draft.content || ""} onChange={e => patch({ content: e.target.value })} rows={5} style={{ ...inputStyle, resize: "vertical" }} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="分類">
                <select value={draft.category || ""} onChange={e => patch({ category: e.target.value })} style={inputStyle}>
                  <option value="general">一般</option>
                  <option value="urgent">緊急</option>
                  <option value="rule">規則</option>
                  <option value="event">活動</option>
                  <option value="training">訓練</option>
                  <option value="celebration">慶賀</option>
                </select>
              </Field>
              <Field label="嚴重度">
                <select value={draft.severity || ""} onChange={e => patch({ severity: e.target.value })} style={inputStyle}>
                  <option value="info">資訊</option>
                  <option value="success">成功</option>
                  <option value="warning">警示</option>
                  <option value="danger">危急</option>
                </select>
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="目標品牌(留空 = 全品牌)">
                <input value={draft.target_brand || ""} onChange={e => patch({ target_brand: e.target.value || null })} placeholder="如 nschool / aischool" style={inputStyle} />
              </Field>
              <Field label="目標角色(留空 = 全角色)">
                <input value={draft.target_role || ""} onChange={e => patch({ target_role: e.target.value || null })} placeholder="如 sales_rep / legal_staff" style={inputStyle} />
              </Field>
            </div>

            <Field label="到期時間(留空 = 永久)">
              <input type="datetime-local" value={draft.expires_at ? draft.expires_at.slice(0, 16) : ""} onChange={e => patch({ expires_at: e.target.value || null })} style={inputStyle} />
            </Field>

            <Field label="啟用狀態">
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={draft.is_active ?? true} onChange={e => patch({ is_active: e.target.checked })} />
                <span style={{ fontSize: 13, color: "var(--ink-mid)" }}>{draft.is_active ?? true ? "啟用中(會在跑馬燈顯示)" : "停用"}</span>
              </label>
            </Field>

            <div style={{ position: "sticky", bottom: 0, background: "var(--bg-paper)", padding: "16px 0", marginTop: 24, borderTop: "1px solid var(--border-soft, rgba(26,26,26,0.10))", display: "flex", gap: 12, justifyContent: "flex-end" }}>
              {draft.id && draft.id !== "__new__" && (
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
              <div style={{ fontSize: 13, lineHeight: 1.7 }}>從左欄點公告開始編輯<br/>或右上「+ 新增」建一個</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Badge({ severity }: { severity: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    info:    { bg: "rgba(74,74,74,0.1)",  color: "var(--ink-deep)",   label: "資訊" },
    success: { bg: "rgba(201,169,110,0.2)", color: "var(--gold-thread, #c9a96e)", label: "成功" },
    warning: { bg: "rgba(185,28,28,0.1)", color: "var(--accent-red)", label: "警示" },
    danger:  { bg: "var(--accent-red)",    color: "var(--bg-paper)",  label: "危急" },
  };
  const s = map[severity] || map.info;
  return (
    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 2, background: s.bg, color: s.color, letterSpacing: 1, fontWeight: 600 }}>
      {s.label}
    </span>
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
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 4, background: "var(--bg-paper)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", color: "var(--ink-deep)", fontSize: 13, fontFamily: "var(--font-noto-sans-tc, sans-serif)" };
const btnPrimary: React.CSSProperties = { padding: "8px 16px", borderRadius: 4, background: "var(--ink-deep)", color: "var(--bg-paper)", fontSize: 13, fontFamily: "var(--font-noto-serif-tc)", letterSpacing: 4, border: "none", cursor: "pointer" };
const btnDanger: React.CSSProperties = { padding: "8px 16px", borderRadius: 4, background: "transparent", color: "var(--accent-red)", border: "1px solid var(--accent-red)", fontSize: 13, fontFamily: "var(--font-noto-serif-tc)", cursor: "pointer" };
