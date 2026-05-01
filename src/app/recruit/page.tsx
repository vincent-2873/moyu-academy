"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import MobileNav from "@/components/MobileNav";

/**
 * 墨宇獵頭工作台 v5
 *
 * 三大區塊：
 *  1. 「今日進度」歡迎卡：顯示新訓百分比 / 已完成任務 / 待辦
 *  2. 「新訓 SOP」摺疊式：Day 1 / Day 2 / Day N + 任務清單 + 完成 checkbox
 *  3. 「招聘任務」緊急 / 待處理 / 已處理（原本的）
 *  4. 「X Platform 品牌」展開可看 5 個品牌的 value prop
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

interface TaskLink { label: string; url: string }
interface SopTask {
  id: string;
  day_id: string;
  title: string;
  description: string | null;
  task_type: string | null;
  links: TaskLink[];
  display_order: number;
  estimated_minutes: number | null;
  progress: { status: string; completed_at: string | null; notes: string | null } | null;
}
interface SopDay {
  id: string;
  day_number: number;
  title: string;
  description: string | null;
  tasks: SopTask[];
}
interface Brand { id: string; slug: string; name: string; category: string; tagline: string; value_prop: string; target_audience: string }

export default function RecruitPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);
  const [sopDays, setSopDays] = useState<SopDay[]>([]);
  const [sopStats, setSopStats] = useState<{ totalTasks: number; doneTasks: number; percent: number }>({ totalTasks: 0, doneTasks: 0, percent: 0 });
  const [brands, setBrands] = useState<Brand[]>([]);
  const [funnelStats, setFunnelStats] = useState<{ sent: number; replied: number; interested: number; contacted: number; scheduled: number; completed: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const main = sessionStorage.getItem("moyu_current_user");
    if (main) { setEmail(main); setSubmitted(true); sessionStorage.setItem("moyu_recruit_email", main); return; }
    const s = sessionStorage.getItem("moyu_recruit_email");
    if (s) { setEmail(s); setSubmitted(true); }
  }, []);

  const loadData = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    try {
      const [cmdRes, sopRes, brandRes, hotRes] = await Promise.all([
        fetch(`/api/v3/commands?owner=${encodeURIComponent(email)}&pillar=recruit`, { cache: "no-store" }),
        fetch(`/api/hr-training?email=${encodeURIComponent(email)}`, { cache: "no-store" }),
        fetch(`/api/xplatform/brands`, { cache: "no-store" }),
        fetch(`/api/recruit/hot-list`, { cache: "no-store" }).catch(() => null),
      ]);
      const cmdData = await cmdRes.json();
      const sopData = await sopRes.json();
      const brandData = await brandRes.json();
      if (hotRes) {
        try {
          const hotData = await hotRes.json();
          if (hotData.ok && hotData.stats) {
            setFunnelStats(hotData.stats);
          }
        } catch { /* ignore */ }
      }

      if (cmdData.ok && cmdData.commands) {
        const todayStr = new Date().toLocaleDateString("sv-SE");
        setCommands(cmdData.commands.filter((c: Command) => c.created_at?.startsWith(todayStr)));
      }
      if (sopData.ok) {
        setSopDays(sopData.days || []);
        setSopStats(sopData.stats || { totalTasks: 0, doneTasks: 0, percent: 0 });
      }
      if (brandData.ok) setBrands(brandData.brands || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [email]);

  useEffect(() => { if (submitted) loadData(); }, [submitted, loadData]);

  const markCmdDone = async (id: string, status: "done" | "ignored" | "blocked") => {
    await fetch("/api/v3/commands", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setCommands((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
  };

  const updateSopTask = async (taskId: string, status: "done" | "in_progress" | "pending") => {
    await fetch("/api/hr-training/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, taskId, status }),
    });
    loadData();
  };

  // 未登入
  if (!submitted) {
    return (
      <div style={S.loginBg}>
        <div style={S.loginCard}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", textAlign: "center" }}>墨宇獵頭工作台</div>
          <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", margin: "6px 0 20px" }}>新訓進度・招聘任務・X Platform 知識庫</div>
          <a href="/" style={{ ...S.btnPrimary, display: "block", textAlign: "center", textDecoration: "none" }}>前往主登入頁</a>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 16, textAlign: "center" }}>請先到 / 用帳號密碼登入</div>
        </div>
      </div>
    );
  }

  // 任務分組
  const urgent = commands.filter((c) => (c.severity === "critical" || c.severity === "high") && c.status === "pending");
  const pending = commands.filter((c) => (c.severity === "normal" || c.severity === "info") && c.status === "pending");
  const cmdDone = commands.filter((c) => c.status !== "pending");
  const totalPending = urgent.length + pending.length;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <style>{`
        @media (max-width: 768px) {
          .recruit-header { flex-wrap: wrap !important; }
          .recruit-main { padding-bottom: 80px !important; }
        }
      `}</style>
      <div className="recruit-header" style={S.header}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>🎯 墨宇獵頭工作台</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{email}</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={S.badge}>新訓 {sopStats.percent}%</div>
        <div style={S.badge}>{totalPending > 0 ? `${totalPending} 件待辦` : "全部完成"}</div>
        <a href="/recruit/104" style={{ ...S.linkBtn, background: "#fef3c7", color: "#92400e", fontWeight: 700 }}>🔥 104 熱名單</a>
        <a href="/account/password" style={S.linkBtn}>🔑 改密碼</a>
        <button onClick={() => { sessionStorage.clear(); window.location.href = "/"; }} style={S.logoutBtn}>登出</button>
      </div>

      <div className="recruit-main" style={{ maxWidth: 720, margin: "0 auto", padding: "20px 14px" }}>

        {/* ─── 1. 歡迎卡 / 已完成什麼 ─── */}
        <div style={S.welcomeCard}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>👋 Hi，{email.split("@")[0]}</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{new Date().toLocaleDateString("zh-TW", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <StatBox label="新訓進度" value={`${sopStats.percent}%`} sub={`${sopStats.doneTasks} / ${sopStats.totalTasks} 任務`} color="#4f46e5" />
            <StatBox label="今日待辦" value={`${totalPending}`} sub="件招聘任務" color="#ef4444" />
            <StatBox label="今日已完成" value={`${cmdDone.length}`} sub="件招聘任務" color="#16a34a" />
          </div>
          {sopStats.totalTasks > 0 && sopStats.percent < 100 && (
            <div style={{ marginTop: 14, fontSize: 13, color: "#64748b" }}>
              📚 還有 <strong>{sopStats.totalTasks - sopStats.doneTasks} 個新訓任務</strong> 等你完成 — 滑下去看 SOP 區塊。
            </div>
          )}
          {sopStats.percent === 100 && (
            <div style={{ marginTop: 14, fontSize: 13, color: "#16a34a", fontWeight: 700 }}>
              🎉 新訓全部完成！你已準備好上機接案。
            </div>
          )}
        </div>

        {/* ─── 招聘儀表板 ─── */}
        <RecruitDashboard funnelStats={funnelStats} />

        {loading && <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>載入中...</div>}

        {/* ─── 2. 新訓 SOP ─── */}
        {sopDays.length > 0 && (
          <Section title="📚 新訓 SOP" sub={`${sopStats.doneTasks} / ${sopStats.totalTasks} 任務完成`}>
            {sopDays.map((day) => (
              <SopDayCard key={day.id} day={day} onUpdate={updateSopTask} />
            ))}
          </Section>
        )}

        {/* ─── 3. 招聘任務 ─── */}
        <Section title="📋 今日招聘任務" sub={totalPending > 0 ? `${totalPending} 件待處理` : "✅ 今日全部完成"}>
          {urgent.length > 0 && (
            <Group title="緊急" icon="🔴" count={urgent.length} color="#ef4444">
              {urgent.map((cmd) => <TaskCard key={cmd.id} cmd={cmd} onDone={markCmdDone} />)}
            </Group>
          )}
          {pending.length > 0 && (
            <Group title="待處理" icon="📌" count={pending.length} color="#3b82f6">
              {pending.map((cmd) => <TaskCard key={cmd.id} cmd={cmd} onDone={markCmdDone} />)}
            </Group>
          )}
          {cmdDone.length > 0 && (
            <Group title="已處理" icon="✅" count={cmdDone.length} color="#16a34a" collapsed>
              {cmdDone.map((cmd) => <DoneCard key={cmd.id} cmd={cmd} />)}
            </Group>
          )}
          {totalPending === 0 && cmdDone.length === 0 && (
            <div style={S.emptySmall}>今日尚未有招聘任務派送，請先完成新訓 SOP。</div>
          )}
        </Section>

        {/* ─── 4. X Platform 品牌 ─── */}
        {brands.length > 0 && (
          <Section title="🏢 X Platform 品牌矩陣" sub="認識你要介紹給求職者的每個品牌">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {brands.map((b) => (
                <div key={b.id} style={S.brandCard}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{b.name}</div>
                    <div style={{ fontSize: 11, color: "#fff", background: "#4f46e5", padding: "2px 8px", borderRadius: 6 }}>{b.category}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>💎 {b.tagline}</div>
                  <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.6 }}>{b.value_prop}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>👥 受眾：{b.target_audience}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        <div style={{ textAlign: "center", padding: "30px 0 50px", fontSize: 11, color: "#cbd5e1" }}>
          墨宇獵頭工作台 v5 · 新訓・招聘・品牌 一站式
        </div>
      </div>
      <MobileNav />
    </div>
  );
}

// ─────────────── 子元件 ───────────────

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, padding: "0 4px" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: "#94a3b8" }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Group({ title, icon, count, color, collapsed, children }: { title: string; icon: string; count: number; color: string; collapsed?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!collapsed);
  return (
    <div style={{ marginBottom: 10 }}>
      <button onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 4px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>{title}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}15`, padding: "1px 7px", borderRadius: 8 }}>{count}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>{open ? "▼" : "▶"}</span>
      </button>
      {open && <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>{children}</div>}
    </div>
  );
}

function SopDayCard({ day, onUpdate }: { day: SopDay; onUpdate: (taskId: string, status: "done" | "in_progress" | "pending") => void }) {
  const [open, setOpen] = useState(true);
  const doneCount = day.tasks.filter((t) => t.progress?.status === "done").length;
  const total = day.tasks.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div style={S.sopCard}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", padding: 14, background: "none", border: "none", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ background: "#4f46e5", color: "#fff", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>D{day.day_number}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{day.title}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{doneCount} / {total} 完成 · {pct}%</div>
        </div>
        <div style={{ width: 60, height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "#16a34a", transition: "width 0.3s" }} />
        </div>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>{open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <div style={{ borderTop: "1px solid #f1f5f9", padding: "8px 14px 14px" }}>
          {day.description && <div style={{ fontSize: 12, color: "#64748b", padding: "8px 0", marginBottom: 4 }}>{day.description}</div>}
          {day.tasks.map((t) => (
            <SopTaskRow key={t.id} task={t} onUpdate={onUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}

function SopTaskRow({ task, onUpdate }: { task: SopTask; onUpdate: (taskId: string, status: "done" | "in_progress" | "pending") => void }) {
  const isDone = task.progress?.status === "done";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderTop: "1px solid #f8fafc" }}>
      <button
        onClick={() => onUpdate(task.id, isDone ? "pending" : "done")}
        style={{
          width: 22, height: 22, minWidth: 22, marginTop: 2,
          borderRadius: 6, border: `2px solid ${isDone ? "#16a34a" : "#cbd5e1"}`,
          background: isDone ? "#16a34a" : "#fff",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 13, fontWeight: 900,
        }}
      >{isDone ? "✓" : ""}</button>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: isDone ? "#94a3b8" : "#0f172a", textDecoration: isDone ? "line-through" : "none" }}>{task.title}</div>
        {task.description && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>{task.description}</div>}
        {task.links && task.links.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {task.links.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noreferrer" style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 6, background: "#eff6ff",
                color: "#1d4ed8", fontSize: 11, fontWeight: 600, textDecoration: "none",
              }}>🔗 {l.label}</a>
            ))}
          </div>
        )}
        {task.estimated_minutes && (
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>⏱ 預估 {task.estimated_minutes} 分</div>
        )}
      </div>
    </div>
  );
}

function TaskCard({ cmd, onDone }: { cmd: Command; onDone: (id: string, status: "done" | "ignored" | "blocked") => void }) {
  const isUrgent = cmd.severity === "critical" || cmd.severity === "high";
  const phoneMatch = (cmd.detail || "").match(/(09\d{2}[-\s]?\d{3}[-\s]?\d{3})/);
  const phone = phoneMatch?.[1]?.replace(/[-\s]/g, "");
  const sheetMatch = (cmd.detail || "").match(/(https:\/\/docs\.google\.com\/spreadsheets\/[^\s]+)/);
  const sheetLink = sheetMatch?.[1];

  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: "12px 14px",
      border: isUrgent ? "2px solid #fca5a5" : "1px solid #e2e8f0",
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{cmd.title}</div>
      {cmd.detail && (
        <div style={{ fontSize: 12, color: "#64748b", whiteSpace: "pre-wrap", marginBottom: 8 }}>
          {cmd.detail.split("\n").filter((l) => !l.startsWith("📋")).join("\n")}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {phone && <a href={`tel:${phone}`} style={S.chipBlue}>📞 {phoneMatch?.[1]}</a>}
        {sheetLink && <a href={sheetLink} target="_blank" rel="noreferrer" style={S.chipBlue}>📋 邀約紀錄</a>}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => onDone(cmd.id, "done")} style={{ ...S.actionBtn, background: "#16a34a", color: "#fff", flex: 1 }}>✓ 完成</button>
        <button onClick={() => onDone(cmd.id, "blocked")} style={{ ...S.actionBtn, background: "#fef3c7", color: "#92400e" }}>卡住</button>
        <button onClick={() => onDone(cmd.id, "ignored")} style={{ ...S.actionBtn, background: "#f1f5f9", color: "#64748b" }}>跳過</button>
      </div>
    </div>
  );
}

function DoneCard({ cmd }: { cmd: Command }) {
  const icon = cmd.status === "done" ? "✅" : cmd.status === "blocked" ? "🟡" : "⏭️";
  return (
    <div style={{ background: "#f8fafc", borderRadius: 10, padding: "8px 12px", border: "1px solid #f1f5f9", opacity: 0.7, display: "flex", alignItems: "center", gap: 8 }}>
      <span>{icon}</span>
      <span style={{ fontSize: 13, color: "#64748b", textDecoration: cmd.status === "done" ? "line-through" : "none" }}>{cmd.title}</span>
    </div>
  );
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: `${color}08`, border: `1.5px solid ${color}25`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function RecruitDashboard({ funnelStats }: { funnelStats: { sent: number; replied: number; interested: number; contacted: number; scheduled: number; completed: number } | null }) {
  const steps = useMemo(() => {
    const s = funnelStats || { sent: 0, replied: 0, interested: 0, contacted: 0, scheduled: 0, completed: 0 };
    const items = [
      { label: "發信", count: s.sent, color: "#6366f1" },
      { label: "回覆", count: s.replied, color: "#8b5cf6" },
      { label: "有興趣", count: s.interested, color: "#a855f7" },
      { label: "已聯絡", count: s.contacted, color: "#0ea5e9" },
      { label: "排面試", count: s.scheduled, color: "#f59e0b" },
      { label: "面試完成", count: s.completed, color: "#16a34a" },
    ];
    const max = Math.max(1, ...items.map((i) => i.count));
    return items.map((i) => ({ ...i, pct: Math.round((i.count / max) * 100), pctOfFirst: s.sent > 0 ? Math.round((i.count / s.sent) * 100) : 0 }));
  }, [funnelStats]);

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #e2e8f0", marginTop: 12, marginBottom: 4 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 14 }}>📊 招聘儀表板</div>

      {/* Funnel bar chart */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {steps.map((step, i) => (
          <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 60, fontSize: 12, fontWeight: 600, color: "#475569", textAlign: "right", flexShrink: 0 }}>{step.label}</div>
            <div style={{ flex: 1, height: 22, background: "#f1f5f9", borderRadius: 6, overflow: "hidden", position: "relative" }}>
              <div style={{
                width: `${Math.max(step.pct, 2)}%`, height: "100%", background: step.color,
                borderRadius: 6, transition: "width 0.6s ease",
                display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6,
              }}>
                {step.count > 0 && step.pct > 15 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{step.count}</span>
                )}
              </div>
              {step.count > 0 && step.pct <= 15 && (
                <span style={{ position: "absolute", left: `${Math.max(step.pct, 2)}%`, top: "50%", transform: "translate(4px, -50%)", fontSize: 10, fontWeight: 700, color: step.color }}>{step.count}</span>
              )}
            </div>
            <div style={{ width: 36, fontSize: 10, color: "#94a3b8", textAlign: "right", flexShrink: 0 }}>
              {i === 0 ? "100%" : `${step.pctOfFirst}%`}
            </div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href="/recruit/104" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "8px 14px", borderRadius: 10, background: "#fef2f2", color: "#dc2626", fontSize: 13, fontWeight: 700, textDecoration: "none", border: "1px solid #fecaca" }}>
          🔴 熱名單
        </a>
        <a href="/recruit/calendar" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "8px 14px", borderRadius: 10, background: "#eff6ff", color: "#2563eb", fontSize: 13, fontWeight: 700, textDecoration: "none", border: "1px solid #bfdbfe" }}>
          📅 日曆
        </a>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "8px 14px", borderRadius: 10, background: "#f0fdf4", color: "#16a34a", fontSize: 13, fontWeight: 700, textDecoration: "none", border: "1px solid #bbf7d0" }}>
          📋 今日待辦
        </a>
      </div>
    </div>
  );
}

// ─────────────── styles ───────────────

const S: Record<string, React.CSSProperties> = {
  loginBg: { minHeight: "100vh", background: "linear-gradient(135deg, #0f172a, #1e1b4b)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  loginCard: { background: "#fff", borderRadius: 20, padding: 32, maxWidth: 400, width: "100%", boxShadow: "0 20px 60px -20px rgba(0,0,0,0.4)" },
  input: { padding: "12px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, background: "#f8fafc", outline: "none" },
  btnPrimary: { padding: "12px", borderRadius: 10, border: "none", background: "#4f46e5", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  header: { background: "#0f172a", padding: "12px 16px", color: "#fff", display: "flex", alignItems: "center", gap: 10, position: "sticky" as const, top: 0, zIndex: 10 },
  badge: { fontSize: 11, fontWeight: 700, color: "#fff", background: "#4f46e5", padding: "4px 10px", borderRadius: 8 },
  linkBtn: { padding: "4px 10px", borderRadius: 6, fontSize: 11, color: "#cbd5e1", textDecoration: "none", border: "1px solid rgba(255,255,255,0.15)" },
  logoutBtn: { padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#94a3b8", fontSize: 11, cursor: "pointer" },
  welcomeCard: { background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #e2e8f0", marginBottom: 4 },
  empty: { textAlign: "center" as const, padding: "50px 20px", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" },
  emptySmall: { textAlign: "center" as const, padding: "20px", background: "#fff", borderRadius: 12, border: "1px solid #f1f5f9", color: "#94a3b8", fontSize: 13 },
  sopCard: { background: "#fff", borderRadius: 12, marginBottom: 8, border: "1px solid #e2e8f0", overflow: "hidden" },
  brandCard: { background: "#fff", borderRadius: 12, padding: 14, border: "1px solid #e2e8f0" },
  actionBtn: { padding: "8px 12px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  chipBlue: { display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 6, background: "#dbeafe", color: "#1d4ed8", fontSize: 12, fontWeight: 600, textDecoration: "none" },
};
