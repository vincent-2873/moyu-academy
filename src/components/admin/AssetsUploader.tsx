"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Item = { name: string; created_at?: string; metadata?: { size?: number; mimetype?: string } };
type Done = { url: string; path: string; bucket: string; size: number };

export default function AssetsUploader() {
  const [kind, setKind] = useState<"video" | "audio">("video");
  const [subdir, setSubdir] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState<Done[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const r = await fetch("/api/admin/assets/training-upload-url");
    const d = await r.json();
    setItems(d.items || []);
  }
  useEffect(() => { refresh(); }, []);

  async function upload(file: File) {
    setUploading(true);
    setErr(null);
    setProgress(10);
    try {
      const init = await fetch("/api/admin/assets/training-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, kind, subdir, content_type: file.type }),
      });
      const j = await init.json();
      if (!init.ok) throw new Error(j.error || "init fail");

      setProgress(30);
      // 用 fetch PUT 到 signed URL
      const put = await fetch(j.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type, "x-upsert": "true" },
        body: file,
      });
      if (!put.ok) {
        const t = await put.text();
        throw new Error(`upload PUT 失敗 ${put.status}: ${t.slice(0, 200)}`);
      }
      setProgress(95);
      setDone((d) => [{ url: j.public_url || `(private) ${j.bucket}/${j.path}`, path: j.path, bucket: j.bucket, size: file.size }, ...d]);
      setProgress(100);
      await refresh();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setUploading(false);
    }
  }

  function copy(s: string) {
    navigator.clipboard.writeText(s);
    setCopied(s);
    setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div style={{ padding: "8px 0 48px", background: "var(--bg-paper)", minHeight: "calc(100vh - 60px)" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={labelStyle}>資產 ASSETS</div>
        <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 32, color: "var(--ink-deep)", letterSpacing: 4, marginTop: 6 }}>訓練資產上傳</div>
        <div style={{ fontSize: 11, color: "var(--ink-mid)", marginTop: 6 }}>影片進 training-videos (public) · 對練錄音進 training-audio (private)</div>
      </div>

      <div style={{ background: "var(--bg-elev, rgba(247,241,227,0.85))", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6, padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <Field label="類型">
            <select value={kind} onChange={(e) => setKind(e.target.value as any)} style={inputStyle}>
              <option value="video">video (mp4 / webm)</option>
              <option value="audio">audio (mp3 / wav / m4a)</option>
            </select>
          </Field>
          <Field label="子目錄 (選填)">
            <input value={subdir} onChange={(e) => setSubdir(e.target.value)} placeholder="hrbp / sales / day1" style={{ ...inputStyle, minWidth: 200 }} />
          </Field>
        </div>

        <input ref={inputRef} type="file" accept={kind === "video" ? "video/*" : "audio/*"} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} style={{ display: "none" }} />

        <motion.button whileHover={{ scale: uploading ? 1 : 1.02 }} whileTap={{ scale: uploading ? 1 : 0.98 }} onClick={() => inputRef.current?.click()} disabled={uploading}
          style={{ padding: "12px 28px", borderRadius: 4, background: uploading ? "var(--ink-mid)" : "var(--accent-red)", color: "var(--bg-paper)", border: "none", fontSize: 14, fontFamily: "var(--font-noto-serif-tc)", letterSpacing: 4, cursor: uploading ? "wait" : "pointer" }}>
          {uploading ? `上傳中 ${progress}%` : "🎬 選擇檔案上傳"}
        </motion.button>

        {uploading && (
          <div style={{ marginTop: 12, height: 6, background: "rgba(26,26,26,0.06)", borderRadius: 1, overflow: "hidden" }}>
            <motion.div initial={{ width: 0 }} animate={{ width: progress + "%" }} style={{ height: "100%", background: "var(--accent-red)" }} />
          </div>
        )}
        {err && <div style={{ marginTop: 12, padding: 10, background: "rgba(185,28,28,0.08)", color: "var(--accent-red)", borderRadius: 4, fontSize: 12 }}>{err}</div>}

        <AnimatePresence>
          {done.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 16 }}>
              <div style={labelStyle}>剛上傳</div>
              {done.map((d) => (
                <div key={d.path} style={{ marginTop: 8, padding: 12, background: "var(--bg-paper)", borderRadius: 4, borderLeft: "3px solid var(--gold-thread, #c9a96e)" }}>
                  <div style={{ fontSize: 11, color: "var(--ink-mid)", marginBottom: 4, fontFamily: "var(--font-jetbrains-mono)" }}>
                    {d.bucket} · {(d.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input readOnly value={d.url} style={{ ...inputStyle, fontSize: 11, fontFamily: "var(--font-jetbrains-mono)", flex: 1 }} />
                    <button onClick={() => copy(d.url)} style={btnSmall}>{copied === d.url ? "✓" : "複製"}</button>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-mid)" }}>
                把 URL 貼進 admin → 養成 → 訓練管理 → 對應 module 的 content jsonb (例:<code style={{ fontFamily: "var(--font-jetbrains-mono)" }}>{"{ \"video_url\": \"...\" }"}</code>)
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ background: "var(--bg-elev, rgba(247,241,227,0.85))", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6, padding: 16 }}>
        <div style={labelStyle}>近 50 個 video 資產</div>
        <div style={{ marginTop: 12, maxHeight: 360, overflowY: "auto" }}>
          {items.length === 0 ? <div style={{ textAlign: "center", color: "var(--ink-mid)", fontSize: 12, padding: 16 }}>尚無上傳 — 或 bucket 還沒建(跑 D12 SQL)</div>
            : items.map((it) => (
              <div key={it.name} style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px", gap: 12, alignItems: "center", padding: "8px 4px", borderBottom: "1px dashed var(--border-soft, rgba(26,26,26,0.06))" }}>
                <div style={{ fontSize: 12, color: "var(--ink-deep)", fontFamily: "var(--font-jetbrains-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                <div style={{ fontSize: 10, color: "var(--ink-mid)", textAlign: "right", fontFamily: "var(--font-jetbrains-mono)" }}>
                  {it.metadata?.size ? (it.metadata.size / 1024 / 1024).toFixed(1) + " MB" : "-"}
                </div>
                <div style={{ fontSize: 10, color: "var(--ink-mid)", textAlign: "right", fontFamily: "var(--font-jetbrains-mono)" }}>
                  {it.created_at ? new Date(it.created_at).toLocaleDateString("zh-TW") : ""}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--ink-mid)", letterSpacing: 3, fontWeight: 600, textTransform: "uppercase" };
const inputStyle: React.CSSProperties = { padding: "8px 12px", borderRadius: 4, background: "var(--bg-paper)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", color: "var(--ink-deep)", fontSize: 13, fontFamily: "inherit" };
const btnSmall: React.CSSProperties = { padding: "6px 12px", borderRadius: 4, background: "transparent", color: "var(--ink-deep)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", fontSize: 11, fontFamily: "var(--font-noto-serif-tc)", letterSpacing: 2, cursor: "pointer", whiteSpace: "nowrap" };
