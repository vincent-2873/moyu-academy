"use client";

import { useState, useEffect, useCallback } from "react";
import MobileNav from "@/components/MobileNav";

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

interface RecruitTask {
  id: string;
  title: string;
  severity: "info" | "normal" | "high" | "critical";
  status: string;
  owner_email: string;
  detail: string | null;
  created_at: string;
}

const LYNN_EMAIL = "lynn@xplatform.world";

export default function Recruit104Page() {
  const [email, setEmail] = useState("");
  const [data, setData] = useState<HotListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<QueueRow | null>(null);
  const [modalType, setModalType] = useState<"phone" | "interview" | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [myTasks, setMyTasks] = useState<RecruitTask[]>([]);
  const [unassignedTasks, setUnassignedTasks] = useState<RecruitTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const e = sessionStorage.getItem("moyu_current_user");
    if (!e) {
      window.location.href = "/";
      return;
    }
    setEmail(e);
    // Check if user is a recruit manager
    (async () => {
      try {
        const r = await fetch("/api/admin/pillar-managers?pillar=recruit");
        const d = await r.json();
        if (d.ok && Array.isArray(d.data)) {
          setIsManager(d.data.some((m: { email: string }) => m.email === e));
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // Fetch tasks when email is available
  useEffect(() => {
    if (!email) return;
    (async () => {
      setTasksLoading(true);
      try {
        const [myR, unR] = await Promise.all([
          fetch(`/api/recruit/tasks?owner=${encodeURIComponent(email)}&status=pending`),
          email === LYNN_EMAIL || isManager
            ? fetch("/api/recruit/tasks?unassigned=1")
            : Promise.resolve(null),
        ]);
        const myD = await myR.json();
        if (myD.ok) setMyTasks(myD.tasks || []);
        if (unR) {
          const unD = await unR.json();
          if (unD.ok) setUnassignedTasks(unD.tasks || []);
        }
      } catch { /* ignore */ }
      setTasksLoading(false);
    })();
  }, [email, isManager]);

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

  async function markContacted(queueId: string, phone: string, notes: string, extra?: {
    contactResult?: string;
    interviewTime?: string;
    interviewMethod?: string;
    expectedSalary?: string;
    workStatus?: string;
  }) {
    if (!email) { alert("請先登入"); return; }
    const r = await fetch("/api/recruit/mark-contacted", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queueId, byEmail: email, phone, notes, ...extra }),
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
      <style>{`
        @media (max-width: 768px) {
          .r104-header { flex-wrap: wrap !important; }
          .r104-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .r104-main { padding-bottom: 80px !important; }
          .r104-hot-actions { flex-direction: column !important; width: auto !important; }
        }
      `}</style>
      <div className="r104-header" style={S.header}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>📞 104 招聘帶班</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
            {email || "請先登入"} · {isManager ? "招聘主管" : "招聘員"} · {data.date}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <a href="/recruit/calendar" style={{ ...S.linkBtn, background: "#eef2ff", color: "#4f46e5", fontWeight: 700, border: "1px solid #c7d2fe" }}>📅 日曆</a>
        <a href="/today" style={S.linkBtn}>📋 今日待辦</a>
        <a href="/recruit" style={S.linkBtn}>← 回新訓</a>
        <button onClick={() => { sessionStorage.clear(); window.location.href = "/"; }} style={S.logoutBtn}>登出</button>
      </div>

      <div className="r104-main" style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 14px" }}>

        {/* 3 大指標 + 完成率 */}
        <div className="r104-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
          <Stat label="🔴 待打電話" value={data.stats.hot} sub={data.stats.hot > 0 ? "立即處理" : "全部打完 🎉"} color="#dc2626" highlight={data.stats.hot > 10} />
          <Stat label="🟡 待排面試" value={data.stats.contacted} sub="已聯絡等排時間" color="#f59e0b" />
          <Stat label="🟢 今日面試" value={data.stats.todayInterviews} sub="已排好" color="#16a34a" />
          <Stat label="💯 處理進度" value={`${Math.round(((data.stats.contacted + data.stats.todayInterviews) / Math.max(1, data.stats.hot + data.stats.contacted + data.stats.todayInterviews)) * 100)}%`} sub="已聯絡 / 總" color="#4f46e5" />
        </div>

        {/* 任務面板 */}
        <TaskAssignmentPanel
          email={email}
          isManager={isManager}
          myTasks={myTasks}
          unassignedTasks={unassignedTasks}
          tasksLoading={tasksLoading}
          onClaim={async (taskId: string) => {
            const r = await fetch("/api/recruit/tasks/claim", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ taskId, email }),
            });
            const d = await r.json();
            if (d.ok) {
              setMyTasks((prev) => prev.filter((t) => t.id !== taskId));
              setUnassignedTasks((prev) => prev.filter((t) => t.id !== taskId));
            } else {
              alert("認領失敗: " + d.error);
            }
          }}
          onAssign={async (taskId: string, assignTo: string) => {
            const r = await fetch("/api/recruit/tasks", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: taskId, assignTo }),
            });
            const d = await r.json();
            if (d.ok) {
              setUnassignedTasks((prev) => prev.filter((t) => t.id !== taskId));
            } else {
              alert("派發失敗: " + d.error);
            }
          }}
        />

        {/* 熱名單 — 依 urgency 自動排序（最久沒處理排前） */}
        <Section title={`🔴 待打電話 (${data.hot.length})`} empty="目前無熱名單。poller 每 15 分鐘掃一次 104，有人回覆『我有興趣』會出現在這裡。">
          {[...data.hot].sort((a, b) => {
            const aT = a.reply_received_at ? new Date(a.reply_received_at).getTime() : 0;
            const bT = b.reply_received_at ? new Date(b.reply_received_at).getTime() : 0;
            return aT - bT; // 最舊的最前
          }).map((r) => {
            const replyAt = r.reply_received_at ? new Date(r.reply_received_at).getTime() : Date.now();
            const hoursAgo = (Date.now() - replyAt) / 3600_000;
            const urgency = hoursAgo >= 24 ? "critical" : hoursAgo >= 12 ? "warm" : "fresh";
            const urgencyColor = urgency === "critical" ? "#dc2626" : urgency === "warm" ? "#f59e0b" : "#10b981";
            const urgencyLabel = urgency === "critical" ? `⏰ ${Math.floor(hoursAgo / 24)} 天前` : urgency === "warm" ? `🟡 ${Math.floor(hoursAgo)}h 前` : `🟢 ${Math.floor(hoursAgo * 60)}m 前`;
            return (
              <div key={r.id} data-candidate={r.candidate_name} style={{
                display: "flex", padding: "12px 0", borderTop: "1px solid #f1f5f9", alignItems: "center", gap: 12,
                borderLeft: `4px solid ${urgencyColor}`, paddingLeft: 12, marginLeft: -8,
                transition: "box-shadow 0.3s",
              }}>
                <div style={{ width: 120 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{r.candidate_name}</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>{r.account} · {r.candidate_104_id}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#1e293b", lineHeight: 1.5 }}>{r.last_reply_text || "(無內容，poller 會補)"}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: urgencyColor, marginTop: 3 }}>{urgencyLabel}</div>
                </div>
                <div style={{ width: 200, textAlign: "right", display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button style={S.btnRed} onClick={() => { setSelected(r); setModalType("phone"); }}>📞 已打電話</button>
                  <button style={S.btnGreen} onClick={() => { setSelected(r); setModalType("interview"); }}>📅 排面試</button>
                </div>
              </div>
            );
          })}
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
      <MobileNav />
      {modalType === "phone" && selected && (
        <PhoneModal row={selected} onClose={() => { setModalType(null); setSelected(null); }} onSubmit={markContacted} />
      )}
      {modalType === "interview" && selected && (
        <InterviewModal row={selected} onClose={() => { setModalType(null); setSelected(null); }} onSubmit={scheduleInterview} />
      )}
    </div>
  );
}

function Stat({ label, value, sub, color, highlight }: { label: string; value: number | string; sub: string; color: string; highlight?: boolean }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: highlight ? `2px solid ${color}` : "1px solid #e2e8f0", boxShadow: highlight ? `0 10px 25px -10px ${color}44` : "none" }}>
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

function PhoneModal({ row, onClose, onSubmit }: {
  row: QueueRow;
  onClose: () => void;
  onSubmit: (id: string, phone: string, notes: string, extra?: {
    contactResult?: string;
    interviewTime?: string;
    interviewMethod?: string;
    expectedSalary?: string;
    workStatus?: string;
  }) => void;
}) {
  const [phone, setPhone] = useState(row.candidate_phone || "");
  const [notes, setNotes] = useState("");
  const [contactResult, setContactResult] = useState("有意願");
  const [interviewTime, setInterviewTime] = useState("");
  const [interviewMethod, setInterviewMethod] = useState("線上Google Meet");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [workStatus, setWorkStatus] = useState("在職");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSubmit(row.id, phone, notes, {
      contactResult,
      interviewTime: interviewTime || undefined,
      interviewMethod,
      expectedSalary: expectedSalary || undefined,
      workStatus,
    });
    setSaving(false);
  };

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={{ ...S.modalCard, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: 16 }}>已打電話：{row.candidate_name}</h3>
        <div style={{ marginTop: 12 }}>
          <label style={S.label}>電話號碼</label>
          <input style={S.input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="09XX-XXX-XXX" />
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={S.label}>聯絡結果</label>
          <select style={S.input} value={contactResult} onChange={e => setContactResult(e.target.value)}>
            <option value="有意願">有意願</option>
            <option value="考慮中">考慮中</option>
            <option value="暫不考慮">暫不考慮</option>
            <option value="未接通">未接通</option>
            <option value="稍後回電">稍後回電</option>
          </select>
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={S.label}>預計面試時間（選填）</label>
          <input type="datetime-local" style={S.input} value={interviewTime} onChange={e => setInterviewTime(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={S.label}>面試方式</label>
          <select style={S.input} value={interviewMethod} onChange={e => setInterviewMethod(e.target.value)}>
            <option value="線上Google Meet">線上Google Meet</option>
            <option value="實體高雄辦公室">實體高雄辦公室</option>
            <option value="實體台北辦公室">實體台北辦公室</option>
          </select>
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={S.label}>期望薪資</label>
          <input style={S.input} value={expectedSalary} onChange={e => setExpectedSalary(e.target.value)} placeholder="例如：35,000-40,000" />
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={S.label}>目前工作狀態</label>
          <select style={S.input} value={workStatus} onChange={e => setWorkStatus(e.target.value)}>
            <option value="在職">在職</option>
            <option value="待業">待業</option>
            <option value="即將離職">即將離職</option>
          </select>
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={S.label}>備註</label>
          <textarea style={{ ...S.input, minHeight: 80 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="例如：對方下週二 14:00 方便，安排線上面試..." />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button style={S.btnGray} onClick={onClose} disabled={saving}>取消</button>
          <button style={{ ...S.btnRed, opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
            {saving ? "儲存中..." : "儲存"}
          </button>
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

function TaskAssignmentPanel({
  email, isManager, myTasks, unassignedTasks, tasksLoading, onClaim, onAssign,
}: {
  email: string;
  isManager: boolean;
  myTasks: RecruitTask[];
  unassignedTasks: RecruitTask[];
  tasksLoading: boolean;
  onClaim: (taskId: string) => void;
  onAssign: (taskId: string, assignTo: string) => void;
}) {
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignEmail, setAssignEmail] = useState("");

  if (tasksLoading) return null;
  if (myTasks.length === 0 && unassignedTasks.length === 0) return null;

  const severityBadge = (sev: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      critical: { bg: "#fef2f2", color: "#dc2626", label: "緊急" },
      high: { bg: "#fff7ed", color: "#ea580c", label: "高" },
      normal: { bg: "#eef2ff", color: "#4f46e5", label: "一般" },
      info: { bg: "#f0fdf4", color: "#16a34a", label: "資訊" },
    };
    const s = map[sev] || map.info;
    return <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: s.bg, color: s.color, fontWeight: 700 }}>{s.label}</span>;
  };

  const scrollToCandidate = (title: string) => {
    // Try to find candidate name in the hot list and scroll to it
    const candidates = document.querySelectorAll("[data-candidate]");
    for (const el of candidates) {
      if ((el as HTMLElement).dataset.candidate && title.includes((el as HTMLElement).dataset.candidate!)) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        (el as HTMLElement).style.boxShadow = "0 0 0 3px #4f46e5";
        setTimeout(() => { (el as HTMLElement).style.boxShadow = ""; }, 2000);
        return;
      }
    }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 18, border: "1px solid #e2e8f0" }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 12px 0" }}>
        📋 你有 {myTasks.length} 個待辦
      </h2>
      {myTasks.map((t) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #f1f5f9", cursor: "pointer" }}
          onClick={() => scrollToCandidate(t.title)}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{t.title}</div>
            {t.detail && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{t.detail}</div>}
          </div>
          {severityBadge(t.severity)}
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "#dcfce7", color: "#16a34a", fontWeight: 600 }}>已認領</span>
        </div>
      ))}

      {isManager && unassignedTasks.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 800, margin: "16px 0 8px 0", color: "#dc2626" }}>
            未派發 ({unassignedTasks.length})
          </h3>
          {unassignedTasks.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #f1f5f9" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t.title}</div>
                {t.detail && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{t.detail}</div>}
              </div>
              {severityBadge(t.severity)}
              {assigning === t.id ? (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input
                    style={{ fontSize: 11, padding: "3px 6px", border: "1px solid #cbd5e1", borderRadius: 6, width: 160 }}
                    placeholder="email"
                    value={assignEmail}
                    onChange={(e) => setAssignEmail(e.target.value)}
                  />
                  <button style={{ ...STask.btnSmall, background: "#16a34a", color: "#fff" }} onClick={() => { onAssign(t.id, assignEmail); setAssigning(null); setAssignEmail(""); }}>確認</button>
                  <button style={{ ...STask.btnSmall, background: "#f1f5f9", color: "#64748b" }} onClick={() => { setAssigning(null); setAssignEmail(""); }}>取消</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 4 }}>
                  <button style={{ ...STask.btnSmall, background: "#4f46e5", color: "#fff" }} onClick={() => onClaim(t.id)}>認領</button>
                  <button style={{ ...STask.btnSmall, background: "#f59e0b", color: "#fff" }} onClick={() => { setAssigning(t.id); setAssignEmail(""); }}>派發</button>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {!isManager && unassignedTasks.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 800, margin: "16px 0 8px 0", color: "#f59e0b" }}>
            可認領 ({unassignedTasks.length})
          </h3>
          {unassignedTasks.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #f1f5f9" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t.title}</div>
              </div>
              {severityBadge(t.severity)}
              <button style={{ ...STask.btnSmall, background: "#4f46e5", color: "#fff" }} onClick={() => onClaim(t.id)}>認領</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

const STask: Record<string, React.CSSProperties> = {
  btnSmall: { padding: "3px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer" },
};

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
