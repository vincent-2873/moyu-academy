"use client";

import { useState, useEffect } from "react";

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
    overdue: { id: string; title: string; response_deadline: string; owner_email: string }[];
    due_this_week: { id: string; title: string; response_deadline: string; owner_email: string }[];
    counts: { mine: number; overdue: number; due_this_week: number };
  };
  recruit: {
    hot_to_call: { id: string; candidate_name: string; account: string; last_reply_text: string | null }[];
    hot_to_call_count: number;
  };
}

export default function TodayPage() {
  const [email, setEmail] = useState("");
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const e = sessionStorage.getItem("moyu_current_user");
    if (!e) { window.location.href = "/"; return; }
    setEmail(e);
  }, []);

  useEffect(() => {
    if (!email) return;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/v3/today?email=${encodeURIComponent(email)}`, { cache: "no-store" });
        const d = await r.json();
        if (d.ok) setData(d);
      } finally { setLoading(false); }
    })();
  }, [email]);

  async function markDone(cmdId: string) {
    await fetch(`/api/v3/commands`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cmdId, status: "done", response: "從今日待辦標記完成" }),
    });
    // reload
    const r = await fetch(`/api/v3/today?email=${encodeURIComponent(email)}`, { cache: "no-store" });
    const d = await r.json();
    if (d.ok) setData(d);
  }

  if (loading && !data) return <div style={{ padding: 40, textAlign: "center" }}>載入中...</div>;
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>載入失敗</div>;

  const hasLegal = data.managed_pillars.includes("legal");
  const hasRecruit = data.managed_pillars.includes("recruit");

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <div style={S.header}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>📋 今日待辦</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{email} · {data.date}</div>
        </div>
        <div style={{ flex: 1 }} />
        {data.managed_pillars.map((p) => (
          <div key={p} style={S.chipDark}>{pillarLabel(p)}</div>
        ))}
        <a href="/recruit" style={S.linkBtn}>招聘</a>
        <a href="/legal" style={S.linkBtn}>法務</a>
        <a href="/me" style={S.linkBtn}>我的</a>
        <button onClick={() => { sessionStorage.clear(); window.location.href = "/"; }} style={S.logoutBtn}>登出</button>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 14px" }}>

        {/* 總指標 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          <Stat label="今日待辦" value={data.commands.today} sub="件需處理" color="#dc2626" />
          <Stat label="🔴 緊急" value={data.commands.critical} sub="件 critical" color="#991b1b" />
          <Stat label="法務逾期" value={data.legal?.counts?.overdue || 0} sub="件未結" color={hasLegal ? "#f59e0b" : "#cbd5e1"} />
          <Stat label="熱名單" value={data.recruit?.hot_to_call_count || 0} sub="個要打電話" color={hasRecruit ? "#dc2626" : "#cbd5e1"} />
        </div>

        {/* 各 pillar 快速指引 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          <PillarCard emoji="💰" label="業務" count={data.commands.by_pillar.sales} href="/me" active />
          <PillarCard emoji="⚖️" label="法務" count={data.commands.by_pillar.legal + (data.legal?.counts?.mine || 0)} href="/legal" active={hasLegal || data.legal?.counts?.mine > 0} />
          <PillarCard emoji="🎯" label="招聘" count={data.commands.by_pillar.recruit + (data.recruit?.hot_to_call_count || 0)} href="/recruit" active={hasRecruit || data.commands.by_pillar.recruit > 0} />
        </div>

        {/* 今日必做 */}
        <Section title={`🔥 今天必做 (${data.commands.today_list.length})`} empty="今天沒有必做事項，繼續前一日的待辦或新訓 SOP。">
          {data.commands.today_list.map((c) => (
            <CmdRow key={c.id} cmd={c} onDone={() => markDone(c.id)} />
          ))}
        </Section>

        {/* 法務即將到期 */}
        {hasLegal && (data.legal?.due_this_week?.length > 0 || data.legal?.overdue?.length > 0) && (
          <Section title={`⚖️ 法務 · 本週到期 (${data.legal.due_this_week.length}) + 逾期 (${data.legal.overdue.length})`} empty="">
            {[...data.legal.overdue, ...data.legal.due_this_week].slice(0, 10).map((c) => (
              <Row key={c.id}>
                <Cell style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.title}</div>
                  <div style={{ fontSize: 11, color: c.response_deadline < data.date ? "#dc2626" : "#f59e0b" }}>
                    期限 {c.response_deadline} · 承辦 {c.owner_email}
                  </div>
                </Cell>
                <a href={`/legal/cases/${c.id}`} style={S.btnSmall}>處理</a>
              </Row>
            ))}
          </Section>
        )}

        {/* 招聘熱名單 */}
        {hasRecruit && (data.recruit?.hot_to_call_count || 0) > 0 && (
          <Section title={`🎯 招聘 · 熱名單 (${data.recruit.hot_to_call_count})`} empty="">
            {data.recruit.hot_to_call.slice(0, 5).map((r) => (
              <Row key={r.id}>
                <Cell style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.candidate_name} <span style={{ fontSize: 11, color: "#64748b" }}>({r.account})</span></div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{r.last_reply_text || "(暫無)"}</div>
                </Cell>
                <a href="/recruit/104" style={S.btnSmall}>打電話</a>
              </Row>
            ))}
            {data.recruit.hot_to_call_count > 5 && (
              <div style={{ padding: "10px 0", fontSize: 12, color: "#64748b" }}>
                還有 {data.recruit.hot_to_call_count - 5} 筆 → <a href="/recruit/104">查看全部</a>
              </div>
            )}
          </Section>
        )}

        {/* 其他進行中命令 */}
        <Section title={`📋 全部進行中 (${data.commands.total})`} empty="無進行中任務。">
          {data.commands.list.map((c) => (
            <CmdRow key={c.id} cmd={c} onDone={() => markDone(c.id)} />
          ))}
        </Section>

      </div>
    </div>
  );
}

function pillarLabel(p: string) {
  if (p === "sales") return "💰 業務主管";
  if (p === "legal") return "⚖️ 法務主管";
  if (p === "recruit") return "🎯 招聘主管";
  return p;
}

function Stat({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function PillarCard({ emoji, label, count, href, active }: { emoji: string; label: string; count: number; href: string; active: boolean }) {
  return (
    <a href={href} style={{
      display: "block", padding: 18, borderRadius: 14, background: "#fff",
      border: `2px solid ${active ? "#4f46e5" : "#e2e8f0"}`,
      textDecoration: "none", color: "#0f172a", transition: "all .2s",
    }}>
      <div style={{ fontSize: 28 }}>{emoji}</div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: active ? "#4f46e5" : "#94a3b8", marginTop: 4 }}>{count}</div>
      <div style={{ fontSize: 10, color: "#94a3b8" }}>件進行中</div>
    </a>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasC = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 18, border: "1px solid #e2e8f0" }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 12px 0" }}>{title}</h2>
      {hasC ? children : <div style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>{empty}</div>}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 10, padding: "10px 0", borderTop: "1px solid #f1f5f9", alignItems: "center" }}>{children}</div>;
}

function Cell({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ minWidth: 0, ...style }}>{children}</div>;
}

function CmdRow({ cmd, onDone }: { cmd: CmdRow; onDone: () => void }) {
  const color = cmd.severity === "critical" ? "#dc2626" : cmd.severity === "high" ? "#f59e0b" : "#4f46e5";
  return (
    <Row>
      <Cell style={{ width: 8 }}>
        <div style={{ width: 4, height: 32, background: color, borderRadius: 2 }} />
      </Cell>
      <Cell style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "#f1f5f9", color: "#475569", fontWeight: 700 }}>
            {cmd.pillar_id === "sales" ? "💰" : cmd.pillar_id === "legal" ? "⚖️" : "🎯"}
          </span>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{cmd.title}</div>
        </div>
        {cmd.detail && <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{cmd.detail.slice(0, 180)}</div>}
        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>
          {cmd.deadline ? `期限 ${cmd.deadline.slice(0, 10)} · ` : ""}
          {cmd.created_at?.slice(0, 10)}
          {cmd.ai_reasoning && ` · ${cmd.ai_reasoning}`}
        </div>
      </Cell>
      <button style={S.btnGreen} onClick={onDone}>完成</button>
    </Row>
  );
}

const S: Record<string, React.CSSProperties> = {
  header: { background: "#0f172a", padding: "12px 16px", color: "#fff", display: "flex", alignItems: "center", gap: 8, position: "sticky", top: 0, zIndex: 10 },
  linkBtn: { padding: "4px 10px", borderRadius: 6, fontSize: 11, color: "#cbd5e1", textDecoration: "none", border: "1px solid rgba(255,255,255,0.15)" },
  logoutBtn: { padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#94a3b8", fontSize: 11, cursor: "pointer" },
  chipDark: { padding: "3px 8px", fontSize: 10, borderRadius: 4, background: "#1e293b", color: "#67e8f9", fontWeight: 700, border: "1px solid #334155" },
  btnSmall: { padding: "5px 12px", borderRadius: 7, border: "none", background: "#4f46e5", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "none" },
  btnGreen: { padding: "5px 12px", borderRadius: 7, border: "none", background: "#16a34a", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" },
};
