import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/legal
 * 法務支柱整合資料 — 合約 / 法遵 / 糾紛 / 智財
 */
export async function GET() {
  const s = getSupabaseAdmin();

  const today = new Date();
  const in30 = new Date(today.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [contractsRes, complianceRes, disputesRes, ipRes] = await Promise.all([
    s.from("legal_contracts").select("*").order("effective_to", { ascending: true }).limit(100),
    s.from("legal_compliance").select("*").order("next_due_at", { ascending: true }).limit(100),
    s.from("legal_disputes").select("*").order("opened_at", { ascending: false }).limit(50),
    s.from("legal_ip").select("*").order("renew_due_at", { ascending: true }).limit(50),
  ]);

  const contracts = contractsRes.data || [];
  const compliance = complianceRes.data || [];
  const disputes = disputesRes.data || [];
  const ip = ipRes.data || [];

  // 分類：30 天內到期、過期、進行中
  const expiringContracts = contracts.filter((c) => c.effective_to && c.effective_to <= in30 && c.effective_to >= todayStr);
  const expiredContracts = contracts.filter((c) => c.effective_to && c.effective_to < todayStr);
  const activeContracts = contracts.filter((c) => c.status === "active");

  const upcomingCompliance = compliance.filter((c) => c.next_due_at && c.next_due_at <= in30 && c.status !== "done");
  const overdueCompliance = compliance.filter((c) => c.next_due_at && c.next_due_at < todayStr && c.status !== "done");

  const openDisputes = disputes.filter((d) => d.status !== "closed");

  return Response.json({
    ok: true,
    summary: {
      contracts: { total: contracts.length, active: activeContracts.length, expiring: expiringContracts.length, expired: expiredContracts.length },
      compliance: { total: compliance.length, upcoming: upcomingCompliance.length, overdue: overdueCompliance.length },
      disputes: { total: disputes.length, open: openDisputes.length },
      ip: { total: ip.length },
    },
    contracts,
    compliance,
    disputes,
    ip,
    alerts: [
      ...overdueCompliance.map((c) => ({ type: "overdue_compliance", severity: "critical", title: c.task_name, due: c.next_due_at })),
      ...expiredContracts.map((c) => ({ type: "expired_contract", severity: "high", title: c.title, due: c.effective_to })),
      ...expiringContracts.map((c) => ({ type: "expiring_contract", severity: "normal", title: c.title, due: c.effective_to })),
      ...openDisputes.filter((d) => d.severity === "critical").map((d) => ({ type: "dispute", severity: "critical", title: d.title, due: d.next_action_date })),
    ],
  });
}
