"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * RecordingUploader — 員工上傳對練錄音 -> Whisper 轉錄 + Claude 三點評估
 *
 * Props:
 *   moduleId: 對應 training_module
 *   userEmail
 *   onResult?: (data) => void  # 評估完成 callback
 */

interface Props {
  moduleId: string;
  userEmail: string;
  onResult?: (data: any) => void;
  compact?: boolean;
}

export default function RecordingUploader({ moduleId, userEmail, onResult, compact }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    setProgress(20);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("email", userEmail);
    fd.append("module_id", moduleId);

    try {
      setProgress(40);
      const r = await fetch("/api/me/training/transcribe", {
        method: "POST",
        body: fd,
      });
      setProgress(80);
      const json = await r.json();
      if (!r.ok) {
        setError(json.error || `HTTP ${r.status}`);
      } else {
        setResult(json);
        onResult?.(json);
      }
      setProgress(100);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setUploading(false);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) upload(f);
  }

  const score = result?.score;
  const evaluation = result?.evaluation;

  return (
    <div style={{ marginTop: 8 }}>
      <input ref={inputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.webm" onChange={onPick} style={{ display: "none" }} />

      {!result && (
        <motion.button
          whileHover={{ scale: uploading ? 1 : 1.02 }}
          whileTap={{ scale: uploading ? 1 : 0.98 }}
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            padding: compact ? "6px 14px" : "10px 20px",
            borderRadius: 4,
            background: uploading ? "var(--border-soft, rgba(26,26,26,0.10))" : "var(--accent-red)",
            color: uploading ? "var(--ink-mid)" : "var(--bg-paper)",
            border: "none",
            fontSize: compact ? 12 : 13,
            fontFamily: "var(--font-noto-serif-tc)",
            letterSpacing: 2,
            cursor: uploading ? "wait" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {uploading ? (
            <>
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                style={{ display: "inline-block" }}
              >◌</motion.span>
              <span>處理中 {progress}%</span>
            </>
          ) : (
            <>🎙️ 上傳錄音 → Claude 評</>
          )}
        </motion.button>
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ marginTop: 8, padding: "8px 12px", background: "rgba(185,28,28,0.1)", border: "1px solid var(--accent-red)", borderRadius: 4, color: "var(--accent-red)", fontSize: 12 }}
          >
            錯誤: {error}
          </motion.div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{ marginTop: 12, padding: 16, background: "var(--bg-elev)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6 }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600 }}>三點評估</span>
              {score != null && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 14 }}
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: 22,
                    fontWeight: 700,
                    color: score >= 80 ? "var(--gold-thread, #c9a96e)" : score >= 60 ? "var(--ink-deep)" : "var(--accent-red)",
                  }}
                >
                  {score}
                </motion.span>
              )}
            </div>

            {evaluation && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 12 }}>
                {["順暢", "邏輯", "語氣"].map((dim, i) => {
                  const d = evaluation[dim];
                  if (!d) return null;
                  return (
                    <motion.div
                      key={dim}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      style={{ padding: 10, background: "var(--bg-paper)", borderRadius: 4 }}
                    >
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600 }}>{dim}</span>
                        <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 14, fontWeight: 600, color: "var(--ink-deep)" }}>{d.score}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-mid)", lineHeight: 1.5 }}>{d.comment}</div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {evaluation?.missing_steps && evaluation.missing_steps.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "var(--accent-red)", letterSpacing: 2, fontWeight: 600, marginBottom: 4 }}>漏掉的步驟</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {evaluation.missing_steps.map((s: string, i: number) => (
                    <span key={i} style={{ fontSize: 11, padding: "3px 8px", background: "rgba(185,28,28,0.1)", color: "var(--accent-red)", borderRadius: 2 }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {evaluation?.suggestions && evaluation.suggestions.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: "var(--gold-thread, #c9a96e)", letterSpacing: 2, fontWeight: 600, marginBottom: 4 }}>戰情官建議</div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {evaluation.suggestions.map((s: string, i: number) => (
                    <li key={i} style={{ fontSize: 12, color: "var(--ink-deep)", lineHeight: 1.7, paddingLeft: 16, position: "relative" }}>
                      <span style={{ position: "absolute", left: 0, color: "var(--gold-thread, #c9a96e)" }}>※</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => { setResult(null); setProgress(0); }}
              style={{ marginTop: 12, padding: "4px 10px", background: "transparent", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 4, fontSize: 11, color: "var(--ink-mid)", cursor: "pointer" }}
            >
              再傳一次
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
