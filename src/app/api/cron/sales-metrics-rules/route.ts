import { getSupabaseAdmin } from "@/lib/supabase";
import { linePush } from "@/lib/line-notify";
import { generateCoachAdvice } from "@/lib/claude-coach";
import { NextRequest } from "next/server";

/*
 * 業務即時數據警報規則引擎
 *
 * 吃 sales_metrics_daily 的即時資料，依日/週/月規則判定 → 觸發
 * 違反人性通知。會跑 Claude coach 針對每個警報生成具體動作。
 *
 * schedule 建議：業務時段 09:00-22:00 台北，每小時整點跑一次
 *   "0 1-14 star star star"  (UTC)
 *
 * 規則（全部都帶時間限定，避免清晨就警報清晨的掛蛋）：
 *
 * 日：
 *   daily_silent_0       : 通次=0 且 TW時間 >= 10:00 → critical
 *   daily_low_calls      : 通次 < 日標 × (已過工時/8) × 0.8 且 >= 12:00 → high
 *   daily_no_appointment : 通次 >= 50 但 邀約=0 且 >= 15:00 → medium
 *
 * 週：(週一/三/五 10:00 跑)
 *   weekly_behind        : 本週累計 < 週標 × (已過天/5) × 0.8 → high
 *   weekly_zero_revenue  : 本週業績=0 且已過週三 → hard
 *
 * 月：(每日 10:00 跑)
 *   monthly_behind_mid   : 月中(15日)業績 < 50% → medium
 *   monthly_behind_late  : 月末倒數 5 天 業績 < 80% → critical
 *   monthly_final_push   : 最後 1 天 < 100% → critical 爆推
 */

function todayTaipei(): Date {
  const now = new Date();
  return new Date(now.getTime() + 8 * 3600 * 1000);
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekStart(d: Date): Date {
  const r = new Date(d);
  const day = r.getUTCDay(); // 0=Sun
  const monDelta = day === 0 ? -6 : 1 - day;
  r.setUTCDate(r.getUTCDate() + monDelta);
  return r;
}

function monthStart(d: Date): Date {
  const r = new Date(d);
  r.setUTCDate(1);
  return r;
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

interface TargetMap {
  [key: string]: number; // key = `${brand}|${level}|${period}|${metric}`
}

async function loadTargets(): Promise<TargetMap> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("sales_metrics_targets")
    .select("brand, level, period, metric, target");
  const map: TargetMap = {};
  for (const t of data || []) {
    map[`${t.brand}|${t.level}|${t.period}|${t.metric}`] = Number(t.target);
  }
  return map;
}

function getTarget(
  targets: TargetMap,
  brand: string,
  level: string | null,
  period: string,
  metric: string
): number | null {
  const l = level || "default";
  return (
    targets[`${brand}|${l}|${period}|${metric}`] ??
    targets[`${brand}|default|${period}|${metric}`] ??
    null
  );
}

async function fireAlert(opts: {
  rule: string;
  user: UserMetric;
  severity: "soft" | "medium" | "high" | "hard" | "critical";
  reason: string;
  advice: { diagnosis: string; action: string };
}): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const today = dateStr(todayTaipei());

  // Dedupe：同人同規則今天一次
  const { data: existing } = await supabase
    .from("health_alerts")
    .select("id")
    .eq("rule_id", opts.rule)
    .eq("user_email", opts.user.email || opts.user.salesperson_id)
    .gte("created_at", today)
    .maybeSingle();
  if (existing) return false;

  await supabase.from("health_alerts").insert({
    rule_id: opts.rule,
    user_email: opts.user.email || opts.user.salesperson_id,
    trigger_reason: opts.reason,
    intervention: opts.advice.action,
    severity: opts.severity === "soft" ? "info" : opts.severity === "critical" ? "critical" : opts.severity === "hard" ? "high" : opts.severity,
    message: `${opts.advice.diagnosis}\n→ ${opts.advice.action}`,
    metric_snapshot: {
      calls: opts.user.calls,
      connected: opts.user.connected,
      raw_appointments: opts.user.raw_appointments,
      closures: opts.user.closures,
      net_revenue_daily: opts.user.net_revenue_daily,
      brand: opts.user.brand,
      team: opts.user.team,
    },
  });

  // LINE push，優先推給當事人，推不到就給 admin
  if (opts.severity === "high" || opts.severity === "hard" || opts.severity === "critical") {
    await linePush({
      title: `🔥 ${opts.user.name || opts.user.salesperson_id}｜${opts.reason}`,
      body: `${opts.advice.diagnosis}\n\n→ ${opts.advice.action}`,
      priority: opts.severity === "critical" ? "critical" : "high",
      userEmail: opts.user.email || undefined,
      reason: `rule:${opts.rule}`,
    });
  }
  return true;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    if (!req.headers.get("x-vercel-cron") && !req.headers.get("x-zeabur-cron")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();
  const tw = todayTaipei();
  const hourTw = tw.getUTCHours(); // 因為 tw 已經是 +8，.getUTCHours 就是台北小時
  const today = dateStr(tw);
  const weekStartDate = dateStr(weekStart(tw));
  const monthStartDate = dateStr(monthStart(tw));

  const targets = await loadTargets();

  // Load today's metrics
  const { data: todayRows } = await supabase
    .from("sales_metrics_daily")
    .select("*")
    .eq("date", today);

  const todayMetrics = (todayRows || []) as UserMetric[];

  // Load week-to-date
  const { data: weekRows } = await supabase
    .from("sales_metrics_daily")
    .select("*")
    .gte("date", weekStartDate)
    .lte("date", today);

  // Roll up week to per-salesperson
  const weekAgg = new Map<string, { calls: number; closures: number; net_revenue_daily: number }>();
  for (const r of (weekRows || []) as UserMetric[]) {
    const e = weekAgg.get(r.salesperson_id) || { calls: 0, closures: 0, net_revenue_daily: 0 };
    e.calls += r.calls;
    e.closures += r.closures;
    e.net_revenue_daily += Number(r.net_revenue_daily);
    weekAgg.set(r.salesperson_id, e);
  }

  const fired: Array<{ rule: string; user: string; severity: string }> = [];

  for (const u of todayMetrics) {
    const brand = u.brand;
    const level = u.level;

    // ── daily_silent_0：10:00 後 0 通 ──
    if (hourTw >= 10 && u.calls === 0) {
      const advice = await generateCoachAdvice({
        name: u.name || u.salesperson_id,
        brand,
        team: u.team,
        level,
        rule: "daily_silent_0",
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
        hoursLeftToday: Math.max(0, 22 - hourTw),
      });
      const ok = await fireAlert({
        rule: "daily_silent_0",
        user: u,
        severity: "critical",
        reason: `${u.name} 上班 ${hourTw - 9} 小時還沒撥第一通`,
        advice,
      });
      if (ok) fired.push({ rule: "daily_silent_0", user: u.name || u.salesperson_id, severity: "critical" });
    }

    // ── daily_low_calls：12:00 後通次 < 日標 × 進度 × 0.8 ──
    if (hourTw >= 12 && u.calls > 0) {
      const target = getTarget(targets, brand, level, "daily", "calls");
      if (target) {
        const workedHours = Math.max(1, hourTw - 9); // 假設 9:00 上班
        const expectedProgress = Math.min(1, workedHours / 8);
        const threshold = target * expectedProgress * 0.8;
        if (u.calls < threshold) {
          const advice = await generateCoachAdvice({
            name: u.name || u.salesperson_id,
            brand,
            team: u.team,
            level,
            rule: "daily_low_calls",
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
            targetCalls: target,
            hoursLeftToday: Math.max(0, 22 - hourTw),
          });
          const ok = await fireAlert({
            rule: "daily_low_calls",
            user: u,
            severity: "high",
            reason: `${u.name} 通次 ${u.calls} / 預期 ${Math.round(threshold)}`,
            advice,
          });
          if (ok) fired.push({ rule: "daily_low_calls", user: u.name || u.salesperson_id, severity: "high" });
        }
      }
    }

    // ── daily_no_appointment：15:00 後打了 >=50 通但 0 邀約 ──
    if (hourTw >= 15 && u.calls >= 50 && u.raw_appointments === 0) {
      const advice = await generateCoachAdvice({
        name: u.name || u.salesperson_id,
        brand,
        team: u.team,
        level,
        rule: "daily_no_appointment",
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
      });
      const ok = await fireAlert({
        rule: "daily_no_appointment",
        user: u,
        severity: "medium",
        reason: `${u.name} 打了 ${u.calls} 通但 0 邀約`,
        advice,
      });
      if (ok) fired.push({ rule: "daily_no_appointment", user: u.name || u.salesperson_id, severity: "medium" });
    }

    // ── weekly_zero_revenue：週三後本週業績 = 0 ──
    const dayOfWeek = tw.getUTCDay(); // 0=Sun, 3=Wed
    if ((dayOfWeek >= 3 || dayOfWeek === 0) && hourTw >= 10) {
      const wk = weekAgg.get(u.salesperson_id);
      if (wk && wk.net_revenue_daily === 0 && wk.calls > 100) {
        const advice = await generateCoachAdvice({
          name: u.name || u.salesperson_id,
          brand,
          team: u.team,
          level,
          rule: "weekly_zero_revenue",
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
        });
        const ok = await fireAlert({
          rule: "weekly_zero_revenue",
          user: u,
          severity: "hard",
          reason: `${u.name} 本週累計 ${wk.calls} 通但業績 0`,
          advice,
        });
        if (ok) fired.push({ rule: "weekly_zero_revenue", user: u.name || u.salesperson_id, severity: "hard" });
      }
    }
  }

  return Response.json({
    ok: true,
    date: today,
    hour_tw: hourTw,
    fired_count: fired.length,
    fired,
    users_scanned: todayMetrics.length,
  });
}
