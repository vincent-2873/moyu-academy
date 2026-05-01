"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { canUploadRag, RAG_UPLOAD_ROLE_LABELS } from "@/lib/upload-permissions";

/**
 * 2026-04-30 Wave C UI A:後台 RAG 上傳區
 *
 * Admin 上傳:reviewed=true,直接公開
 *
 * 用 /api/rag/ingest-upload 統一 backend
 */

type Pillar = "sales" | "legal" | "common";
type Visibility = "public" | "pillar" | "brand" | "role";

interface Props {
  email: string;
}

// 2026-05-01:hr 體系全砍(對齊 system-tree v2)
const PILLAR_LABEL: Record<Pillar, string> = {
  sales: "業務",
  legal: "法務",
  common: "通用",
};

const PILLAR_COLOR: Record<Pillar, string> = {
  sales: "#c9a96e",
  legal: "#b91c1c",
  common: "#4a4a4a",
};

const VISIBILITY_LABEL: Record<Visibility, string> = {
  public: "公開(全員可見)",
  pillar: "限該 Pillar(預設)",
  brand: "限該 Brand",
  role: "限指定角色",
};

export default function RagUploadPanel({ email }: Props) {
  const [mode, setMode] = useState<"text" | "file">("text");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pillar, setPillar] = useState<Pillar>("common");
  const [visibility, setVisibility] = useState<Visibility>("pillar");
  const [anonymizePII, setAnonymizePII] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  // 2026-04-30 末段:role check
  const [userRole, setUserRole] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!email) return;
    fetch(`/api/user?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((d) => setUserRole(d?.user?.role || d?.role || null))
      .catch(() => setUserRole(null));
  }, [email]);

  async function submit() {
    if (!title.trim()) { setResult({ error: "請填 title" }); return; }
    if (mode === "text" && !text.trim()) { setResult({ error: "請填內容" }); return; }
    if (mode === "file" && !file) { setResult({ error: "請選擇檔案" }); return; }

    setSubmitting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("source", "admin");
      fd.append("pillar", pillar);
      fd.append("visibility", visibility);
      fd.append("email", email);
      fd.append("anonymize_pii", anonymizePII ? "true" : "false");
      if (mode === "text") fd.append("text", text);
      else if (file) fd.append("file", file);

      const r = await fetch("/api/rag/ingest-upload", { method: "POST", body: fd });
      const d = await r.json();
      setResult(d);
      if (d.ok) {
        setTitle(""); setText(""); setFile(null);
      }
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setSubmitting(false);
    }
  }

  if (userRole === undefined) {
    return <div className="p-12 text-sm" style={{ color: "var(--ink-mid)" }}>檢查權限…</div>;
  }
  if (!canUploadRag(userRole)) {
    return (
      <div style={{ padding: "60px 32px", maxWidth: 700, margin: "0 auto" }}>
        <div style={{ fontSize: 11, color: "var(--accent-red)", letterSpacing: 4, marginBottom: 12, fontWeight: 600 }}>NO PERMISSION</div>
        <h1 style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 40, color: "var(--ink-deep)", letterSpacing: 4, marginBottom: 16 }}>權限不足</h1>
        <div style={{ fontSize: 14, color: "var(--ink-deep)", lineHeight: 1.7, marginBottom: 20 }}>
          你的角色 <code style={{ background: "var(--bg-elev)", padding: "2px 6px", borderRadius: 3 }}>{userRole || "未知"}</code> 沒有 RAG 上傳權限。
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-mid)", lineHeight: 1.8, padding: 16, background: "var(--bg-elev)", borderRadius: 4 }}>
          可上傳的角色(只 4 種):
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            {Object.entries(RAG_UPLOAD_ROLE_LABELS).map(([k, v]) => (
              <li key={k} style={{ marginBottom: 4 }}>{v} <code style={{ fontSize: 10, color: "var(--ink-mid)" }}>({k})</code></li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px", maxWidth: 900, margin: "0 auto" }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, marginBottom: 12, fontWeight: 600 }}>
        ADMIN · RAG UPLOAD
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: "clamp(36px, 5vw, 56px)", fontWeight: 600, color: "var(--ink-deep)", letterSpacing: 4, marginBottom: 8, lineHeight: 1.1 }}
      >
        知識上傳
      </motion.h1>
      <div style={{ fontSize: 13, color: "var(--ink-mid)", lineHeight: 1.7, marginBottom: 32 }}>
        管理員上傳的內容會直接公開到指定 pillar。員工上傳走 <strong>/upload</strong>(前台)會進審核佇列。
      </div>

      {/* mode toggle */}
      <div className="flex gap-2 mb-6">
        <ModeChip label="📝 純文字" active={mode === "text"} onClick={() => setMode("text")} />
        <ModeChip label="📁 檔案(text/audio/video)" active={mode === "file"} onClick={() => setMode("file")} />
      </div>

      {/* form */}
      <div className="moyu-glass-card" style={{ display: "grid", gap: 16, padding: 24 }}>
        {/* title */}
        <Field label="標題">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 業務破冰話術 v2 / 客戶異議處理 SOP" style={inputStyle} />
        </Field>

        {/* content */}
        {mode === "text" ? (
          <Field label="內容">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} placeholder="貼上純文字..." style={{ ...inputStyle, fontFamily: "var(--font-noto-sans-tc)", resize: "vertical" }} />
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
                {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}
                {(file.type.startsWith("audio/") || file.type.startsWith("video/")) && (
                  <span style={{ marginLeft: 8, color: "var(--accent-red)" }}>⚠️ 需 Whisper 轉錄,沒 GROQ_API_KEY 會 pending</span>
                )}
              </div>
            )}
          </Field>
        )}

        {/* pillar selector */}
        <Field label="池 PILLAR">
          <div className="flex gap-2 flex-wrap">
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
        </Field>

        {/* visibility */}
        <Field label="可見範圍 VISIBILITY">
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)} style={inputStyle}>
            {(["pillar", "public", "brand", "role"] as Visibility[]).map((v) => (
              <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>
            ))}
          </select>
        </Field>

        {/* PII toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-deep)", cursor: "pointer" }}>
          <input type="checkbox" checked={anonymizePII} onChange={(e) => setAnonymizePII(e.target.checked)} />
          <span>自動 anonymize PII(Email / 電話 / 身分證 / 信用卡 → [PII] 占位)</span>
        </label>

        {/* submit */}
        <motion.button
          whileHover={{ scale: submitting ? 1 : 1.02 }}
          whileTap={{ scale: submitting ? 1 : 0.98 }}
          onClick={submit}
          disabled={submitting}
          style={{
            padding: "12px 24px",
            background: submitting ? "var(--border-soft)" : "var(--accent-red)",
            color: submitting ? "var(--ink-mid)" : "var(--bg-paper)",
            border: "none",
            borderRadius: 4,
            fontSize: 14,
            fontFamily: "var(--font-noto-serif-tc)",
            letterSpacing: 2,
            cursor: submitting ? "wait" : "pointer",
            fontWeight: 600,
          }}
        >
          {submitting ? "上傳中…" : "📤 上傳到 RAG"}
        </motion.button>
      </div>

      {/* result */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{
          marginTop: 20,
          padding: 16,
          background: result.ok ? "rgba(107,122,90,0.08)" : "rgba(185,28,28,0.06)",
          border: `1px solid ${result.ok ? "var(--gold-thread, #c9a96e)" : "var(--accent-red)"}`,
          borderRadius: 4,
          fontSize: 12,
          fontFamily: "var(--font-jetbrains-mono)",
          color: "var(--ink-deep)",
          whiteSpace: "pre-wrap",
        }}>
          {result.ok ? "✅ 上傳成功" : "❌ 失敗"}
          {"\n\n"}
          {JSON.stringify(result, null, 2)}
        </motion.div>
      )}
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
  background: "var(--bg-elev)",
  border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
  borderRadius: 4,
  color: "var(--ink-deep)",
  fontSize: 14,
  fontFamily: "var(--font-noto-sans-tc)",
  outline: "none",
  boxSizing: "border-box",
};
