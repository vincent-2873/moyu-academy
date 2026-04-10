"use client";

/**
 * v3 員工工作台 — /me
 *
 * 員工輸入 email 後看到完整工作畫面：
 *   - 我屬於哪個部門 / 職位
 *   - 我的職責 + KPI 目標
 *   - 我負責的專案
 *   - 今日待辦命令
 *
 * 哲學：員工註冊後就清楚自己該做什麼，不用問主管。
 */

import { useState, useEffect, useCallback } from "react";

interface Department {
  id: string;
  code: string;
  name: string;
  icon: string;
  color: string;
  description: string | null;
}

interface Position {
  id: string;
  title: string;
  level: string;
  description: string | null;
  responsibilities: string[];
  base_kpi: { metric: string; target: number }[];
}

interface Project {
  id: string;
  pillar_id: string | null;
  name: string;
  goal: string;
  status: string;
  health: string;
  progress: number;
  deadline: string | null;
}

interface Command {
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
  done_at: string | null;
}

interface MeData {
  ok: boolean;
  registered: boolean;
  message?: string;
  missing_migration?: boolean;
  profile?: { id: string; email: string; name: string; brand: string; role: string };
  department?: Department | null;
  position?: Position | null;
  manager?: { name: string; email: string; brand: string } | null;
  projects?: Project[];
  commands?: { pending: Command[]; recent: Command[] };
  stats?: { total_pending: number; done_today: number; blocked: number; total_projects: number };
  assigned?: boolean;
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

const HEALTH_META: Record<string, { color: string; label: string }> = {
  healthy: { color: "#22c55e", label: "🟢 正常" },
  warning: { color: "#f97316", label: "🟠 警告" },
  critical: { color: "#ef4444", label: "🔴 危急" },
  unknown: { color: "#94a3b8", label: "⚪ 未知" },
};

const BRAND_OPTIONS: { id: string; label: string; inviteCode: string }[] = [
  { id: "hq", label: "🏛️ 墨宇股份有限公司", inviteCode: "MOYUHQ2026" },
  { id: "nschool", label: "💼 nSchool 財經學院", inviteCode: "NS2026" },
  { id: "xuemi", label: "💼 XUEMI 學米", inviteCode: "XM2026" },
  { id: "ooschool", label: "💼 OOschool 無限學院", inviteCode: "OO2026" },
  { id: "aischool", label: "💼 AIschool AI 未來學院", inviteCode: "AS2026" },
  { id: "moyuhunt", label: "🎯 墨宇獵頭", inviteCode: "MOYUHUNT" },
  { id: "legal", label: "⚖️ 法務顧問事務所", inviteCode: "MOYULAW2026" },
];

export default function MePage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [data, setData] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Register form state ────
  const [mode, setMode] = useState<"login" | "register">("login");
  const [regName, setRegName] = useState("");
  const [regBrand, setRegBrand] = useState("hq");
  const [regInvite, setRegInvite] = useState("");
  const [regError, setRegError] = useState<string | null>(null);
  const [regBusy, setRegBusy] = useState(false);

  // 從 localStorage 還原 email
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("moyu_employee_email") : null;
    if (stored) {
      setEmail(stored);
      setSubmitted(true);
    }
  }, []);

  const load = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v3/me?email=${encodeURIComponent(email)}`, { cache: "no-store" });
      const json: MeData = await res.json();
      if (!json.ok) throw new Error(json.message || "讀取失敗");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    if (submitted) {
      load();
      const interval = setInterval(load, 30000);
      return () => clearInterval(interval);
    }
  }, [submitted, load]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    localStorage.setItem("moyu_employee_email", email);
    setSubmitted(true);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    if (!email.includes("@")) {
      setRegError("請輸入有效 email");
      return;
    }
    if (!regName.trim()) {
      setRegError("請輸入姓名");
      return;
    }
    const brandMeta = BRAND_OPTIONS.find((b) => b.id === regBrand);
    if (!brandMeta) {
      setRegError("請選擇品牌");
      return;
    }
    if (regInvite.trim() !== brandMeta.inviteCode) {
      setRegError(`邀請碼錯誤（${brandMeta.label}）`);
      return;
    }
    setRegBusy(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: regName.trim(), brand: regBrand }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setRegError(json.error || "註冊失敗");
        return;
      }
      localStorage.setItem("moyu_employee_email", email);
      setSubmitted(true);
    } catch {
      setRegError("網路錯誤，請稍後重試");
    } finally {
      setRegBusy(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("moyu_employee_email");
    setEmail("");
    setSubmitted(false);
    setData(null);
  };

  const [busyCmd, setBusyCmd] = useState<string | null>(null);

  const action = async (commandId: string, status: "done" | "blocked" | "ignored", note?: string) => {
    if (busyCmd) return;
    setBusyCmd(commandId);
    try {
      const res = await fetch("/api/v3/commands", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: commandId, status, blocked_reason: note, note }),
      });
      const json = await res.json();
      if (json.ok) load();
      else alert(json.error || "更新失敗");
    } catch {
      alert("網路錯誤，請稍後重試");
    } finally {
      setBusyCmd(null);
    }
  };

  // ─── Login / Register screen ────
  if (!submitted) {
    const tabBtn = (active: boolean): React.CSSProperties => ({
      flex: 1,
      padding: "10px 0",
      background: active ? "rgba(124,108,240,0.18)" : "transparent",
      color: active ? "#fff" : "#94a3b8",
      border: "1px solid",
      borderColor: active ? "rgba(124,108,240,0.6)" : "rgba(255,255,255,0.1)",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
    });
    return (
      <div style={loginWrap}>
        <div style={loginCard}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, color: "#fff" }}>墨宇學院 · 我的工作台</h1>
          <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>
            {mode === "login" ? "輸入你的工作 email，看看今天 Claude 給你什麼任務" : "首次加入請填寫下方資料"}
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            <button type="button" style={tabBtn(mode === "login")} onClick={() => { setMode("login"); setRegError(null); }}>登入</button>
            <button type="button" style={tabBtn(mode === "register")} onClick={() => { setMode("register"); setRegError(null); }}>註冊</button>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLogin}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                style={loginInput}
              />
              <button type="submit" style={loginBtn}>進入工作台 →</button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="工作 email"
                required
                style={loginInput}
              />
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="姓名"
                required
                style={loginInput}
              />
              <select
                value={regBrand}
                onChange={(e) => setRegBrand(e.target.value)}
                style={{ ...loginInput, appearance: "none" }}
              >
                {BRAND_OPTIONS.map((b) => (
                  <option key={b.id} value={b.id} style={{ background: "#0f172a" }}>{b.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={regInvite}
                onChange={(e) => setRegInvite(e.target.value)}
                placeholder="邀請碼"
                required
                style={loginInput}
              />
              {regError && (
                <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 10, textAlign: "left" }}>⚠️ {regError}</div>
              )}
              <button type="submit" disabled={regBusy} style={{ ...loginBtn, opacity: regBusy ? 0.6 : 1 }}>
                {regBusy ? "註冊中..." : "建立帳號 →"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ─── Loading ────
  if (loading && !data) {
    return <div style={fullScreenMsg}>載入工作台中...</div>;
  }

  // ─── Error ────
  if (error) {
    return (
      <div style={fullScreenMsg}>
        <div style={{ marginBottom: 16, color: "#ef4444" }}>⚠️ {error}</div>
        <button onClick={handleLogout} style={loginBtn}>重新登入</button>
      </div>
    );
  }

  if (!data) return null;

  // ─── Not registered ────
  if (!data.registered) {
    return (
      <div style={fullScreenMsg}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🤔</div>
        <div style={{ marginBottom: 8, fontSize: 18, color: "#fff", fontWeight: 700 }}>找不到這個 email</div>
        <div style={{ marginBottom: 24, color: "#94a3b8", fontSize: 13 }}>{data.message}</div>
        <button onClick={handleLogout} style={loginBtn}>換一個 email</button>
      </div>
    );
  }

  // ─── Main dashboard ────
  return (
    <div style={pageWrap}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>墨宇學院 · 我的工作台</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: 0 }}>{data.profile?.name || "(未命名)"}</h1>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{data.profile?.email}</div>
        </div>
        <button onClick={handleLogout} style={logoutBtn}>登出</button>
      </div>

      {/* Identity card */}
      {data.assigned && data.department && data.position ? (
        (() => {
          const dept = data.department;
          const pos = data.position;
          return (
            <div
              style={{
                ...sectionCard,
                background: `linear-gradient(135deg, ${dept.color}22, ${dept.color}08)`,
                border: `1px solid ${dept.color}55`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ fontSize: 48 }}>{dept.icon}</div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: dept.color, letterSpacing: 0.5, textTransform: "uppercase" }}>
                    {dept.name}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginTop: 2 }}>{pos.title}</div>
                  {pos.description && <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 4 }}>{pos.description}</div>}
                  {data.manager && (
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
                      👑 主管：<strong style={{ color: "#fff" }}>{data.manager.name}</strong> ({data.manager.email})
                    </div>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, minWidth: 280 }}>
                  <MiniStat label="待辦" value={data.stats?.total_pending ?? 0} color="#fbbf24" />
                  <MiniStat label="今日完成" value={data.stats?.done_today ?? 0} color="#22c55e" />
                  <MiniStat label="負責專案" value={data.stats?.total_projects ?? 0} color="#06b6d4" />
                </div>
              </div>

              {/* Responsibilities */}
              {pos.responsibilities && pos.responsibilities.length > 0 && (
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${dept.color}33` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: dept.color, marginBottom: 10, letterSpacing: 0.5, textTransform: "uppercase" }}>
                    📋 我的職責
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#e2e8f0", lineHeight: 1.8 }}>
                    {pos.responsibilities.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* KPI */}
              {pos.base_kpi && pos.base_kpi.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: dept.color, marginBottom: 10, letterSpacing: 0.5, textTransform: "uppercase" }}>
                    📊 KPI 目標
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {pos.base_kpi.map((k, i) => (
                      <div
                        key={i}
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          padding: "8px 14px",
                          fontSize: 12,
                          color: "#e2e8f0",
                        }}
                      >
                        {k.metric} ≥ <strong style={{ color: dept.color }}>{k.target}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()
      ) : (
        <div
          style={{
            ...sectionCard,
            background: "rgba(251,191,36,0.08)",
            border: "1px solid rgba(251,191,36,0.4)",
            textAlign: "center",
            padding: 40,
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fbbf24", marginBottom: 6 }}>等待主管指派部門與職位</div>
          <div style={{ fontSize: 13, color: "#cbd5e1" }}>請聯絡你的主管，到後台組織架構幫你設定部門和職位後就會看到完整工作內容</div>
        </div>
      )}

      {/* My projects */}
      {data.projects && data.projects.length > 0 && (
        <div style={sectionCard}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 14 }}>
            📁 我負責的專案 <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>({data.projects.length})</span>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {data.projects.map((p) => {
              const pillar = p.pillar_id ? PILLAR_META[p.pillar_id] : null;
              const health = HEALTH_META[p.health] || HEALTH_META.unknown;
              return (
                <div key={p.id} style={projectCard}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {pillar && <span style={{ fontSize: 16 }}>{pillar.icon}</span>}
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{p.name}</span>
                    </div>
                    <span style={{ fontSize: 11, color: health.color, fontWeight: 700 }}>{health.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>🎯 {p.goal}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${p.progress}%`, height: "100%", background: pillar?.color || "#7c6cf0", borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 11, color: "#cbd5e1" }}>{p.progress}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Today's commands */}
      <div style={sectionCard}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
            ⚡ 今日命令 <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>({data.commands?.pending.length || 0})</span>
          </div>
          <button onClick={load} style={refreshBtn}>🔄 重新整理</button>
        </div>

        {(!data.commands?.pending || data.commands.pending.length === 0) ? (
          <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 12 }}>
            🎉 今天沒有待辦命令 — 繼續推進你的專案
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {data.commands.pending.map((c) => (
              <CommandCard key={c.id} command={c} onAction={action} busy={busyCmd === c.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function CommandCard({ command, onAction, busy }: { command: Command; onAction: (id: string, status: "done" | "blocked" | "ignored", note?: string) => void; busy?: boolean }) {
  const [showBlocked, setShowBlocked] = useState(false);
  const [blockedNote, setBlockedNote] = useState("");
  const sev = SEVERITY_META[command.severity] || SEVERITY_META.normal;
  const pillar = command.pillar_id ? PILLAR_META[command.pillar_id] : null;
  const isOverdue = command.deadline && new Date(command.deadline) < new Date();

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${isOverdue ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.1)"}`,
        borderLeft: `3px solid ${sev.color}`,
        borderRadius: 10,
        padding: "14px 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: sev.bg, color: sev.color }}>
          {sev.label}
        </span>
        {pillar && (
          <span style={{ fontSize: 11, color: pillar.color, fontWeight: 600 }}>
            {pillar.icon} {pillar.name}
          </span>
        )}
        {command.ai_generated && (
          <span style={{ fontSize: 10, color: "#94a3b8" }}>🤖 Claude 指派</span>
        )}
        {isOverdue && <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 700 }}>已逾期</span>}
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{command.title}</div>
      {command.detail && <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 8, whiteSpace: "pre-wrap" }}>{command.detail}</div>}

      {command.deadline && (
        <div style={{ fontSize: 11, color: isOverdue ? "#ef4444" : "#94a3b8", marginBottom: 10 }}>
          🕒 截止：{new Date(command.deadline).toLocaleString("zh-TW")}
        </div>
      )}

      {showBlocked ? (
        <div style={{ marginTop: 10 }}>
          <textarea
            value={blockedNote}
            onChange={(e) => setBlockedNote(e.target.value)}
            placeholder="卡在哪裡？(會回報給 Claude 學習)"
            rows={3}
            style={{
              width: "100%",
              padding: 10,
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              color: "#fff",
              fontSize: 12,
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={() => {
                onAction(command.id, "blocked", blockedNote);
                setShowBlocked(false);
                setBlockedNote("");
              }}
              style={{ ...actionBtn, background: "#fbbf24", color: "#000" }}
            >
              送出
            </button>
            <button onClick={() => setShowBlocked(false)} style={{ ...actionBtn, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#94a3b8" }}>
              取消
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button disabled={busy} onClick={() => onAction(command.id, "done")} style={{ ...actionBtn, background: "#22c55e", color: "#fff", opacity: busy ? 0.5 : 1 }}>
            {busy ? "處理中..." : "✓ 完成"}
          </button>
          <button disabled={busy} onClick={() => setShowBlocked(true)} style={{ ...actionBtn, background: "#fbbf24", color: "#000", opacity: busy ? 0.5 : 1 }}>
            🚧 卡住
          </button>
          <button disabled={busy} onClick={() => onAction(command.id, "ignored")} style={{ ...actionBtn, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#94a3b8", opacity: busy ? 0.5 : 1 }}>
            ✗ 忽略
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Styles ────
const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #0f172a, #020617)",
  padding: "32px 24px",
  maxWidth: 960,
  margin: "0 auto",
  color: "#e2e8f0",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 24,
  gap: 16,
  flexWrap: "wrap",
};

const sectionCard: React.CSSProperties = {
  background: "rgba(15,23,42,0.6)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  padding: 24,
  marginBottom: 20,
};

const projectCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  padding: "12px 14px",
};

const loginWrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #0f172a, #020617)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};

const loginCard: React.CSSProperties = {
  background: "rgba(15,23,42,0.7)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 20,
  padding: 36,
  maxWidth: 420,
  width: "100%",
  textAlign: "center",
};

const loginInput: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  background: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 10,
  color: "#fff",
  fontSize: 14,
  marginBottom: 12,
};

const loginBtn: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  background: "linear-gradient(135deg, #7c6cf0, #06b6d4)",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const logoutBtn: React.CSSProperties = {
  background: "transparent",
  color: "#94a3b8",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 12,
  cursor: "pointer",
};

const refreshBtn: React.CSSProperties = {
  background: "transparent",
  color: "#94a3b8",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 11,
  cursor: "pointer",
};

const fullScreenMsg: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #0f172a, #020617)",
  color: "#94a3b8",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
  padding: 24,
  textAlign: "center",
};

const actionBtn: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  border: "none",
};
