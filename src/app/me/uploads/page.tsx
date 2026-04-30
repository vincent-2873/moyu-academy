"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

/**
 * 2026-04-30 Wave C UI C:個人「我的素材」
 *
 * 員工 audit 自己上傳的所有 chunks(pending / approved / rejected)
 */

const PILLAR_LABEL: Record<string, string> = {
  hr: "HR 招聘", sales: "業務", legal: "法務", common: "通用",
};
const PILLAR_COLOR: Record<string, string> = {
  hr: "#0891b2", sales: "#c9a96e", legal: "#b91c1c", common: "#4a4a4a",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "等審核",
  approved: "已核准",
  rejected: "已拒絕",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "var(--gold-thread, #c9a96e)",
  approved: "#6B7A5A",
  rejected: "var(--accent-red)",
};

export default function MyUploadsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  useEffect(() => {
    const e = sessionStorage.getItem("moyu_current_user");
    if (!e) {
      router.push("/?next=/me/uploads");
      return;
    }
    setEmail(e);
  }, [router]);

  useEffect(() => {
    if (!email) return;
    setLoading(true);
    fetch(`/api/me/uploads?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setStats(d.stats || {});
      })
      .finally(() => setLoading(false));
  }, [email]);

  if (!email) return null;

  const filtered = statusFilter ? items.filter((i) => i.status === statusFilter) : items;
  const active = items.find((i) => i.id === activeId);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-paper, #f7f1e3)" }}>
      <style>{`
        @media (max-width: 768px) {
          .uploads-grid { grid-template-columns: 1fr !important; height: auto !important; }
          .uploads-list { ${activeId ? "display:none !important;" : ""} border-right: none !important; }
          .uploads-detail { ${!activeId ? "display:none !important;" : ""} }
          .uploads-back-btn { display: inline-flex !important; }
        }
        .uploads-back-btn { display: none; }
      `}</style>
      <div className="uploads-grid" style={{ display: "grid", gridTemplateColumns: "min(420px, 35vw) 1fr", height: "100vh" }}>
        {/* List */}
        <div className="uploads-list" style={{ borderRight: "1px solid var(--border-soft, rgba(26,26,26,0.10))", overflowY: "auto" }}>
          <div style={{ padding: "32px 20px 16px 20px", position: "sticky", top: 0, background: "var(--bg-paper, #f7f1e3)", zIndex: 1, borderBottom: "1px solid var(--border-soft, rgba(26,26,26,0.10))" }}>
            <div style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, fontWeight: 600 }}>MY UPLOADS</div>
            <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 28, color: "var(--ink-deep)", marginTop: 4, marginBottom: 16, letterSpacing: 4 }}>
              我的素材
            </div>

            {/* stats */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Stat label="共" value={stats.total || 0} active={statusFilter === null} onClick={() => setStatusFilter(null)} />
              <Stat label="等審" value={stats.pending || 0} active={statusFilter === "pending"} onClick={() => setStatusFilter("pending")} color={STATUS_COLOR.pending} />
              <Stat label="已核准" value={stats.approved || 0} active={statusFilter === "approved"} onClick={() => setStatusFilter("approved")} color={STATUS_COLOR.approved} />
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-mid)", textAlign: "right" }}>
              <a href="/upload" style={{ color: "var(--accent-red)", textDecoration: "underline" }}>+ 新增</a>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm" style={{ color: "var(--ink-mid)" }}>載入中…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm" style={{ color: "var(--ink-mid)" }}>
              還沒有上傳紀錄<br/>
              <a href="/upload" style={{ color: "var(--accent-red)", textDecoration: "underline" }}>去上傳第一筆</a>
            </div>
          ) : (
            <div className="p-3 space-y-1.5">
              {filtered.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <motion.button
                    key={c.id}
                    whileHover={{ x: 2 }}
                    onClick={() => setActiveId(c.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 4,
                      background: isActive ? "var(--ink-deep)" : "var(--bg-elev)",
                      color: isActive ? "var(--bg-paper)" : "var(--ink-deep)",
                      border: `1px solid ${isActive ? "var(--ink-deep)" : "var(--border-soft, rgba(26,26,26,0.10))"}`,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 9, color: isActive ? "rgba(255,255,255,0.7)" : PILLAR_COLOR[c.pillar] || "var(--ink-mid)", fontWeight: 600 }}>
                        {PILLAR_LABEL[c.pillar] || c.pillar}
                      </span>
                      <span style={{ fontSize: 9, color: isActive ? "rgba(255,255,255,0.7)" : STATUS_COLOR[c.status], fontWeight: 600, marginLeft: "auto" }}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </div>
                    <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 13, fontWeight: 500, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.title || "(無標題)"}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.6 }}>
                      {new Date(c.uploaded_at).toISOString().slice(5, 16).replace("T", " ")} · {c.content_length} chars
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="uploads-detail" style={{ overflowY: "auto" }}>
          <AnimatePresence mode="wait">
            {active ? (
              <motion.div key={active.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} style={{ padding: 24, maxWidth: 800 }}>
                <button
                  onClick={() => setActiveId(null)}
                  className="uploads-back-btn"
                  style={{
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    background: "transparent",
                    border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "var(--ink-deep)",
                    cursor: "pointer",
                    marginBottom: 16,
                  }}
                >
                  ← 返回列表
                </button>
                <div style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600 }}>詳 DETAIL</div>
                <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 26, color: "var(--ink-deep)", marginTop: 6, marginBottom: 16, letterSpacing: 1 }}>
                  {active.title}
                </div>

                {/* status banner */}
                <div style={{
                  padding: 12,
                  background: active.status === "rejected" ? "rgba(185,28,28,0.05)" : active.status === "pending" ? "rgba(201,169,110,0.08)" : "rgba(107,122,90,0.06)",
                  border: `1px solid ${STATUS_COLOR[active.status]}`,
                  borderRadius: 4,
                  marginBottom: 24,
                  fontSize: 13,
                  color: STATUS_COLOR[active.status],
                }}>
                  <strong>{STATUS_LABEL[active.status]}</strong>
                  {active.status === "pending" && " — 等待管理員核准"}
                  {active.status === "approved" && " — 已進 RAG,可被檢索"}
                  {active.status === "rejected" && active.rejection_reason && (
                    <div style={{ marginTop: 4, color: "var(--ink-mid)" }}>理由:{active.rejection_reason}</div>
                  )}
                </div>

                <div style={{ fontSize: 11, color: "var(--ink-mid)", fontFamily: "var(--font-jetbrains-mono)", marginBottom: 16 }}>
                  {active.source_type} · {active.source_mime} · {active.transcript_status} · {active.visibility}
                </div>

                {(active.metadata?.pii_found?.total || 0) > 0 && (
                  <div style={{ padding: 8, background: "rgba(185,28,28,0.04)", border: "1px solid var(--accent-red)", borderRadius: 4, marginBottom: 16, fontSize: 12, color: "var(--accent-red)" }}>
                    🛡️ 上傳時偵測到 {active.metadata.pii_found.total} 件 PII(已自動替換為 [PII])
                  </div>
                )}

                <div style={{ padding: 16, background: "var(--bg-elev)", borderRadius: 4, fontSize: 13, color: "var(--ink-deep)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {active.content_preview}
                  {active.content_length > 200 && <span style={{ color: "var(--ink-mid)" }}>… (預覽前 200 字 · 共 {active.content_length} 字)</span>}
                </div>
              </motion.div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 80 }}>
                <div style={{ textAlign: "center", color: "var(--ink-mid)" }}>
                  <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 32, color: "var(--ink-deep)", letterSpacing: 8, marginBottom: 12 }}>選 一</div>
                  <div style={{ fontSize: 13, lineHeight: 1.7 }}>左欄點 chunk 看內容 / 狀態</div>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, active, onClick, color }: { label: string; value: number; active: boolean; onClick: () => void; color?: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        padding: "8px",
        background: active ? "var(--ink-deep)" : "var(--bg-elev)",
        color: active ? "var(--bg-paper)" : (color || "var(--ink-deep)"),
        border: `1px solid ${active ? "var(--ink-deep)" : "var(--border-soft, rgba(26,26,26,0.10))"}`,
        borderRadius: 4,
        cursor: "pointer",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 18, fontFamily: "var(--font-jetbrains-mono)", fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 9, opacity: 0.7, letterSpacing: 1 }}>{label}</div>
    </motion.button>
  );
}
