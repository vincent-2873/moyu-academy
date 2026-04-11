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

import { useState, useEffect, useCallback, useRef } from "react";
import LineBindBanner from "@/components/LineBindBanner";

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

  // 從 localStorage 還原 email — 也 fallback 讀 root 登入的 sessionStorage.moyu_current_user，
  // 讓從 / 登入的業務進到 /me 不用再重新輸入一次 email
  useEffect(() => {
    if (typeof window === "undefined") return;
    let stored = localStorage.getItem("moyu_employee_email");
    if (!stored) {
      // root / login 會寫進 sessionStorage.moyu_current_user (見 src/lib/store.ts)
      stored = sessionStorage.getItem("moyu_current_user");
      if (stored) {
        // 順手同步回 localStorage，下次直接快取
        localStorage.setItem("moyu_employee_email", stored);
      }
    }
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
    // 同步到 root / 的 session key，讓兩邊共用登入狀態
    sessionStorage.setItem("moyu_current_user", email);
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
      sessionStorage.setItem("moyu_current_user", email);
      setSubmitted(true);
    } catch {
      setRegError("網路錯誤，請稍後重試");
    } finally {
      setRegBusy(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("moyu_employee_email");
    sessionStorage.removeItem("moyu_current_user");
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
      background: active ? "rgba(79,70,229,0.12)" : "transparent",
      color: active ? "#4f46e5" : "#64748b",
      border: "1px solid",
      borderColor: active ? "rgba(124,108,240,0.6)" : "#e2e8f0",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
    });
    return (
      <div style={loginWrap}>
        <div style={loginCard}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, color: "#0f172a" }}>墨宇戰情中樞 · 我的戰情</h1>
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
                  <option key={b.id} value={b.id} style={{ background: "#ffffff" }}>{b.label}</option>
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
        <div style={{ marginBottom: 8, fontSize: 18, color: "#0f172a", fontWeight: 700 }}>找不到這個 email</div>
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
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>墨宇戰情中樞 · 我的戰情</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: 0 }}>{data.profile?.name || "(未命名)"}</h1>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{data.profile?.email}</div>
        </div>
        <button onClick={handleLogout} style={logoutBtn}>登出</button>
      </div>

      {/* 未綁定 LINE 時自動顯示補綁 banner */}
      {data.profile?.email && <LineBindBanner email={data.profile.email} />}

      {/* 今日晨報 — 早上打開看到的代辦清單 */}
      {data.profile?.email && <DailyBriefingCard email={data.profile.email} />}

      {/* 個人業務數據卡片 — 對應 Metabase 同步進來的即時數字 */}
      {data.profile?.email && <MySalesMetricsCard email={data.profile.email} />}

      {/* 成就里程碑 — 新人看得見的進度、老人拿得到的長期目標 */}
      {data.profile?.email && <AchievementsCard email={data.profile.email} />}

      {/* 戰情官對練 — 跟 Claude 復盤 / 對練 / 話術 */}
      {data.profile?.email && <CoachChatCard email={data.profile.email} />}

      {/* 通話逐字稿診斷 — 貼通話內容讓戰情官 6 維度打分 + 給替代話術 */}
      {data.profile?.email && <RecordingAnalyzeCard email={data.profile.email} />}

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
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>{pos.title}</div>
                  {pos.description && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{pos.description}</div>}
                  {data.manager && (
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
                      👑 主管：<strong style={{ color: "#0f172a" }}>{data.manager.name}</strong> ({data.manager.email})
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
                          background: "rgba(15,23,42,0.04)",
                          border: "1px solid #e2e8f0",
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
          <div style={{ fontSize: 13, color: "#64748b" }}>請聯絡你的主管，到後台組織架構幫你設定部門和職位後就會看到完整工作內容</div>
        </div>
      )}

      {/* My projects */}
      {data.projects && data.projects.length > 0 && (
        <div style={sectionCard}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 14 }}>
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
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{p.name}</span>
                    </div>
                    <span style={{ fontSize: 11, color: health.color, fontWeight: 700 }}>{health.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>🎯 {p.goal}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, height: 6, background: "rgba(15,23,42,0.06)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${p.progress}%`, height: "100%", background: pillar?.color || "#7c6cf0", borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 11, color: "#64748b" }}>{p.progress}%</span>
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
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
            ⚡ 今日命令 <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>({data.commands?.pending.length || 0})</span>
          </div>
          <button onClick={load} style={refreshBtn}>🔄 重新整理</button>
        </div>

        {(!data.commands?.pending || data.commands.pending.length === 0) ? (
          <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", border: "1px dashed #e2e8f0", borderRadius: 12 }}>
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
    <div style={{ background: "rgba(15,23,42,0.04)", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
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
        background: "rgba(15,23,42,0.03)",
        border: `1px solid ${isOverdue ? "rgba(239,68,68,0.4)" : "#e2e8f0"}`,
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

      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>{command.title}</div>
      {command.detail && <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, whiteSpace: "pre-wrap" }}>{command.detail}</div>}

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
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              color: "#0f172a",
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
            <button onClick={() => setShowBlocked(false)} style={{ ...actionBtn, background: "transparent", border: "1px solid #cbd5e1", color: "#94a3b8" }}>
              取消
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button disabled={busy} onClick={() => onAction(command.id, "done")} style={{ ...actionBtn, background: "#22c55e", color: "#0f172a", opacity: busy ? 0.5 : 1 }}>
            {busy ? "處理中..." : "✓ 完成"}
          </button>
          <button disabled={busy} onClick={() => setShowBlocked(true)} style={{ ...actionBtn, background: "#fbbf24", color: "#000", opacity: busy ? 0.5 : 1 }}>
            🚧 卡住
          </button>
          <button disabled={busy} onClick={() => onAction(command.id, "ignored")} style={{ ...actionBtn, background: "transparent", border: "1px solid #cbd5e1", color: "#94a3b8", opacity: busy ? 0.5 : 1 }}>
            ✗ 忽略
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Styles（淺色主題） ────
const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #f4f6fb 0%, #eef2ff 100%)",
  padding: "32px 24px",
  maxWidth: 960,
  margin: "0 auto",
  color: "#0f172a",
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
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 24,
  marginBottom: 20,
  boxShadow: "0 10px 30px -16px rgba(15,23,42,0.10)",
};

const projectCard: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "12px 14px",
};

const loginWrap: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "linear-gradient(135deg, #f4f6fb 0%, #eef2ff 50%, #f5f3ff 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};

const loginCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 36,
  maxWidth: 420,
  width: "100%",
  textAlign: "center",
  boxShadow: "0 24px 70px -24px rgba(79,70,229,0.25)",
};

const loginInput: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  color: "#0f172a",
  fontSize: 14,
  marginBottom: 12,
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const loginBtn: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  background: "linear-gradient(135deg, #4f46e5, #06b6d4)",
  color: "#0f172a",
  border: "none",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 10px 24px -10px rgba(79,70,229,0.5)",
  transition: "transform 0.15s, box-shadow 0.15s",
};

const logoutBtn: React.CSSProperties = {
  background: "#ffffff",
  color: "#475569",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 12,
  cursor: "pointer",
};

const refreshBtn: React.CSSProperties = {
  background: "transparent",
  color: "#94a3b8",
  border: "1px solid #cbd5e1",
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

// ─── 個人業務數據卡片（即時數據 + 今日/本週/本月 + 達標警示）──────────────────

interface MyMetric {
  calls: number;
  call_minutes: number;
  connected: number;
  raw_appointments: number;
  appointments_show: number;
  raw_demos: number;
  closures: number;
  net_revenue_daily: number;
}
interface MyShortfall {
  metric: "calls" | "call_minutes" | "raw_appointments";
  actual: number;
  min: number;
  delta: number;
}
interface MySalesResponse {
  ok: boolean;
  bound: boolean;
  message?: string;
  profile?: {
    name: string | null;
    team: string | null;
    org: string | null;
    brand: string;
    level: string | null;
  };
  today?: MyMetric;
  week?: MyMetric;
  month?: MyMetric;
  dailyTrend?: Array<{ date: string; calls: number; closures: number; net_revenue_daily: number; appointments_show: number }>;
  rule?: {
    name: string;
    min_calls: number | null;
    min_call_minutes: number | null;
    min_appointments: number | null;
    severity: string;
  } | null;
  shortfalls?: MyShortfall[];
  provenance?: {
    brand: string;
    questionId: number;
    questionName: string | null;
    lastSyncAt: string | null;
    lastSyncRows: number | null;
    lastSyncStatus: string | null;
  } | null;
  latestAvailable?: { date: string; metric: MyMetric } | null;
  todayDate?: string;
  rates?: {
    today: FunnelRatesDTO;
    week: FunnelRatesDTO;
    month: FunnelRatesDTO;
  };
  brandComparison?: {
    peopleCount: number;
    totalRevenue: number;
    rates: FunnelRatesDTO;
  };
}

interface FunnelRatesDTO {
  connectRate: number | null;
  inviteRate: number | null;
  showRate: number | null;
  closeRate: number | null;
  demoCloseRate: number | null;
  avgCallMinutes: number | null;
  avgDealSize: number | null;
  orderRevenueEstimate: number;
}

const BRAND_CN: Record<string, string> = {
  nschool: "nSchool 財經學院",
  xuemi: "XUEMI 學米",
  sixdigital: "無限學院",
  ooschool: "無限學院",
  xlab: "XLAB AI 實驗室",
  aischool: "AI 未來學院",
};

function MySalesMetricsCard({ email }: { email: string }) {
  const [data, setData] = useState<MySalesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/me/sales-metrics?email=${encodeURIComponent(email)}`, { cache: "no-store" });
        const json = (await res.json()) as MySalesResponse;
        if (!cancelled) setData(json);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    // Auto refresh every 2 minutes
    const interval = setInterval(load, 120000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [email]);

  if (loading) return null;
  if (!data || !data.ok) return null;

  // 沒綁定業務資料 — 可能是管理員、還沒匯入、或 email 不在 Metabase 名單
  if (!data.bound) {
    return (
      <div
        style={{
          margin: "16px 0",
          padding: "14px 18px",
          background: "#f8fafc",
          border: "1px dashed #e2e8f0",
          borderRadius: 14,
          color: "#64748b",
          fontSize: 12,
        }}
      >
        📊 你這個信箱還沒有業務即時數據。可能原因：(1) 今天還沒同步 (2) 你不是電銷業務 (3) email 跟 Metabase 名單對不起來。
      </div>
    );
  }

  const today = data.today!;
  const week = data.week!;
  const month = data.month!;
  const profile = data.profile!;
  const rule = data.rule;
  const shortfalls = data.shortfalls || [];

  return (
    <div
      style={{
        margin: "20px 0",
        padding: 24,
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        border: "1px solid #e2e8f0",
        borderRadius: 18,
        boxShadow: "0 12px 40px -18px rgba(79,70,229,0.18)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>📞 我的即時業務數據</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
            {profile.name || "(未命名)"}
            {profile.level === "新人" && (
              <span style={{ marginLeft: 8, background: "rgba(14,165,233,0.13)", color: "#0ea5e9", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                新人
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {BRAND_CN[profile.brand] || profile.brand}
            {profile.org && ` · 📍 ${profile.org}`}
            {profile.team && ` · 🎯 ${profile.team}`}
          </div>
        </div>
      </div>

      {/* Rule / shortfall alert */}
      {rule && shortfalls.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            background:
              rule.severity === "critical"
                ? "rgba(239,68,68,0.08)"
                : rule.severity === "high"
                ? "rgba(249,115,22,0.08)"
                : "rgba(251,191,36,0.08)",
            border: `1.5px solid ${
              rule.severity === "critical"
                ? "rgba(239,68,68,0.4)"
                : rule.severity === "high"
                ? "rgba(249,115,22,0.4)"
                : "rgba(251,191,36,0.4)"
            }`,
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
            {rule.severity === "critical" ? "🔴" : rule.severity === "high" ? "🟠" : "🟡"} {rule.name}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#0f172a" }}>
            {shortfalls.map((s) => (
              <div key={s.metric}>
                {s.metric === "calls" ? "通次" : s.metric === "call_minutes" ? "通時" : "邀約"}{" "}
                <strong>{s.actual}</strong> / <strong>{s.min}</strong>
                <span style={{ color: "#dc2626", marginLeft: 4 }}>(差 {s.delta})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 今天沒同步時的 notice */}
      {data.latestAvailable && data.latestAvailable.metric && (
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            background: "rgba(14,165,233,0.08)",
            border: "1px dashed rgba(14,165,233,0.35)",
            borderRadius: 10,
            fontSize: 11,
            color: "#075985",
            fontWeight: 600,
          }}
        >
          ⏳ 今天 ({data.todayDate}) 的 Metabase 還沒同步，以下顯示最後一天 <strong>{data.latestAvailable.date}</strong> 的資料
        </div>
      )}

      {/* 🎯 miao-miao 風格：月度 4 大 Funnel + 淨業績 */}
      {(() => {
        const m = month;
        const r = data.rates?.month;
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
            <MiniFunnelCard label="通次" big={m.calls} rate={r?.connectRate ?? null} rateLabel="接通率" tone="#4f46e5" />
            <MiniFunnelCard label="邀約" big={m.raw_appointments} rate={r?.inviteRate ?? null} rateLabel="接通→邀約" tone="#d97706" />
            <MiniFunnelCard label="出席" big={m.appointments_show} rate={r?.showRate ?? null} rateLabel="邀約→出席" tone="#ea580c" />
            <MiniFunnelCard label="成交" big={m.closures} rate={r?.closeRate ?? null} rateLabel="出席→成交" tone="#16a34a" />
            <MiniFunnelCard label="淨業績" bigText={`NT$${formatMillionsMe(m.net_revenue_daily)}`} tone="#db2777" highlight />
          </div>
        );
      })()}

      {/* 個人業績趨勢 sparkline */}
      {data.dailyTrend && data.dailyTrend.length > 1 && (
        <PersonalTrend trend={data.dailyTrend} />
      )}

      {/* 🎯 轉換漏斗率 + 同品牌平均比對 (miao-miao 風格) */}
      {data.rates && data.brandComparison && (
        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            background: "linear-gradient(90deg, rgba(79,70,229,0.04), rgba(219,39,119,0.04))",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#475569",
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>🎯 本月轉換漏斗（你 vs 同品牌 {data.brandComparison.peopleCount} 人平均）</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
            <PersonalRateCell
              label="接通率"
              mine={data.rates.month.connectRate}
              avg={data.brandComparison.rates.connectRate}
              tone="#0891b2"
            />
            <PersonalRateCell
              label="邀約率"
              mine={data.rates.month.inviteRate}
              avg={data.brandComparison.rates.inviteRate}
              tone="#d97706"
            />
            <PersonalRateCell
              label="出席率"
              mine={data.rates.month.showRate}
              avg={data.brandComparison.rates.showRate}
              tone="#ea580c"
            />
            <PersonalRateCell
              label="成交率"
              mine={data.rates.month.closeRate}
              avg={data.brandComparison.rates.closeRate}
              tone="#16a34a"
            />
            <PersonalRateCell
              label="客單價"
              mine={data.rates.month.avgDealSize}
              avg={data.brandComparison.rates.avgDealSize}
              tone="#db2777"
              format="money"
            />
            <PersonalRateCell
              label="單通平均"
              mine={data.rates.month.avgCallMinutes}
              avg={data.brandComparison.rates.avgCallMinutes}
              tone="#0d9488"
              suffix="分"
            />
          </div>
        </div>
      )}

      {/* Provenance footer */}
      {data.provenance && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: "1px dashed #e2e8f0",
            fontSize: 10,
            color: "#94a3b8",
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            lineHeight: 1.5,
          }}
        >
          <span>📡 資料來源：Metabase #{data.provenance.questionId}</span>
          {data.provenance.questionName && <span>· {data.provenance.questionName}</span>}
          {data.provenance.lastSyncAt && (
            <span>
              · 最後同步 <strong style={{ color: "#64748b" }}>{formatSyncAge(data.provenance.lastSyncAt)}</strong>
            </span>
          )}
          {data.provenance.lastSyncStatus && data.provenance.lastSyncStatus !== "success" && (
            <span style={{ color: "#dc2626" }}>· ⚠️ {data.provenance.lastSyncStatus}</span>
          )}
        </div>
      )}
    </div>
  );
}

function formatMillionsMe(n: number): string {
  if (!isFinite(n)) return "0";
  if (n >= 10000) return `${(n / 10000).toFixed(1)}萬`;
  return Math.round(n).toLocaleString();
}

function MiniFunnelCard({
  label,
  big,
  bigText,
  rate,
  rateLabel,
  tone,
  highlight,
}: {
  label: string;
  big?: number;
  bigText?: string;
  rate?: number | null;
  rateLabel?: string;
  tone: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: `1px solid ${highlight ? tone : "#e2e8f0"}`,
        borderRadius: 14,
        padding: "12px 14px",
        position: "relative",
        overflow: "hidden",
        boxShadow: highlight ? `0 10px 24px -12px ${tone}33` : "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: tone,
        }}
      />
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: highlight ? tone : "#0f172a", lineHeight: 1.1 }}>
        {bigText != null ? bigText : big?.toLocaleString() || 0}
      </div>
      {rate != null && rateLabel && (
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
          {rateLabel} <strong style={{ color: tone }}>{(rate * 100).toFixed(1)}%</strong>
        </div>
      )}
    </div>
  );
}

function PersonalTrend({
  trend,
}: {
  trend: Array<{ date: string; calls: number; closures: number; net_revenue_daily: number; appointments_show: number }>;
}) {
  const max = Math.max(...trend.map((d) => d.net_revenue_daily), 1);
  const total = trend.reduce((s, d) => s + d.net_revenue_daily, 0);
  return (
    <div
      style={{
        marginBottom: 14,
        padding: "12px 14px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>📈 本月業績趨勢</span>
        <span style={{ fontSize: 10, color: "#94a3b8" }}>
          合計 NT${formatMillionsMe(total)} · {trend.length} 天
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${trend.length}, 1fr)`,
          gap: 3,
          alignItems: "end",
          height: 70,
        }}
      >
        {trend.map((d) => {
          const pct = Math.max(3, (d.net_revenue_daily / max) * 100);
          return (
            <div
              key={d.date}
              title={`${d.date}: NT$${formatMillionsMe(d.net_revenue_daily)} · ${d.calls} 通 · ${d.closures} 成交`}
              style={{
                height: `${pct}%`,
                minHeight: 3,
                background: d.net_revenue_daily > 0 ? "linear-gradient(180deg,#db2777,#be185d)" : "#e2e8f0",
                borderRadius: 3,
              }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#94a3b8", marginTop: 4 }}>
        <span>{trend[0]?.date.slice(5)}</span>
        <span>{trend[trend.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

function formatSyncAge(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  if (diffMs < 0) return "剛剛";
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "剛剛";
  if (mins < 60) return `${mins} 分鐘前`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.round(hours / 24);
  return `${days} 天前`;
}

function PersonalRateCell({
  label,
  mine,
  avg,
  tone,
  format,
  suffix,
}: {
  label: string;
  mine: number | null;
  avg: number | null;
  tone: string;
  format?: "percent" | "money";
  suffix?: string;
}) {
  const fmt = format || "percent";
  const render = (v: number | null) => {
    if (v == null) return "—";
    if (fmt === "money") return `$${Math.round(v).toLocaleString()}`;
    return `${(v * 100).toFixed(1)}%`;
  };
  // 比平均是否高
  const delta =
    mine != null && avg != null ? (fmt === "percent" ? mine - avg : mine - avg) : null;
  const diffPct =
    mine != null && avg != null && avg > 0 ? ((mine - avg) / avg) * 100 : null;
  const isAbove = delta != null && delta > 0;
  const isBelow = delta != null && delta < 0;
  return (
    <div
      style={{
        background: "#ffffff",
        border: `1px solid ${tone}33`,
        borderRadius: 10,
        padding: "8px 10px",
      }}
    >
      <div style={{ fontSize: 10, color: tone, fontWeight: 800, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", lineHeight: 1.1 }}>
        {render(mine)}
        {suffix && mine != null ? <span style={{ fontSize: 10, marginLeft: 2 }}>{suffix}</span> : null}
      </div>
      <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>
        平均 {render(avg)}
        {suffix && avg != null ? suffix : null}
        {diffPct != null && isFinite(diffPct) && (
          <span
            style={{
              marginLeft: 6,
              fontWeight: 700,
              color: isAbove ? "#16a34a" : isBelow ? "#dc2626" : "#94a3b8",
            }}
          >
            {isAbove ? "↑" : isBelow ? "↓" : "·"}
            {Math.abs(diffPct).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

function PeriodGrid({
  label,
  metric,
  tone,
}: {
  label: string;
  metric: MyMetric;
  tone: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: tone, marginBottom: 6 }}>{label}</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))",
          gap: 8,
        }}
      >
        <StatCell label="通次" value={metric.calls} />
        <StatCell label="接通" value={metric.connected} />
        <StatCell label="通時" value={`${Math.round(metric.call_minutes)}分`} />
        <StatCell label="邀約" value={metric.raw_appointments} />
        <StatCell label="出席" value={metric.appointments_show} accent={metric.appointments_show > 0 ? "#ea580c" : undefined} />
        <StatCell label="DEMO" value={metric.raw_demos} />
        <StatCell label="成交" value={metric.closures} accent={metric.closures > 0 ? "#16a34a" : undefined} />
        <StatCell label="淨業績" value={`$${Math.round(metric.net_revenue_daily).toLocaleString()}`} accent={metric.net_revenue_daily > 0 ? "#db2777" : undefined} wide />
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  accent,
  wide,
}: {
  label: string;
  value: string | number;
  accent?: string;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: "10px 12px",
        gridColumn: wide ? "span 2" : undefined,
      }}
    >
      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 900,
          color: accent || "#0f172a",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── 成就里程碑卡片 (新人看得見進度 / 老人長期目標) ───────────────────────

interface Achievement {
  id: string;
  tier: "rookie" | "growing" | "veteran" | "elite";
  icon: string;
  title: string;
  description: string;
  target: number;
  actual: number;
  pct: number;
  unlocked: boolean;
  unlockedAt?: string;
}

interface AchievementsResponse {
  ok: boolean;
  bound: boolean;
  stats?: {
    totalAchievements: number;
    unlockedCount: number;
    daysActive: number;
    longestStreak: number;
    currentStreak: number;
  };
  recentlyUnlocked?: Achievement[];
  inProgress?: Achievement[];
  upNext?: Achievement[];
  unlocked?: Achievement[];
}

const TIER_COLORS: Record<Achievement["tier"], { bg: string; border: string; text: string; label: string }> = {
  rookie: { bg: "#eff6ff", border: "#93c5fd", text: "#2563eb", label: "新人" },
  growing: { bg: "#f0fdf4", border: "#86efac", text: "#16a34a", label: "成長" },
  veteran: { bg: "#fef3c7", border: "#fcd34d", text: "#d97706", label: "老手" },
  elite: { bg: "#fce7f3", border: "#f9a8d4", text: "#db2777", label: "菁英" },
};

function AchievementsCard({ email }: { email: string }) {
  const [data, setData] = useState<AchievementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/me/achievements?email=${encodeURIComponent(email)}`, { cache: "no-store" });
        const json = (await res.json()) as AchievementsResponse;
        if (!cancelled) setData(json);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
  }, [email]);

  if (loading) return null;
  if (!data || !data.ok || !data.bound) return null;

  const stats = data.stats!;
  const recent = data.recentlyUnlocked || [];
  const upNext = data.upNext || [];
  const unlocked = data.unlocked || [];

  return (
    <div
      style={{
        margin: "20px 0",
        padding: 24,
        background: "linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)",
        border: "1px solid #fcd34d",
        borderRadius: 18,
        boxShadow: "0 12px 40px -18px rgba(234,88,12,0.25)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, color: "#b45309", fontWeight: 700 }}>🏅 成就里程碑</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
            {stats.unlockedCount} / {stats.totalAchievements}
            <span style={{ fontSize: 12, fontWeight: 600, color: "#b45309", marginLeft: 8 }}>
              已解鎖
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#92400e", marginTop: 4 }}>
            活躍 {stats.daysActive} 天 · 最長連續 {stats.longestStreak} 天 · 目前連續 {stats.currentStreak} 天
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #fcd34d",
            background: "#fff",
            fontSize: 11,
            fontWeight: 700,
            color: "#b45309",
            cursor: "pointer",
          }}
        >
          {expanded ? "收起 ▲" : "看全部 ▼"}
        </button>
      </div>

      {/* 剛解鎖 */}
      {recent.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#b45309", marginBottom: 8 }}>
            ✨ 最近 7 天解鎖
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {recent.map((a) => (
              <AchievementCell key={a.id} a={a} />
            ))}
          </div>
        </div>
      )}

      {/* 下一個目標 */}
      {upNext.length > 0 && (
        <div style={{ marginBottom: expanded ? 14 : 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#b45309", marginBottom: 8 }}>
            🎯 下一個目標
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {upNext.map((a) => (
              <AchievementCell key={a.id} a={a} />
            ))}
          </div>
        </div>
      )}

      {/* 全部 (expanded) */}
      {expanded && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#b45309", marginBottom: 8, marginTop: 14 }}>
            🏆 所有已解鎖 ({unlocked.length})
          </div>
          {unlocked.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              {unlocked.map((a) => (
                <AchievementCell key={a.id} a={a} />
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#92400e", padding: "12px 0" }}>
              還沒有任何解鎖 — 開始打第一通電話吧！
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AchievementCell({ a }: { a: Achievement }) {
  const tone = TIER_COLORS[a.tier];
  return (
    <div
      style={{
        background: a.unlocked ? tone.bg : "#ffffff",
        border: `1px solid ${a.unlocked ? tone.border : "#e2e8f0"}`,
        borderRadius: 10,
        padding: "10px 12px",
        opacity: a.unlocked ? 1 : 0.85,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 20, filter: a.unlocked ? "none" : "grayscale(0.7)" }}>{a.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>
            {a.title}
          </div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: tone.text,
              textTransform: "uppercase",
              marginTop: 2,
            }}
          >
            {tone.label}
          </div>
        </div>
        {a.unlocked && (
          <div style={{ fontSize: 14, color: tone.text }}>✓</div>
        )}
      </div>
      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6, lineHeight: 1.4 }}>
        {a.description}
      </div>
      <div
        style={{
          height: 6,
          background: "#f1f5f9",
          borderRadius: 4,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: `${a.pct}%`,
            height: "100%",
            background: tone.text,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, display: "flex", justifyContent: "space-between" }}>
        <span>
          {a.actual.toLocaleString()} / {a.target.toLocaleString()}
        </span>
        <span style={{ fontWeight: 700, color: tone.text }}>{a.pct}%</span>
      </div>
    </div>
  );
}

// ─── 今日晨報卡片 (wake up, see what to do) ─────────────────────────────────

interface BriefingAction {
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  detail: string;
  source: string;
  estimate?: string;
}
interface BriefingResponse {
  ok: boolean;
  bound: boolean;
  email: string;
  generatedAt: string;
  profile?: { name: string; brand: string; team: string | null; org: string | null; level: string | null };
  today?: { calls: number; connected: number; raw_appointments: number; appointments_show: number; closures: number; net_revenue_daily: number };
  rule?: { name: string; severity: string; targets: { calls: number | null; call_minutes: number | null; raw_appointments: number | null } } | null;
  shortfalls?: Array<{ metric: string; actual: number; min: number; delta: number }>;
  headlineSummary?: string;
  actions?: BriefingAction[];
  teamContext?: { topPerformer: { name: string; revenue: number } | null; silent: Array<{ name: string; calls: number }> };
  cached?: boolean;
  message?: string;
}

const PRIORITY_STYLE: Record<BriefingAction["priority"], { bg: string; bar: string; label: string; icon: string }> = {
  critical: { bg: "rgba(239,68,68,0.08)", bar: "#dc2626", label: "最高優先", icon: "🔴" },
  high: { bg: "rgba(249,115,22,0.08)", bar: "#ea580c", label: "高", icon: "🟠" },
  medium: { bg: "rgba(251,191,36,0.08)", bar: "#d97706", label: "中", icon: "🟡" },
  low: { bg: "rgba(14,165,233,0.08)", bar: "#0891b2", label: "低", icon: "🔵" },
};

function DailyBriefingCard({ email }: { email: string }) {
  const [data, setData] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      try {
        const url = `/api/me/daily-briefing?email=${encodeURIComponent(email)}${refresh ? "&refresh=1" : ""}`;
        const res = await fetch(url, { cache: "no-store" });
        const json = (await res.json()) as BriefingResponse;
        setData(json);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [email]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  if (loading) return null;
  if (!data?.ok) return null;

  if (!data.bound) {
    return null; // Already covered by MySalesMetricsCard's "尚未綁定" message
  }

  const actions = data.actions || [];
  const topPerformer = data.teamContext?.topPerformer;

  return (
    <div
      style={{
        margin: "20px 0",
        padding: 24,
        background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 50%, #fef3c7 100%)",
        border: "1px solid rgba(234,88,12,0.2)",
        borderRadius: 18,
        boxShadow: "0 14px 42px -18px rgba(234,88,12,0.22)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "#92400e", fontWeight: 800, letterSpacing: 1 }}>☀️ 今日晨報</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginTop: 6, lineHeight: 1.4 }}>
            {data.headlineSummary}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            {data.cached ? "📦 今日已生成 (可重新整理)" : "🆕 剛剛生成"} · {new Date(data.generatedAt).toLocaleString("zh-TW")}
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "1.5px solid #fed7aa",
            background: "#ffffff",
            color: "#c2410c",
            fontSize: 12,
            fontWeight: 700,
            cursor: refreshing ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {refreshing ? "重算中..." : "↻ 重新生成"}
        </button>
      </div>

      {/* Action list */}
      {actions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {actions.map((a, i) => {
            const style = PRIORITY_STYLE[a.priority] || PRIORITY_STYLE.medium;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "12px 14px",
                  background: style.bg,
                  borderLeft: `4px solid ${style.bar}`,
                  borderRadius: 10,
                }}
              >
                <div style={{ fontSize: 18, flexShrink: 0 }}>{style.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                      {i + 1}. {a.title}
                    </span>
                    {a.estimate && (
                      <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>⏱ {a.estimate}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#334155", marginTop: 4, lineHeight: 1.6 }}>{a.detail}</div>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 6, fontStyle: "italic" }}>
                    📎 依據：{a.source}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Team context footer */}
      {topPerformer && topPerformer.revenue > 0 && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            background: "rgba(22,163,74,0.08)",
            borderRadius: 10,
            fontSize: 12,
            color: "#14532d",
          }}
        >
          🏆 今日同組 MVP：<strong>{topPerformer.name}</strong> · ${topPerformer.revenue.toLocaleString()} — 別只打電話，今天一定要跟他對 1 個 objection 學法
        </div>
      )}
      {data.teamContext?.silent && data.teamContext.silent.length > 0 && (
        <div
          style={{
            marginTop: 8,
            padding: "10px 14px",
            background: "rgba(239,68,68,0.08)",
            borderRadius: 10,
            fontSize: 12,
            color: "#7f1d1d",
          }}
        >
          🔴 今日掛蛋同事：{data.teamContext.silent.map((s) => s.name).join("、")} — 不要跟他們一起掉進舒適圈
        </div>
      )}
    </div>
  );
}

// ─── 通話逐字稿診斷卡片 ─────────────────────────────────────────────────────

interface RecordingScore {
  score: number;
  evidence: string;
}
interface RecordingAnalysis {
  overall_score: number;
  one_liner: string;
  scores: {
    opening: RecordingScore;
    rapport: RecordingScore;
    discovery: RecordingScore;
    pitch: RecordingScore;
    objection_handling: RecordingScore;
    close: RecordingScore;
  };
  critical_moments: Array<{
    timestamp: string;
    quote: string;
    problem: string;
    better_script: string;
    reasoning: string;
  }>;
  wins: Array<{ quote: string; why: string }>;
  next_actions: string[];
}

const SCENARIO_OPTIONS = [
  "邀約電話 (cold call)",
  "確認出席",
  "成交通話",
  "C 級客戶追蹤",
  "異議處理",
  "其他",
];

const OUTCOME_OPTIONS: Array<{ id: string; label: string; color: string }> = [
  { id: "rejected", label: "❌ 被拒絕", color: "#dc2626" },
  { id: "follow_up", label: "🔄 要再聯繫", color: "#d97706" },
  { id: "booked", label: "📅 約成功", color: "#0891b2" },
  { id: "closed", label: "🎯 成交", color: "#16a34a" },
  { id: "ghosted", label: "👻 客戶不理", color: "#94a3b8" },
];

const DIMENSION_LABELS: Record<keyof RecordingAnalysis["scores"], string> = {
  opening: "開場",
  rapport: "建立關係",
  discovery: "挖掘需求",
  pitch: "產品介紹",
  objection_handling: "異議處理",
  close: "收單",
};

function RecordingAnalyzeCard({ email }: { email: string }) {
  const [transcript, setTranscript] = useState("");
  const [scenario, setScenario] = useState(SCENARIO_OPTIONS[0]);
  const [outcome, setOutcome] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<RecordingAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const analyze = async () => {
    if (transcript.trim().length < 50) {
      setError("逐字稿至少要 50 字");
      return;
    }
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/me/recording-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, transcript, scenario, customerOutcome: outcome || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "分析失敗");
      } else {
        setResult(json.analysis);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "network error");
    } finally {
      setAnalyzing(false);
    }
  };

  const scoreColor = (s: number) => {
    if (s >= 8) return "#16a34a";
    if (s >= 6) return "#d97706";
    return "#dc2626";
  };

  return (
    <div
      style={{
        margin: "20px 0",
        padding: 24,
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 18,
        boxShadow: "0 12px 40px -18px rgba(15,23,42,0.12)",
      }}
    >
      <div
        style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={{ fontSize: 14, color: "#94a3b8", fontWeight: 700 }}>{expanded ? "▼" : "▶"}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>📼 通話復盤</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginTop: 2 }}>
            通話逐字稿診斷
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            把通話逐字稿貼上來，戰情官從 6 個面向打分 + 指出問題時點 + 給替代話術
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 20 }}>
          {/* Scenario + outcome */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4 }}>情境</div>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1.5px solid #e2e8f0",
                  fontSize: 13,
                  background: "#ffffff",
                  color: "#0f172a",
                }}
              >
                {SCENARIO_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4 }}>客戶結果</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {OUTCOME_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setOutcome(outcome === o.id ? "" : o.id)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: `1.5px solid ${outcome === o.id ? o.color : "#e2e8f0"}`,
                      background: outcome === o.id ? `${o.color}15` : "#ffffff",
                      color: outcome === o.id ? o.color : "#64748b",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Transcript textarea */}
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={`把整段通話逐字稿貼在這邊，例如：\n\n業務：您好，這是 XX 學院 Tiffany，想跟您聊聊...\n客戶：我現在有點忙。\n業務：好的，請問什麼時間方便...\n...\n\n至少 50 字以上`}
            rows={12}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 10,
              border: "1.5px solid #e2e8f0",
              fontSize: 13,
              fontFamily: "monospace",
              lineHeight: 1.6,
              resize: "vertical",
              background: "#f8fafc",
              color: "#0f172a",
              boxSizing: "border-box",
            }}
          />
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            目前 {transcript.length} 字
          </div>

          {error && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 14px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 10,
                fontSize: 12,
                color: "#dc2626",
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={analyze}
            disabled={analyzing || transcript.length < 50}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "12px",
              borderRadius: 12,
              border: "none",
              background:
                analyzing || transcript.length < 50
                  ? "#e2e8f0"
                  : "linear-gradient(135deg, #4f46e5, #7c3aed)",
              color: analyzing || transcript.length < 50 ? "#94a3b8" : "#ffffff",
              fontSize: 14,
              fontWeight: 800,
              cursor: analyzing || transcript.length < 50 ? "not-allowed" : "pointer",
            }}
          >
            {analyzing ? "🧠 戰情官分析中..." : "📼 開始診斷"}
          </button>

          {result && (
            <div style={{ marginTop: 20 }}>
              {/* Overall */}
              <div
                style={{
                  padding: 16,
                  background: "linear-gradient(135deg, #fef3c7, #ffffff)",
                  border: "1px solid rgba(251,191,36,0.3)",
                  borderRadius: 12,
                  marginBottom: 14,
                }}
              >
                <div style={{ fontSize: 11, color: "#92400e", fontWeight: 700 }}>總評</div>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 900,
                    color: scoreColor(result.overall_score),
                    lineHeight: 1,
                    marginTop: 4,
                  }}
                >
                  {result.overall_score}
                  <span style={{ fontSize: 14, color: "#64748b" }}> / 10</span>
                </div>
                <div style={{ fontSize: 13, color: "#0f172a", marginTop: 8, lineHeight: 1.6 }}>
                  {result.one_liner}
                </div>
              </div>

              {/* 6 dimensions */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                {(Object.keys(DIMENSION_LABELS) as Array<keyof typeof DIMENSION_LABELS>).map((key) => {
                  const s = result.scores[key];
                  return (
                    <div
                      key={key}
                      style={{
                        padding: 10,
                        background: "#f8fafc",
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>
                        {DIMENSION_LABELS[key]}
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: scoreColor(s.score), lineHeight: 1 }}>
                        {s.score}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#64748b",
                          marginTop: 4,
                          fontStyle: "italic",
                          lineHeight: 1.4,
                        }}
                      >
                        &ldquo;{s.evidence.slice(0, 60)}{s.evidence.length > 60 ? "..." : ""}&rdquo;
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Critical moments */}
              {result.critical_moments && result.critical_moments.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
                    🔴 關鍵問題點
                  </div>
                  {result.critical_moments.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        padding: 12,
                        marginBottom: 8,
                        background: "rgba(239,68,68,0.05)",
                        borderLeft: "4px solid #dc2626",
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>
                        {m.timestamp}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          fontStyle: "italic",
                          background: "#f8fafc",
                          padding: "6px 10px",
                          borderRadius: 6,
                          marginBottom: 6,
                        }}
                      >
                        &ldquo;{m.quote}&rdquo;
                      </div>
                      <div style={{ fontSize: 12, color: "#991b1b", fontWeight: 700, marginBottom: 4 }}>
                        問題：{m.problem}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#166534",
                          background: "rgba(22,163,74,0.08)",
                          padding: "6px 10px",
                          borderRadius: 6,
                          marginTop: 6,
                        }}
                      >
                        💬 替代話術：&ldquo;{m.better_script}&rdquo;
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, fontStyle: "italic" }}>
                        → {m.reasoning}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Wins */}
              {result.wins && result.wins.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#166534", marginBottom: 8 }}>
                    ✅ 做得好
                  </div>
                  {result.wins.map((w, i) => (
                    <div
                      key={i}
                      style={{
                        padding: 10,
                        marginBottom: 6,
                        background: "rgba(22,163,74,0.06)",
                        borderLeft: "4px solid #16a34a",
                        borderRadius: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          fontStyle: "italic",
                          marginBottom: 4,
                        }}
                      >
                        &ldquo;{w.quote}&rdquo;
                      </div>
                      <div style={{ fontSize: 12, color: "#166534" }}>{w.why}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Next actions */}
              {result.next_actions && result.next_actions.length > 0 && (
                <div
                  style={{
                    padding: 14,
                    background: "rgba(79,70,229,0.06)",
                    borderRadius: 10,
                    border: "1px solid rgba(79,70,229,0.2)",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#4f46e5", marginBottom: 8 }}>
                    🎯 下次必做
                  </div>
                  {result.next_actions.map((a, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 12,
                        color: "#0f172a",
                        marginBottom: 4,
                        paddingLeft: 18,
                        position: "relative",
                      }}
                    >
                      <span style={{ position: "absolute", left: 0, color: "#4f46e5" }}>→</span>
                      {a}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 戰情官聊天卡片 ──────────────────────────────────────────────────────────

type ChatMsg = { role: "user" | "assistant"; content: string };
type ChatMode = "debrief" | "practice" | "objection";

const MODE_LABEL: Record<ChatMode, { label: string; desc: string; icon: string }> = {
  debrief: { label: "今日復盤", desc: "戰情官看你今天的數據，指出問題 + 具體補救", icon: "📊" },
  practice: { label: "客戶對練", desc: "模擬難纏客戶，練習話術應對", icon: "🎭" },
  objection: { label: "話術急救", desc: "遇到 objection 不知怎麼回，立刻拿到 3 句可直接講", icon: "💬" },
};

const QUICK_PROMPTS: Record<ChatMode, string[]> = {
  debrief: [
    "幫我看今天哪裡卡住了",
    "我通次不夠該怎麼補",
    "為什麼今天邀不到人",
    "剩下的時間要怎麼安排",
  ],
  practice: [
    "來練一個「我再考慮看看」",
    "模擬一個對價格敏感的客戶",
    "模擬老婆反對要諮詢的客戶",
    "模擬有興趣但推到下週的客戶",
  ],
  objection: [
    "客戶說「我沒錢」怎麼回",
    "客戶說「我再想想」怎麼回",
    "客戶說「我老婆不同意」怎麼回",
    "客戶說「課程太貴」怎麼回",
  ],
};

function CoachChatCard({ email }: { email: string }) {
  const [mode, setMode] = useState<ChatMode>("debrief");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Reset messages when mode changes
  useEffect(() => {
    setMessages([]);
  }, [mode]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || sending) return;
    const userMsg: ChatMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setSending(true);

    // Placeholder assistant message that will stream
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/me/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, mode, messages: newMessages }),
      });
      if (!res.ok || !res.body) {
        throw new Error("chat API failed: " + res.status);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          try {
            const parsed = JSON.parse(payload) as { delta?: string; done?: boolean; error?: string };
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.delta) {
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === "assistant") {
                  copy[copy.length - 1] = { ...last, content: last.content + parsed.delta };
                }
                return copy;
              });
            }
          } catch {
            /* ignore parse errors */
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.role === "assistant" && last.content === "") {
          copy[copy.length - 1] = {
            ...last,
            content: "⚠️ 戰情官暫時無法回應：" + (err instanceof Error ? err.message : "unknown"),
          };
        }
        return copy;
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        margin: "20px 0",
        padding: 24,
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        border: "1px solid #e2e8f0",
        borderRadius: 18,
        boxShadow: "0 12px 40px -18px rgba(79,70,229,0.12)",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>🎯 戰情官</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
          {MODE_LABEL[mode].icon} {MODE_LABEL[mode].label}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{MODE_LABEL[mode].desc}</div>
      </div>

      {/* Mode selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(Object.keys(MODE_LABEL) as ChatMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: `1.5px solid ${mode === m ? "#4f46e5" : "#e2e8f0"}`,
              background: mode === m ? "rgba(79,70,229,0.08)" : "#ffffff",
              color: mode === m ? "#4f46e5" : "#64748b",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {MODE_LABEL[m].icon} {MODE_LABEL[m].label}
          </button>
        ))}
      </div>

      {/* Quick prompts */}
      {messages.length === 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>💡 快速問（點一下直接問）</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {QUICK_PROMPTS[mode].map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={sending}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  fontSize: 12,
                  color: "#475569",
                  cursor: sending ? "not-allowed" : "pointer",
                  opacity: sending ? 0.5 : 1,
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div
          ref={scrollRef}
          style={{
            maxHeight: 400,
            overflowY: "auto",
            marginBottom: 12,
            padding: 12,
            background: "#f8fafc",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
          }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                marginBottom: 12,
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "85%",
                  padding: "10px 14px",
                  borderRadius: 14,
                  background: m.role === "user"
                    ? "linear-gradient(135deg, #4f46e5, #06b6d4)"
                    : "#ffffff",
                  color: m.role === "user" ? "#fff" : "#0f172a",
                  border: m.role === "user" ? "none" : "1px solid #e2e8f0",
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {m.content || (m.role === "assistant" && sending && i === messages.length - 1 ? "思考中…" : "")}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={
            mode === "debrief"
              ? "問戰情官任何關於今天的事..."
              : mode === "practice"
              ? "告訴陪練官要練什麼場景..."
              : "把客戶的 objection 貼上來..."
          }
          disabled={sending}
          style={{
            flex: 1,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1.5px solid #e2e8f0",
            background: "#ffffff",
            fontSize: 13,
            color: "#0f172a",
            outline: "none",
          }}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || sending}
          style={{
            padding: "12px 22px",
            borderRadius: 12,
            border: "none",
            background: !input.trim() || sending ? "#e2e8f0" : "linear-gradient(135deg, #4f46e5, #06b6d4)",
            color: !input.trim() || sending ? "#94a3b8" : "#ffffff",
            fontSize: 13,
            fontWeight: 800,
            cursor: !input.trim() || sending ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          送出
        </button>
      </div>

      {messages.length > 0 && (
        <button
          onClick={() => setMessages([])}
          style={{
            marginTop: 8,
            padding: "4px 10px",
            background: "transparent",
            border: "none",
            color: "#94a3b8",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          ↻ 清空對話
        </button>
      )}
    </div>
  );
}
