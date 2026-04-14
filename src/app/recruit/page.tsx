"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * 招聘工作台 v4 — 完整執行介面
 *
 * 每個任務卡片包含：
 * - 明確動作（📞電話 / 🎤面試 / 🔄追蹤）
 * - 求職者資訊 + 電話撥打按鈕
 * - 邀約紀錄連結（直連 Google Sheet）
 * - 面試登記欄（出席/錄取/備註/約二面）
 */

interface Command {
  id: string;
  title: string;
  detail: string | null;
  severity: "critical" | "high" | "normal" | "info";
  status: "pending" | "acknowledged" | "done" | "blocked" | "ignored";
  deadline: string | null;
  created_at: string;
  ai_reasoning: string | null;
}

export default function RecruitPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = sessionStorage.getItem("moyu_recruit_email");
    if (s) { setEmail(s); setSubmitted(true); return; }
    const main = sessionStorage.getItem("moyu_current_user");
    if (main) { setEmail(main); setSubmitted(true); sessionStorage.setItem("moyu_recruit_email", main); return; }
    const old = localStorage.getItem("moyu_recruit_email");
    if (old) { setEmail(old); setSubmitted(true); sessionStorage.setItem("moyu_recruit_email", old); localStorage.removeItem("moyu_recruit_email"); }
  }, []);

  const loadData = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v3/commands?owner=${encodeURIComponent(email)}&pillar=recruit`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (data.ok && data.commands) {
        const todayStr = new Date().toLocaleDateString("sv-SE");
        setCommands(
          data.commands.filter((c: Command) => c.created_at?.startsWith(todayStr))
        );
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [email]);

  useEffect(() => { if (submitted) loadData(); }, [submitted, loadData]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    sessionStorage.setItem("moyu_recruit_email", email);
    setSubmitted(true);
  };

  const markDone = async (id: string, status: "done" | "ignored" | "blocked") => {
    await fetch("/api/v3/commands", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setCommands((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
  };

  // ── Login ──
  if (!submitted) {
    return (
      <div style={S.loginBg}>
        <div style={S.loginCard}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", textAlign: "center" }}>墨宇招聘中心</div>
          <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", margin: "4px 0 20px" }}>輸入工作 Email 開始</div>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" style={S.input} />
            <button type="submit" style={S.btnPrimary}>進入</button>
          </form>
        </div>
      </div>
    );
  }

  // ── 分組 ──
  const urgent = commands.filter((c) => (c.severity === "critical" || c.severity === "high") && c.status === "pending");
  const pending = commands.filter((c) => (c.severity === "normal" || c.severity === "info") && c.status === "pending");
  const done = commands.filter((c) => c.status !== "pending");
  const totalPending = urgent.length + pending.length;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <div style={S.header}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>招聘工作台</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{email}</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={S.badge}>{totalPending > 0 ? `${totalPending} 件待處理` : "全部完成"}</div>
        <button onClick={() => { sessionStorage.removeItem("moyu_recruit_email"); setSubmitted(false); setEmail(""); setCommands([]); }} style={S.logoutBtn}>登出</button>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 12px" }}>
        {loading && <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>載入中...</div>}

        {!loading && totalPending === 0 && done.length === 0 && (
          <div style={S.empty}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>今天沒有任務</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>Claude 會在有事情需要你做的時候通知你</div>
          </div>
        )}

        {urgent.length > 0 && (
          <Group title="緊急" icon="🔴" count={urgent.length} color="#ef4444">
            {urgent.map((cmd) => (
              <TaskCard key={cmd.id} cmd={cmd} email={email} onDone={markDone} onRefresh={loadData} />
            ))}
          </Group>
        )}

        {pending.length > 0 && (
          <Group title="待處理" icon="📋" count={pending.length} color="#3b82f6">
            {pending.map((cmd) => (
              <TaskCard key={cmd.id} cmd={cmd} email={email} onDone={markDone} onRefresh={loadData} />
            ))}
          </Group>
        )}

        {done.length > 0 && (
          <Group title="已處理" icon="✅" count={done.length} color="#16a34a" collapsed>
            {done.map((cmd) => <DoneCard key={cmd.id} cmd={cmd} />)}
          </Group>
        )}

        <div style={{ textAlign: "center", padding: "20px 0 40px", fontSize: 11, color: "#cbd5e1" }}>
          墨宇招聘中心 v4 · Claude 指派，你負責執行
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Group
// ═══════════════════════════════════════════════

function Group({ title, icon, count, color, collapsed, children }: {
  title: string; icon: string; count: number; color: string; collapsed?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!collapsed);
  return (
    <div style={{ marginBottom: 16 }}>
      <button onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{title}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, background: `${color}15`, padding: "2px 8px", borderRadius: 10 }}>{count}</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>{open ? "▼" : "▶"}</span>
      </button>
      {open && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════
// TaskCard — 核心任務卡片（含面試登記）
// ═══════════════════════════════════════════════

function TaskCard({ cmd, email, onDone, onRefresh }: {
  cmd: Command; email: string;
  onDone: (id: string, status: "done" | "ignored" | "blocked") => void;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [attendance, setAttendance] = useState("出席");
  const [hired, setHired] = useState("");
  const [note, setNote] = useState("");
  const [arrangeSecond, setArrangeSecond] = useState(false);
  const [secondTime, setSecondTime] = useState("");
  const [secondManager, setSecondManager] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isUrgent = cmd.severity === "critical" || cmd.severity === "high";
  const isInterview = cmd.title.includes("面試") || cmd.title.includes("🎤");

  // 解析 detail 裡的資訊
  const lines = (cmd.detail || "").split("\n");
  const phoneMatch = (cmd.detail || "").match(/(📞\s*)?(09\d{2}[-\s]?\d{3}[-\s]?\d{3})/);
  const phone = phoneMatch?.[2]?.replace(/[-\s]/g, "");
  const sheetLinkMatch = (cmd.detail || "").match(/(https:\/\/docs\.google\.com\/spreadsheets\/[^\s]+)/);
  const sheetLink = sheetLinkMatch?.[1];

  // 從 ai_reasoning 提取 sheet row index
  const rowMatch = cmd.ai_reasoning?.match(/sheet_row_(\d+)/);
  const sheetRowIndex = rowMatch ? parseInt(rowMatch[1]) : undefined;

  // 從 title 提取候選人名字
  const nameMatch = cmd.title.match(/—\s*(.+)/);
  const candidateName = nameMatch?.[1]?.trim() || "";

  const actionIcon = cmd.title.includes("🎤") ? "🎤"
    : cmd.title.includes("📞") ? "📞"
    : cmd.title.includes("🔄") ? "🔄"
    : "📌";

  // 面試登記送出
  const handleSubmitForm = async () => {
    setSubmitting(true);
    try {
      // 1. 更新面試狀態
      await fetch("/api/recruit/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commandId: cmd.id,
          sheetRowIndex,
          candidateName,
          attendance,
          isHired: hired,
          interviewNote: note,
          arrangeSecond,
          secondInterviewTime: secondTime || undefined,
          secondManager: secondManager || undefined,
        }),
      });

      // 2. 如果有約二面，建 Calendar
      if (arrangeSecond && secondTime) {
        await fetch("/api/recruit/schedule-interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheetRowIndex,
            candidateName,
            location: lines.find((l) => l.includes("·"))?.split("·")[1]?.trim() || "",
            startTime: new Date(secondTime).toISOString(),
            interviewManager: secondManager,
            calendarEmail: email,
            round: 2,
          }),
        });
      }

      onRefresh();
    } catch { /* ignore */ }
    finally { setSubmitting(false); setShowForm(false); }
  };

  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "14px 16px",
      border: isUrgent ? "2px solid #fca5a5" : "1px solid #e2e8f0",
      boxShadow: isUrgent ? "0 2px 12px rgba(239,68,68,0.1)" : "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      {/* Title */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>{actionIcon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", lineHeight: 1.4 }}>{cmd.title}</div>
          {/* Detail lines (不含連結) */}
          {lines.filter((l) => !l.startsWith("📋")).map((line, i) => (
            <div key={i} style={{ fontSize: 13, color: "#64748b", marginTop: 3, lineHeight: 1.5 }}>{line}</div>
          ))}
        </div>
      </div>

      {/* Quick actions row */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {phone && (
          <a href={`tel:${phone}`} style={S.chip}>📞 撥打 {phoneMatch?.[2]}</a>
        )}
        {sheetLink && (
          <a href={sheetLink} target="_blank" rel="noreferrer" style={{ ...S.chip, background: "#dbeafe", color: "#1d4ed8" }}>
            📋 邀約紀錄
          </a>
        )}
      </div>

      {/* 面試登記按鈕 */}
      {isInterview && !showForm && (
        <button onClick={() => setShowForm(true)} style={{ ...S.actionBtn, background: "#f0fdf4", color: "#16a34a", width: "100%", marginBottom: 8, border: "1px solid #bbf7d0" }}>
          填寫面試登記
        </button>
      )}

      {/* 面試登記表單 */}
      {showForm && (
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 8, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>面試登記 — {candidateName}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <label style={S.formLabel}>
              出席狀況
              <select value={attendance} onChange={(e) => setAttendance(e.target.value)} style={S.formSelect}>
                <option>出席</option>
                <option>未出席</option>
                <option>改期</option>
                <option>未出席，有提前告知</option>
              </select>
            </label>
            <label style={S.formLabel}>
              是否錄取
              <select value={hired} onChange={(e) => setHired(e.target.value)} style={S.formSelect}>
                <option value="">待定</option>
                <option>錄取</option>
                <option>不錄取</option>
              </select>
            </label>
          </div>

          <label style={S.formLabel}>
            備註
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ ...S.formSelect, resize: "vertical" as const }} placeholder="面試觀察..." />
          </label>

          <label style={{ ...S.formLabel, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={arrangeSecond} onChange={(e) => setArrangeSecond(e.target.checked)} />
            <span>安排二面</span>
          </label>

          {arrangeSecond && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <label style={S.formLabel}>
                二面時間
                <input type="datetime-local" value={secondTime} onChange={(e) => setSecondTime(e.target.value)} style={S.formSelect} />
              </label>
              <label style={S.formLabel}>
                二面主管
                <input value={secondManager} onChange={(e) => setSecondManager(e.target.value)} style={S.formSelect} placeholder="主管名字" />
              </label>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={handleSubmitForm} disabled={submitting} style={{ ...S.actionBtn, background: "#16a34a", color: "#fff", flex: 1, opacity: submitting ? 0.5 : 1 }}>
              {submitting ? "送出中..." : "送出登記"}
            </button>
            <button onClick={() => setShowForm(false)} style={{ ...S.actionBtn, background: "#f1f5f9", color: "#64748b" }}>取消</button>
          </div>
        </div>
      )}

      {/* 完成/跳過 按鈕 */}
      {!isInterview && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onDone(cmd.id, "done")} style={{ ...S.actionBtn, background: "#16a34a", color: "#fff", flex: 1 }}>✓ 完成</button>
          <button onClick={() => onDone(cmd.id, "blocked")} style={{ ...S.actionBtn, background: "#fef3c7", color: "#92400e" }}>卡住</button>
          <button onClick={() => onDone(cmd.id, "ignored")} style={{ ...S.actionBtn, background: "#f1f5f9", color: "#64748b" }}>跳過</button>
        </div>
      )}
    </div>
  );
}

function DoneCard({ cmd }: { cmd: Command }) {
  const icon = cmd.status === "done" ? "✅" : cmd.status === "blocked" ? "🟡" : "⏭️";
  return (
    <div style={{ background: "#f8fafc", borderRadius: 12, padding: "10px 14px", border: "1px solid #f1f5f9", opacity: 0.7, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 14, color: "#64748b", textDecoration: cmd.status === "done" ? "line-through" : "none" }}>{cmd.title}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════

const S: Record<string, React.CSSProperties> = {
  loginBg: { minHeight: "100vh", background: "linear-gradient(135deg, #0f172a, #1e1b4b)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  loginCard: { background: "#fff", borderRadius: 20, padding: 28, maxWidth: 380, width: "100%", boxShadow: "0 20px 60px -20px rgba(0,0,0,0.4)" },
  input: { padding: "12px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, background: "#f8fafc", outline: "none" },
  btnPrimary: { padding: "12px", borderRadius: 10, border: "none", background: "#4f46e5", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  header: { background: "#0f172a", padding: "14px 16px", color: "#fff", display: "flex", alignItems: "center", gap: 12, position: "sticky" as const, top: 0, zIndex: 10 },
  badge: { fontSize: 12, fontWeight: 700, color: "#fff", background: "#4f46e5", padding: "4px 10px", borderRadius: 8 },
  logoutBtn: { padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#94a3b8", fontSize: 11, cursor: "pointer" },
  empty: { textAlign: "center" as const, padding: "50px 20px", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" },
  actionBtn: { padding: "8px 14px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  chip: { display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 8, background: "#f0fdf4", color: "#16a34a", fontSize: 13, fontWeight: 600, textDecoration: "none" },
  formLabel: { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 12, color: "#64748b", fontWeight: 600 },
  formSelect: { padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, background: "#fff", outline: "none" },
};
