"use client";

import { useState, useEffect, useCallback, use } from "react";

interface CaseDetail {
  id: string;
  case_no_internal: string | null;
  case_no_external: string | null;
  title: string;
  kind: string;
  brand_code: string | null;
  agency: string | null;
  agency_type: string | null;
  primary_party_name: string | null;
  owner_email: string | null;
  reviewer_email: string | null;
  stage: string;
  status: string;
  severity: string;
  filed_date: string | null;
  response_deadline: string | null;
  hearing_date: string | null;
  closure_date: string | null;
  amount_claimed: number | null;
  amount_settled: number | null;
  summary: string | null;
  our_lawyer: string | null;
  opposing_lawyer: string | null;
  onedrive_path: string | null;
  created_at: string;
  updated_at: string;
}

interface Evt { id: string; event_type: string; title: string; detail: string | null; actor_email: string | null; event_date: string; }
interface Doc { id: string; doc_type: string; filename: string | null; onedrive_path: string | null; version: number; created_at: string; }

const STAGES = ["intake", "drafting", "review", "sealed", "dispatched", "hearing", "judged", "finalised", "closed", "appealed"];

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [email, setEmail] = useState("");
  const [c, setC] = useState<CaseDetail | null>(null);
  const [events, setEvents] = useState<Evt[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEvent, setNewEvent] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const e = sessionStorage.getItem("moyu_current_user");
    if (!e) { window.location.href = "/"; return; }
    setEmail(e);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/legal/cases/${id}`, { cache: "no-store" });
    const d = await r.json();
    if (d.ok) { setC(d.case); setEvents(d.events); setDocs(d.documents); }
    setLoading(false);
  }, [id]);

  useEffect(() => { if (email) load(); }, [email, load]);

  async function updateField(field: string, value: unknown) {
    const r = await fetch(`/api/legal/cases/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value, byEmail: email }),
    });
    if (r.ok) load();
  }

  if (loading && !c) return <div style={{ padding: 40, textAlign: "center" }}>載入中...</div>;
  if (!c) return <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>找不到此案件</div>;

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !!(c.response_deadline && c.response_deadline < today && c.status === "open");

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <div style={S.header}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900 }}>⚖️ {c.title}</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{c.case_no_internal || "-"} · {c.case_no_external || ""}</div>
        </div>
        <div style={{ flex: 1 }} />
        <a href="/legal/cases" style={S.linkBtn}>← 案件列表</a>
        <button onClick={() => { sessionStorage.clear(); window.location.href = "/"; }} style={S.logoutBtn}>登出</button>
      </div>

      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "16px 14px", display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        {/* 主區 */}
        <div>
          {isOverdue && <div style={S.alertBar}>🚨 此案件已逾期 — 請立即處理</div>}

          {/* 基本資料 */}
          <Card title="基本資料">
            <Row label="案件標題" value={c.title} />
            <Row label="類型" value={c.kind} />
            <Row label="品牌" value={c.brand_code || "-"} />
            <Row label="受文機關 / 法院" value={c.agency || "-"} />
            <Row label="對造 / 當事人" value={c.primary_party_name || "-"} />
            <Row label="我方律師" value={c.our_lawyer || "-"} />
            <Row label="對造律師" value={c.opposing_lawyer || "-"} />
            <Row label="訴訟金額" value={c.amount_claimed ? `$${c.amount_claimed.toLocaleString()}` : "-"} />
          </Card>

          {/* 案件階段 */}
          <Card title="案件階段">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {STAGES.map((s) => (
                <button key={s}
                  onClick={() => updateField("stage", s)}
                  style={{
                    padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                    border: c.stage === s ? "2px solid #4f46e5" : "1px solid #cbd5e1",
                    background: c.stage === s ? "#eef2ff" : "#fff",
                    color: c.stage === s ? "#4f46e5" : "#475569",
                    cursor: "pointer",
                  }}>{s}</button>
              ))}
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <select value={c.status} onChange={(e) => updateField("status", e.target.value)} style={S.input}>
                <option value="open">🟢 open</option>
                <option value="closed">✅ closed</option>
                <option value="archived">📁 archived</option>
                <option value="withdrawn">↩️ withdrawn</option>
                <option value="settled">🤝 settled</option>
              </select>
              <select value={c.severity} onChange={(e) => updateField("severity", e.target.value)} style={S.input}>
                <option value="normal">⚪ normal</option>
                <option value="high">🟡 high</option>
                <option value="critical">🔴 critical</option>
              </select>
            </div>
          </Card>

          {/* 摘要 + 備註 */}
          <Card title="爭點 / 摘要">
            <div style={{ fontSize: 13, whiteSpace: "pre-wrap", color: "#1e293b" }}>{c.summary || "(尚無摘要)"}</div>
          </Card>

          {/* 時間軸 */}
          <Card title={`時間軸 (${events.length})`} action={<button style={S.btnSmall} onClick={() => setNewEvent(true)}>+ 記事件</button>}>
            {events.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8", padding: "10px 0" }}>暫無事件</div>}
            {events.map((e) => (
              <div key={e.id} style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "#eef2ff", color: "#4f46e5", fontWeight: 700 }}>{e.event_type}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{e.title}</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>{new Date(e.event_date).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}</span>
                </div>
                {e.detail && <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, paddingLeft: 4 }}>{e.detail}</div>}
                {e.actor_email && <div style={{ fontSize: 10, color: "#94a3b8", paddingLeft: 4 }}>@ {e.actor_email.split("@")[0]}</div>}
              </div>
            ))}
          </Card>
        </div>

        {/* 側欄 */}
        <div>
          <Card title="承辦資訊">
            <Row label="承辦人" value={<EditableEmail value={c.owner_email} onSave={(v) => updateField("owner_email", v)} />} />
            <Row label="審閱主管" value={<EditableEmail value={c.reviewer_email} onSave={(v) => updateField("reviewer_email", v)} />} />
          </Card>

          <Card title="關鍵日期">
            <Row label="收文日" value={<EditableDate value={c.filed_date} onSave={(v) => updateField("filed_date", v)} />} />
            <Row label="回函/答辯期限" value={<EditableDate value={c.response_deadline} onSave={(v) => updateField("response_deadline", v)} overdue={isOverdue} />} />
            <Row label="開庭日" value={<EditableDate value={c.hearing_date ? c.hearing_date.slice(0, 10) : null} onSave={(v) => updateField("hearing_date", v)} />} />
            <Row label="結案日" value={<EditableDate value={c.closure_date} onSave={(v) => updateField("closure_date", v)} />} />
          </Card>

          <Card title={`文件 (${docs.length})`}>
            {docs.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8" }}>暫無文件。可到 OneDrive 對應資料夾：<br />{c.onedrive_path || "(尚未設定路徑)"}</div>}
            {docs.map((d) => (
              <div key={d.id} style={{ fontSize: 12, padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ fontWeight: 600 }}>{d.doc_type} v{d.version}</div>
                {d.filename && <div style={{ color: "#64748b", fontSize: 11 }}>{d.filename}</div>}
              </div>
            ))}
          </Card>
        </div>
      </div>

      {newEvent && <NewEventModal caseId={id} email={email} onClose={() => setNewEvent(false)} onDone={() => { setNewEvent(false); load(); }} />}
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>{title}</h3>
        <div style={{ flex: 1 }} />
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", padding: "5px 0", fontSize: 12, alignItems: "center" }}>
      <div style={{ width: 110, color: "#64748b" }}>{label}</div>
      <div style={{ flex: 1, color: "#1e293b" }}>{value}</div>
    </div>
  );
}

function EditableEmail({ value, onSave }: { value: string | null; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value || "");
  if (editing) return <input autoFocus value={v} onBlur={() => { onSave(v); setEditing(false); }} onChange={(e) => setV(e.target.value)} style={S.inputInline} />;
  return <span onClick={() => setEditing(true)} style={{ cursor: "pointer", color: value ? "#1e293b" : "#94a3b8" }}>{value || "(未設定)"}</span>;
}

function EditableDate({ value, onSave, overdue }: { value: string | null; onSave: (v: string) => void; overdue?: boolean | null }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value || "");
  if (editing) return <input autoFocus type="date" value={v} onBlur={() => { onSave(v); setEditing(false); }} onChange={(e) => setV(e.target.value)} style={S.inputInline} />;
  return <span onClick={() => setEditing(true)} style={{ cursor: "pointer", color: overdue ? "#dc2626" : value ? "#1e293b" : "#94a3b8", fontWeight: overdue ? 700 : 400 }}>{overdue ? `🚨 ` : ""}{value || "(未設定)"}</span>;
}

function NewEventModal({ caseId, email, onClose, onDone }: { caseId: string; email: string; onClose: () => void; onDone: () => void }) {
  const [ev, setEv] = useState({ event_type: "note", title: "", detail: "" });
  async function submit() {
    if (!ev.title) { alert("請填事件標題"); return; }
    const r = await fetch(`/api/legal/cases/${caseId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...ev, actor_email: email }),
    });
    if (r.ok) onDone();
  }
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0 }}>新增事件</h3>
        <div style={{ marginTop: 12 }}>
          <select value={ev.event_type} onChange={(e) => setEv({ ...ev, event_type: e.target.value })} style={S.input}>
            <option value="note">📝 一般紀錄</option>
            <option value="received">📥 收到文件</option>
            <option value="drafted">✏️ 擬稿完成</option>
            <option value="reviewed">👀 主管審閱</option>
            <option value="sealed">📜 用印完成</option>
            <option value="dispatched">📤 發文</option>
            <option value="hearing_scheduled">🏛️ 開庭通知</option>
            <option value="hearing_done">⚖️ 開庭完成</option>
            <option value="judged">📋 判決</option>
            <option value="settled">🤝 和解</option>
            <option value="closed">✅ 結案</option>
          </select>
        </div>
        <div style={{ marginTop: 8 }}>
          <input placeholder="事件標題" value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} style={S.input} />
        </div>
        <div style={{ marginTop: 8 }}>
          <textarea placeholder="詳情" rows={3} value={ev.detail} onChange={(e) => setEv({ ...ev, detail: e.target.value })} style={S.input} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
          <button style={S.btnGray} onClick={onClose}>取消</button>
          <button style={S.btnPrimary} onClick={submit}>建立</button>
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  header: { background: "#0f172a", padding: "12px 16px", color: "#fff", display: "flex", alignItems: "center", gap: 8, position: "sticky", top: 0, zIndex: 10 },
  linkBtn: { padding: "4px 10px", borderRadius: 6, fontSize: 11, color: "#cbd5e1", textDecoration: "none", border: "1px solid rgba(255,255,255,0.15)" },
  logoutBtn: { padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#94a3b8", fontSize: 11, cursor: "pointer" },
  btnPrimary: { padding: "6px 14px", borderRadius: 7, border: "none", background: "#4f46e5", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  btnSmall: { padding: "5px 12px", borderRadius: 7, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: 11, fontWeight: 600, cursor: "pointer" },
  btnGray: { padding: "6px 14px", borderRadius: 7, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  input: { width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 6, boxSizing: "border-box", background: "#fff" },
  inputInline: { padding: "3px 6px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff", width: "100%" },
  alertBar: { background: "#fef2f2", color: "#991b1b", padding: "10px 14px", borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 700, border: "1px solid #fecaca" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { background: "#fff", borderRadius: 14, padding: 20, width: 500, maxWidth: "92%" },
};
