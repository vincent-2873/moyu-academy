import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 個人業務數據 API（員工自己看自己）
 *
 * GET /api/me/sales-metrics?email=<email>
 *
 * 讀取 sales_metrics_daily 中該 email 本月範圍的所有紀錄，
 * 回傳 today / week / month 3 個 bucket + daily trend。
 *
 * Returns:
 *   {
 *     ok: true,
 *     email,
 *     bound: boolean,          // 是否有對應 sales 資料
 *     profile: { name, team, org, brand, level },  // 最新一筆拿 meta
 *     today: { calls, ..., net_revenue_daily },
 *     week:  { ... },
 *     month: { ... },
 *     dailyTrend: [ { date, calls, closures, net_revenue_daily }, ... ]
 *     // 跟規則引擎對照的目標
 *     rule?: { name, cond_attend_min, cond_attend_max, min_calls, ... },
 *     shortfalls?: [...]
 *   }
 */

function todayTaipei(): string {
  const now = new Date();
  const tp = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return tp.toISOString().slice(0, 10);
}

function weekStart(d: Date): Date {
  const r = new Date(d);
  const day = r.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  r.setUTCDate(r.getUTCDate() + delta);
  return r;
}

function monthStart(d: Date): Date {
  const r = new Date(d);
  r.setUTCDate(1);
  return r;
}

type Metric = {
  calls: number;
  call_minutes: number;
  connected: number;
  raw_appointments: number;
  appointments_show: number;
  raw_demos: number;
  closures: number;
  net_revenue_daily: number;
};

function empty(): Metric {
  return {
    calls: 0,
    call_minutes: 0,
    connected: 0,
    raw_appointments: 0,
    appointments_show: 0,
    raw_demos: 0,
    closures: 0,
    net_revenue_daily: 0,
  };
}

function add(a: Metric, b: Metric): Metric {
  return {
    calls: a.calls + b.calls,
    call_minutes: a.call_minutes + b.call_minutes,
    connected: a.connected + b.connected,
    raw_appointments: a.raw_appointments + b.raw_appointments,
    appointments_show: a.appointments_show + b.appointments_show,
    raw_demos: a.raw_demos + b.raw_demos,
    closures: a.closures + b.closures,
    net_revenue_daily: a.net_revenue_daily + b.net_revenue_daily,
  };
}

function fromRow(r: Record<string, unknown>): Metric {
  return {
    calls: Number(r.calls) || 0,
    call_minutes: Number(r.call_minutes) || 0,
    connected: Number(r.connected) || 0,
    raw_appointments: Number(r.raw_appointments) || 0,
    appointments_show: Number(r.appointments_show) || 0,
    raw_demos: Number(r.raw_demos) || 0,
    closures: Number(r.closures) || 0,
    net_revenue_daily: Number(r.net_revenue_daily) || 0,
  };
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return Response.json({ ok: false, error: "email required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const today = todayTaipei();
  const todayDate = new Date(today + "T00:00:00Z");
  const wkStart = weekStart(todayDate).toISOString().slice(0, 10);
  const mnStart = monthStart(todayDate).toISOString().slice(0, 10);

  // Pull all this-month rows for this email
  const { data: rows, error } = await supabase
    .from("sales_metrics_daily")
    .select("*")
    .eq("email", email)
    .gte("date", mnStart)
    .lte("date", today)
    .order("date", { ascending: false });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const allRows = rows || [];
  if (allRows.length === 0) {
    return Response.json({
      ok: true,
      email,
      bound: false,
      message: "這個信箱還沒有業務數據（Metabase 尚未同步、或這個 email 不在業務名單中）",
      today: empty(),
      week: empty(),
      month: empty(),
      dailyTrend: [],
    });
  }

  // Meta from latest row
  const latest = allRows[0] as Record<string, unknown>;
  const profile = {
    name: latest.name as string | null,
    team: latest.team as string | null,
    org: latest.org as string | null,
    brand: latest.brand as string,
    level: latest.level as string | null,
  };

  // Bucket aggregation
  let todayMetric = empty();
  let weekMetric = empty();
  const monthMetric = allRows.reduce((acc, r) => add(acc, fromRow(r as Record<string, unknown>)), empty());

  for (const r of allRows as Record<string, unknown>[]) {
    const rowDate = r.date as string;
    if (rowDate === today) {
      todayMetric = add(todayMetric, fromRow(r));
    }
    if (rowDate >= wkStart && rowDate <= today) {
      weekMetric = add(weekMetric, fromRow(r));
    }
  }

  // Daily trend (most recent first → reverse for chart display)
  const dailyTrend = (allRows as Record<string, unknown>[])
    .map((r) => ({
      date: r.date as string,
      calls: Number(r.calls) || 0,
      closures: Number(r.closures) || 0,
      net_revenue_daily: Number(r.net_revenue_daily) || 0,
      appointments_show: Number(r.appointments_show) || 0,
    }))
    .reverse();

  // 查適用的 alert rule
  const { data: rules } = await supabase
    .from("sales_alert_rules")
    .select("*")
    .eq("enabled", true);

  type Rule = {
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
    severity: string;
  };

  const matchedRule = (rules as Rule[] | null)
    ?.filter((r) => r.brand === profile.brand || r.brand === "all")
    .filter((r) => r.level === (profile.level || "default") || r.level === "default")
    .filter((r) => {
      const attend = todayMetric.appointments_show;
      if (r.cond_attend_min != null && attend < r.cond_attend_min) return false;
      if (r.cond_attend_max != null && attend > r.cond_attend_max) return false;
      return true;
    })
    .sort((a, b) => {
      const aScore = (a.brand !== "all" ? 2 : 0) + (a.level !== "default" ? 1 : 0);
      const bScore = (b.brand !== "all" ? 2 : 0) + (b.level !== "default" ? 1 : 0);
      return bScore - aScore;
    })[0];

  let shortfalls: Array<{ metric: string; actual: number; min: number; delta: number }> = [];
  if (matchedRule) {
    if (matchedRule.min_calls != null && todayMetric.calls < matchedRule.min_calls) {
      shortfalls.push({
        metric: "calls",
        actual: todayMetric.calls,
        min: matchedRule.min_calls,
        delta: matchedRule.min_calls - todayMetric.calls,
      });
    }
    if (matchedRule.min_call_minutes != null && todayMetric.call_minutes < Number(matchedRule.min_call_minutes)) {
      shortfalls.push({
        metric: "call_minutes",
        actual: Math.round(todayMetric.call_minutes),
        min: Number(matchedRule.min_call_minutes),
        delta: Math.round(Number(matchedRule.min_call_minutes) - todayMetric.call_minutes),
      });
    }
    if (matchedRule.min_appointments != null && todayMetric.raw_appointments < matchedRule.min_appointments) {
      shortfalls.push({
        metric: "raw_appointments",
        actual: todayMetric.raw_appointments,
        min: matchedRule.min_appointments,
        delta: matchedRule.min_appointments - todayMetric.raw_appointments,
      });
    }
  }

  return Response.json({
    ok: true,
    email,
    bound: true,
    profile,
    today: todayMetric,
    week: weekMetric,
    month: monthMetric,
    dailyTrend,
    rule: matchedRule || null,
    shortfalls,
  });
}
