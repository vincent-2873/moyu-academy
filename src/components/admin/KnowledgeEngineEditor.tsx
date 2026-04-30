"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BreathingNumber from "@/components/wabi/BreathingNumber";

type Chunk = {
  id: string;
  source_type: string;
  source_id: string;
  title: string | null;
  content_preview: string;
  token_count: number | null;
  has_embedding: boolean;
  pillar?: string;
  allowed_roles?: string[] | null;
  created_at: string;
  updated_at: string;
};

type Pillar = "hr" | "legal" | "sales" | "common";

const PILLAR_LABEL: Record<string, string> = {
  hr: "HR 招聘",
  legal: "法務",
  sales: "業務",
  common: "通用",
};
const PILLAR_COLOR: Record<string, string> = {
  hr: "#0891b2",       // 青
  legal: "#b91c1c",    // 朱
  sales: "#c9a96e",    // 金
  common: "#4a4a4a",   // 灰
};

export default function KnowledgeEngineEditor() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [pillarFilter, setPillarFilter] = useState<Pillar | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggerResult, setTriggerResult] = useState<any>(null);
  const [autoClassifying, setAutoClassifying] = useState(false);
  const [savingPillar, setSavingPillar] = useState(false);
  const [notionConfig, setNotionConfig] = useState<any[]>([]);
  const [notionConfigEdits, setNotionConfigEdits] = useState<Record<string, string>>({});
  const [notionConfigSaving, setNotionConfigSaving] = useState<string | null>(null);
  const [pillarIngesting, setPillarIngesting] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const [statsR, cfgR] = await Promise.all([
      fetch("/api/admin/knowledge-stats"),
      fetch("/api/admin/rag/notion-config"),
    ]);
    const d = await statsR.json();
    setData(d);
    try {
      const cfg = await cfgR.json();
      setNotionConfig(cfg.rows || []);
    } catch {}
    setLoading(false);
  }

  async function updateChunkPillar(id: string, newPillar: Pillar) {
    setSavingPillar(true);
    try {
      await fetch("/api/admin/rag/update-chunk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, pillar: newPillar }),
      });
      await refresh();
    } finally {
      setSavingPillar(false);
    }
  }

  async function saveNotionDbId(pillar: string) {
    const dbId = notionConfigEdits[pillar];
    if (!dbId) return;
    setNotionConfigSaving(pillar);
    try {
      await fetch("/api/admin/rag/notion-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pillar, notion_database_id: dbId, enabled: true }),
      });
      setNotionConfigEdits((prev) => { const c = { ...prev }; delete c[pillar]; return c; });
      await refresh();
    } finally {
      setNotionConfigSaving(null);
    }
  }

  async function ingestPillar(pillar: string) {
    setPillarIngesting(pillar);
    setTriggerResult(null);
    try {
      const r = await fetch("/api/admin/rag/ingest-notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pillar, max_pages: 100 }),
      });
      const d = await r.json();
      setTriggerResult(d);
      await refresh();
    } finally {
      setPillarIngesting(null);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function trigger(action: string) {
    setTriggering(action);
    setTriggerResult(null);
    const r = await fetch("/api/admin/rag-trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const d = await r.json();
    setTriggerResult(d);
    setTriggering(null);
    await refresh();
  }

  if (loading) return <div className="p-12 text-center text-sm" style={{ color: "var(--ink-mid)" }}>載入知識庫…</div>;

  const chunks: Chunk[] = data?.chunks || [];
  const filtered = chunks.filter((c) => {
    if (sourceFilter && c.source_type !== sourceFilter) return false;
    if (pillarFilter && (c.pillar || "common") !== pillarFilter) return false;
    if (filter) {
      const lf = filter.toLowerCase();
      return (
        (c.title || "").toLowerCase().includes(lf) ||
        (c.source_id || "").toLowerCase().includes(lf) ||
        (c.content_preview || "").toLowerCase().includes(lf)
      );
    }
    return true;
  });

  async function autoClassify() {
    setAutoClassifying(true);
    setTriggerResult(null);
    const r = await fetch("/api/admin/rag/auto-classify-pillar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dry_run: false, only_common: true }),
    });
    const d = await r.json();
    setTriggerResult(d);
    setAutoClassifying(false);
    await refresh();
  }

  const active = chunks.find((c) => c.id === activeId);

  return (
    <div style={{ height: "calc(100vh - 60px)", background: "var(--bg-paper)", display: "grid", gridTemplateColumns: "400px 1fr" }}>
      {/* List */}
      <div style={{ borderRight: "1px solid var(--border-soft, rgba(26,26,26,0.10))", overflowY: "auto" }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--border-soft, rgba(26,26,26,0.10))", position: "sticky", top: 0, background: "var(--bg-paper)", zIndex: 1 }}>
          <div style={labelStyle}>知 KNOWLEDGE · {filtered.length}/{data?.total_chunks || 0}</div>
          <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 18, color: "var(--ink-deep)", marginTop: 4, marginBottom: 12 }}>知識庫</div>

          {/* stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <Stat label="總片段" value={data?.total_chunks || 0} />
            <Stat label="已 embed" value={data?.total_embedded || 0} warning={(data?.total_embedded || 0) === 0 && (data?.total_chunks || 0) > 0} />
          </div>

          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="搜:title / id / 內容" style={{ ...inputStyle, marginBottom: 8 }} />

          {/* source filter */}
          <div className="flex flex-wrap gap-1 mb-2">
            <SourceChip label="全部" active={sourceFilter === null} onClick={() => setSourceFilter(null)} count={data?.total_chunks || 0} />
            {Object.entries(data?.source_counts || {}).map(([k, v]: any) => (
              <SourceChip key={k} label={k} active={sourceFilter === k} onClick={() => setSourceFilter(k)} count={v.total} />
            ))}
          </div>

          {/* RAG 三池 pillar filter (Vincent 2026-04-30 反饋#1) */}
          {data?.pillar_counts && (
            <div>
              <div style={{ ...labelStyle, fontSize: 9, marginBottom: 4 }}>池 PILLAR</div>
              <div className="flex flex-wrap gap-1">
                <SourceChip label="全部" active={pillarFilter === null} onClick={() => setPillarFilter(null)} count={data?.total_chunks || 0} />
                {(["hr", "legal", "sales", "common"] as Pillar[]).map((p) => {
                  const stats = data.pillar_counts[p] || { total: 0, embedded: 0 };
                  return (
                    <SourceChip
                      key={p}
                      label={PILLAR_LABEL[p]}
                      active={pillarFilter === p}
                      onClick={() => setPillarFilter(p)}
                      count={stats.total}
                      colorAccent={PILLAR_COLOR[p]}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-2 space-y-1">
          {filtered.slice(0, 200).map((c, idx) => {
            const isActive = c.id === activeId;
            return (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.01, 0.2) }}
                whileHover={{ x: 2 }}
                onClick={() => setActiveId(c.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 4,
                  background: isActive ? "var(--ink-deep)" : "transparent",
                  color: isActive ? "var(--bg-paper)" : "var(--ink-deep)",
                  border: "1px solid",
                  borderColor: isActive ? "var(--ink-deep)" : "transparent",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, opacity: 0.6, letterSpacing: 1, textTransform: "uppercase" }}>{c.source_type}</span>
                  {c.pillar && (
                    <span style={{ fontSize: 9, color: isActive ? "rgba(255,255,255,0.85)" : PILLAR_COLOR[c.pillar] || "var(--ink-mid)", fontWeight: 600 }}>{PILLAR_LABEL[c.pillar] || c.pillar}</span>
                  )}
                  {c.has_embedding && <span style={{ fontSize: 9, color: isActive ? "rgba(201,169,110,1)" : "var(--gold-thread, #c9a96e)" }}>✓ embed</span>}
                  <span style={{ fontSize: 9, opacity: 0.5, marginLeft: "auto" }}>{c.token_count || 0} tk</span>
                </div>
                <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 13, fontWeight: 500, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.title || "(無標題)"}
                </div>
                <div style={{ fontSize: 10, opacity: 0.6, fontFamily: "var(--font-jetbrains-mono)" }}>
                  {c.source_id?.slice(0, 50) || "—"}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Detail / Trigger */}
      <div style={{ overflowY: "auto" }}>
        {/* Trigger panel */}
        <div style={{ padding: 24, borderBottom: "1px solid var(--border-soft, rgba(26,26,26,0.10))", background: "var(--bg-elev)" }}>
          <div style={labelStyle}>觸 TRIGGER</div>
          <div className="flex flex-wrap gap-2 mt-3">
            <TriggerButton label="📁 Ingest 本機 training/" onClick={() => trigger("ingest_local")} loading={triggering === "ingest_local"} />
            <TriggerButton label="📚 Ingest Notion (common)" onClick={() => trigger("ingest_notion")} loading={triggering === "ingest_notion"} />
            <TriggerButton label="🧠 Embed pending" onClick={() => trigger("embed_pending")} loading={triggering === "embed_pending"} primary />
            <TriggerButton label="⚡ All in one" onClick={() => trigger("all")} loading={triggering === "all"} primary />
            <TriggerButton label="🏛️ Auto 分 Pillar" onClick={autoClassify} loading={autoClassifying} />
          </div>

          {/* F2 (2026-04-30 第三輪):Notion DB per-pillar config + ingest trigger */}
          <div style={{ marginTop: 24 }}>
            <div style={labelStyle}>池 PILLAR · NOTION DB</div>
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-mid)", lineHeight: 1.6 }}>
              填 Notion database_id 後 → 「同步」會撈該 DB 全部 page 進對應 pillar
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              {(["hr", "sales", "legal"] as Pillar[]).map((p) => {
                const cfg = notionConfig.find((c) => c.id === p);
                const editing = notionConfigEdits[p] !== undefined;
                const dbIdVal = editing ? notionConfigEdits[p] : (cfg?.notion_database_id || "");
                const lastSync = cfg?.last_synced_at ? new Date(cfg.last_synced_at).toISOString().slice(0, 16).replace("T", " ") : "—";
                return (
                  <div key={p} style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr auto auto",
                    gap: 8,
                    alignItems: "center",
                    padding: "6px 10px",
                    background: "var(--bg-paper)",
                    border: `1px solid ${cfg?.notion_database_id ? PILLAR_COLOR[p] : "var(--border-soft, rgba(26,26,26,0.10))"}`,
                    borderRadius: 4,
                  }}>
                    <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 12, color: PILLAR_COLOR[p], fontWeight: 600 }}>
                      {PILLAR_LABEL[p]}
                    </div>
                    <input
                      value={dbIdVal}
                      onChange={(e) => setNotionConfigEdits((prev) => ({ ...prev, [p]: e.target.value }))}
                      placeholder="Notion database_id (32-hex,Notion URL 末段)"
                      style={{ ...inputStyle, fontSize: 11, padding: "4px 8px", fontFamily: "var(--font-jetbrains-mono)" }}
                    />
                    <button
                      onClick={() => saveNotionDbId(p)}
                      disabled={!editing || notionConfigSaving === p}
                      style={{
                        padding: "4px 10px",
                        background: editing ? "var(--ink-deep)" : "transparent",
                        color: editing ? "var(--bg-paper)" : "var(--ink-mid)",
                        border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
                        borderRadius: 3,
                        fontSize: 11,
                        cursor: editing ? "pointer" : "not-allowed",
                      }}
                    >
                      {notionConfigSaving === p ? "..." : "存"}
                    </button>
                    <button
                      onClick={() => ingestPillar(p)}
                      disabled={!cfg?.notion_database_id || pillarIngesting === p}
                      style={{
                        padding: "4px 10px",
                        background: cfg?.notion_database_id ? PILLAR_COLOR[p] : "var(--border-soft, rgba(26,26,26,0.10))",
                        color: cfg?.notion_database_id ? "var(--bg-paper)" : "var(--ink-mid)",
                        border: "none",
                        borderRadius: 3,
                        fontSize: 11,
                        cursor: cfg?.notion_database_id ? "pointer" : "not-allowed",
                      }}
                      title={`最後同步:${lastSync}`}
                    >
                      {pillarIngesting === p ? "..." : "同步"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {triggerResult && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 12, padding: 12, background: "var(--bg-paper)", borderRadius: 4, fontSize: 11, fontFamily: "var(--font-jetbrains-mono)", color: "var(--ink-mid)", whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>
              {JSON.stringify(triggerResult.results || triggerResult, null, 2)}
            </motion.div>
          )}
        </div>

        {/* Detail */}
        <AnimatePresence mode="wait">
          {active ? (
            <motion.div key={active.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} style={{ padding: 32 }}>
              <div style={labelStyle}>詳 DETAIL</div>
              <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 22, color: "var(--ink-deep)", marginTop: 4, marginBottom: 12, letterSpacing: 1 }}>
                {active.title || "(無標題)"}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-mid)", fontFamily: "var(--font-jetbrains-mono)", marginBottom: 16 }}>
                {active.source_type} · {active.source_id} · {active.token_count || 0} tokens · {active.has_embedding ? "✓ embedded" : "✗ no embedding"}
              </div>

              {/* F3 (2026-04-30 第三輪):pillar dropdown 手動 re-tag */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, padding: "10px 14px", background: "var(--bg-elev)", borderRadius: 4, border: `1px solid ${PILLAR_COLOR[active.pillar || "common"]}` }}>
                <div style={{ fontSize: 10, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600 }}>池</div>
                <select
                  value={active.pillar || "common"}
                  onChange={(e) => updateChunkPillar(active.id, e.target.value as Pillar)}
                  disabled={savingPillar}
                  style={{
                    padding: "6px 10px",
                    background: "var(--bg-paper)",
                    border: `1px solid ${PILLAR_COLOR[active.pillar || "common"]}`,
                    color: PILLAR_COLOR[active.pillar || "common"],
                    borderRadius: 3,
                    fontSize: 13,
                    fontFamily: "var(--font-noto-serif-tc)",
                    cursor: savingPillar ? "wait" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  {(["hr", "legal", "sales", "common"] as Pillar[]).map((p) => (
                    <option key={p} value={p}>{PILLAR_LABEL[p]}</option>
                  ))}
                </select>
                {savingPillar && <span style={{ fontSize: 11, color: "var(--ink-mid)" }}>儲存中…</span>}
                {active.allowed_roles && active.allowed_roles.length > 0 && (
                  <span style={{ fontSize: 10, color: "var(--ink-mid)", marginLeft: "auto" }}>
                    ACL: {active.allowed_roles.join(", ")}
                  </span>
                )}
              </div>

              <div style={{ padding: 16, background: "var(--bg-elev)", borderRadius: 4, fontSize: 13, color: "var(--ink-deep)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {active.content_preview}
                {(active.content_preview || "").length >= 300 && <span style={{ color: "var(--ink-mid)" }}>… (預覽前 300 字)</span>}
              </div>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80 }}>
              <div style={{ textAlign: "center", color: "var(--ink-mid)" }}>
                <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 32, color: "var(--ink-deep)", letterSpacing: 8, marginBottom: 12 }}>選 一</div>
                <div style={{ fontSize: 13, lineHeight: 1.7 }}>左欄點 chunk 看內容預覽<br/>上方按鈕觸發 ingest / embedding</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Stat({ label, value, warning }: { label: string; value: number; warning?: boolean }) {
  return (
    <div style={{ padding: 8, background: warning ? "rgba(185,28,28,0.05)" : "var(--bg-elev)", border: warning ? "1px solid var(--accent-red)" : "none", borderRadius: 4 }}>
      <div style={{ fontSize: 9, color: warning ? "var(--accent-red)" : "var(--ink-mid)", letterSpacing: 1, fontWeight: 600 }}>{label}</div>
      <BreathingNumber size={20} color={warning ? "var(--accent-red)" : undefined}>{value.toLocaleString()}</BreathingNumber>
    </div>
  );
}

function SourceChip({ label, active, onClick, count, colorAccent }: { label: string; active: boolean; onClick: () => void; count: number; colorAccent?: string }) {
  return (
    <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }} onClick={onClick} style={{
      padding: "3px 8px",
      borderRadius: 3,
      background: active ? (colorAccent || "var(--ink-deep)") : "transparent",
      color: active ? "var(--bg-paper)" : (colorAccent || "var(--ink-deep)"),
      border: `1px solid ${active ? (colorAccent || "var(--ink-deep)") : "var(--border-soft, rgba(26,26,26,0.10))"}`,
      fontSize: 10,
      fontFamily: "var(--font-noto-serif-tc)",
      cursor: "pointer",
    }}>
      {label} <span style={{ opacity: 0.6 }}>{count}</span>
    </motion.button>
  );
}

function TriggerButton({ label, onClick, loading, primary }: { label: string; onClick: () => void; loading: boolean; primary?: boolean }) {
  return (
    <motion.button whileHover={{ scale: loading ? 1 : 1.03 }} whileTap={{ scale: loading ? 1 : 0.97 }} onClick={onClick} disabled={loading} style={{
      padding: "8px 14px",
      borderRadius: 4,
      background: loading ? "var(--border-soft, rgba(26,26,26,0.10))" : primary ? "var(--accent-red)" : "var(--ink-deep)",
      color: loading ? "var(--ink-mid)" : "var(--bg-paper)",
      border: "none",
      fontSize: 12,
      fontFamily: "var(--font-noto-serif-tc)",
      letterSpacing: 1,
      cursor: loading ? "wait" : "pointer",
    }}>
      {loading ? "處理中…" : label}
    </motion.button>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600, textTransform: "uppercase" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 4, background: "var(--bg-paper)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", color: "var(--ink-deep)", fontSize: 13 };
