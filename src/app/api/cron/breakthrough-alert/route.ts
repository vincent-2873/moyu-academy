import { getSupabaseAdmin } from "@/lib/supabase";
import { linePush } from "@/lib/line-notify";

async function sendLineMessage(toUserId: string, text: string): Promise<void> {
  await linePush({ lineUserId: toUserId, body: text, priority: "high", reason: "alert" });
}
import { NextRequest } from "next/server";

/**
 * 突破引擎 — 連續 3 day KPI=0 警報
 * 每 2 hr 跑(配既有 cron schedule)
 *
 * 規則:
 *   業務員 user.role in [sales_rep, sales_rookie] AND 連 3 day calls=0
 *   → 推 LINE 給該業務員的 manager + 該業務員自己
 */

export const runtime = "nodejs";

function dateAgoTpe(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
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

  // 業務員 list
  const { data: salesUsers } = await supabase
    .from("users")
    .select("id, email, name, line_user_id, manager_email")
    .in("role", ["sales_rep", "sales_rookie"])
    .eq("status", "active");

  const alerts: Array<{ user: string; email: string; pushed: boolean }> = [];

  for (const u of salesUsers || []) {
    // 撈過去 3 day KPI
    const fromDate = dateAgoTpe(3);
    const { data: kpis } = await supabase
      .from("kpi_entries")
      .select("date, calls, valid_calls, appointments, closures")
      .eq("user_id", u.id)
      .gte("date", fromDate)
      .order("date", { ascending: false });

    const last3 = kpis || [];
    if (last3.length < 3) continue; // 入職不到 3 day,skip

    const allZero = last3.every((k) => (k.calls || 0) === 0 && (k.appointments || 0) === 0);
    if (!allZero) continue;

    // 推 LINE 給業務員
    const msg = `🚨 突破引擎警報\n你連續 3 天 KPI = 0(電話 0, 約見 0)\n今天必須出單。需要協助 reply 1`;
    let pushed = false;
    if (u.line_user_id) {
      await sendLineMessage(u.line_user_id, msg).catch(() => null);
      pushed = true;
    }

    // 推 LINE 給 manager
    if (u.manager_email) {
      const { data: mgr } = await supabase.from("users").select("line_user_id").eq("email", u.manager_email).maybeSingle();
      if (mgr?.line_user_id) {
        await sendLineMessage(mgr.line_user_id, `📊 ${u.name || u.email} 連 3 day KPI=0,需要關注`).catch(() => null);
      }
    } else if (adminLineId) {
      await sendLineMessage(adminLineId, `📊 ${u.name || u.email}(無 manager)連 3 day KPI=0`).catch(() => null);
    }

    // 寫 breakthrough_log
    await supabase.from("breakthrough_log").insert({
      user_email: u.email,
      severity: "high",
      message: msg,
      acknowledged: false,
    });

    alerts.push({ user: u.name || u.email, email: u.email, pushed });
  }

  return Response.json({ ok: true, duration_ms: Date.now() - started, total_sales: salesUsers?.length || 0, alerts });
}
