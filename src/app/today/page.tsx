"use client";

import { useState, useEffect, useMemo } from "react";

interface CmdRow {
  id: string;
  title: string;
  detail: string | null;
  pillar_id: string;
  severity: string;
  status: string;
  deadline: string | null;
  created_at: string;
  ai_reasoning: string | null;
}

interface TodayData {
  ok: boolean;
  date: string;
  email: string;
  managed_pillars: string[];
  commands: {
    total: number;
    today: number;
    critical: number;
    by_pillar: { sales: number; legal: number; recruit: number };
    list: CmdRow[];
    today_list: CmdRow[];
  };
  legal: {
    mine: { id: string; title: string; response_deadline?: string; kind: string; status: string }[];
    overdue: { id: string; title: string; response_deadline: string; owner_email: string; case_no_internal?: string }[];
    due_this_week: { id: string; title: string; response_deadline: string; owner_email: string; case_no_internal?: string }[];
    counts: { mine: number; overdue: number; due_this_week: number };
  };
  recruit: {
    hot_to_call: { id: string; candidate_name: string; account: string; last_reply_text: string | null; reply_received_at: string }[];
    hot_to_call_count: number;
  };
}

const PILLAR_META: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  sales: { emoji: "💰", label: "業務", color: "#4f46e5", bg: "#eef2ff" },
  legal: { emoji: "⚖️", label: "法務", color: "#7c3aed", bg: "#f5f3ff" },
  recruit: { emoji: "🎯", label: "招聘", color: "#dc2626", bg: "#fef2f2" },
};

export default function TodayPage() {
  const [email, setEmail] = useState("");
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const e = sessionStorage.getItem("moyu_current_user");
    if (!e) { window.location.href = "/"; return; }
    setEmail(e);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/v3/today?email=${encodeURIComponent(email)}`, { cache: "no-store" });
      const d = await r.json();
      if (d.ok) setData(d);
    } finally { setLoading(false); setNow(Date.now()); }
  }

  useEffect(() => {
    if (!email) return;
    load();
    const t = setInterval(load, 60_000);
    const clock = setInterval(() => setNow(Date.now()), 30_000);
    return () => { clearInterval(t); clearInterval(clock); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  async function markDone(cmdId: string) {
    setCompleting(cmdId);
    await fetch(`/api/v3/commands`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cmdId, status: "done", response: "一鍵完成" }),
    });
    setCompleting(null);
    load();
  }

  // 計算「#1 最重要」命令 — critical > overdue deadline > high > today deadline > latest critical
  const topCmd = useMemo(() => {
    if (!data) return null;
    const todayStr = data.date;
    const sorted = [...data.commands.list].sort((a, b) => {
      const aCrit = a.severity === "critical" ? 3 : a.severity === "high" ? 2 : 1;
      const bCrit = b.severity === "critical" ? 3 : b.severity === "high" ? 2 : 1;
      if (aCrit !== bCrit) return bCrit - aCrit;
      const aOver = a.deadline && a.deadline.slice(0, 10) < todayStr ? 1 : 0;
      const bOver = b.deadline && b.deadline.slice(0, 10) < todayStr ? 1 : 0;
      if (aOver !== bOver) return bOver - aOver;
      return (b.created_at || "").localeCompare(a.created_at || "");
    });
    return sorted[0] || null;
  }, [data]);

  const greet = useMemo(() => {
    const h = new Date(now + 8 * 3600 * 1000).getUTCHours();
    if (h < 6) return "凌晨好";
    if (h < 12) return "早安";
    if (h < 14) return "午安";
    if (h < 18) return "下午好";
    if (h < 22) return "晚安";
    return "夜深了";
  }, [now]);

  if (loading && !data) return <LoadingHero greet={greet} />;
  if (!data) return <div style={{ padding: 60, textAlign: "center", color: "#dc2626" }}>載入失敗，請重新整理</div>;

  const hasLegal = data.managed_pillars.includes("legal");
  const hasRecruit = data.managed_pillars.includes("recruit");
  const name = data.email.split("@")[0];
  const totalToDo = data.commands.total + (hasLegal ? data.legal.counts.mine : 0) + (hasRecruit ? data.recruit.hot_to_call_count : 0);
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][new Date(now + 8 * 3600 * 1000).getUTCDay()];

  // 分時段桶
  const overdue = data.commands.list.filter((c) => c.deadline && c.deadline.slice(0, 10) < data.date);
  const todayCmds = data.commands.list.filter((c) => c.deadline && c.deadline.slice(0, 10) === data.date);
  const thisWeek = data.commands.list.filter((c) => {
    if (!c.deadline) return false;
    const d = c.deadline.slice(0, 10);
    const weekLater = new Date(now + 7 * 86400000).toISOString().slice(0, 10);
    return d > data.date && d <= weekLater;
  });
  const nodeadline = data.commands.list.filter((c) => !c.deadline);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #0f172a 0%, #f8fafc 180px)" }}>
      {/* Hero Header */}
      <div style={{ background: "transparent", padding: "16px 22px 0", color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 13, opacity: 0.7 }}>{data.date} ({weekday})</div>
        <div style={{ flex: 1 }} />
        {data.managed_pillars.map((p) => (
          <span key={p} style={{ padding: "3px 10px", fontSize: 10, borderRadius: 12, background: "rgba(255,255,255,0.1)", color: "#cbd5e1", fontWeight: 600 }}>
            {PILLAR_META[p]?.emoji} {PILLAR_META[p]?.label}主管
          </span>
        ))}
        <div style={{ width: 8 }} />
        <a href="/me" style={navBtn}>我的</a>
        {hasLegal && <a href="/legal/cases" style={navBtn}>法務</a>}
        {hasRecruit && <a href="/recruit/104" style={navBtn}>招聘</a>}
        <button onClick={load} style={navBtn}>🔄</button>
        <button onClick={() => { sessionStorage.clear(); window.location.href = "/"; }} style={navBtn}>登出</button>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 22px 60px" }}>
        {/* 問候 */}
        <div style={{ color: "#fff", marginBottom: 24 }}>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>
            {greet}, {name}
          </div>
          <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>
            你今天有 <b style={{ color: "#fbbf24" }}>{totalToDo}</b> 件事要處理
            {data.commands.critical > 0 && <>，其中 <b style={{ color: "#f87171" }}>{data.commands.critical}</b> 件緊急</>}
            {data.legal.counts.overdue > 0 && <>，法務逾期 <b style={{ color: "#f87171" }}>{data.legal.counts.overdue}</b> 件</>}
          </div>
        </div>

        {/* #1 最重要 Hero 卡 */}
        {topCmd && (
          <HeroCard cmd={topCmd} onDone={markDone} completing={completing === topCmd.id} />
        )}

        {/* 三柱進度儀表 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
          <PillarTile
            id="sales"
            count={data.commands.by_pillar.sales}
            label="業務"
            emoji="💰"
            sub={hasLegal || hasRecruit ? "我的命令" : null}
            href="/me"
          />
          <PillarTile
            id="legal"
            count={data.commands.by_pillar.legal + (hasLegal ? data.legal.counts.mine : 0)}
            label="法務"
            emoji="⚖️"
            sub={hasLegal ? `逾期 ${data.legal.counts.overdue} · 本週 ${data.legal.counts.due_this_week}` : null}
            alert={data.legal.counts.overdue}
            href="/legal/cases"
          />
          <PillarTile
            id="recruit"
            count={data.commands.by_pillar.recruit + (hasRecruit ? data.recruit.hot_to_call_count : 0)}
            label="招聘"
            emoji="🎯"
            sub={hasRecruit ? `熱名單 ${data.recruit.hot_to_call_count}` : null}
            href="/recruit/104"
          />
        </div>

        {/* 時間桶 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
          <BucketCard title="🚨 逾期" count={overdue.length} color="#dc2626" tip="需立即處理" />
          <BucketCard title="📌 今天到期" count={todayCmds.length} color="#f59e0b" tip="今天完成" />
          <BucketCard title="📅 本週內" count={thisWeek.length} color="#0891b2" tip="週五前處理" />
          <BucketCard title="📝 無期限" count={nodeadline.length} color="#64748b" tip="隨時處理" />
        </div>

        {/* 法務逾期區（如果是法務主管） */}
        {hasLegal && (data.legal.overdue.length + data.legal.due_this_week.length) > 0 && (
          <Section title={`⚖️ 法務急迫（${data.legal.overdue.length + data.legal.due_this_week.length}）`} accent="#7c3aed">
            {[...data.legal.overdue, ...data.legal.due_this_week].slice(0, 8).map((c) => (
              <LegalItem key={c.id} c={c} today={data.date} />
            ))}
          </Section>
        )}

        {/* 招聘熱名單 */}
        {hasRecruit && data.recruit.hot_to_call_count > 0 && (
          <Section title={`🎯 招聘熱名單（${data.recruit.hot_to_call_count}）`} accent="#dc2626" action={{ label: "全部 →", href: "/recruit/104" }}>
            {data.recruit.hot_to_call.slice(0, 5).map((r) => (
              <RecruitItem key={r.id} r={r} now={now} />
            ))}
          </Section>
        )}

        {/* 全部進行中命令 */}
        {data.commands.list.length > 0 && (
          <Section title={`📋 全部進行中命令（${data.commands.list.length}）`} accent="#4f46e5">
            {data.commands.list.map((c) => (
              <CmdItem key={c.id} cmd={c} today={data.date} onDone={markDone} completing={completing === c.id} />
            ))}
          </Section>
        )}

        {/* 全空時的鼓勵訊息 */}
        {data.commands.list.length === 0 && !hasLegal && !hasRecruit && (
          <div style={{ background: "#fff", borderRadius: 18, padding: 50, textAlign: "center", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 54 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 10, color: "#0f172a" }}>今天沒有待辦事項</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
              可以進新訓 SOP / 讀知識庫 / 回顧昨日戰報
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingHero({ greet }: { greet: string }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 28, fontWeight: 900 }}>{greet}，載入中...</div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>正在從 3 個支柱彙整資訊</div>
      </div>
    </div>
  );
}

function HeroCard({ cmd, onDone, completing }: { cmd: CmdRow; onDone: (id: string) => void; completing: boolean }) {
  const meta = PILLAR_META[cmd.pillar_id] || PILLAR_META.sales;
  const sev = cmd.severity === "critical" ? { bg: "#991b1b", color: "#fecaca", label: "🚨 最緊急" }
            : cmd.severity === "high" ? { bg: "#c2410c", color: "#fed7aa", label: "⚠️ 高優先" }
            : { bg: meta.color, color: "#fff", label: "處理中" };
  const overdue = cmd.deadline && cmd.deadline.slice(0, 10) < new Date().toISOString().slice(0, 10);
  return (
    <div style={{
      background: "linear-gradient(135deg, #fff 0%, #f8fafc 100%)",
      borderRadius: 20, padding: 28, marginBottom: 20,
      border: `3px solid ${sev.bg}`,
      boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", position: "relative",
    }}>
      <div style={{ position: "absolute", top: -14, left: 20, background: sev.bg, color: sev.color, padding: "5px 14px", fontSize: 11, fontWeight: 800, borderRadius: 10, letterSpacing: "0.05em" }}>
        {sev.label} · 你的 #1
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, background: meta.bg, color: meta.color,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, flexShrink: 0,
        }}>{meta.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: meta.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{meta.label}</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4, color: "#0f172a", lineHeight: 1.3 }}>{cmd.title}</div>
          {cmd.detail && <div style={{ fontSize: 14, color: "#475569", marginTop: 8, lineHeight: 1.6 }}>{cmd.detail}</div>}
          {cmd.deadline && (
            <div style={{ fontSize: 12, color: overdue ? "#dc2626" : "#64748b", marginTop: 10, fontWeight: 600 }}>
              {overdue ? "🚨 已逾期 " : "🕒 期限 "}
              {cmd.deadline.slice(0, 10)}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button
          onClick={() => onDone(cmd.id)}
          disabled={completing}
          style={{
            padding: "10px 22px", borderRadius: 10, background: sev.bg, color: "#fff",
            border: "none", fontSize: 14, fontWeight: 800, cursor: completing ? "wait" : "pointer",
            opacity: completing ? 0.5 : 1,
          }}>
          {completing ? "標記中..." : "✓ 完成這件事"}
        </button>
        <button
          onClick={async () => {
            await fetch(`/api/v3/commands`, {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: cmd.id, status: "blocked", blocked_reason: "暫時被擋住", response: "延後" }),
            });
            window.location.reload();
          }}
          style={{
            padding: "10px 18px", borderRadius: 10, background: "#fff", color: "#64748b",
            border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
          ⏸ 暫時擋住
        </button>
      </div>
    </div>
  );
}

function PillarTile({ id, count, label, emoji, sub, alert, href }: { id: string; count: number; label: string; emoji: string; sub: string | null; alert?: number; href: string }) {
  const meta = PILLAR_META[id];
  return (
    <a href={href} style={{
      display: "block", padding: 20, borderRadius: 16, background: "#fff",
      border: `1px solid ${alert ? "#fecaca" : "#e2e8f0"}`, textDecoration: "none", color: "#0f172a",
      position: "relative",
      boxShadow: alert ? "0 10px 25px -10px rgba(220,38,38,0.25)" : "0 4px 16px -6px rgba(15,23,42,0.08)",
    }}>
      {alert && alert > 0 && (
        <div style={{ position: "absolute", top: 10, right: 12, fontSize: 10, fontWeight: 800, background: "#dc2626", color: "#fff", padding: "3px 8px", borderRadius: 10 }}>
          🚨 {alert} 逾期
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: meta.bg, color: meta.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
          {emoji}
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: count > 0 ? meta.color : "#cbd5e1", lineHeight: 1 }}>{count}</div>
        </div>
      </div>
      {sub && <div style={{ fontSize: 11, color: "#64748b", marginTop: 10 }}>{sub}</div>}
    </a>
  );
}

function BucketCard({ title, count, color, tip }: { title: string; count: number; color: string; tip: string }) {
  return (
    <div style={{ background: "#fff", padding: 14, borderRadius: 12, border: count > 0 ? `1px solid ${color}44` : "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: count > 0 ? color : "#cbd5e1", lineHeight: 1.1, marginTop: 4 }}>{count}</div>
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{tip}</div>
    </div>
  );
}

function Section({ title, accent, action, children }: { title: string; accent: string; action?: { label: string; href: string }; children: React.ReactNode }) {
  const has = Array.isArray(children) ? children.length > 0 : !!children;
  if (!has) return null;
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 16, border: "1px solid #e2e8f0", borderTop: `3px solid ${accent}` }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{title}</h3>
        <div style={{ flex: 1 }} />
        {action && <a href={action.href} style={{ fontSize: 12, color: accent, textDecoration: "none", fontWeight: 600 }}>{action.label}</a>}
      </div>
      {children}
    </div>
  );
}

function LegalItem({ c, today }: { c: { id: string; title: string; response_deadline: string; owner_email: string; case_no_internal?: string }; today: string }) {
  const overdue = c.response_deadline < today;
  const days = Math.floor((new Date(c.response_deadline).getTime() - new Date(today).getTime()) / 86400000);
  return (
    <a href={`/legal/cases/${c.id}`} style={{ display: "flex", padding: "10px 0", borderTop: "1px solid #f1f5f9", alignItems: "center", gap: 12, textDecoration: "none", color: "#0f172a" }}>
      <div style={{
        width: 60, textAlign: "center", padding: "6px 0", borderRadius: 8,
        background: overdue ? "#fef2f2" : days <= 3 ? "#fef3c7" : "#eef2ff",
        color: overdue ? "#991b1b" : days <= 3 ? "#b45309" : "#4f46e5",
        fontSize: 11, fontWeight: 800,
      }}>
        {overdue ? `逾 ${Math.abs(days)}天` : days === 0 ? "今天" : `${days} 天`}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{c.case_no_internal || "-"} · {c.owner_email?.split("@")[0]}</div>
      </div>
      <span style={{ color: "#cbd5e1", fontSize: 16 }}>›</span>
    </a>
  );
}

function RecruitItem({ r, now }: { r: { id: string; candidate_name: string; account: string; last_reply_text: string | null; reply_received_at: string }; now: number }) {
  const mins = Math.floor((now - new Date(r.reply_received_at).getTime()) / 60000);
  const hours = Math.floor(mins / 60);
  const age = hours >= 24 ? `${Math.floor(hours / 24)}天前` : hours >= 1 ? `${hours}小時前` : `${mins}分鐘前`;
  const urgent = hours >= 24;
  const warm = hours >= 12;
  return (
    <a href="/recruit/104" style={{ display: "flex", padding: "10px 0", borderTop: "1px solid #f1f5f9", alignItems: "center", gap: 12, textDecoration: "none", color: "#0f172a" }}>
      <div style={{
        width: 6, height: 44, borderRadius: 3,
        background: urgent ? "#dc2626" : warm ? "#f59e0b" : "#10b981",
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>
          {r.candidate_name} <span style={{ fontSize: 10, color: "#64748b", marginLeft: 4 }}>({r.account})</span>
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 500 }}>
          {r.last_reply_text || "(暫無內容 - poller 會補)"}
        </div>
      </div>
      <div style={{ fontSize: 10, color: urgent ? "#dc2626" : warm ? "#f59e0b" : "#64748b", fontWeight: 700 }}>{age}</div>
    </a>
  );
}

function CmdItem({ cmd, today, onDone, completing }: { cmd: CmdRow; today: string; onDone: (id: string) => void; completing: boolean }) {
  const meta = PILLAR_META[cmd.pillar_id] || PILLAR_META.sales;
  const overdue = cmd.deadline && cmd.deadline.slice(0, 10) < today;
  const todayBadge = cmd.deadline && cmd.deadline.slice(0, 10) === today;
  const severityChip = cmd.severity === "critical" ? { bg: "#fef2f2", color: "#991b1b", label: "🚨 緊急" }
                      : cmd.severity === "high" ? { bg: "#fef3c7", color: "#92400e", label: "⚠️ 高" }
                      : { bg: "#f1f5f9", color: "#475569", label: cmd.severity };
  return (
    <div style={{ display: "flex", padding: "12px 0", borderTop: "1px solid #f1f5f9", alignItems: "flex-start", gap: 12 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: meta.bg, color: meta.color,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0,
      }}>{meta.emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: severityChip.bg, color: severityChip.color }}>
            {severityChip.label}
          </span>
          {overdue && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "#fee2e2", color: "#991b1b" }}>🚨 逾期</span>}
          {todayBadge && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "#fef3c7", color: "#92400e" }}>📌 今天</span>}
          <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{cmd.title}</span>
        </div>
        {cmd.detail && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>{cmd.detail.slice(0, 200)}</div>}
        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
          {cmd.deadline ? `期限 ${cmd.deadline.slice(0, 10)} · ` : ""}
          建立 {cmd.created_at?.slice(0, 10)}
          {cmd.ai_reasoning && <> · {cmd.ai_reasoning}</>}
        </div>
      </div>
      <button
        onClick={() => onDone(cmd.id)}
        disabled={completing}
        style={{
          padding: "7px 14px", borderRadius: 8, background: "#16a34a", color: "#fff",
          border: "none", fontSize: 12, fontWeight: 700, cursor: completing ? "wait" : "pointer",
          opacity: completing ? 0.5 : 1, flexShrink: 0,
        }}>
        {completing ? "..." : "✓ 完成"}
      </button>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  padding: "5px 10px", borderRadius: 6, fontSize: 11, color: "#cbd5e1", textDecoration: "none",
  border: "1px solid rgba(255,255,255,0.12)", background: "transparent", cursor: "pointer",
};
