"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * 招聘工作台 v2 — Claude 主導，招聘員執行
 *
 * 招聘員只做三件事：
 * 1. 按「自動發信」→ 系統自動發
 * 2. 看待辦清單 → 一件一件做
 * 3. 做完打勾 → 確認完成
 */

interface Task {
  id: string;
  title: string;
  details: string | null;
  status: "pending" | "done" | "skipped" | "blocked";
  priority: number;
  created_at: string;
}

interface WeekStats {
  sent: number;
  invited: number;
  interviewed: number;
  hired: number;
}

export default function RecruitPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<WeekStats>({ sent: 0, invited: 0, interviewed: 0, hired: 0 });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [lastSentTime, setLastSentTime] = useState<string | null>(null);
  const [todaySent, setTodaySent] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("moyu_recruit_email");
    if (stored) { setEmail(stored); setSubmitted(true); }
  }, []);

  const loadData = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    try {
      // Load tasks (v3_commands for recruiter)
      const [taskRes, pipeRes] = await Promise.all([
        fetch(`/api/v3/commands?email=${encodeURIComponent(email)}&role=recruiter`, { cache: "no-store" }),
        fetch("/api/admin/recruit-pipeline", { cache: "no-store" }),
      ]);
      const taskData = await taskRes.json();
      const pipeData = await pipeRes.json();

      if (taskData.ok && taskData.commands) {
        setTasks(taskData.commands.map((c: Record<string, unknown>) => ({
          id: c.id as string,
          title: c.title as string,
          details: c.details as string | null,
          status: c.status as Task["status"],
          priority: (c.priority as number) || 0,
          created_at: c.created_at as string,
        })));
      }
      if (pipeData.ok && pipeData.summary) {
        setStats({
          sent: pipeData.summary.thisWeekOutreach || 0,
          invited: pipeData.summary.byStage?.invited || 0,
          interviewed: pipeData.summary.thisWeekInterviews || 0,
          hired: pipeData.summary.thisWeekHires || 0,
        });
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [email]);

  useEffect(() => { if (submitted) loadData(); }, [submitted, loadData]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    localStorage.setItem("moyu_recruit_email", email);
    setSubmitted(true);
  };

  const handleAutoSend = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const r = await fetch("/api/recruit/auto-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: "自動搜尋中",
          city: "台北",
          recruiterName: email.split("@")[0],
          recruiterEmail: email,
          inviteMethod: "信件邀約",
          source: "104",
          jobType: "業務",
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setSendResult(`已發送邀約！系統已自動記錄到 Google Sheet 和資料庫。`);
        setTodaySent((p) => p + 1);
        setLastSentTime(new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }));
      } else {
        setSendResult(`發送失敗: ${d.error || "未知錯誤"}`);
      }
    } catch (err) {
      setSendResult(`系統錯誤: ${String(err)}`);
    } finally {
      setSending(false);
    }
  };

  const updateTask = async (id: string, newStatus: "done" | "skipped" | "blocked") => {
    await fetch("/api/v3/commands", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: newStatus } : t));
  };

  // ── Login ──
  if (!submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a, #1e1b4b)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: 32, maxWidth: 400, width: "100%", boxShadow: "0 20px 60px -20px rgba(0,0,0,0.4)" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>墨宇招聘中心</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>輸入工作 Email 開始使用</div>
          </div>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
              style={{ padding: "12px 16px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 14, background: "#f8fafc" }} />
            <button type="submit" style={btnPrimary}>進入招聘中心</button>
          </form>
        </div>
      </div>
    );
  }

  // ── Main ──
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1e1b4b, #4c1d95)", padding: "20px 24px", color: "#fff", display: "flex", alignItems: "center", gap: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>🎯 招聘工作台</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{email}</div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => { localStorage.removeItem("moyu_recruit_email"); setSubmitted(false); setEmail(""); }}
          style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 12, cursor: "pointer" }}>
          登出
        </button>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px" }}>

        {/* ═══ 1. 一鍵自動發信 ═══ */}
        <div style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", borderRadius: 20, padding: 24, marginBottom: 20, color: "#fff", boxShadow: "0 10px 30px -10px rgba(79,70,229,0.5)" }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>🚀 一鍵自動發信</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 16, lineHeight: 1.6 }}>
            按下按鈕，系統會自動到 104 搜尋符合條件的求職者，自動發送邀約信件，自動記錄到 Google Sheet 和資料庫。你不需要做任何事。
          </div>
          <button onClick={handleAutoSend} disabled={sending}
            style={{ width: "100%", padding: "16px", borderRadius: 14, border: "2px solid rgba(255,255,255,0.4)", background: sending ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.2)", color: "#fff", fontSize: 16, fontWeight: 900, cursor: sending ? "wait" : "pointer", transition: "all 0.2s" }}>
            {sending ? "⏳ 自動發信中，請稍候..." : "開始自動發信"}
          </button>
          {sendResult && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: sendResult.includes("失敗") || sendResult.includes("錯誤") ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)", fontSize: 13 }}>
              {sendResult}
            </div>
          )}
          <div style={{ display: "flex", gap: 20, marginTop: 14, fontSize: 12, opacity: 0.7 }}>
            <span>今日已發: {todaySent} 封</span>
            {lastSentTime && <span>上次發信: {lastSentTime}</span>}
          </div>
        </div>

        {/* ═══ 2. 今日待辦任務 ═══ */}
        <div style={{ background: "#fff", borderRadius: 20, padding: 20, marginBottom: 20, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>📋 今日待辦任務</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
            Claude 指派給你的任務。做完一件就打勾，全部完成就下班！
          </div>

          {loading && <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 20 }}>載入中...</div>}

          {!loading && pendingTasks.length === 0 && doneTasks.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 20px", color: "#94a3b8" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>目前沒有待辦任務</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Claude 會在有事情需要你做的時候通知你</div>
              <div style={{ fontSize: 12, marginTop: 8, color: "#cbd5e1" }}>通常包括：追蹤回覆、打電話確認面試、面試評估等</div>
            </div>
          )}

          {/* Pending tasks */}
          {pendingTasks.map((task) => (
            <div key={task.id} style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: "1px solid #f1f5f9", alignItems: "flex-start" }}>
              <button onClick={() => updateTask(task.id, "done")}
                style={{ width: 28, height: 28, minWidth: 28, borderRadius: 8, border: "2px solid #4f46e5", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginTop: 2 }}>
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", lineHeight: 1.5 }}>{task.title}</div>
                {task.details && <div style={{ fontSize: 13, color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>{task.details}</div>}
              </div>
              <button onClick={() => updateTask(task.id, "skipped")}
                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8", fontSize: 11, cursor: "pointer" }}>
                跳過
              </button>
            </div>
          ))}

          {/* Done tasks */}
          {doneTasks.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 8 }}>已完成 ({doneTasks.length})</div>
              {doneTasks.map((task) => (
                <div key={task.id} style={{ display: "flex", gap: 12, padding: "8px 0", opacity: 0.5, alignItems: "center" }}>
                  <div style={{ width: 28, height: 28, minWidth: 28, borderRadius: 8, background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14 }}>✓</div>
                  <div style={{ fontSize: 14, color: "#64748b", textDecoration: "line-through" }}>{task.title}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ 3. 本週成績 ═══ */}
        <div style={{ background: "#fff", borderRadius: 20, padding: 20, marginBottom: 20, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginBottom: 12 }}>📊 本週成績</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <StatBox label="發信" value={stats.sent} color="#3b82f6" />
            <StatBox label="有意願" value={stats.invited} color="#8b5cf6" />
            <StatBox label="面試" value={stats.interviewed} color="#f59e0b" />
            <StatBox label="錄取" value={stats.hired} color="#16a34a" />
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "16px 0 40px", fontSize: 11, color: "#cbd5e1" }}>
          墨宇招聘中心 v2 · Claude 主導，你負責執行
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: "center", padding: "14px 8px", borderRadius: 14, background: `${color}08`, border: `1.5px solid ${color}20` }}>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginTop: 6 }}>{label}</div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: "14px", borderRadius: 12, border: "none",
  background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "#fff",
  fontSize: 14, fontWeight: 700, cursor: "pointer",
  boxShadow: "0 6px 16px -6px rgba(79,70,229,0.4)", width: "100%",
};
