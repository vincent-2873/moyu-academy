"use client";

import { useEffect, useState } from "react";

/**
 * TrainingEditor — /admin 訓練管理 tab
 *
 * 功能:
 *   - 列出 paths(business_default / recruit_default)
 *   - 點 path 看 module 列表(按 day_offset + sequence 排)
 *   - 編輯 module: title / description / content / duration / reward
 *   - 新增 module(指定 day_offset + sequence)
 *   - 刪除 module
 *
 * 不打算做 path 新增(2 條 fix:business / recruit),只能改 path metadata
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

export default function TrainingEditor() {
  const [paths, setPaths] = useState<Path[]>([]);
  const [modulesByPath, setModulesByPath] = useState<Record<string, Module[]>>({});
  const [activePathId, setActivePathId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Module | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

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

  async function saveModule(mod: Partial<Module>, isNew: boolean) {
    const url = isNew ? "/api/admin/training/module" : `/api/admin/training/module?id=${mod.id}`;
    const method = isNew ? "POST" : "PUT";
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mod),
    });
    if (r.ok) {
      setEditing(null);
      setCreating(false);
      refresh();
    } else {
      const d = await r.json();
      alert(`儲存失敗: ${d.error || r.status}`);
    }
  }

  async function deleteModule(id: string) {
    if (!confirm("刪除這個 module?(無法復原)")) return;
    const r = await fetch(`/api/admin/training/module?id=${id}`, { method: "DELETE" });
    if (r.ok) refresh();
  }

  if (loading) return <div className="p-6 text-sm" style={{ color: "var(--ink-mid)" }}>載入中…</div>;

  const activePath = paths.find(p => p.id === activePathId);
  const modules = activePathId ? (modulesByPath[activePathId] || []) : [];

  return (
    <div className="p-6 max-w-6xl mx-auto" style={{ background: "var(--bg-paper)", minHeight: "100vh" }}>
      <h2 style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 24, fontWeight: 600, color: "var(--ink-deep)", marginBottom: 24 }}>
        訓練管理
      </h2>

      {/* Path tabs */}
      <div className="flex gap-2 mb-6">
        {paths.map(p => (
          <button
            key={p.id}
            onClick={() => setActivePathId(p.id)}
            className="px-4 py-2 rounded-md text-sm transition-colors"
            style={{
              background: p.id === activePathId ? "var(--ink-deep)" : "transparent",
              color: p.id === activePathId ? "var(--bg-paper)" : "var(--ink-deep)",
              border: "1px solid var(--border-soft)",
              fontFamily: "var(--font-noto-serif-tc)",
            }}
          >
            {p.name}
            <span style={{ marginLeft: 8, opacity: 0.6, fontSize: 11 }}>
              {(modulesByPath[p.id] || []).length} module
            </span>
          </button>
        ))}
      </div>

      {/* Active path info */}
      {activePath && (
        <div className="mb-4 p-4 rounded-md" style={{ background: "var(--bg-elev)", border: "1px solid var(--border-soft)" }}>
          <div style={{ fontSize: 13, color: "var(--ink-mid)" }}>{activePath.code}</div>
          <div style={{ fontSize: 14, color: "var(--ink-deep)", marginTop: 4 }}>{activePath.description || "—"}</div>
        </div>
      )}

      {/* Modules table */}
      <div className="space-y-2 mb-4">
        {modules.map(m => (
          <div key={m.id} className="p-3 rounded-md flex items-start gap-3" style={{ background: "var(--bg-paper)", border: "1px solid var(--border-soft)" }}>
            <div className="flex-shrink-0 text-center" style={{ width: 60, color: "var(--accent-red)", fontFamily: "var(--font-noto-serif-tc)" }}>
              <div style={{ fontSize: 22, fontWeight: 600 }}>D{m.day_offset}</div>
              <div style={{ fontSize: 10, opacity: 0.6 }}>#{m.sequence}</div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-xs" style={{ background: "var(--ink-deep)", color: "var(--bg-paper)" }}>
                  {m.module_type}
                </span>
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-deep)", fontFamily: "var(--font-noto-serif-tc)" }}>
                  {m.title}
                </span>
                {m.duration_min && <span style={{ fontSize: 11, color: "var(--ink-mid)" }}>· {m.duration_min} 分</span>}
                {m.reward?.stamp && <span style={{ fontSize: 11, color: "var(--accent-red)" }}>🔴 {m.reward.stamp}</span>}
              </div>
              {m.description && <div style={{ fontSize: 12, color: "var(--ink-mid)", lineHeight: 1.6 }}>{m.description}</div>}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => setEditing(m)} className="px-3 py-1 rounded text-xs" style={{ background: "var(--ink-deep)", color: "var(--bg-paper)" }}>改</button>
              <button onClick={() => deleteModule(m.id)} className="px-3 py-1 rounded text-xs" style={{ background: "transparent", color: "var(--accent-red)", border: "1px solid var(--accent-red)" }}>刪</button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => setCreating(true)} className="px-4 py-2 rounded-md text-sm" style={{ background: "var(--accent-red)", color: "var(--bg-paper)", fontFamily: "var(--font-noto-serif-tc)" }}>
        + 新增 module
      </button>

      {/* Edit / Create modal */}
      {(editing || creating) && (
        <ModuleModal
          module={editing}
          pathId={activePathId!}
          onSave={(mod) => saveModule(mod, creating)}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function ModuleModal({ module, pathId, onSave, onClose }: {
  module: Module | null;
  pathId: string;
  onSave: (mod: any) => void;
  onClose: () => void;
}) {
  const [m, setM] = useState<any>(module || {
    path_id: pathId,
    day_offset: 0,
    sequence: 1,
    module_type: "reading",
    title: "",
    description: "",
    content: {},
    duration_min: 30,
    required: true,
    reward: {},
  });
  const [contentJson, setContentJson] = useState(JSON.stringify(m.content || {}, null, 2));
  const [rewardJson, setRewardJson] = useState(JSON.stringify(m.reward || {}, null, 2));

  function save() {
    let content, reward;
    try { content = JSON.parse(contentJson); } catch { alert("content JSON 格式錯"); return; }
    try { reward = JSON.parse(rewardJson); } catch { alert("reward JSON 格式錯"); return; }
    onSave({ ...m, content, reward });
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999,
        background: "rgba(15, 15, 15, 0.65)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="w-full max-w-2xl rounded-md"
        style={{
          background: "var(--bg-paper, #f7f1e3)",
          border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          position: "relative",
          zIndex: 10000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-soft, rgba(26,26,26,0.10))", background: "var(--bg-paper, #f7f1e3)", position: "sticky", top: 0, zIndex: 1 }}>
          <div style={{ fontFamily: "var(--font-noto-serif-tc, serif)", fontSize: 18, color: "var(--ink-deep, #1a1a1a)" }}>
            {module ? "編輯 module" : "新增 module"}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full" style={{ color: "var(--ink-mid, #4a4a4a)", background: "transparent", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))" }}>✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Day"><input type="number" value={m.day_offset} onChange={e => setM({ ...m, day_offset: +e.target.value })} className="w-full px-2 py-1 rounded" style={inputStyle} /></Field>
            <Field label="順序"><input type="number" value={m.sequence} onChange={e => setM({ ...m, sequence: +e.target.value })} className="w-full px-2 py-1 rounded" style={inputStyle} /></Field>
            <Field label="時長(分)"><input type="number" value={m.duration_min || 0} onChange={e => setM({ ...m, duration_min: +e.target.value })} className="w-full px-2 py-1 rounded" style={inputStyle} /></Field>
          </div>
          <Field label="類型">
            <select value={m.module_type} onChange={e => setM({ ...m, module_type: e.target.value })} className="w-full px-2 py-1 rounded" style={inputStyle}>
              {["video", "reading", "quiz", "sparring", "task", "reflection", "live_session"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="標題"><input type="text" value={m.title} onChange={e => setM({ ...m, title: e.target.value })} className="w-full px-2 py-1 rounded" style={inputStyle} /></Field>
          <Field label="說明"><textarea value={m.description || ""} onChange={e => setM({ ...m, description: e.target.value })} rows={2} className="w-full px-2 py-1 rounded" style={inputStyle} /></Field>
          <Field label="必修"><input type="checkbox" checked={m.required} onChange={e => setM({ ...m, required: e.target.checked })} /></Field>
          <Field label="content (JSON)"><textarea value={contentJson} onChange={e => setContentJson(e.target.value)} rows={5} className="w-full px-2 py-1 rounded font-mono text-xs" style={inputStyle} /></Field>
          <Field label="reward (JSON)"><textarea value={rewardJson} onChange={e => setRewardJson(e.target.value)} rows={3} className="w-full px-2 py-1 rounded font-mono text-xs" style={inputStyle} /></Field>
        </div>
        <div className="p-5 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border-soft)" }}>
          <button onClick={onClose} className="px-4 py-2 rounded text-sm" style={{ background: "transparent", color: "var(--ink-mid)", border: "1px solid var(--border-soft)" }}>取消</button>
          <button onClick={save} className="px-4 py-2 rounded text-sm" style={{ background: "var(--ink-deep)", color: "var(--bg-paper)", fontFamily: "var(--font-noto-serif-tc)" }}>儲存</button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-paper)",
  border: "1px solid var(--border-soft)",
  color: "var(--ink-deep)",
  fontSize: 13,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div style={{ fontSize: 11, color: "var(--ink-mid)", marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}
