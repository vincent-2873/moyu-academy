"use client";

import { useState, useEffect, useCallback } from "react";
import MobileNav from "@/components/MobileNav";
import DeadlineCountdown, { type DeadlineItem } from "@/components/legal/DeadlineCountdown";

interface Contract { id: string; contract_no: string | null; title: string; party_b: string; contract_type: string | null; status: string; effective_from: string | null; effective_to: string | null; amount: number | null; owner_email: string | null; }
interface Compliance { id: string; task_name: string; category: string | null; authority: string | null; due_date: string; next_due_at: string | null; status: string; frequency: string | null; }
interface Dispute { id: string; title: string; counterparty: string | null; status: string; severity: string; opened_at: string | null; next_action_date: string | null; next_action: string | null; amount_at_risk: number | null; }
interface IP { id: string; name: string; ip_type: string | null; reg_no: string | null; status: string | null; renew_due_at: string | null; }
interface Alert { type: string; severity: string; title: string; due: string | null; }

interface LegalData {
  ok: boolean;
  summary: {
    contracts: { total: number; active: number; expiring: number; expired: number };
    compliance: { total: number; upcoming: number; overdue: number };
    disputes: { total: number; open: number };
    ip: { total: number };
  };
  contracts: Contract[];
  compliance: Compliance[];
  disputes: Dispute[];
  ip: IP[];
  alerts: Alert[];
}

export default function LegalPage() {
  const [email, setEmail] = useState("");
  const [data, setData] = useState<LegalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "contracts" | "compliance" | "disputes" | "ip">("overview");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const e = sessionStorage.getItem("moyu_current_user");
    if (e) setEmail(e);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/legal", { cache: "no-store" });
      const d = await r.json();
      if (d.ok) setData(d);
    } catch {/*ignore*/}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <div style={{ padding: 40, color: "#94a3b8", textAlign: "center" }}>載入中...</div>;
  if (!data) return <div style={{ padding: 40, color: "#dc2626", textAlign: "center" }}>載入失敗</div>;

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <style>{`
        @media (max-width: 768px) {
          .legal-header { flex-wrap: wrap !important; }
          .legal-main { padding-bottom: 80px !important; }
          .legal-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
      {/* Header */}
      <div className="legal-header" style={S.header}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>⚖️ 法務中心</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{email || "請先登入"}</div>
        </div>
        <div style={{ flex: 1 }} />
        {data.alerts.filter((a) => a.severity === "critical").length > 0 && (
          <div style={{ ...S.badge, background: "#dc2626" }}>
            🚨 {data.alerts.filter((a) => a.severity === "critical").length} 件緊急
          </div>
        )}
        <a href="/legal/cases" style={{ ...S.linkBtn, background: "#4f46e5", color: "#fff", fontWeight: 700 }}>⚖️ 案件管理</a>
        <a href="/today" style={S.linkBtn}>📋 今日待辦</a>
        <a href="/account/password" style={S.linkBtn}>🔑 改密碼</a>
        <button onClick={() => { sessionStorage.clear(); window.location.href = "/"; }} style={S.logoutBtn}>登出</button>
      </div>

      <div className="legal-main" style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 14px" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18, overflowX: "auto" }}>
          {[
            { id: "overview", label: "📊 總覽" },
            { id: "contracts", label: `📄 合約 (${data.summary.contracts.total})` },
            { id: "compliance", label: `📋 法遵申報 (${data.summary.compliance.total})` },
            { id: "disputes", label: `⚠️ 糾紛 (${data.summary.disputes.open})` },
            { id: "ip", label: `™️ 智財 (${data.summary.ip.total})` },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as never)} style={{
              padding: "8px 14px", borderRadius: 10, border: "none",
              background: tab === t.id ? "#0f172a" : "#fff",
              color: tab === t.id ? "#fff" : "#475569",
              fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
              boxShadow: tab === t.id ? "0 4px 12px rgba(15,23,42,0.2)" : "0 1px 3px rgba(0,0,0,0.05)",
            }}>{t.label}</button>
          ))}
        </div>

        {/* 總覽 */}
        {tab === "overview" && (
          <div>
            {/* 4 大指標 */}
            <div className="legal-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 18 }}>
              <Stat label="進行中合約" value={data.summary.contracts.active} sub={`${data.summary.contracts.expiring} 件 30 天內到期`} color="#3b82f6" />
              <Stat label="法遵申報待辦" value={data.summary.compliance.upcoming} sub={data.summary.compliance.overdue > 0 ? `🔴 ${data.summary.compliance.overdue} 件已逾期` : "無逾期"} color={data.summary.compliance.overdue > 0 ? "#dc2626" : "#16a34a"} />
              <Stat label="進行中糾紛" value={data.summary.disputes.open} sub={`共 ${data.summary.disputes.total} 件`} color="#f59e0b" />
              <Stat label="智財權項目" value={data.summary.ip.total} sub="商標 / 專利 / 著作權" color="#7c3aed" />
            </div>

            {/* 2026-04-30 末段 G1:Deadline countdown widget */}
            <DeadlineCountdown
              todayStr={todayStr}
              items={buildDeadlineItems(data, todayStr)}
            />

            {/* 警報 */}
            {data.alerts.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 16, border: "1px solid #fecaca" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#dc2626", marginBottom: 10 }}>🚨 警報 ({data.alerts.length})</div>
                {data.alerts.map((a, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i > 0 ? "1px solid #fee2e2" : "none" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: "#fff",
                      background: a.severity === "critical" ? "#dc2626" : a.severity === "high" ? "#f59e0b" : "#3b82f6",
                      padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap",
                    }}>{a.severity}</span>
                    <span style={{ fontSize: 13, color: "#0f172a", flex: 1 }}>{a.title}</span>
                    {a.due && <span style={{ fontSize: 12, color: a.due < todayStr ? "#dc2626" : "#64748b" }}>{a.due}</span>}
                  </div>
                ))}
              </div>
            )}

            <div style={{ background: "#f0fdf4", borderRadius: 12, padding: 14, fontSize: 13, color: "#16a34a", border: "1px solid #bbf7d0" }}>
              💡 <strong>下一步建議：</strong>
              {data.summary.compliance.overdue > 0 && <span> 立即處理 {data.summary.compliance.overdue} 件逾期申報；</span>}
              {data.summary.contracts.expiring > 0 && <span> 安排 {data.summary.contracts.expiring} 件即將到期合約的續約；</span>}
              {data.summary.disputes.open > 0 && <span> 跟進 {data.summary.disputes.open} 件糾紛進度。</span>}
              {data.alerts.length === 0 && <span> 目前無緊急任務，可進行例行性合約 review。</span>}
            </div>
          </div>
        )}

        {/* 合約 */}
        {tab === "contracts" && (
          <Table headers={["編號", "標題", "對方", "類型", "生效", "到期", "狀態"]}
            rows={data.contracts.map((c) => [
              c.contract_no || "—",
              c.title,
              c.party_b,
              c.contract_type || "—",
              c.effective_from || "—",
              <ExpireBadge key={c.id} date={c.effective_to} />,
              <StatusBadge key={c.id + "s"} status={c.status} />,
            ])} />
        )}

        {/* 法遵 */}
        {tab === "compliance" && (
          <Table headers={["申報項目", "類別", "主管機關", "下次到期", "頻率", "狀態"]}
            rows={data.compliance.map((c) => [
              c.task_name,
              c.category || "—",
              c.authority || "—",
              <ExpireBadge key={c.id} date={c.next_due_at} />,
              c.frequency || "—",
              <StatusBadge key={c.id + "s"} status={c.status} />,
            ])} />
        )}

        {/* 糾紛 */}
        {tab === "disputes" && (
          data.disputes.length === 0 ? <Empty msg="目前沒有糾紛紀錄" />
          : <Table headers={["案件", "對方", "嚴重度", "狀態", "下一動作", "下次動作日"]}
              rows={data.disputes.map((d) => [
                d.title, d.counterparty || "—",
                <span key={d.id} style={{ color: d.severity === "critical" ? "#dc2626" : "#475569", fontWeight: 700 }}>{d.severity}</span>,
                <StatusBadge key={d.id + "s"} status={d.status} />,
                d.next_action || "—", d.next_action_date || "—",
              ])} />
        )}

        {/* 智財 */}
        {tab === "ip" && (
          data.ip.length === 0 ? <Empty msg="尚未登錄智財項目" />
          : <Table headers={["名稱", "類型", "註冊號", "狀態", "續約到期"]}
              rows={data.ip.map((i) => [i.name, i.ip_type || "—", i.reg_no || "—", i.status || "—", <ExpireBadge key={i.id} date={i.renew_due_at} />])} />
        )}

        <div style={{ textAlign: "center", padding: "30px 0 50px", fontSize: 11, color: "#cbd5e1" }}>
          ⚖️ 墨宇法務中心 · 集團合約・法遵・糾紛・智財一站式
        </div>
      </div>
      <MobileNav />
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    active: { bg: "#dcfce7", fg: "#16a34a", label: "進行中" },
    pending: { bg: "#fef3c7", fg: "#92400e", label: "待處理" },
    done: { bg: "#dbeafe", fg: "#1d4ed8", label: "已完成" },
    open: { bg: "#fef3c7", fg: "#92400e", label: "進行中" },
    closed: { bg: "#f1f5f9", fg: "#64748b", label: "結案" },
    draft: { bg: "#f1f5f9", fg: "#64748b", label: "草稿" },
    expired: { bg: "#fef2f2", fg: "#dc2626", label: "已過期" },
  };
  const m = map[status] || { bg: "#f1f5f9", fg: "#64748b", label: status };
  return <span style={{ fontSize: 11, fontWeight: 700, color: m.fg, background: m.bg, padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>{m.label}</span>;
}

function ExpireBadge({ date }: { date: string | null }) {
  if (!date) return <span style={{ color: "#94a3b8" }}>—</span>;
  const today = new Date().toISOString().slice(0, 10);
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 3600 * 24));
  let color = "#475569";
  if (date < today) color = "#dc2626";
  else if (days <= 30) color = "#f59e0b";
  return <span style={{ color, fontWeight: 600, fontSize: 12 }}>{date} {days < 0 ? `(過期 ${-days} 天)` : days <= 30 ? `(${days} 天)` : ""}</span>;
}

// 2026-04-30 末段 G1:把 contracts/compliance/disputes 拼成 deadline list
function buildDeadlineItems(d: LegalData, today: string): DeadlineItem[] {
  const items: DeadlineItem[] = [];
  const dayMs = 86400000;
  const todayMs = new Date(today + "T00:00:00").getTime();

  for (const c of d.contracts) {
    if (!c.effective_to) continue;
    const due = c.effective_to;
    const days = Math.ceil((new Date(due + "T00:00:00").getTime() - todayMs) / dayMs);
    if (days <= 30) items.push({
      type: "contract",
      title: c.title,
      due_date: due,
      days_left: days,
      detail: c.party_b,
      link: "/legal#contracts",
    });
  }
  for (const cp of d.compliance) {
    const due = cp.next_due_at || cp.due_date;
    if (!due || cp.status === "done") continue;
    const dueStr = due.slice(0, 10);
    const days = Math.ceil((new Date(dueStr + "T00:00:00").getTime() - todayMs) / dayMs);
    if (days <= 30) items.push({
      type: "compliance",
      title: cp.task_name,
      due_date: dueStr,
      days_left: days,
      detail: cp.authority || undefined,
      link: "/legal#compliance",
    });
  }
  for (const dp of d.disputes) {
    if (!dp.next_action_date) continue;
    const dueStr = dp.next_action_date.slice(0, 10);
    const days = Math.ceil((new Date(dueStr + "T00:00:00").getTime() - todayMs) / dayMs);
    if (days <= 30) items.push({
      type: "dispute",
      title: dp.title,
      due_date: dueStr,
      days_left: days,
      detail: dp.next_action || undefined,
      link: "/legal#disputes",
    });
  }
  return items;
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13, border: "1px solid #e2e8f0" }}>{msg}</div>;
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #e2e8f0", overflowX: "auto" }}>
      <table style={{ width: "100%", fontSize: 13 }}>
        <thead>
          <tr style={{ color: "#64748b", textAlign: "left" }}>
            {headers.map((h, i) => <th key={i} style={{ padding: "8px 10px", fontSize: 12, fontWeight: 600 }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
              {row.map((cell, j) => <td key={j} style={{ padding: "10px" }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>沒有資料</div>}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  header: { background: "#0f172a", padding: "12px 16px", color: "#fff", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 10 },
  badge: { fontSize: 11, fontWeight: 700, color: "#fff", background: "#4f46e5", padding: "4px 10px", borderRadius: 8 },
  linkBtn: { padding: "4px 10px", borderRadius: 6, fontSize: 11, color: "#cbd5e1", textDecoration: "none", border: "1px solid rgba(255,255,255,0.15)" },
  logoutBtn: { padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#94a3b8", fontSize: 11, cursor: "pointer" },
};
