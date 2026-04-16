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

const KIND_LABEL: Record<string, { emoji: string; label: string }> = {
  consumer_dispute: { emoji: "🛒", label: "消費爭議" },
  civil_defense: { emoji: "⚖️", label: "民事答辯" },
  civil_enforcement: { emoji: "💰", label: "強制執行" },
  criminal: { emoji: "🚨", label: "刑事" },
  labor: { emoji: "👷", label: "勞動爭議" },
  contract_dispute: { emoji: "📝", label: "合約糾紛" },
  nda_breach: { emoji: "🔒", label: "NDA 違約" },
  complaint: { emoji: "📢", label: "客訴" },
};

const STAGE_LABEL: Record<string, string> = {
  intake: "📥 收件",
  drafting: "✏️ 撰狀中",
  review: "👀 審閱中",
  sealed: "📜 已用印",
  dispatched: "📤 已遞狀",
  hearing: "🏛️ 開庭中",
  judged: "⚖️ 已判決",
  finalised: "🔒 判決確定",
  closed: "✅ 結案",
  appealed: "↗️ 上訴中",
};

export default function LegalCasesPage() {
  const [email, setEmail] = useState("");
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<{ kind: string; brand: string; status: string }>({ kind: "", brand: "", status: "open" });
  const [loading, setLoading] = useState(true);
  const [newCase, setNewCase] = useState(false);

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
    const r = await fetch(`/api/legal/cases?${params}`, { cache: "no-store" });
    const d = await r.json();
    if (d.ok) { setCases(d.data); setStats(d.stats); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { if (email) load(); }, [email, load]);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <div style={S.header}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>⚖️ 法務案件中心</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{email}</div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setNewCase(true)} style={S.btnPrimary}>+ 新建案件</button>
        <a href="/legal" style={S.linkBtn}>← 概覽</a>
        <a href="/today" style={S.linkBtn}>今日待辦</a>
        <button onClick={() => { sessionStorage.clear(); window.location.href = "/"; }} style={S.logoutBtn}>登出</button>
      </div>

      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "16px 14px" }}>

        {/* 統計 */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
            <Stat label="全部開啟中" value={stats.total} color="#4f46e5" />
            <Stat label="🚨 逾期" value={stats.overdue} color="#dc2626" />
            <Stat label="⏰ 本週到期" value={stats.due_this_week} color="#f59e0b" />
            <Stat label="類型數" value={Object.keys(stats.by_kind).length} color="#64748b" />
          </div>
        )}

        {/* 篩選 */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} style={S.select}>
            <option value="open">🟢 進行中</option>
            <option value="closed">✅ 已結案</option>
            <option value="all">全部</option>
          </select>
          <select value={filter.kind} onChange={(e) => setFilter({ ...filter, kind: e.target.value })} style={S.select}>
            <option value="">所有類型</option>
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
          </select>
          <select value={filter.brand} onChange={(e) => setFilter({ ...filter, brand: e.target.value })} style={S.select}>
            <option value="">所有品牌</option>
            {["米", "科", "希", "無限", "言"].map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <button onClick={load} style={S.btnSmall}>🔄 重新整理</button>
        </div>

        {loading && <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>載入中...</div>}

        {/* 列表 */}
        {!loading && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ ...S.rowHead }}>
              <div style={{ width: 60 }}>類型</div>
              <div style={{ width: 150 }}>案號</div>
              <div style={{ flex: 2 }}>標題 / 對造</div>
              <div style={{ width: 100 }}>階段</div>
              <div style={{ width: 120 }}>期限</div>
              <div style={{ width: 130 }}>承辦</div>
              <div style={{ width: 50 }}></div>
            </div>
            {cases.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>目前無案件</div>
            ) : cases.map((c) => <CaseListRow key={c.id} c={c} />)}
          </div>
        )}

      </div>

      {newCase && <NewCaseModal email={email} onClose={() => setNewCase(false)} onCreated={() => { setNewCase(false); load(); }} />}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#fff", padding: 14, borderRadius: 12, border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function CaseListRow({ c }: { c: CaseRow }) {
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = c.response_deadline && c.response_deadline < today;
  const kind = KIND_LABEL[c.kind] || { emoji: "📄", label: c.kind };
  return (
    <a href={`/legal/cases/${c.id}`} style={{ ...S.rowBody, textDecoration: "none", color: "#0f172a" }}>
      <div style={{ width: 60, fontSize: 11 }}>
        <div style={{ fontSize: 18 }}>{kind.emoji}</div>
        <div style={{ color: "#64748b" }}>{kind.label}</div>
      </div>
      <div style={{ width: 150, fontSize: 11, color: "#475569", fontFamily: "monospace" }}>
        <div>{c.case_no_internal || "-"}</div>
        {c.case_no_external && <div style={{ fontSize: 10, color: "#94a3b8" }}>{c.case_no_external}</div>}
      </div>
      <div style={{ flex: 2, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
          {c.brand_code && <span style={{ padding: "1px 6px", borderRadius: 4, background: "#f1f5f9", marginRight: 6 }}>{c.brand_code}</span>}
          {c.primary_party_name || c.agency || "-"}
        </div>
      </div>
      <div style={{ width: 100, fontSize: 11 }}>{STAGE_LABEL[c.stage] || c.stage}</div>
      <div style={{ width: 120, fontSize: 11, color: isOverdue ? "#dc2626" : "#475569", fontWeight: isOverdue ? 700 : 500 }}>
        {c.response_deadline ? (isOverdue ? `🚨 ${c.response_deadline}` : c.response_deadline) : "-"}
      </div>
      <div style={{ width: 130, fontSize: 11, color: "#475569" }}>{(c.owner_email || "").split("@")[0]}</div>
      <div style={{ width: 50, textAlign: "right", color: "#cbd5e1" }}>›</div>
    </a>
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
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: 0, fontSize: 18 }}>新建法務案件</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
          <Field label="案件類型" required><select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} style={S.input}>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}</select></Field>
          <Field label="品牌" required><select value={form.brand_code} onChange={e => setForm({ ...form, brand_code: e.target.value })} style={S.input}>{["米", "科", "希", "無限", "言"].map(b => <option key={b} value={b}>{b}</option>)}</select></Field>
          <Field label="標題" required><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="例：陳姿亘 消費爭議" style={S.input} /></Field>
          <Field label="對造 / 當事人"><input value={form.primary_party_name} onChange={e => setForm({ ...form, primary_party_name: e.target.value })} placeholder="姓名" style={S.input} /></Field>
          <Field label="受文機關 / 法院"><input value={form.agency} onChange={e => setForm({ ...form, agency: e.target.value })} placeholder="例：臺中市政府" style={S.input} /></Field>
          <Field label="外部案號"><input value={form.case_no_external} onChange={e => setForm({ ...form, case_no_external: e.target.value })} placeholder="例：113(米)收字113040001號" style={S.input} /></Field>
          <Field label="回函/答辯期限"><input type="date" value={form.response_deadline} onChange={e => setForm({ ...form, response_deadline: e.target.value })} style={S.input} /></Field>
          <Field label="嚴重度"><select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} style={S.input}><option value="normal">一般</option><option value="high">高</option><option value="critical">緊急</option></select></Field>
        </div>
        <div style={{ marginTop: 10 }}>
          <Field label="爭點摘要"><textarea rows={3} value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} style={S.input} /></Field>
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
      <label style={{ fontSize: 11, color: "#475569", fontWeight: 600, display: "block", marginBottom: 3 }}>{label}{required && <span style={{ color: "#dc2626" }}> *</span>}</label>
      {children}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  header: { background: "#0f172a", padding: "12px 16px", color: "#fff", display: "flex", alignItems: "center", gap: 8, position: "sticky", top: 0, zIndex: 10 },
  linkBtn: { padding: "4px 10px", borderRadius: 6, fontSize: 11, color: "#cbd5e1", textDecoration: "none", border: "1px solid rgba(255,255,255,0.15)" },
  logoutBtn: { padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#94a3b8", fontSize: 11, cursor: "pointer" },
  btnPrimary: { padding: "6px 14px", borderRadius: 7, border: "none", background: "#4f46e5", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  btnSmall: { padding: "6px 12px", borderRadius: 7, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  btnGray: { padding: "6px 14px", borderRadius: 7, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  select: { padding: "6px 10px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff" },
  rowHead: { display: "flex", gap: 12, padding: "10px 14px", background: "#f8fafc", fontSize: 11, fontWeight: 700, color: "#475569", borderBottom: "1px solid #e2e8f0", alignItems: "center" },
  rowBody: { display: "flex", gap: 12, padding: "10px 14px", borderBottom: "1px solid #f1f5f9", alignItems: "center" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { background: "#fff", borderRadius: 14, padding: 20, width: 640, maxWidth: "92%", maxHeight: "90vh", overflowY: "auto" },
  input: { width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 6, boxSizing: "border-box", background: "#fff" },
};
