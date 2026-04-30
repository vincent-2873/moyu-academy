import { getSupabaseAdmin } from "@/lib/supabase";
import { linePush } from "@/lib/line-notify";

async function sendLineMessage(toUserId: string, text: string): Promise<void> {
  await linePush({ lineUserId: toUserId, body: text, priority: "high", reason: "alert" });
}
import { NextRequest } from "next/server";

/**
 * 法務 deadline 預警
 * 每日 9am 跑(配 cron 0 1 * * *)— 但獨立 schedule 跑不衝突
 *
 * 規則:
 *   contract.effective_to < now + 30day → 推 LINE 給 owner
 *   compliance.next_due_at < now + 7day → 推 LINE 升級 Vincent
 *   過期未處理 disputes(severity=critical, opened_at > 30day) → 升級 Vincent
 */

export const runtime = "nodejs";

function tpDaysAhead(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    if (!req.headers.get("x-zeabur-cron")) return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const adminLineId = process.env.LINE_ADMIN_USER_ID;
  const started = Date.now();

  const alerts: Array<{ type: string; what: string; severity: string; pushed: boolean }> = [];

  // 1. 合約 30 day 到期
  const { data: contracts } = await supabase
    .from("legal_contracts")
    .select("id, title, effective_to, owner_email, counterparty")
    .lt("effective_to", tpDaysAhead(30))
    .gt("effective_to", new Date().toISOString());
  for (const c of contracts || []) {
    const days = Math.round((new Date(c.effective_to).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    const msg = `⚖️ 合約 ${days} 天到期\n${c.title || "(無 title)"}\n對方:${c.counterparty || "?"}\nowner:${c.owner_email || "?"}`;
    let pushed = false;
    if (c.owner_email) {
      const { data: owner } = await supabase.from("users").select("line_user_id").eq("email", c.owner_email).maybeSingle();
      if (owner?.line_user_id) { await sendLineMessage(owner.line_user_id, msg).catch(() => null); pushed = true; }
    }
    if (!pushed && adminLineId) { await sendLineMessage(adminLineId, msg).catch(() => null); pushed = true; }
    alerts.push({ type: "contract_expiry", what: c.title || c.id, severity: "high", pushed });
  }

  // 2. 合規 7 day 到期 → 升級 Vincent
  const { data: compliance } = await supabase
    .from("legal_compliance")
    .select("id, task_name, next_due_at, owner_email")
    .lt("next_due_at", tpDaysAhead(7))
    .gt("next_due_at", new Date().toISOString());
  for (const c of compliance || []) {
    const days = Math.round((new Date(c.next_due_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    const msg = `⚖️🚨 合規任務 ${days} 天到期(已升級)\n${c.task_name || "(無)"}\nowner:${c.owner_email || "?"}`;
    if (adminLineId) await sendLineMessage(adminLineId, msg).catch(() => null);
    alerts.push({ type: "compliance_due", what: c.task_name || c.id, severity: "critical", pushed: !!adminLineId });
  }

  // 3. 過期 critical disputes
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: disputes } = await supabase
    .from("legal_disputes")
    .select("id, title, severity, opened_at, status")
    .eq("severity", "critical")
    .lt("opened_at", thirtyDaysAgo)
    .neq("status", "closed");
  for (const d of disputes || []) {
    const msg = `⚖️🔴 critical 爭議超 30 天未結案\n${d.title || "(無)"}`;
    if (adminLineId) await sendLineMessage(adminLineId, msg).catch(() => null);
    alerts.push({ type: "dispute_overdue", what: d.title || d.id, severity: "critical", pushed: !!adminLineId });
  }

  return Response.json({
    ok: true,
    duration_ms: Date.now() - started,
    counts: {
      contracts_expiring: contracts?.length || 0,
      compliance_due: compliance?.length || 0,
      disputes_overdue: disputes?.length || 0,
    },
    alerts,
  });
}
