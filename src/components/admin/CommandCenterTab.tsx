"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Cmd = { id: string; title: string; detail: string | null; severity: string; status: string; owner_email: string; created_at: string; deadline: string | null };
type FrozenUser = { id: string; email: string; name: string | null; brand: string | null; is_active: boolean; frozen_at: string | null; frozen_reason: string | null };
type Data = {
  ok: boolean;
  commands: Cmd[];
  frozen_users: FrozenUser[];
  line_bound_count: number;
};

const sevColor = (s: string) => s === "critical" ? "var(--accent-red, #b91c1c)" : s === "high" ? "#d97706" : s === "info" ? "var(--ink-mid)" : "var(--ink-deep)";

export default function CommandCenterTab() {
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushMsg, setPushMsg] = useState("");
  const [askMsg, setAskMsg] = useState("");
  const [askScope, setAskScope] = useState("");
  const [decTitle, setDecTitle] = useState("");
  const [decDetail, setDecDetail] = useState("");
  const [decSev, setDecSev] = useState<"info" | "normal" | "high" | "critical">("normal");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/admin/command-center");
    setD(await r.json());
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  function showToast(t: string) { setToast(t); setTimeout(() => setToast(null), 3500); }

  async function pushAll() {
    if (!pushMsg.trim()) return;
    if (!confirm(`確定推給綁定 LINE 的 ${d?.line_bound_count ?? 0} 人?`)) return;
    setBusy("push-all");
    const r = await fetch("/api/admin/command-center", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "push-all", message: pushMsg }) });
    const j = await r.json();
    setBusy(null);
    if (r.ok) { setPushMsg(""); showToast(`已推送 ${j.sent}/${j.total} 人`); }
    else showToast(`失敗: ${j.error}`);
  }

  async function randomAsk() {
    if (!askMsg.trim()) return;
    setBusy("ask");
    const r = await fetch("/api/admin/command-center", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "random-ask", question: askMsg, scope: askScope || undefined }) });
    const j = await r.json();
    setBusy(null);
    if (r.ok) { setAskMsg(""); showToast(j.note ? j.note : `已抽問 ${j.picked?.name || j.picked?.email}`); }
    else showToast(`失敗: ${j.error}`);
  }

  async function makeDecision() {
    if (!decTitle.trim()) return;
    setBusy("decision");
    const r = await fetch("/api/admin/command-center", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "decision", title: decTitle, detail: decDetail, severity: decSev }) });
    const j = await r.json();
    setBusy(null);
    if (r.ok) { setDecTitle(""); setDecDetail(""); showToast("已記錄拍板"); refresh(); }
    else showToast(`失敗: ${j.error}`);
  }

  async function unfreeze(uid: string, name: string) {
    if (!confirm(`解凍 ${name}?`)) return;
    setBusy("unfreeze-" + uid);
    const r = await fetch("/api/admin/command-center", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unfreeze", user_id: uid }) });
    setBusy(null);
    if (r.ok) { showToast(`已解凍 ${name}`); refresh(); }
  }

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "var(--ink-mid)", fontSize: 13 }}>載入指揮台…</div>;
  if (!d) return null;

  return (
    <div style={{ padding: "8px 0 48px", background: "var(--bg-paper, #f7f1e3)", position: "relative" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={labelStyle}>指揮 COMMAND</div>
        <div style={{ fontFamily: "var(--font-noto-serif-tc, serif)", fontSize: 32, color: "var(--ink-deep, #1a1a1a)", letterSpacing: 4, marginTop: 6 }}>指揮台</div>
        <div style={{ fontSize: 11, color: "var(--ink-mid, #4a4a4a)", marginTop: 6 }}>一鍵全員推播 · 抽人問話 · 凍結帳號 · 拍板紀錄</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* 推播 */}
        <div style={cardOuterStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={labelStyle}>全員推播</div>
            <div style={{ fontSize: 11, color: "var(--ink-mid)", fontFamily: "var(--font-jetbrains-mono)" }}>覆蓋 {d.line_bound_count} 人</div>
          </div>
          <textarea value={pushMsg} onChange={e => setPushMsg(e.target.value)} placeholder="今晚 21:00 全體上線開週會&#10;議程..."
            style={{ ...inputStyle, marginTop: 12, minHeight: 92, resize: "vertical" }} />
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={pushAll} disabled={busy === "push-all" || !pushMsg.trim()}
            style={{ ...btnPrimary, marginTop: 12, opacity: busy === "push-all" || !pushMsg.trim() ? 0.5 : 1 }}>
            {busy === "push-all" ? "推送中…" : "📢 一鍵全員推送"}
          </motion.button>
        </div>

        {/* 抽問 */}
        <div style={cardOuterStyle}>
          <div style={labelStyle}>抽人問話</div>
          <input value={askMsg} onChange={e => setAskMsg(e.target.value)} placeholder="今天進度如何?有卡點?" style={{ ...inputStyle, marginTop: 12 }} />
          <select value={askScope} onChange={e => setAskScope(e.target.value)} style={{ ...inputStyle, marginTop: 8 }}>
            <option value="">全集團</option>
            <option value="nschool">nSchool 財經</option>
            <option value="xuemi">XUEMI 學米</option>
            <option value="ooschool">OOschool 無限</option>
            <option value="aischool">AIschool 智能</option>
            <option value="moyuhunt">墨宇獵頭</option>
            <option value="hq">墨宇總部</option>
          </select>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={randomAsk} disabled={busy === "ask" || !askMsg.trim()}
            style={{ ...btnPrimary, marginTop: 12, opacity: busy === "ask" || !askMsg.trim() ? 0.5 : 1 }}>
            {busy === "ask" ? "抽問中…" : "🎲 隨機抽問"}
          </motion.button>
        </div>
      </div>

      {/* 拍板 */}
      <div style={{ ...cardOuterStyle, marginBottom: 24 }}>
        <div style={labelStyle}>拍板紀錄</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginTop: 12 }}>
          <input value={decTitle} onChange={e => setDecTitle(e.target.value)} placeholder="拍板標題,如:Q3 全集團 hire ↑ 30%" style={inputStyle} />
          <select value={decSev} onChange={e => setDecSev(e.target.value as any)} style={inputStyle}>
            <option value="info">info</option>
            <option value="normal">normal</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
        </div>
        <textarea value={decDetail} onChange={e => setDecDetail(e.target.value)} placeholder="背景 / 理由 / 預期" style={{ ...inputStyle, marginTop: 8, minHeight: 60 }} />
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={makeDecision} disabled={busy === "decision" || !decTitle.trim()}
          style={{ ...btnPrimary, marginTop: 12, opacity: busy === "decision" || !decTitle.trim() ? 0.5 : 1 }}>
          {busy === "decision" ? "存證中…" : "✍️ 拍板存證"}
        </motion.button>

        <div style={{ marginTop: 20, maxHeight: 280, overflowY: "auto" }}>
          {d.commands.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--ink-mid)", fontSize: 12, padding: 16 }}>尚無拍板紀錄</div>
          ) : d.commands.map((c, idx) => (
            <motion.div key={c.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }}
              style={{ padding: "10px 12px", borderRadius: 4, marginBottom: 6, background: "var(--bg-paper)", borderLeft: `3px solid ${sevColor(c.severity)}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 13, color: "var(--ink-deep)", letterSpacing: 1 }}>{c.title}</div>
                <div style={{ fontSize: 10, color: "var(--ink-mid)", fontFamily: "var(--font-jetbrains-mono)" }}>{new Date(c.created_at).toLocaleDateString("zh-TW")}</div>
              </div>
              {c.detail && <div style={{ fontSize: 11, color: "var(--ink-mid)", marginTop: 4 }}>{c.detail}</div>}
              <div style={{ fontSize: 10, color: "var(--ink-mid)", marginTop: 4, fontFamily: "var(--font-jetbrains-mono)", letterSpacing: 1 }}>
                {c.severity} · {c.status} · @{c.owner_email}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 凍結帳號管理 */}
      <div style={cardOuterStyle}>
        <div style={labelStyle}>凍結中帳號 ({d.frozen_users.length})</div>
        <div style={{ marginTop: 12 }}>
          {d.frozen_users.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--ink-mid)", fontSize: 12, padding: 16 }}>無凍結帳號</div>
          ) : d.frozen_users.map((u) => (
            <div key={u.id} style={{ padding: "10px 12px", borderRadius: 4, marginBottom: 6, background: "rgba(185,28,28,0.04)", display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 13, color: "var(--ink-deep)" }}>{u.name || u.email}</div>
                <div style={{ fontSize: 10, color: "var(--ink-mid)", marginTop: 2, fontFamily: "var(--font-jetbrains-mono)" }}>
                  {u.brand} · {u.frozen_reason || "未說明"} · {u.frozen_at ? new Date(u.frozen_at).toLocaleDateString("zh-TW") : ""}
                </div>
              </div>
              <button onClick={() => unfreeze(u.id, u.name || u.email)} disabled={busy === "unfreeze-" + u.id} style={btnSmall}>
                {busy === "unfreeze-" + u.id ? "…" : "解凍"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            style={{ position: "fixed", bottom: 24, right: 24, background: "var(--ink-deep)", color: "var(--bg-paper)", padding: "12px 20px", borderRadius: 4, fontSize: 13, fontFamily: "var(--font-noto-serif-tc)", letterSpacing: 1, boxShadow: "0 8px 24px rgba(0,0,0,0.2)", zIndex: 100 }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--ink-mid)", letterSpacing: 3, fontWeight: 600, textTransform: "uppercase" };
const cardOuterStyle: React.CSSProperties = { background: "var(--bg-elev, rgba(247,241,227,0.85))", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6, padding: "20px 24px" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", borderRadius: 4, background: "var(--bg-paper)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", color: "var(--ink-deep)", fontSize: 13, fontFamily: "inherit" };
const btnPrimary: React.CSSProperties = { padding: "10px 20px", borderRadius: 4, background: "var(--ink-deep)", color: "var(--bg-paper)", fontSize: 13, fontFamily: "var(--font-noto-serif-tc)", letterSpacing: 4, border: "none", cursor: "pointer" };
const btnSmall: React.CSSProperties = { padding: "6px 14px", borderRadius: 4, background: "transparent", color: "var(--accent-red)", border: "1px solid var(--accent-red)", fontSize: 11, fontFamily: "var(--font-noto-serif-tc)", letterSpacing: 2, cursor: "pointer" };
