import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * 統一儀表板 — 業務 + 招聘 + 法務 + 104 + 電話 一次給完
 * 快速、聚合、帶 alerts
 */
export async function GET() {
  const s = getSupabaseAdmin();
  const today = new Date();
  const tpToday = new Date(today.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const dayStart = tpToday + "T00:00:00Z";
  const weekAgoIso = new Date(today.getTime() - 7 * 24 * 3600 * 1000).toISOString();
  const in30 = new Date(today.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [
    recruits, outreach, phone, commands,
    contracts, compliance, disputes, users,
  ] = await Promise.all([
    s.from("recruits").select("id, stage, created_at").gte("created_at", weekAgoIso),
    s.from("outreach_log").select("id, account, sent_at, reply_status").gte("sent_at", weekAgoIso),
    s.from("phone_call_log").select("extension, agent_name, duration_seconds, status, start_time").gte("start_time", dayStart),
    s.from("v3_commands").select("id, status, severity, pillar_id, created_at").gte("created_at", dayStart),
    s.from("legal_contracts").select("id, status, effective_to, title"),
    s.from("legal_compliance").select("id, task_name, next_due_at, status"),
    s.from("legal_disputes").select("id, title, status, severity"),
    s.from("users").select("email, role, status").eq("status", "active"),
  ]);

  // 招聘 funnel
  const recList = recruits.data || [];
  const funnel = {
    new: recList.filter((r) => r.stage === "new" || r.stage === "applied").length,
    contacted: recList.filter((r) => ["contacted", "screening"].includes(r.stage)).length,
    interview: recList.filter((r) => ["interview_1", "interview_2"].includes(r.stage)).length,
    offer: recList.filter((r) => r.stage === "offer").length,
    onboarded: recList.filter((r) => ["onboarded", "probation", "passed"].includes(r.stage)).length,
    rejected: recList.filter((r) => ["rejected", "dropped"].includes(r.stage)).length,
  };

  // 104 狀態
  const outr = outreach.data || [];
  const sentToday = outr.filter((o) => o.sent_at?.startsWith(tpToday));
  const repliesToday = outr.filter((o) => o.reply_status && o.sent_at?.startsWith(tpToday));
  const sent104 = {
    mofan: sentToday.filter((o) => o.account === "mofan").length,
    ruifu: sentToday.filter((o) => o.account === "ruifu").length,
  };
  const replies = outr.reduce((acc, o) => {
    if (!o.reply_status) return acc;
    acc[o.reply_status] = (acc[o.reply_status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // 電話
  const phoneList = phone.data || [];
  const phoneByExt: Record<string, { agent: string; calls: number; answered: number; totalMin: number }> = {};
  for (const p of phoneList) {
    const k = p.extension;
    if (!phoneByExt[k]) phoneByExt[k] = { agent: p.agent_name || "—", calls: 0, answered: 0, totalMin: 0 };
    phoneByExt[k].calls++;
    if (p.status === "answered") phoneByExt[k].answered++;
    phoneByExt[k].totalMin += Math.round((p.duration_seconds || 0) / 60);
  }

  // 命令
  const cmds = commands.data || [];
  const cmdStats = {
    total: cmds.length,
    pending: cmds.filter((c) => c.status === "pending").length,
    done: cmds.filter((c) => c.status === "done").length,
    critical: cmds.filter((c) => c.severity === "critical" && c.status === "pending").length,
    byPillar: cmds.reduce((acc, c) => {
      const k = c.pillar_id || "other";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  // 法務
  const ct = contracts.data || [];
  const cp = compliance.data || [];
  const dp = disputes.data || [];
  const legalStats = {
    contractsTotal: ct.length,
    contractsExpired: ct.filter((c) => c.effective_to && c.effective_to < tpToday).length,
    contractsExpiring: ct.filter((c) => c.effective_to && c.effective_to >= tpToday && c.effective_to <= in30).length,
    complianceOverdue: cp.filter((c) => c.next_due_at && c.next_due_at < tpToday && c.status !== "done").length,
    complianceUpcoming: cp.filter((c) => c.next_due_at && c.next_due_at >= tpToday && c.next_due_at <= in30 && c.status !== "done").length,
    disputesCritical: dp.filter((d) => d.severity === "critical" && d.status !== "closed").length,
    disputesOpen: dp.filter((d) => d.status !== "closed").length,
  };

  // 統一警報
  const alerts: { level: "critical" | "high" | "normal"; pillar: string; text: string; link?: string }[] = [];
  if (cmdStats.critical > 0) alerts.push({ level: "critical", pillar: "all", text: `🔴 ${cmdStats.critical} 件緊急命令待處理` });
  if (legalStats.complianceOverdue > 0) alerts.push({ level: "critical", pillar: "legal", text: `📋 ${legalStats.complianceOverdue} 件法遵申報已逾期`, link: "/legal" });
  if (legalStats.disputesCritical > 0) alerts.push({ level: "critical", pillar: "legal", text: `⚠️ ${legalStats.disputesCritical} 件重大糾紛進行中`, link: "/legal" });
  if (legalStats.contractsExpired > 0) alerts.push({ level: "high", pillar: "legal", text: `📄 ${legalStats.contractsExpired} 份合約已過期`, link: "/legal" });
  if (legalStats.contractsExpiring > 0) alerts.push({ level: "normal", pillar: "legal", text: `📄 ${legalStats.contractsExpiring} 份合約 30 天內到期`, link: "/legal" });
  if (sent104.mofan < 100 && new Date().getUTCHours() >= 1) alerts.push({ level: "normal", pillar: "recruit", text: `📤 墨凡今日發信 ${sent104.mofan}/200（預期 07-09 完成）` });

  return Response.json({
    ok: true,
    date: tpToday,
    recruit: {
      funnel,
      outreach7d: outr.length,
      sent104Today: sent104,
      repliesTotals: replies,
      repliesToday: repliesToday.length,
    },
    phone: {
      totalToday: phoneList.length,
      byExtension: phoneByExt,
    },
    commands: cmdStats,
    legal: legalStats,
    people: { active: (users.data || []).length },
    alerts,
  });
}
