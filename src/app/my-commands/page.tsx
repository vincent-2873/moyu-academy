"use client";

/**
 * v3 員工命令收件箱（前台）
 *
 * 員工輸入 email 後只看到自己被指派的命令，按「✓ 完成 / 卡住 / 忽略」三個按鈕回報。
 * 哲學：簡單到不需要學就會用，員工偷懶時 Claude 會直接 LINE 提醒。
 */

import { useState, useEffect, useCallback } from "react";

interface V3Command {
  id: string;
  pillar_id: string | null;
  owner_email: string;
  title: string;
  detail: string | null;
  severity: "info" | "normal" | "high" | "critical";
  deadline: string | null;
  status: "pending" | "acknowledged" | "done" | "blocked" | "ignored";
  ai_generated: boolean;
  ai_reasoning: string | null;
  created_at: string;
  acknowledged_at: string | null;
  done_at: string | null;
}

const PILLAR_META: Record<string, { icon: string; name: string; color: string }> = {
  sales: { icon: "💰", name: "業務", color: "#fb923c" },
  legal: { icon: "⚖️", name: "法務", color: "#7c6cf0" },
  recruit: { icon: "🎯", name: "招聘", color: "#10b981" },
};

const SEVERITY_META: Record<string, { color: string; label: string; bg: string }> = {
  info: { color: "#3b82f6", label: "提醒", bg: "rgba(59,130,246,0.1)" },
  normal: { color: "#8b5cf6", label: "一般", bg: "rgba(139,92,246,0.1)" },
  high: { color: "#fbbf24", label: "重要", bg: "rgba(251,191,36,0.12)" },
  critical: { color: "#ef4444", label: "緊急", bg: "rgba(239,68,68,0.12)" },
};

export default function MyCommandsPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [commands, setCommands] = useState<V3Command[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  // 從 localStorage 還原 email
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("moyu_employee_email") : null;
    if (saved) {
      setEmail(saved);
      setSubmitted(true);
    }
  }, []);

  const load = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ owner: email });
      if (filter === "pending") params.set("status", "pending");
      const res = await fetch(`/api/v3/commands?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "讀取失敗");
      setCommands(json.commands || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
  }, [email, filter]);

  useEffect(() => {
    if (submitted) {
      load();
      const t = setInterval(load, 30000);
      return () => clearInterval(t);
    }
  }, [submitted, load]);

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    localStorage.setItem("moyu_employee_email", email);
    setSubmitted(true);
  }

  function logout() {
    localStorage.removeItem("moyu_employee_email");
    setEmail("");
    setSubmitted(false);
    setCommands([]);
  }

  async function patch(id: string, status: V3Command["status"], note?: string) {
    try {
      await fetch("/api/v3/commands", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, note }),
      });
      load();
    } catch {
      // ignore
    }
  }

  if (!submitted) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #581c87 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        color: "#fff",
      }}>
        <div style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 20, padding: "44px 36px", maxWidth: 420, width: "100%" }}>
          <div style={{ fontSize: 12, letterSpacing: 2, color: "rgba(255,255,255,0.6)", fontWeight: 600, marginBottom: 8 }}>MY COMMANDS</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, background: "linear-gradient(135deg, #fff, #fbbf24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            ⚡ 我的命令收件箱
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 28, lineHeight: 1.6 }}>
            輸入你的 email，看 Claude 今天派給你的命令。完成後按「✓ 完成」即可。
          </div>
          <form onSubmit={handleEmailSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vincent@example.com"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 10,
                padding: "13px 16px",
                color: "#fff",
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              type="submit"
              style={{
                background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "13px 16px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              進入收件箱 →
            </button>
          </form>
        </div>
      </div>
    );
  }

  const pendingCount = commands.filter((c) => c.status === "pending").length;
  const criticalCount = commands.filter((c) => c.severity === "critical" && c.status === "pending").length;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#fff", padding: "24px 18px 60px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 60%, #7c3aed 100%)",
          borderRadius: 18,
          padding: "26px 28px",
          marginBottom: 22,
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -50, right: -30, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(251,191,36,0.3), transparent 70%)" }} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: 1.5, color: "rgba(255,255,255,0.6)", fontWeight: 600, marginBottom: 4 }}>MY COMMANDS</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>⚡ {email}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
                  待辦 {pendingCount} 道
                  {criticalCount > 0 && <span style={{ color: "#fca5a5", fontWeight: 700 }}> · 🔴 {criticalCount} 緊急</span>}
                </div>
              </div>
              <button
                onClick={logout}
                style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
              >
                換人
              </button>
            </div>
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {(["pending", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? "#fbbf24" : "transparent",
                color: filter === f ? "#0f172a" : "#cbd5e1",
                border: `1px solid ${filter === f ? "#fbbf24" : "#334155"}`,
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {f === "pending" ? "🔥 待辦" : "📜 全部歷史"}
            </button>
          ))}
          <button
            onClick={load}
            disabled={loading}
            style={{ marginLeft: "auto", background: "transparent", color: "#cbd5e1", border: "1px solid #334155", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: loading ? "wait" : "pointer" }}
          >
            {loading ? "刷新中..." : "🔄 刷新"}
          </button>
        </div>

        {error && (
          <div style={{ padding: "14px 16px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10, color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Commands list */}
        {loading && commands.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>讀取中...</div>
        ) : commands.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", background: "#1e293b", borderRadius: 14, color: "#94a3b8" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>沒有任何待辦命令</div>
            <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>
              {filter === "pending" ? "Claude 還沒給你新指令，繼續做你手上的事" : "你還沒收過任何命令"}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {commands.map((c) => (
              <EmployeeCommandCard key={c.id} command={c} onAction={patch} />
            ))}
          </div>
        )}

        <div style={{ marginTop: 30, padding: 16, background: "#1e293b", borderRadius: 10, fontSize: 11, color: "#64748b", lineHeight: 1.7, textAlign: "center" }}>
          這個收件箱每 30 秒自動刷新一次。Claude 是 CEO，每天會根據 3 大支柱戰況產出命令推給你。
          有問題按「卡住」加上一句說明，Claude 會學習。
        </div>
      </div>
    </div>
  );
}

function EmployeeCommandCard({ command, onAction }: { command: V3Command; onAction: (id: string, status: V3Command["status"], note?: string) => void }) {
  const sev = SEVERITY_META[command.severity] || SEVERITY_META.normal;
  const pillar = command.pillar_id ? PILLAR_META[command.pillar_id] : null;
  const [showBlockedNote, setShowBlockedNote] = useState(false);
  const [blockedNote, setBlockedNote] = useState("");

  const isOverdue = command.deadline && new Date(command.deadline) < new Date() && command.status === "pending";
  const isPending = command.status === "pending";

  return (
    <div style={{
      background: "#1e293b",
      border: `1px solid ${isPending ? sev.color + "55" : "#334155"}`,
      borderRadius: 14,
      padding: 18,
      opacity: isPending ? 1 : 0.55,
      position: "relative",
      overflow: "hidden",
    }}>
      {pillar && (
        <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: pillar.color }} />
      )}

      {/* Severity & meta row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: sev.color, padding: "3px 8px", border: `1px solid ${sev.color}`, borderRadius: 5, letterSpacing: 0.5 }}>
          {sev.label}
        </div>
        {pillar && (
          <div style={{ fontSize: 10, color: "#cbd5e1", fontWeight: 600 }}>
            {pillar.icon} {pillar.name}
          </div>
        )}
        {command.ai_generated && (
          <div style={{ fontSize: 9, color: "#a855f7", fontWeight: 700 }}>🧠 Claude</div>
        )}
        {!isPending && (
          <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", padding: "2px 7px", background: "#334155", borderRadius: 5 }}>
            {command.status.toUpperCase()}
          </div>
        )}
        {isOverdue && (
          <div style={{ fontSize: 9, fontWeight: 800, color: "#fff", background: "#ef4444", padding: "3px 8px", borderRadius: 5 }}>
            🚨 已逾期
          </div>
        )}
      </div>

      {/* Title */}
      <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 8, lineHeight: 1.4 }}>{command.title}</div>

      {/* Detail */}
      {command.detail && (
        <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, marginBottom: 10, whiteSpace: "pre-wrap" }}>{command.detail}</div>
      )}

      {/* Deadline */}
      {command.deadline && (
        <div style={{ fontSize: 11, color: isOverdue ? "#fca5a5" : "#94a3b8", marginBottom: 10 }}>
          🕒 截止：{new Date(command.deadline).toLocaleString("zh-TW")}
        </div>
      )}

      {/* AI reasoning */}
      {command.ai_reasoning && (
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(168,85,247,0.1)", borderLeft: "2px solid #a855f7", borderRadius: 6, fontSize: 11, color: "#cbd5e1", lineHeight: 1.5 }}>
          <strong style={{ color: "#a855f7" }}>Claude 判斷：</strong> {command.ai_reasoning}
        </div>
      )}

      <div style={{ fontSize: 10, color: "#64748b", marginBottom: isPending ? 14 : 0 }}>
        派發於 {new Date(command.created_at).toLocaleString("zh-TW")}
      </div>

      {/* Action buttons */}
      {isPending && !showBlockedNote && (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onAction(command.id, "done")}
            style={{ flex: 1, background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            ✓ 完成
          </button>
          <button
            onClick={() => setShowBlockedNote(true)}
            style={{ flex: 1, background: "transparent", color: "#fb923c", border: "1px solid #fb923c", borderRadius: 8, padding: "11px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            🚧 卡住
          </button>
          <button
            onClick={() => onAction(command.id, "ignored")}
            style={{ flex: 1, background: "transparent", color: "#94a3b8", border: "1px solid #475569", borderRadius: 8, padding: "11px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            ✗ 忽略
          </button>
        </div>
      )}

      {showBlockedNote && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          <textarea
            value={blockedNote}
            onChange={(e) => setBlockedNote(e.target.value)}
            placeholder="卡在哪裡？(Claude 會學習)"
            rows={2}
            style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 13, resize: "vertical", outline: "none" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setShowBlockedNote(false)}
              style={{ flex: 1, background: "transparent", color: "#94a3b8", border: "1px solid #475569", borderRadius: 8, padding: "10px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              取消
            </button>
            <button
              onClick={() => { onAction(command.id, "blocked", blockedNote); setShowBlockedNote(false); }}
              style={{ flex: 2, background: "#fb923c", color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              送出「卡住」
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
