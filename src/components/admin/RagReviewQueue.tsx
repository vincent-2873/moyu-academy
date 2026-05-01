"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * 2026-04-30 Wave C UI A:後台 RAG 審核佇列
 *
 * Admin 看員工(/upload)上傳的待審 chunks,approve/reject
 */

type Pillar = "sales" | "legal" | "common";

// 2026-05-01:hr 體系全砍(對齊 system-tree v2)
const PILLAR_LABEL: Record<string, string> = {
  sales: "業務", legal: "法務", common: "通用",
};
const PILLAR_COLOR: Record<string, string> = {
  sales: "#c9a96e", legal: "#b91c1c", common: "#4a4a4a",
};

interface Chunk {
  id: string;
  title: string;
  content_preview: string;
  content_length: number;
  source_type: string;
  pillar: string;
  visibility: string;
  uploaded_by_email: string;
  uploaded_at: string;
  source_mime: string;
  transcript_status: string;
  pii_count: number;
  created_at: string;
}

export default function RagReviewQueue() {
  const [items, setItems] = useState<Chunk[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pillarFilter, setPillarFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [editPillar, setEditPillar] = useState<Pillar>("common");
  const [rejectReason, setRejectReason] = useState("");

  async function refresh() {
    setLoading(true);
    const url = pillarFilter ? `/api/admin/rag/review-queue?pillar=${pillarFilter}` : "/api/admin/rag/review-queue";
    const r = await fetch(url);
    const d = await r.json();
    setItems(d.items || []);
    setStats(d.stats || {});
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [pillarFilter]);

  async function action(act: "approve" | "reject") {
    if (!activeId) return;
    setActing(true);
    try {
      const body: Record<string, unknown> = { id: activeId, action: act };
      if (act === "approve") {
        body.pillar = editPillar;
      } else {
        body.rejection_reason = rejectReason || "未說明";
      }
      await fetch("/api/admin/rag/review-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setActiveId(null);
      setRejectReason("");
      await refresh();
    } finally {
      setActing(false);
    }
  }

  const active = items.find((c) => c.id === activeId);

  return (
    <div style={{ height: "calc(100vh - 60px)", background: "var(--bg-paper)", display: "grid", gridTemplateColumns: "420px 1fr" }}>
      {/* List */}
      <div style={{ borderRight: "1px solid var(--border-soft, rgba(26,26,26,0.10))", overflowY: "auto" }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--border-soft, rgba(26,26,26,0.10))", position: "sticky", top: 0, background: "var(--bg-paper)", zIndex: 1 }}>
          <div style={labelStyle}>審 REVIEW · {items.length}</div>
          <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 18, color: "var(--ink-deep)", marginTop: 4, marginBottom: 12 }}>審核佇列</div>

          <div className="flex flex-wrap gap-1 mb-2">
            <Chip label="全部" active={pillarFilter === null} onClick={() => setPillarFilter(null)} count={Object.values(stats).reduce((s, n) => s + n, 0)} />
            {(["hr", "sales", "legal", "common"] as Pillar[]).map((p) => (
              <Chip
                key={p}
                label={PILLAR_LABEL[p]}
                active={pillarFilter === p}
                onClick={() => setPillarFilter(p)}
                count={stats[p] || 0}
                colorAccent={PILLAR_COLOR[p]}
              />
            ))}
          </div>
        </div>

        <div className="p-2 space-y-1">
          {loading ? (
            <div className="p-12 text-center text-sm" style={{ color: "var(--ink-mid)" }}>載入中…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-sm" style={{ color: "var(--ink-mid)" }}>👍 沒有待審項目</div>
          ) : items.map((c) => {
            const isActive = c.id === activeId;
            return (
              <motion.button
                key={c.id}
                whileHover={{ x: 2 }}
                onClick={() => { setActiveId(c.id); setEditPillar(c.pillar as Pillar); }}
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
                  <span style={{ fontSize: 9, color: isActive ? "rgba(255,255,255,0.85)" : PILLAR_COLOR[c.pillar], fontWeight: 600 }}>{PILLAR_LABEL[c.pillar]}</span>
                  {c.pii_count > 0 && (
                    <span style={{ fontSize: 9, color: "var(--accent-red)" }}>⚠️ {c.pii_count} PII</span>
                  )}
                  <span style={{ fontSize: 9, opacity: 0.5, marginLeft: "auto" }}>{c.content_length} chars</span>
                </div>
                <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 13, fontWeight: 500, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.title || "(無標題)"}
                </div>
                <div style={{ fontSize: 10, opacity: 0.6, fontFamily: "var(--font-jetbrains-mono)" }}>
                  by {c.uploaded_by_email} · {new Date(c.uploaded_at).toISOString().slice(5, 16).replace("T", " ")}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Detail */}
      <div style={{ overflowY: "auto" }}>
        <AnimatePresence mode="wait">
          {active ? (
            <motion.div key={active.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} style={{ padding: 32 }}>
              <div style={labelStyle}>檢 REVIEW</div>
              <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 22, color: "var(--ink-deep)", marginTop: 4, marginBottom: 12, letterSpacing: 1 }}>
                {active.title}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-mid)", fontFamily: "var(--font-jetbrains-mono)", marginBottom: 16 }}>
                {active.source_type} · {active.uploaded_by_email} · {active.source_mime} · {active.transcript_status}
              </div>

              {active.pii_count > 0 && (
                <div style={{ padding: 10, background: "rgba(185,28,28,0.05)", border: "1px solid var(--accent-red)", borderRadius: 4, marginBottom: 16, fontSize: 12, color: "var(--accent-red)" }}>
                  ⚠️ 偵測到 {active.pii_count} 件 PII(已自動 anonymize)
                </div>
              )}

              {/* approve form */}
              <div style={{ display: "grid", gap: 12, padding: 16, background: "var(--bg-elev)", borderRadius: 4, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600 }}>核准前可改 pillar</div>
                <div className="flex gap-2 flex-wrap">
                  {(["hr", "sales", "legal", "common"] as Pillar[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setEditPillar(p)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 3,
                        background: editPillar === p ? PILLAR_COLOR[p] : "transparent",
                        color: editPillar === p ? "var(--bg-paper)" : PILLAR_COLOR[p],
                        border: `1px solid ${PILLAR_COLOR[p]}`,
                        fontSize: 11,
                        fontFamily: "var(--font-noto-serif-tc)",
                        cursor: "pointer",
                      }}
                    >
                      {PILLAR_LABEL[p]}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => action("approve")}
                  disabled={acting}
                  style={{
                    padding: "10px 20px",
                    background: "var(--gold-thread, #c9a96e)",
                    color: "var(--bg-paper)",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 13,
                    fontFamily: "var(--font-noto-serif-tc)",
                    cursor: acting ? "wait" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  {acting ? "處理中…" : "✅ 核准 + 公開"}
                </button>
              </div>

              {/* reject form */}
              <div style={{ display: "grid", gap: 12, padding: 16, background: "rgba(185,28,28,0.04)", borderRadius: 4, marginBottom: 24 }}>
                <input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="拒絕理由(會記入 audit log)"
                  style={{ ...inputStyle, fontSize: 12 }}
                />
                <button
                  onClick={() => action("reject")}
                  disabled={acting}
                  style={{
                    padding: "10px 20px",
                    background: "transparent",
                    color: "var(--accent-red)",
                    border: "1px solid var(--accent-red)",
                    borderRadius: 4,
                    fontSize: 13,
                    fontFamily: "var(--font-noto-serif-tc)",
                    cursor: acting ? "wait" : "pointer",
                  }}
                >
                  {acting ? "處理中…" : "❌ 拒絕"}
                </button>
              </div>

              {/* preview */}
              <div style={{ padding: 16, background: "var(--bg-elev)", borderRadius: 4, fontSize: 13, color: "var(--ink-deep)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {active.content_preview}
                {active.content_length > 500 && <span style={{ color: "var(--ink-mid)" }}>… (預覽前 500 字 · 共 {active.content_length} 字)</span>}
              </div>
            </motion.div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80 }}>
              <div style={{ textAlign: "center", color: "var(--ink-mid)" }}>
                <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 32, color: "var(--ink-deep)", letterSpacing: 8, marginBottom: 12 }}>選 一</div>
                <div style={{ fontSize: 13, lineHeight: 1.7 }}>左欄點 chunk 看內容<br/>核准 / 拒絕</div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Chip({ label, active, onClick, count, colorAccent }: { label: string; active: boolean; onClick: () => void; count: number; colorAccent?: string }) {
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

const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600, textTransform: "uppercase" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 4, background: "var(--bg-paper)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", color: "var(--ink-deep)", fontSize: 13 };
