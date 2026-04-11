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

  // Track most recent date that actually has data (for "today unsynced" fallback UI)
  let mostRecentDataDate: string | null = null;
  let mostRecentDataMetric: Metric | null = null;

  for (const r of allRows as Record<string, unknown>[]) {
    const rowDate = r.date as string;
    if (rowDate === today) {
      todayMetric = add(todayMetric, fromRow(r));
    }
    if (rowDate >= wkStart && rowDate <= today) {
      weekMetric = add(weekMetric, fromRow(r));
    }
    if (!mostRecentDataDate || rowDate > mostRecentDataDate) {
      mostRecentDataDate = rowDate;
      mostRecentDataMetric = fromRow(r);
    } else if (rowDate === mostRecentDataDate && mostRecentDataMetric) {
      mostRecentDataMetric = add(mostRecentDataMetric, fromRow(r));
    }
  }

  // 今天完全沒資料 → 標記為「尚未同步」，前端可以用最近一天的值代替
  const todayEmpty =
    todayMetric.calls === 0 &&
    todayMetric.call_minutes === 0 &&
    todayMetric.raw_appointments === 0 &&
    todayMetric.closures === 0;

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

  // 🔴 即時進度 — 現在幾點，依照規則應該到哪，落後多少
  //    工作時段 09:00 → 20:00 台北 (11 hr),  min_calls 均速消化
  //    這是「時間感壓迫」— 讓業務看到自己卡在哪 hour 該追多少通
  const paceCheck = (() => {
    if (!matchedRule || matchedRule.min_calls == null) return null;
    const now = new Date();
    const tpHours = (now.getUTCHours() + 8) % 24;
    const tpMinutes = now.getUTCMinutes();
    const shiftStart = 9;
    const shiftEnd = 20; // 20:00
    const totalHours = shiftEnd - shiftStart;
    // 決定目前進度％ (0 → 1)
    let elapsedHours: number;
    if (tpHours < shiftStart) elapsedHours = 0;
    else if (tpHours >= shiftEnd) elapsedHours = totalHours;
    else elapsedHours = tpHours - shiftStart + tpMinutes / 60;
    const pct = Math.max(0, Math.min(1, elapsedHours / totalHours));
    const expectedCalls = Math.round(matchedRule.min_calls * pct);
    const actualCalls = todayMetric.calls;
    const behind = expectedCalls - actualCalls;
    const callsPerHourRequired =
      elapsedHours < totalHours && behind > 0
        ? Math.ceil(behind / (totalHours - elapsedHours))
        : 0;
    return {
      now: `${String(tpHours).padStart(2, "0")}:${String(tpMinutes).padStart(2, "0")}`,
      shiftStart: `${shiftStart}:00`,
      shiftEnd: `${shiftEnd}:00`,
      elapsedPct: Math.round(pct * 100),
      expectedCalls,
      actualCalls,
      behind: Math.max(0, behind),
      ahead: Math.max(0, -behind),
      callsPerHourRequired,
      totalTarget: matchedRule.min_calls,
      severity: behind > 30 ? "critical" : behind > 10 ? "high" : behind > 0 ? "medium" : "ok",
    };
  })();

  // ── 漏斗率計算（個人）+ 同品牌平均（for vs 比對） ─────────────────
  const computeRates = (m: Metric) => {
    const safe = (num: number, den: number) => (den > 0 ? num / den : null);
    return {
      connectRate: safe(m.connected, m.calls),
      inviteRate: safe(m.raw_appointments, m.connected),
      showRate: safe(m.appointments_show, m.raw_appointments),
      closeRate: safe(m.closures, m.appointments_show),
      demoCloseRate: safe(m.closures, m.raw_demos),
      avgCallMinutes: safe(m.call_minutes, m.calls),
      avgDealSize: safe(m.net_revenue_daily, m.closures),
      orderRevenueEstimate: Math.round(m.net_revenue_daily * 1.1),
    };
  };

  const monthRates = computeRates(monthMetric);
  const weekRates = computeRates(weekMetric);
  const todayRates = computeRates(todayMetric);

  // 同品牌本月所有人的彙總 → 算出團隊平均率
  const { data: brandRows } = await supabase
    .from("sales_metrics_daily")
    .select("calls, call_minutes, connected, raw_appointments, appointments_show, raw_demos, closures, net_revenue_daily, email")
    .eq("brand", profile.brand)
    .gte("date", mnStart)
    .lte("date", today);

  const brandAggregate = (brandRows || []).reduce<Metric>(
    (acc, r) => add(acc, fromRow(r as Record<string, unknown>)),
    empty()
  );
  const brandPeopleCount = new Set((brandRows || []).map((r) => r.email)).size;
  const brandRates = computeRates(brandAggregate);

  // Provenance — 拉該品牌的 metabase_source 狀態讓前端顯示「資料來源 / 最後同步」
  const { data: sources } = await supabase
    .from("metabase_sources")
    .select("brand, question_id, question_name, last_sync_at, last_sync_rows, last_sync_status")
    .eq("brand", profile.brand)
    .limit(1);
  const provenance =
    sources && sources.length > 0
      ? {
          brand: sources[0].brand as string,
          questionId: sources[0].question_id as number,
          questionName: sources[0].question_name as string | null,
          lastSyncAt: sources[0].last_sync_at as string | null,
          lastSyncRows: sources[0].last_sync_rows as number | null,
          lastSyncStatus: sources[0].last_sync_status as string | null,
        }
      : null;

  return Response.json({
    ok: true,
    email,
    bound: true,
    profile,
    today: todayMetric,
    week: weekMetric,
    month: monthMetric,
    rates: {
      today: todayRates,
      week: weekRates,
      month: monthRates,
    },
    // 同品牌本月平均 — 讓前端顯示 "你的 X% vs 平均 Y%"
    brandComparison: {
      peopleCount: brandPeopleCount,
      totalRevenue: brandAggregate.net_revenue_daily,
      rates: brandRates,
    },
    dailyTrend,
    rule: matchedRule || null,
    shortfalls,
    paceCheck,
    provenance,
    // 只在「今天沒同步」且有過往資料時回傳，讓 UI 顯示 fallback
    latestAvailable:
      todayEmpty && mostRecentDataDate && mostRecentDataDate !== today
        ? { date: mostRecentDataDate, metric: mostRecentDataMetric }
        : null,
    todayDate: today,
  });
}
