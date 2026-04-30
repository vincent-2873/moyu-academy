"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { canUploadRag, RAG_UPLOAD_ROLE_LABELS } from "@/lib/upload-permissions";

/**
 * 2026-04-30 Wave C UI B:前台共同上傳區
 *
 * 員工(全員)可上傳素材到 RAG 知識庫,進審核佇列等管理員核准。
 *
 * 跟 /admin/rag-upload 差別:
 *   - source='staff' → reviewed=false 進審核
 *   - 沒 visibility=public 選項(只能限自己 pillar)
 */

type Pillar = "hr" | "sales" | "legal" | "common";

const PILLAR_LABEL: Record<Pillar, string> = {
  hr: "HR 招聘",
  sales: "業務",
  legal: "法務",
  common: "通用",
};

const PILLAR_COLOR: Record<Pillar, string> = {
  hr: "#0891b2",
  sales: "#c9a96e",
  legal: "#b91c1c",
  common: "#4a4a4a",
};

const PILLAR_HINT: Record<Pillar, string> = {
  hr: "招聘 SOP / 一面二面對話 / 履歷分析",
  sales: "電話對練逐字稿 / 客戶異議處理 / 成交 case",
  legal: "合約範本 / 法遵申報案例 / 糾紛處理",
  common: "通用文化 / 跨部門 SOP / 不確定",
};

type Mode = "text" | "file" | "self";

export default function UploadPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const [mode, setMode] = useState<Mode>("text");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pillar, setPillar] = useState<Pillar>("sales");
  const [piiAnonymize, setPiiAnonymize] = useState(true);
  const [confirmConsent, setConfirmConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const e = sessionStorage.getItem("moyu_current_user");
    if (!e) {
      router.push("/?next=/upload");
      return;
    }
    setEmail(e);
    fetch(`/api/user?email=${encodeURIComponent(e)}`)
      .then((r) => r.json())
      .then((d) => {
        const u = d?.user || d;
        setUser(u);
        // 預設 pillar by stage_path
        if (u?.stage_path === "recruit") setPillar("hr");
        else if (u?.brand === "legal") setPillar("legal");
        else setPillar("sales");
      })
      .catch(() => {});
  }, [router]);

  async function submit() {
    if (!email) return;
    if (!confirmConsent) { setResult({ error: "請先勾選 PII 確認" }); return; }
    if (!title.trim()) { setResult({ error: "請填標題" }); return; }
    if (mode === "text" && !text.trim()) { setResult({ error: "請填內容" }); return; }
    if (mode === "file" && !file) { setResult({ error: "請選擇檔案" }); return; }

    setSubmitting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("source", mode === "self" ? "self" : "staff");
      fd.append("pillar", pillar);
      fd.append("visibility", mode === "self" ? "self" : "pillar");
      fd.append("email", email);
      fd.append("anonymize_pii", piiAnonymize ? "true" : "false");
      if (mode === "text" || mode === "self") fd.append("text", text);
      if (mode === "file" && file) fd.append("file", file);

      const r = await fetch("/api/rag/ingest-upload", { method: "POST", body: fd });
      const d = await r.json();
      setResult(d);
      if (d.ok) {
        setTitle(""); setText(""); setFile(null); setConfirmConsent(false);
      }
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setSubmitting(false);
    }
  }

  if (!email) return null;

  // 2026-04-30 末段:role guard — 只有 super_admin / 3 manager 可上傳
  const allowed = user ? canUploadRag(user.role) : null;
  if (user !== null && allowed === false) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-paper, #f7f1e3)", padding: "60px 20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, marginBottom: 12, fontWeight: 600 }}>NO PERMISSION</div>
          <h1 style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 40, color: "var(--ink-deep)", letterSpacing: 4, marginBottom: 20 }}>權限不足</h1>
          <div style={{ fontSize: 14, color: "var(--ink-deep)", lineHeight: 1.7, marginBottom: 24 }}>
            你的角色 <code style={{ background: "var(--bg-elev)", padding: "2px 6px", borderRadius: 3 }}>{user?.role || "未知"}</code> 沒有 RAG 上傳權限。
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-mid)", lineHeight: 1.8, marginBottom: 24, padding: 16, background: "var(--bg-elev)", borderRadius: 4, textAlign: "left" }}>
            可上傳的角色:
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              {Object.entries(RAG_UPLOAD_ROLE_LABELS).map(([k, v]) => (
                <li key={k} style={{ marginBottom: 4 }}>{v} <code style={{ fontSize: 10, color: "var(--ink-mid)" }}>({k})</code></li>
              ))}
            </ul>
          </div>
          <a href="/work" style={{ fontSize: 13, color: "var(--accent-red)", textDecoration: "underline" }}>← 回工作台</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-paper, #f7f1e3)", padding: "32px 16px" }}>
      <style>{`
        @media (max-width: 768px) {
          .upload-pillar-row { flex-wrap: wrap !important; gap: 6px !important; }
          .upload-pillar-row button { font-size: 11px !important; padding: 5px 10px !important; }
          .upload-mode-row { flex-wrap: wrap !important; gap: 6px !important; }
          .upload-mode-row button { font-size: 11px !important; padding: 6px 12px !important; flex: 1; min-width: 0; }
          .upload-form-card { padding: 16px !important; gap: 12px !important; }
          .upload-submit-btn { font-size: 14px !important; padding: 12px 20px !important; }
        }
      `}</style>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, marginBottom: 12, fontWeight: 600 }}>
          STAFF · KNOWLEDGE UPLOAD
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 600, color: "var(--ink-deep)", letterSpacing: 4, marginBottom: 8, lineHeight: 1.1 }}
        >
          素材上傳
        </motion.h1>
        <div style={{ fontSize: 13, color: "var(--ink-mid)", lineHeight: 1.7, marginBottom: 24 }}>
          上傳後進「審核佇列」由管理員核准。<strong>選私池(僅我自己)則直接公開只給你自己用</strong>。
        </div>

        {user && (
          <div style={{ fontSize: 11, color: "var(--ink-mid)", marginBottom: 20, fontFamily: "var(--font-jetbrains-mono)" }}>
            you = {user.name || email} · {user.brand || "—"} · {user.stage || user.role || "—"}
          </div>
        )}

        {/* mode toggle */}
        <div className="upload-mode-row flex gap-2 mb-6 flex-wrap">
          <ModeChip label="📝 純文字" active={mode === "text"} onClick={() => setMode("text")} />
          <ModeChip label="📁 檔案" active={mode === "file"} onClick={() => setMode("file")} />
          <ModeChip label="🔒 我自己用(私池)" active={mode === "self"} onClick={() => setMode("self")} />
        </div>

        {mode === "self" && (
          <div style={{ padding: 12, background: "rgba(8,145,178,0.05)", border: "1px solid #0891b2", borderRadius: 4, marginBottom: 16, fontSize: 12, color: "var(--ink-deep)" }}>
            🔒 私池模式:只有你自己的戰情官對話會用到這份素材,不進審核,不公開。
          </div>
        )}

        {/* form */}
        <div className="upload-form-card" style={{ display: "grid", gap: 16, padding: 24, background: "var(--bg-elev, rgba(247,241,227,0.85))", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6 }}>
          <Field label="標題">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 與客戶 A 第 3 通異議處理 / 招聘 EP4 練習" style={inputStyle} />
          </Field>

          {mode !== "file" ? (
            <Field label="內容">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder={mode === "self" ? "貼上你想記錄的個人筆記 / 對話..." : "貼上對話逐字稿 / 客戶 case / 學習筆記..."}
                style={{ ...inputStyle, fontFamily: "var(--font-noto-sans-tc)", resize: "vertical" }}
              />
              <div style={{ fontSize: 11, color: "var(--ink-mid)", marginTop: 4 }}>{text.length} 字</div>
            </Field>
          ) : (
            <Field label="檔案(text / audio / video,< 25 MB)">
              <input
                type="file"
                accept="text/*,.md,.txt,audio/*,video/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{ ...inputStyle, padding: 8 }}
              />
              {file && (
                <div style={{ fontSize: 11, color: "var(--ink-mid)", marginTop: 4 }}>
                  {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                  {(file.type.startsWith("audio/") || file.type.startsWith("video/")) && (
                    <span style={{ color: "var(--accent-red)", marginLeft: 8 }}>⚠️ 會用 Whisper 轉錄成文字</span>
                  )}
                </div>
              )}
            </Field>
          )}

          {mode !== "self" && (
            <Field label="池 PILLAR">
              <div className="upload-pillar-row flex gap-2 flex-wrap">
                {(["hr", "sales", "legal", "common"] as Pillar[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPillar(p)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 3,
                      background: pillar === p ? PILLAR_COLOR[p] : "transparent",
                      color: pillar === p ? "var(--bg-paper)" : PILLAR_COLOR[p],
                      border: `1px solid ${PILLAR_COLOR[p]}`,
                      fontSize: 12,
                      fontFamily: "var(--font-noto-serif-tc)",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {PILLAR_LABEL[p]}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-mid)", marginTop: 6 }}>
                💡 {PILLAR_HINT[pillar]}
              </div>
            </Field>
          )}

          {/* PII */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: "var(--ink-deep)" }}>
            <input type="checkbox" checked={piiAnonymize} onChange={(e) => setPiiAnonymize(e.target.checked)} />
            <span>自動 anonymize PII(推薦)— Email / 電話 / 身分證 / 信用卡 → [PII]</span>
          </label>

          {/* consent */}
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, cursor: "pointer", color: "var(--accent-red)", padding: "10px 12px", background: "rgba(185,28,28,0.04)", borderRadius: 4, lineHeight: 1.6 }}>
            <input type="checkbox" checked={confirmConsent} onChange={(e) => setConfirmConsent(e.target.checked)} style={{ marginTop: 2 }} />
            <span>
              <strong>⚠️ 確認</strong>:檔案不含敏感 PII / 已徵得當事人同意 / 不違反隱私法規 / 我願為內容負責
            </span>
          </label>

          <motion.button
            whileHover={{ scale: submitting ? 1 : 1.02 }}
            whileTap={{ scale: submitting ? 1 : 0.98 }}
            onClick={submit}
            disabled={submitting}
            className="upload-submit-btn"
            style={{
              padding: "14px 28px",
              background: submitting ? "var(--border-soft, rgba(26,26,26,0.10))" : "var(--accent-red, #b91c1c)",
              color: submitting ? "var(--ink-mid)" : "var(--bg-paper)",
              border: "none",
              borderRadius: 4,
              fontSize: 15,
              fontFamily: "var(--font-noto-serif-tc)",
              letterSpacing: 2,
              cursor: submitting ? "wait" : "pointer",
              fontWeight: 600,
            }}
          >
            {submitting ? "上傳中…" : mode === "self" ? "🔒 加進我的私池" : "📤 提交審核"}
          </motion.button>
        </div>

        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{
            marginTop: 20,
            padding: 16,
            background: result.ok ? "rgba(107,122,90,0.08)" : "rgba(185,28,28,0.06)",
            border: `1px solid ${result.ok ? "var(--gold-thread, #c9a96e)" : "var(--accent-red, #b91c1c)"}`,
            borderRadius: 4,
            fontSize: 13,
            color: "var(--ink-deep)",
          }}>
            {result.ok ? (
              <>
                <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 16, marginBottom: 8 }}>✅ 上傳成功</div>
                <div style={{ fontSize: 12, color: "var(--ink-mid)" }}>
                  <div>chunk_id: {result.chunk_id}</div>
                  <div>下一步:{result.next_step}</div>
                  {result.pii_found && result.pii_found.total > 0 && (
                    <div style={{ marginTop: 4, color: "var(--accent-red)" }}>
                      🛡️ 偵測到 {result.pii_found.total} 件 PII(已自動替換)
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "var(--accent-red)" }}>❌ {result.error || "上傳失敗"}</div>
            )}
          </motion.div>
        )}

        <div style={{ marginTop: 24, fontSize: 11, color: "var(--ink-mid)", textAlign: "center" }}>
          → <a href="/me/uploads" style={{ color: "var(--accent-red)", textDecoration: "underline" }}>查看我已上傳的內容</a>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function ModeChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: 3,
        background: active ? "var(--ink-deep)" : "transparent",
        color: active ? "var(--bg-paper)" : "var(--ink-deep)",
        border: "1px solid var(--ink-deep)",
        fontSize: 12,
        fontFamily: "var(--font-noto-serif-tc)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "var(--bg-paper, #f7f1e3)",
  border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
  borderRadius: 4,
  color: "var(--ink-deep)",
  fontSize: 14,
  fontFamily: "var(--font-noto-sans-tc)",
  outline: "none",
  boxSizing: "border-box",
};
