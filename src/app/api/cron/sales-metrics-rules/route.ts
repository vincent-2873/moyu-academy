import { getSupabaseAdmin } from "@/lib/supabase";
import { linePush } from "@/lib/line-notify";
import { generateCoachAdvice } from "@/lib/claude-coach";
import { NextRequest } from "next/server";

/*
 * 業務即時數據動態警報引擎
 *
 * 規則來源：sales_alert_rules 表（支援依 appointments_show 動態切換 KPI）
 *
 * Vincent 定義的 3 階規則：
 *   Tier 1 (出席=0): min 130 通 / 100 分 / 4 邀約 → critical
 *   Tier 2 (出席=1): min 100 通 / 100 分 / 3 邀約 → high
 *   Tier 3 (出席>=2): min 80 通 / 60 分 / 1 邀約 → medium
 *
 * schedule 建議：業務時段 09:00-22:00 台北，每小時 05 分跑一次
 *   "5 1-14 star star star" (UTC)
 *
 * 觸發後：
 *   - 寫 health_alerts 去重（同人同規則一天一次）
 *   - high/critical 會推 LINE（優先推給當事人 email）
 *   - 呼叫 generateCoachAdvice 產出具體動作建議
 */

function todayTaipei(): Date {
  const now = new Date();
  return new Date(now.getTime() + 8 * 3600 * 1000);
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface UserMetric {
  date: string;
  salesperson_id: string;
  brand: string;
  team: string | null;
  name: string | null;
  email: string | null;
  level: string | null;
  calls: number;
  connected: number;
  call_minutes: number;
  raw_appointments: number;
  appointments_show: number;
  raw_demos: number;
  closures: number;
  net_revenue_daily: number;
}

interface AlertRule {
  id: string;
  brand: string;
  level: string;
  name: string;
  cond_attend_min: number | null;
  cond_attend_max: number | null;
  min_calls: number | null;
  min_call_minutes: number | null;
  min_appointments: number | null;
  rec_calls: number | null;
  rec_call_minutes: number | null;
  rec_appointments: number | null;
  severity: string;
  enabled: boolean;
}

function findMatchingRule(
  rules: AlertRule[],
  user: UserMetric
): AlertRule | null {
  // 偏好順序：brand-specific + level-specific → brand + default → all + default
  const brand = user.brand;
  const level = user.level || "default";
  const candidates = rules
    .filter((r) => r.enabled)
    .filter((r) => r.brand === brand || r.brand === "all")
    .filter((r) => r.level === level || r.level === "default")
    .filter((r) => {
      const attend = user.appointments_show;
      if (r.cond_attend_min != null && attend < r.cond_attend_min) return false;
      if (r.cond_attend_max != null && attend > r.cond_attend_max) return false;
      return true;
    })
    // Sort: exact brand match > all, exact level match > default
    .sort((a, b) => {
      const aScore =
        (a.brand === brand ? 2 : 0) + (a.level === level ? 1 : 0);
      const bScore =
        (b.brand === brand ? 2 : 0) + (b.level === level ? 1 : 0);
      return bScore - aScore;
    });
  return candidates[0] || null;
}

type Shortfall = {
  metric: "calls" | "call_minutes" | "raw_appointments";
  actual: number;
  min: number;
  delta: number;
};

function evaluateShortfalls(user: UserMetric, rule: AlertRule): Shortfall[] {
  const out: Shortfall[] = [];
  if (rule.min_calls != null && user.calls < rule.min_calls) {
    out.push({
      metric: "calls",
      actual: user.calls,
      min: rule.min_calls,
      delta: rule.min_calls - user.calls,
    });
  }
  if (
    rule.min_call_minutes != null &&
    user.call_minutes < Number(rule.min_call_minutes)
  ) {
    out.push({
      metric: "call_minutes",
      actual: Math.round(user.call_minutes),
      min: Number(rule.min_call_minutes),
      delta: Math.round(Number(rule.min_call_minutes) - user.call_minutes),
    });
  }
  if (
    rule.min_appointments != null &&
    user.raw_appointments < rule.min_appointments
  ) {
    out.push({
      metric: "raw_appointments",
      actual: user.raw_appointments,
      min: rule.min_appointments,
      delta: rule.min_appointments - user.raw_appointments,
    });
  }
  return out;
}

function metricLabel(m: Shortfall["metric"]): string {
  return { calls: "通次", call_minutes: "通時(分)", raw_appointments: "邀約" }[m];
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    if (
      !req.headers.get("x-vercel-cron") &&
      !req.headers.get("x-zeabur-cron")
    ) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();
  const tw = todayTaipei();
  const hourTw = tw.getUTCHours(); // tw 已經是 +8
  const today = dateStr(tw);

  // 早於 10:00 或晚於 22:00 不跑 — 避免清晨大爆警報
  if (hourTw < 10 || hourTw >= 22) {
    return Response.json({
      ok: true,
      skipped: true,
      reason: `out of business hours (TW ${hourTw}:00)`,
    });
  }

  // Load rules + today's metrics
  const [{ data: rulesData }, { data: metricsData }] = await Promise.all([
    supabase.from("sales_alert_rules").select("*").eq("enabled", true),
    supabase.from("sales_metrics_daily").select("*").eq("date", today).not("is_monthly_rollup", "is", true),
  ]);

  const rules = (rulesData || []) as AlertRule[];
  const metrics = (metricsData || []) as UserMetric[];

  const fired: Array<{ user: string; rule: string; severity: string }> = [];
  const scanned = metrics.length;

  for (const u of metrics) {
    const rule = findMatchingRule(rules, u);
    if (!rule) continue;

    const shortfalls = evaluateShortfalls(u, rule);
    if (shortfalls.length === 0) continue;

    // Dedupe：同人同規則當日只觸發一次
    const userKey = u.email || u.salesperson_id;
    const { data: existing } = await supabase
      .from("health_alerts")
      .select("id")
      .eq("rule_id", `dynamic_${rule.id}`)
      .eq("user_email", userKey)
      .gte("created_at", today)
      .maybeSingle();
    if (existing) continue;

    // Claude coach 產具體動作建議
    const advice = await generateCoachAdvice({
      name: u.name || u.salesperson_id,
      brand: u.brand,
      team: u.team,
      level: u.level,
      rule: `dynamic_${rule.name}`,
      today: {
        calls: u.calls,
        connected: u.connected,
        call_minutes: u.call_minutes,
        raw_appointments: u.raw_appointments,
        appointments_show: u.appointments_show,
        raw_demos: u.raw_demos,
        closures: u.closures,
        net_revenue_daily: u.net_revenue_daily,
      },
      targetCalls: rule.min_calls || undefined,
      hoursLeftToday: Math.max(0, 22 - hourTw),
    });

    // 組 reason 字串
    const reason = shortfalls
      .map(
        (s) =>
          `${metricLabel(s.metric)} ${s.actual}/${s.min}（差 ${s.delta}）`
      )
      .join(" · ");

    // 寫 health_alerts
    await supabase.from("health_alerts").insert({
      rule_id: `dynamic_${rule.id}`,
      user_email: userKey,
      trigger_reason: `${rule.name}：${reason}`,
      intervention: advice.action,
      severity:
        rule.severity === "critical"
          ? "critical"
          : rule.severity === "high"
          ? "high"
          : "medium",
      message: `${advice.diagnosis}\n→ ${advice.action}`,
      metric_snapshot: {
        calls: u.calls,
        call_minutes: u.call_minutes,
        raw_appointments: u.raw_appointments,
        appointments_show: u.appointments_show,
        closures: u.closures,
        net_revenue_daily: u.net_revenue_daily,
        brand: u.brand,
        team: u.team,
        rule_name: rule.name,
        shortfalls,
      },
    });

    // LINE push（high / critical 才推）
    if (rule.severity === "critical" || rule.severity === "high") {
      await linePush({
        title: `🔥 ${u.name || u.salesperson_id}｜${rule.name}`,
        body: `${reason}\n\n${advice.diagnosis}\n\n→ ${advice.action}`,
        priority: rule.severity === "critical" ? "critical" : "high",
        userEmail: u.email || undefined,
        reason: `rule:${rule.name}`,
      });
    }

    fired.push({
      user: u.name || u.salesperson_id,
      rule: rule.name,
      severity: rule.severity,
    });
  }

  return Response.json({
    ok: true,
    date: today,
    hour_tw: hourTw,
    users_scanned: scanned,
    fired_count: fired.length,
    fired,
  });
}
