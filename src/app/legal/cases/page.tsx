"use client";

import { useState, useEffect, useCallback } from "react";

interface CaseRow {
  id: string;
  case_no_internal: string | null;
  case_no_external: string | null;
  title: string;
  kind: string;
  brand_code: string | null;
  agency: string | null;
  primary_party_name: string | null;
  owner_email: string | null;
  stage: string;
  status: string;
  severity: string;
  response_deadline: string | null;
  filed_date: string | null;
  hearing_date: string | null;
  amount_claimed: number | null;
  created_at: string;
}

interface Stats {
  total: number;
  by_kind: Record<string, number>;
  by_brand: Record<string, number>;
  overdue: number;
  due_this_week: number;
}

const KIND_META: Record<string, { emoji: string; label: string; color: string }> = {
  consumer_dispute: { emoji: "🛒", label: "消費爭議", color: "#dc2626" },
  civil_defense: { emoji: "⚖️", label: "民事答辯", color: "#7c3aed" },
  civil_enforcement: { emoji: "💰", label: "強制執行", color: "#059669" },
  criminal: { emoji: "🚨", label: "刑事", color: "#991b1b" },
  labor: { emoji: "👷", label: "勞動", color: "#d97706" },
  contract_dispute: { emoji: "📝", label: "合約糾紛", color: "#0891b2" },
  nda_breach: { emoji: "🔒", label: "NDA 違約", color: "#6366f1" },
  complaint: { emoji: "📢", label: "客訴", color: "#db2777" },
};

const STAGES = [
  { id: "intake", label: "📥 收件", color: "#64748b" },
  { id: "drafting", label: "✏️ 撰狀中", color: "#4f46e5" },
  { id: "review", label: "👀 審閱中", color: "#7c3aed" },
  { id: "sealed", label: "📜 用印", color: "#0891b2" },
  { id: "dispatched", label: "📤 已遞", color: "#0ea5e9" },
  { id: "hearing", label: "🏛️ 開庭", color: "#f59e0b" },
  { id: "judged", label: "⚖️ 判決", color: "#dc2626" },
  { id: "finalised", label: "🔒 確定", color: "#16a34a" },
  { id: "closed", label: "✅ 結案", color: "#10b981" },
];

export default function LegalCasesPage() {
  const [email, setEmail] = useState("");
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<{ kind: string; brand: string; status: string }>({ kind: "", brand: "", status: "open" });
  const [loading, setLoading] = useState(true);
  const [newCase, setNewCase] = useState(false);
  const [view, setView] = useState<"list" | "kanban">("kanban");
  const [search, setSearch] = useState("");
  const [recentEvents, setRecentEvents] = useState<{ id: string; case_id: string; case_title: string; event_type: string; note: string; created_at: string }[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const e = sessionStorage.getItem("moyu_current_user");
    if (!e) { window.location.href = "/"; return; }
    setEmail(e);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter.kind) params.set("kind", filter.kind);
    if (filter.brand) params.set("brand", filter.brand);
    if (filter.status) params.set("status", filter.status);
    const [r, evtRes] = await Promise.all([
      fetch(`/api/legal/cases?${params}`, { cache: "no-store" }),
      fetch(`/api/legal/cases?timeline=recent&limit=10`, { cache: "no-store" }).catch(() => null),
    ]);
    const d = await r.json();
    if (d.ok) { setCases(d.data); setStats(d.stats); }
    if (evtRes) {
      try {
        const evtData = await evtRes.json();
        if (evtData.ok && evtData.recent_events) setRecentEvents(evtData.recent_events);
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { if (email) load(); }, [email, load]);

  const filtered = search ? cases.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.case_no_internal || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.primary_party_name || "").toLowerCase().includes(search.toLowerCase())
  ) : cases;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <div style={S.header}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>⚖️ 法務案件中心</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{email}</div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setNewCase(true)} style={S.btnPrimary}>+ 新建案件</button>
        <a href="/today" style={S.linkBtn}>📋 今日待辦</a>
        <a href="/legal" style={S.linkBtn}>← 概覽</a>
        <button onClick={() => { sessionStorage.clear(); window.location.href = "/"; }} style={S.logoutBtn}>登出</button>
      </div>

      <div style={{ maxWidth: 1600, margin: "0 auto", padding: "16px 18px" }}>

        {/* 指標卡 */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
            <Stat label="全部開啟中" value={stats.total} color="#4f46e5" />
            <Stat label="🚨 逾期" value={stats.overdue} color="#dc2626" highlight={stats.overdue > 0} />
            <Stat label="⏰ 本週到期" value={stats.due_this_week} color="#f59e0b" />
            <Stat label="已結案" value={0} color="#16a34a" sub="請切到 status=closed" />
          </div>
        )}

        {/* 案件類型快篩 chips */}
        {stats && Object.keys(stats.by_kind).length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <button
              onClick={() => setFilter({ ...filter, kind: "" })}
              style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                border: filter.kind === "" ? "2px solid #4f46e5" : "1px solid #e2e8f0",
                background: filter.kind === "" ? "#eef2ff" : "#fff",
                color: filter.kind === "" ? "#4f46e5" : "#475569",
                cursor: "pointer",
              }}
            >
              全部 {stats.total}
            </button>
            {Object.entries(stats.by_kind).map(([kind, count]) => {
              const meta = KIND_META[kind] || { emoji: "📄", label: kind, color: "#64748b" };
              const active = filter.kind === kind;
              return (
                <button
                  key={kind}
                  onClick={() => setFilter({ ...filter, kind: active ? "" : kind })}
                  style={{
                    padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                    border: active ? `2px solid ${meta.color}` : "1px solid #e2e8f0",
                    background: active ? `${meta.color}15` : "#fff",
                    color: active ? meta.color : "#475569",
                    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
                  }}
                >
                  {meta.emoji} {meta.label} {count}
                </button>
              );
            })}
          </div>
        )}

        {/* 控制列 */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <input
            placeholder="🔎 搜尋標題 / 案號 / 當事人"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...S.select, minWidth: 260, flex: 1 }}
          />
          <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} style={S.select}>
            <option value="open">🟢 進行中</option>
            <option value="closed">✅ 已結案</option>
            <option value="all">全部</option>
          </select>
          <select value={filter.kind} onChange={(e) => setFilter({ ...filter, kind: e.target.value })} style={S.select}>
            <option value="">所有類型</option>
            {Object.entries(KIND_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
          </select>
          <select value={filter.brand} onChange={(e) => setFilter({ ...filter, brand: e.target.value })} style={S.select}>
            <option value="">所有品牌</option>
            {["米", "科", "希", "無限", "言"].map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <div style={{ display: "flex", border: "1px solid #cbd5e1", borderRadius: 7, overflow: "hidden" }}>
            <button onClick={() => setView("kanban")} style={{ ...S.viewBtn, background: view === "kanban" ? "#4f46e5" : "#fff", color: view === "kanban" ? "#fff" : "#475569" }}>📋 看板</button>
            <button onClick={() => setView("list")} style={{ ...S.viewBtn, background: view === "list" ? "#4f46e5" : "#fff", color: view === "list" ? "#fff" : "#475569" }}>☰ 列表</button>
          </div>
          <button onClick={load} style={S.btnSmall}>🔄</button>
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading && <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>載入中...</div>}

            {!loading && filtered.length === 0 && (
              <div style={{ padding: 60, textAlign: "center", background: "#fff", borderRadius: 12 }}>
                <div style={{ fontSize: 48 }}>📋</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 10 }}>目前無案件</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>點右上 + 新建案件 開始</div>
              </div>
            )}

            {/* Kanban 看板 */}
            {!loading && filtered.length > 0 && view === "kanban" && (
              <KanbanView cases={filtered} today={today} />
            )}

            {/* 列表 */}
            {!loading && filtered.length > 0 && view === "list" && (
              <ListView cases={filtered} today={today} />
            )}
          </div>

          {/* 最近事件時間軸 */}
          {recentEvents.length > 0 && (
            <div style={{ width: 280, flexShrink: 0, background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 14, position: "sticky", top: 60 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>🕐 最近事件</div>
              {recentEvents.map((evt, i) => (
                <a key={evt.id || i} href={`/legal/cases/${evt.case_id}`} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: i > 0 ? "1px solid #f1f5f9" : "none", textDecoration: "none", color: "#0f172a" }}>
                  <div style={{ width: 8, display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: i === 0 ? "#4f46e5" : "#cbd5e1" }} />
                    {i < recentEvents.length - 1 && <div style={{ width: 1, flex: 1, background: "#e2e8f0", marginTop: 2 }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{evt.case_title || evt.event_type}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{evt.note || evt.event_type}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{evt.created_at?.slice(0, 16).replace("T", " ")}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {newCase && <NewCaseModal email={email} onClose={() => setNewCase(false)} onCreated={() => { setNewCase(false); load(); }} />}
    </div>
  );
}

function KanbanView({ cases, today }: { cases: CaseRow[]; today: string }) {
  const byStage: Record<string, CaseRow[]> = {};
  for (const s of STAGES) byStage[s.id] = [];
  for (const c of cases) {
    if (byStage[c.stage]) byStage[c.stage].push(c);
    else {
      if (!byStage["other"]) byStage["other"] = [];
      byStage["other"].push(c);
    }
  }
  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 20 }}>
      {STAGES.map((s) => {
        const list = byStage[s.id] || [];
        return (
          <div key={s.id} style={{ minWidth: 280, flexShrink: 0, background: "#f8fafc", borderRadius: 12, padding: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.label}</div>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "#fff", color: "#64748b", border: "1px solid #e2e8f0" }}>{list.length}</div>
            </div>
            {list.length === 0 ? (
              <div style={{ fontSize: 11, color: "#cbd5e1", textAlign: "center", padding: "20px 0" }}>—</div>
            ) : list.map((c) => <KanbanCard key={c.id} c={c} today={today} />)}
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({ c, today }: { c: CaseRow; today: string }) {
  const kind = KIND_META[c.kind] || { emoji: "📄", label: c.kind, color: "#64748b" };
  const overdue = c.response_deadline && c.response_deadline < today;
  const days = c.response_deadline ? Math.floor((new Date(c.response_deadline).getTime() - new Date(today).getTime()) / 86400000) : null;
  const urgency = overdue ? "#dc2626" : days !== null && days <= 3 ? "#f59e0b" : days !== null && days <= 7 ? "#0891b2" : null;

  return (
    <a href={`/legal/cases/${c.id}`} style={{
      display: "block", background: "#fff", borderRadius: 10, padding: 12, marginBottom: 8,
      border: "1px solid #e2e8f0", textDecoration: "none", color: "#0f172a",
      borderLeft: urgency ? `3px solid ${urgency}` : "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: kind.color + "15", color: kind.color }}>
          {kind.emoji} {kind.label}
        </span>
        {c.brand_code && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#f1f5f9", color: "#475569" }}>{c.brand_code}</span>}
        {c.severity === "critical" && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#fee2e2", color: "#991b1b" }}>🚨</span>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: "#0f172a", wordBreak: "break-word" }}>{c.title}</div>
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, fontFamily: "monospace" }}>{c.case_no_internal || c.case_no_external || ""}</div>
      <div style={{ display: "flex", alignItems: "center", marginTop: 8, gap: 6 }}>
        {c.primary_party_name && <span style={{ fontSize: 11, color: "#475569" }}>👤 {c.primary_party_name}</span>}
        <div style={{ flex: 1 }} />
        {c.response_deadline && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10,
            background: overdue ? "#fef2f2" : days !== null && days <= 3 ? "#fef3c7" : "#f1f5f9",
            color: overdue ? "#991b1b" : days !== null && days <= 3 ? "#b45309" : "#475569",
          }}>
            {overdue ? `逾 ${Math.abs(days!)}d` : days === 0 ? "今天" : `${days}d`}
          </span>
        )}
      </div>
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>{(c.owner_email || "").split("@")[0]}</div>
    </a>
  );
}

function ListView({ cases, today }: { cases: CaseRow[]; today: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
      <div style={S.rowHead}>
        <div style={{ width: 60 }}>類型</div>
        <div style={{ width: 150 }}>案號</div>
        <div style={{ flex: 2 }}>標題 / 對造</div>
        <div style={{ width: 100 }}>階段</div>
        <div style={{ width: 120 }}>期限</div>
        <div style={{ width: 130 }}>承辦</div>
        <div style={{ width: 50 }}></div>
      </div>
      {cases.map((c) => <CaseListRow key={c.id} c={c} today={today} />)}
    </div>
  );
}

function CaseListRow({ c, today }: { c: CaseRow; today: string }) {
  const kind = KIND_META[c.kind] || { emoji: "📄", label: c.kind, color: "#64748b" };
  const overdue = c.response_deadline && c.response_deadline < today;
  const days = c.response_deadline ? Math.floor((new Date(c.response_deadline).getTime() - new Date(today).getTime()) / 86400000) : null;
  const stage = STAGES.find((s) => s.id === c.stage);
  return (
    <a href={`/legal/cases/${c.id}`} style={{ ...S.rowBody, textDecoration: "none", color: "#0f172a" }}>
      <div style={{ width: 60, textAlign: "center" }}>
        <div style={{ fontSize: 20 }}>{kind.emoji}</div>
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{kind.label}</div>
      </div>
      <div style={{ width: 150, fontSize: 11, color: "#475569", fontFamily: "monospace" }}>
        <div>{c.case_no_internal || "-"}</div>
        {c.case_no_external && <div style={{ fontSize: 10, color: "#94a3b8" }}>{c.case_no_external}</div>}
      </div>
      <div style={{ flex: 2, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {c.severity === "critical" && <span style={{ color: "#dc2626", marginRight: 4 }}>🚨</span>}
          {c.title}
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
          {c.brand_code && <span style={{ padding: "1px 6px", borderRadius: 4, background: "#f1f5f9", marginRight: 6 }}>{c.brand_code}</span>}
          {c.primary_party_name || c.agency || "-"}
        </div>
      </div>
      <div style={{ width: 100, fontSize: 11 }}>
        {stage ? <span style={{ color: stage.color, fontWeight: 700 }}>{stage.label}</span> : c.stage}
      </div>
      <div style={{ width: 120 }}>
        {c.response_deadline ? (
          <div>
            <div style={{ fontSize: 11, color: overdue ? "#dc2626" : "#475569", fontWeight: overdue ? 700 : 500 }}>
              {overdue ? "🚨 " : ""}{c.response_deadline}
            </div>
            <div style={{ fontSize: 9, color: overdue ? "#dc2626" : "#94a3b8" }}>
              {overdue ? `逾 ${Math.abs(days!)} 天` : days === 0 ? "今天" : `${days} 天後`}
            </div>
          </div>
        ) : <span style={{ color: "#cbd5e1" }}>—</span>}
      </div>
      <div style={{ width: 130, fontSize: 11, color: "#475569" }}>{(c.owner_email || "").split("@")[0]}</div>
      <div style={{ width: 50, textAlign: "right", color: "#cbd5e1" }}>›</div>
    </a>
  );
}

function Stat({ label, value, color, highlight, sub }: { label: string; value: number; color: string; highlight?: boolean; sub?: string }) {
  return (
    <div style={{ background: "#fff", padding: 14, borderRadius: 12, border: highlight ? `2px solid ${color}` : "1px solid #e2e8f0", boxShadow: highlight ? `0 10px 25px -10px ${color}33` : "none" }}>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function NewCaseModal({ email, onClose, onCreated }: { email: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: "", kind: "consumer_dispute", brand_code: "米",
    agency: "", primary_party_name: "",
    response_deadline: "", summary: "",
    case_no_external: "", severity: "normal",
  });
  const [submitting, setSubmitting] = useState(false);
  async function submit() {
    if (!form.title) { alert("請填標題"); return; }
    setSubmitting(true);
    const r = await fetch("/api/legal/cases", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, owner_email: email }),
    });
    const d = await r.json();
    setSubmitting(false);
    if (d.ok) onCreated();
    else alert("失敗: " + d.error);
  }
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0, fontSize: 18 }}>新建法務案件</h2>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>建立後會自動產生內部案號 + 寫 timeline + 推命令給承辦人</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
          <Field label="案件類型" required>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} style={S.input}>
              {Object.entries(KIND_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </select>
          </Field>
          <Field label="品牌" required>
            <select value={form.brand_code} onChange={(e) => setForm({ ...form, brand_code: e.target.value })} style={S.input}>
              {["米", "科", "希", "無限", "言"].map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="標題" required><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="例：陳姿亘 消費爭議" style={S.input} /></Field>
          <Field label="對造 / 當事人"><input value={form.primary_party_name} onChange={(e) => setForm({ ...form, primary_party_name: e.target.value })} placeholder="姓名" style={S.input} /></Field>
          <Field label="受文機關 / 法院"><input value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} placeholder="例：臺中市政府" style={S.input} /></Field>
          <Field label="外部案號"><input value={form.case_no_external} onChange={(e) => setForm({ ...form, case_no_external: e.target.value })} placeholder="例：113(米)收字113040001號" style={S.input} /></Field>
          <Field label="回函/答辯期限"><input type="date" value={form.response_deadline} onChange={(e) => setForm({ ...form, response_deadline: e.target.value })} style={S.input} /></Field>
          <Field label="嚴重度">
            <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} style={S.input}>
              <option value="normal">⚪ 一般</option>
              <option value="high">🟡 高</option>
              <option value="critical">🔴 緊急</option>
            </select>
          </Field>
        </div>
        <div style={{ marginTop: 10 }}>
          <Field label="爭點摘要"><textarea rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} style={S.input} /></Field>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <button style={S.btnGray} onClick={onClose}>取消</button>
          <button style={S.btnPrimary} onClick={submit} disabled={submitting}>{submitting ? "建立中..." : "建立案件"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: "#475569", fontWeight: 600, display: "block", marginBottom: 3 }}>
        {label}{required && <span style={{ color: "#dc2626" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  header: { background: "#0f172a", padding: "12px 16px", color: "#fff", display: "flex", alignItems: "center", gap: 8, position: "sticky", top: 0, zIndex: 10 },
  linkBtn: { padding: "4px 10px", borderRadius: 6, fontSize: 11, color: "#cbd5e1", textDecoration: "none", border: "1px solid rgba(255,255,255,0.15)" },
  logoutBtn: { padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#94a3b8", fontSize: 11, cursor: "pointer" },
  btnPrimary: { padding: "6px 14px", borderRadius: 7, border: "none", background: "#4f46e5", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  btnSmall: { padding: "6px 10px", borderRadius: 7, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  viewBtn: { padding: "5px 10px", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  btnGray: { padding: "6px 14px", borderRadius: 7, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  select: { padding: "6px 10px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff" },
  rowHead: { display: "flex", gap: 12, padding: "10px 14px", background: "#f8fafc", fontSize: 11, fontWeight: 700, color: "#475569", borderBottom: "1px solid #e2e8f0", alignItems: "center" },
  rowBody: { display: "flex", gap: 12, padding: "10px 14px", borderBottom: "1px solid #f1f5f9", alignItems: "center" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { background: "#fff", borderRadius: 14, padding: 22, width: 640, maxWidth: "92%", maxHeight: "90vh", overflowY: "auto" },
  input: { width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 6, boxSizing: "border-box", background: "#fff" },
};
