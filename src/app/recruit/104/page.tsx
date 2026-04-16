"use client";

import { useState, useEffect, useCallback } from "react";

interface QueueRow {
  id: string;
  account: string;
  candidate_104_id: string;
  candidate_name: string;
  candidate_phone: string | null;
  candidate_age: number | null;
  reply_status: string | null;
  reply_received_at: string | null;
  last_reply_text: string | null;
  phone_contacted_at: string | null;
  phone_contacted_by: string | null;
  interview_scheduled_at: string | null;
  interview_location: string | null;
  status: string | null;
  sent_at: string | null;
}

interface HotListData {
  date: string;
  hot: QueueRow[];
  contacted: QueueRow[];
  todayInterviews: QueueRow[];
  stats: { hot: number; contacted: number; todayInterviews: number };
}

export default function Recruit104Page() {
  const [email, setEmail] = useState("");
  const [data, setData] = useState<HotListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<QueueRow | null>(null);
  const [modalType, setModalType] = useState<"phone" | "interview" | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const e = sessionStorage.getItem("moyu_current_user");
    if (e) setEmail(e);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/recruit/hot-list`, { cache: "no-store" });
      const d = await r.json();
      if (d.ok) setData(d);
    } catch {/*ignore*/}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  async function markContacted(queueId: string, phone: string, notes: string) {
    if (!email) { alert("請先登入"); return; }
    const r = await fetch("/api/recruit/mark-contacted", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queueId, byEmail: email, phone, notes }),
    });
    const d = await r.json();
    if (d.ok) { setModalType(null); setSelected(null); load(); }
    else alert("失敗: " + d.error);
  }

  async function scheduleInterview(queueId: string, interviewTime: string, location: string, notes: string) {
    if (!email) { alert("請先登入"); return; }
    const r = await fetch("/api/recruit/schedule-interview-104", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queueId, interviewTime, location, byEmail: email, notes }),
    });
    const d = await r.json();
    if (d.ok) {
      alert("✅ 面試已登記，系統會自動在 104 寄面試邀請");
      setModalType(null); setSelected(null); load();
    } else alert("失敗: " + d.error);
  }

  if (loading && !data) return <div style={{ padding: 40, textAlign: "center" }}>載入中...</div>;
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>載入失敗</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <div style={S.header}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>📞 104 招聘帶班</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{email || "請先登入"} · {data.date}</div>
        </div>
        <div style={{ flex: 1 }} />
        <a href="/recruit" style={S.linkBtn}>← 回新訓</a>
        <button onClick={() => { sessionStorage.clear(); window.location.href = "/"; }} style={S.logoutBtn}>登出</button>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 14px" }}>

        {/* 3 大指標 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
          <Stat label="🔴 待打電話" value={data.stats.hot} sub="有興趣候選人" color="#dc2626" />
          <Stat label="🟡 待排面試" value={data.stats.contacted} sub="已聯絡等排時間" color="#f59e0b" />
          <Stat label="🟢 今日面試" value={data.stats.todayInterviews} sub="已排好" color="#16a34a" />
        </div>

        {/* 熱名單 */}
        <Section title={`🔴 待打電話 (${data.hot.length})`} empty="目前無熱名單。poller 每 15 分鐘掃一次 104，有人回覆『我有興趣』會出現在這裡。">
          {data.hot.map((r) => (
            <Row key={r.id}>
              <Cell style={{ width: 120 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{r.candidate_name}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{r.account} · {r.candidate_104_id}</div>
              </Cell>
              <Cell style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#1e293b" }}>{r.last_reply_text || "(無內容)"}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>回覆 {timeAgo(r.reply_received_at)}</div>
              </Cell>
              <Cell style={{ width: 180, textAlign: "right" }}>
                <button style={S.btnRed} onClick={() => { setSelected(r); setModalType("phone"); }}>已打電話</button>
                <button style={S.btnGreen} onClick={() => { setSelected(r); setModalType("interview"); }}>直接排面試</button>
              </Cell>
            </Row>
          ))}
        </Section>

        {/* 已聯絡待排面試 */}
        <Section title={`🟡 已聯絡待排面試 (${data.contacted.length})`} empty="目前無。">
          {data.contacted.map((r) => (
            <Row key={r.id}>
              <Cell style={{ width: 120 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{r.candidate_name}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{r.account}</div>
              </Cell>
              <Cell style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#1e293b" }}>電話：{r.candidate_phone || "-"}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>聯絡人：{r.phone_contacted_by} · {timeAgo(r.phone_contacted_at)}</div>
              </Cell>
              <Cell style={{ width: 180, textAlign: "right" }}>
                <button style={S.btnGreen} onClick={() => { setSelected(r); setModalType("interview"); }}>登記面試</button>
              </Cell>
            </Row>
          ))}
        </Section>

        {/* 今日面試 */}
        <Section title={`🟢 今日面試 (${data.todayInterviews.length})`} empty="今天沒排面試。">
          {data.todayInterviews.map((r) => (
            <Row key={r.id}>
              <Cell style={{ width: 120 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{r.candidate_name}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{r.account}</div>
              </Cell>
              <Cell style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#16a34a", fontWeight: 700 }}>{formatTime(r.interview_scheduled_at)}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{r.interview_location} · {r.candidate_phone || "-"}</div>
              </Cell>
              <Cell style={{ width: 180, textAlign: "right", fontSize: 11, color: "#64748b" }}>
                {r.status === "interview_scheduled" ? "✉️ 已自動發 104 通知" : r.status}
              </Cell>
            </Row>
          ))}
        </Section>

        <div style={{ textAlign: "center", padding: "30px 0 50px", fontSize: 11, color: "#cbd5e1" }}>
          📞 墨宇 104 自動化 · 每 15 分鐘掃回覆 · 面試自動發 104
        </div>
      </div>

      {/* Modals */}
      {modalType === "phone" && selected && (
        <PhoneModal row={selected} onClose={() => { setModalType(null); setSelected(null); }} onSubmit={markContacted} />
      )}
      {modalType === "interview" && selected && (
        <InterviewModal row={selected} onClose={() => { setModalType(null); setSelected(null); }} onSubmit={scheduleInterview} />
      )}
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 900, color, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 18, border: "1px solid #e2e8f0" }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 12px 0" }}>{title}</h2>
      {hasChildren ? children : <div style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>{empty}</div>}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: "1px solid #f1f5f9", alignItems: "center" }}>{children}</div>;
}
function Cell({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ minWidth: 0, ...style }}>{children}</div>;
}

function PhoneModal({ row, onClose, onSubmit }: { row: QueueRow; onClose: () => void; onSubmit: (id: string, phone: string, notes: string) => void }) {
  const [phone, setPhone] = useState(row.candidate_phone || "");
  const [notes, setNotes] = useState("");
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modalCard} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: 16 }}>已打電話：{row.candidate_name}</h3>
        <div style={{ marginTop: 12 }}>
          <label style={S.label}>電話號碼</label>
          <input style={S.input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="09XX-XXX-XXX" />
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={S.label}>通話摘要</label>
          <textarea style={{...S.input, minHeight: 80}} value={notes} onChange={e => setNotes(e.target.value)} placeholder="例如：對方下週二 14:00 方便，安排線上面試..." />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button style={S.btnGray} onClick={onClose}>取消</button>
          <button style={S.btnRed} onClick={() => onSubmit(row.id, phone, notes)}>儲存</button>
        </div>
      </div>
    </div>
  );
}

function InterviewModal({ row, onClose, onSubmit }: { row: QueueRow; onClose: () => void; onSubmit: (id: string, time: string, loc: string, notes: string) => void }) {
  const [time, setTime] = useState("");
  const [loc, setLoc] = useState("線上視訊（Google Meet 連結於面試前寄出）");
  const [notes, setNotes] = useState("");
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modalCard} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: 16 }}>登記面試：{row.candidate_name}</h3>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>⚠️ 按下「儲存」後，系統會自動在 104 平台寄面試邀約訊息。</div>
        <div style={{ marginTop: 12 }}>
          <label style={S.label}>面試時間</label>
          <input type="datetime-local" style={S.input} value={time} onChange={e => setTime(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={S.label}>地點 / 連結</label>
          <input style={S.input} value={loc} onChange={e => setLoc(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={S.label}>備註（傳給 104 對話用）</label>
          <textarea style={{...S.input, minHeight: 70}} value={notes} onChange={e => setNotes(e.target.value)} placeholder="例如：面試聯絡人 Lynn, 可能會遲到 10 分鐘..." />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button style={S.btnGray} onClick={onClose}>取消</button>
          <button style={S.btnGreen} onClick={() => time ? onSubmit(row.id, new Date(time).toISOString(), loc, notes) : alert("請填面試時間")}>儲存 + 發 104</button>
        </div>
      </div>
    </div>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return "-";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} 分鐘前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小時前`;
  return `${Math.floor(hrs / 24)} 天前`;
}
function formatTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const S: Record<string, React.CSSProperties> = {
  header: { background: "#0f172a", padding: "12px 16px", color: "#fff", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 10 },
  linkBtn: { padding: "4px 10px", borderRadius: 6, fontSize: 11, color: "#cbd5e1", textDecoration: "none", border: "1px solid rgba(255,255,255,0.15)" },
  logoutBtn: { padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#94a3b8", fontSize: 11, cursor: "pointer" },
  btnRed: { padding: "6px 12px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", marginLeft: 4 },
  btnGreen: { padding: "6px 12px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", marginLeft: 4 },
  btnGray: { padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modalCard: { background: "#fff", borderRadius: 14, padding: 20, width: 480, maxWidth: "90%", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 },
  input: { width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #cbd5e1", borderRadius: 8, boxSizing: "border-box" },
};
