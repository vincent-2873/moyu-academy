import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 後台「業務數據」頁面讀取 API
 *
 * GET /api/admin/sales-metrics?brand=nschool&date=2026-04-10
 *   brand 省略 → 全集團
 *   date 省略 → 今天（台北）
 *
 * 回傳：
 *   - rows: 當日個人明細（排序：淨業績 desc, 通次 desc）
 *   - teamAggregate: 依 team 聚合
 *   - brandSummary: 整個 brand 的總計
 *   - sources: metabase_sources 的最新同步狀態（for UI 顯示「最後同步時間」）
 */

function todayTaipei(): string {
  const now = new Date();
  const tp = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return tp.toISOString().slice(0, 10);
}

/** 依 period 算出起訖日期 */
function periodRange(
  period: "day" | "week" | "month" | "last7" | "last14" | "prevMonth",
  anchor: string
): { start: string; end: string } {
  const d = new Date(anchor + "T00:00:00Z");
  if (period === "day") {
    return { start: anchor, end: anchor };
  }
  if (period === "week") {
    // 台灣習慣：週一起算 (ISO)
    const day = d.getUTCDay(); // 0=Sun
    const deltaToMon = day === 0 ? -6 : 1 - day;
    const start = new Date(d);
    start.setUTCDate(start.getUTCDate() + deltaToMon);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  if (period === "last7") {
    const start = new Date(d);
    start.setUTCDate(start.getUTCDate() - 6);
    return { start: start.toISOString().slice(0, 10), end: anchor };
  }
  if (period === "last14") {
    const start = new Date(d);
    start.setUTCDate(start.getUTCDate() - 13);
    return { start: start.toISOString().slice(0, 10), end: anchor };
  }
  if (period === "prevMonth") {
    const start = new Date(d);
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - 1);
    const end = new Date(d);
    end.setUTCDate(0); // last day of previous month
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  // month
  const start = new Date(d);
  start.setUTCDate(1);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0); // last day of that month
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/**
 * 資料完整性檢查 — 漏斗規則：
 *   有通時通次 → 才有邀約
 *   有邀約 → 才有出席 (或未出席)
 *   有出席 → 才有成交 (或未成交)
 *
 * 違反規則 = Metabase 源頭資料有問題 (跨日切割 / 同步漏 / 業務手動填錯)
 */
interface DataIssue {
  salesperson: string;
  email: string | null;
  date: string;
  kind: "closures_without_shows" | "shows_without_appts" | "appts_without_calls" | "connected_without_calls";
  detail: string;
}
function checkIntegrity(r: {
  name?: string | null;
  email?: string | null;
  date: string;
  calls: number;
  connected: number;
  raw_appointments: number;
  appointments_show: number;
  closures: number;
}): DataIssue[] {
  // Skip integrity check for monthly rollup rows (stored with date=YYYY-MM-01)
  // Monthly aggregates often have closures > shows because different days' events aggregate
  // Also skip ANY row with very high calls (> 300/person/day) — likely monthly
  if (r.date.endsWith("-01") && r.calls > 200) return [];
  // Also skip historical data before 2026-03 (all monthly rollups, integrity not meaningful)
  if (r.date < "2026-03-01") return [];

  const issues: DataIssue[] = [];
  const who = r.name || r.email || "(unknown)";
  if (r.connected > 0 && r.calls === 0) {
    issues.push({ salesperson: who, email: r.email || null, date: r.date, kind: "connected_without_calls", detail: `接通 ${r.connected} 通次 0` });
  }
  if (r.raw_appointments > 0 && r.calls === 0) {
    issues.push({ salesperson: who, email: r.email || null, date: r.date, kind: "appts_without_calls", detail: `邀約 ${r.raw_appointments} 通次 0` });
  }
  if (r.appointments_show > r.raw_appointments) {
    issues.push({ salesperson: who, email: r.email || null, date: r.date, kind: "shows_without_appts", detail: `出席 ${r.appointments_show} > 邀約 ${r.raw_appointments}` });
  }
  if (r.closures > r.appointments_show) {
    issues.push({ salesperson: who, email: r.email || null, date: r.date, kind: "closures_without_shows", detail: `成交 ${r.closures} > 出席 ${r.appointments_show}` });
  }
  return issues;
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
  net_revenue_contract: number;
};

type Row = Metric & {
  date: string;
  salesperson_id: string;
  brand: string;
  team: string | null;
  org: string | null;
  name: string | null;
  email: string | null;
  level: string | null;
  last_synced_at: string;
};

function emptyMetric(): Metric {
  return {
    calls: 0,
    call_minutes: 0,
    connected: 0,
    raw_appointments: 0,
    appointments_show: 0,
    raw_demos: 0,
    closures: 0,
    net_revenue_daily: 0,
    net_revenue_contract: 0,
  };
}

function addMetric(a: Metric, b: Metric): Metric {
  return {
    calls: a.calls + b.calls,
    call_minutes: a.call_minutes + b.call_minutes,
    connected: a.connected + b.connected,
    raw_appointments: a.raw_appointments + b.raw_appointments,
    appointments_show: a.appointments_show + b.appointments_show,
    raw_demos: a.raw_demos + b.raw_demos,
    closures: a.closures + b.closures,
    net_revenue_daily: a.net_revenue_daily + b.net_revenue_daily,
    net_revenue_contract: a.net_revenue_contract + b.net_revenue_contract,
  };
}

/**
 * 計算轉換漏斗各階段比率 (miao-miao-style funnel)
 *
 *  撥打 → 接通 → 邀約 → 出席 → 成交
 *
 * 各率定義：
 *   connect_rate      = 接通 / 通次
 *   invite_rate       = 邀約 / 接通 (接通 → 邀約, 越大越好)
 *   show_rate         = 出席 / 邀約 (邀約 → 出席)
 *   close_rate        = 成交 / 出席 (出席 → 成交)
 *   demo_close_rate   = 成交 / DEMO
 *   avg_call_minutes  = 通時 / 通次 (單通平均分鐘)
 *   avg_deal_size     = 淨業績 / 成交 (客單價)
 *   order_revenue_est = 淨業績 × 1.1 (訂單業績估算, miao-miao 這樣定義)
 *
 * 分母為 0 時回 null (不要除 0 顯示 NaN)
 */
interface FunnelRates {
  connectRate: number | null;
  inviteRate: number | null;
  showRate: number | null;
  closeRate: number | null;
  demoCloseRate: number | null;
  avgCallMinutes: number | null;
  avgDealSize: number | null;
  orderRevenueEstimate: number;
}

function computeRates(m: Metric): FunnelRates {
  const safe = (num: number, den: number) => (den > 0 ? num / den : null);
  const calls = Number(m.calls) || 0;
  const connected = Number(m.connected) || 0;
  const appointments = Number(m.raw_appointments) || 0;
  const shows = Number(m.appointments_show) || 0;
  const demos = Number(m.raw_demos) || 0;
  const closures = Number(m.closures) || 0;
  const callMinutes = Number(m.call_minutes) || 0;
  const revenue = Number(m.net_revenue_daily) || 0;
  return {
    connectRate: safe(connected, calls),
    inviteRate: safe(appointments, connected),
    showRate: safe(shows, appointments),
    closeRate: safe(closures, shows),
    demoCloseRate: safe(closures, demos),
    avgCallMinutes: safe(callMinutes, calls),
    avgDealSize: safe(revenue, closures),
    orderRevenueEstimate: Math.round(revenue * 1.1),
  };
}

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  const period = (req.nextUrl.searchParams.get("period") || "month") as
    | "day"
    | "week"
    | "month"
    | "last7"
    | "last14"
    | "prevMonth"
    | "custom"
    | "auto";
  const date = req.nextUrl.searchParams.get("date") || todayTaipei();
  const customStart = req.nextUrl.searchParams.get("start");
  const customEnd = req.nextUrl.searchParams.get("end");

  let start: string;
  let end: string;
  if (period === "custom" && customStart && customEnd) {
    start = customStart;
    end = customEnd;
  } else if (period === "auto") {
    // 用實際有資料的最早/最晚日期，讓空月份不會一片空白
    const supabaseProbe = getSupabaseAdmin();
    let probe = supabaseProbe.from("sales_metrics_daily").select("date").order("date", { ascending: true }).limit(1);
    if (brand) probe = probe.eq("brand", brand);
    const first = await probe;
    let probe2 = supabaseProbe.from("sales_metrics_daily").select("date").order("date", { ascending: false }).limit(1);
    if (brand) probe2 = probe2.eq("brand", brand);
    const last = await probe2;
    start = (first.data && first.data[0]?.date) || date;
    end = (last.data && last.data[0]?.date) || date;
  } else if (period === "day" || period === "week" || period === "month" || period === "last7" || period === "last14" || period === "prevMonth") {
    const range = periodRange(period, date);
    start = range.start;
    end = range.end;
  } else {
    const range = periodRange("month", date);
    start = range.start;
    end = range.end;
  }

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("sales_metrics_daily")
    .select("*")
    .gte("date", start)
    .lte("date", end)
    .order("net_revenue_daily", { ascending: false })
    .order("calls", { ascending: false });

  if (brand) query = query.eq("brand", brand);

  const { data: rawRows, error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  const typedRows = (rawRows || []) as Row[];

  // 若跨多天（週/月），依 salesperson_id 合併（累加）
  const bySalesperson = new Map<string, Row>();
  for (const r of typedRows) {
    const existing = bySalesperson.get(r.salesperson_id);
    if (!existing) {
      bySalesperson.set(r.salesperson_id, { ...r });
      continue;
    }
    // Keep latest metadata (name/team/org/level) — use the most recent row
    if (r.date > existing.date) {
      existing.name = r.name;
      existing.team = r.team;
      existing.org = r.org;
      existing.level = r.level;
      existing.brand = r.brand;
    }
    existing.calls += r.calls;
    existing.call_minutes = (Number(existing.call_minutes) || 0) + (Number(r.call_minutes) || 0);
    existing.connected += r.connected;
    existing.raw_appointments += r.raw_appointments;
    existing.appointments_show += r.appointments_show;
    existing.raw_demos += r.raw_demos;
    existing.closures += r.closures;
    existing.net_revenue_daily = (Number(existing.net_revenue_daily) || 0) + (Number(r.net_revenue_daily) || 0);
    existing.net_revenue_contract = (Number(existing.net_revenue_contract) || 0) + (Number(r.net_revenue_contract) || 0);
  }
  const rows = Array.from(bySalesperson.values()).sort(
    (a, b) => Number(b.net_revenue_daily) - Number(a.net_revenue_daily) || b.calls - a.calls
  );

  // 組別聚合
  const teamMap = new Map<string, { team: string; count: number; metric: Metric }>();
  const brandSummary = emptyMetric();
  let count = 0;
  for (const r of rows) {
    count++;
    const delta: Metric = {
      calls: r.calls,
      call_minutes: Number(r.call_minutes) || 0,
      connected: r.connected,
      raw_appointments: r.raw_appointments,
      appointments_show: r.appointments_show,
      raw_demos: r.raw_demos,
      closures: r.closures,
      net_revenue_daily: Number(r.net_revenue_daily) || 0,
      net_revenue_contract: Number(r.net_revenue_contract) || 0,
    };
    Object.assign(brandSummary, addMetric(brandSummary, delta));

    const teamKey = r.team || "(未分組)";
    const entry = teamMap.get(teamKey) || {
      team: teamKey,
      count: 0,
      metric: emptyMetric(),
    };
    entry.count += 1;
    entry.metric = addMetric(entry.metric, delta);
    teamMap.set(teamKey, entry);
  }

  const teamAggregate = Array.from(teamMap.values())
    .map((t) => ({ ...t, rates: computeRates(t.metric) }))
    .sort(
      (a, b) => b.metric.net_revenue_daily - a.metric.net_revenue_daily || b.metric.calls - a.metric.calls
    );

  // 幫 rows 附加個人漏斗率
  const rowsWithRates = rows.map((r) => ({
    ...r,
    rates: computeRates({
      calls: r.calls,
      call_minutes: Number(r.call_minutes) || 0,
      connected: r.connected,
      raw_appointments: r.raw_appointments,
      appointments_show: r.appointments_show,
      raw_demos: r.raw_demos,
      closures: r.closures,
      net_revenue_daily: Number(r.net_revenue_daily) || 0,
      net_revenue_contract: Number(r.net_revenue_contract) || 0,
    }),
  }));

  // 品牌層級漏斗率（= 整張表合計後算）+ 用來給前端 vs 團隊平均 比對用
  const brandRates = computeRates(brandSummary);

  // 據點（org）聚合
  const orgMap = new Map<string, { org: string; count: number; metric: Metric }>();
  for (const r of rows) {
    const orgKey = r.org || "(未分配)";
    const entry = orgMap.get(orgKey) || { org: orgKey, count: 0, metric: emptyMetric() };
    entry.count += 1;
    entry.metric = addMetric(entry.metric, {
      calls: r.calls,
      call_minutes: Number(r.call_minutes) || 0,
      connected: r.connected,
      raw_appointments: r.raw_appointments,
      appointments_show: r.appointments_show,
      raw_demos: r.raw_demos,
      closures: r.closures,
      net_revenue_daily: Number(r.net_revenue_daily) || 0,
      net_revenue_contract: Number(r.net_revenue_contract) || 0,
    });
    orgMap.set(orgKey, entry);
  }
  const orgAggregate = Array.from(orgMap.values())
    .map((o) => ({ ...o, rates: computeRates(o.metric) }))
    .sort((a, b) => b.metric.net_revenue_daily - a.metric.net_revenue_daily);

  // metabase_sources 的最新同步狀態
  const { data: sources } = await supabase
    .from("metabase_sources")
    .select("brand, question_id, question_name, last_sync_at, last_sync_rows, last_sync_status, last_sync_error, enabled");

  // 資料缺漏日期檢查 — 在起訖區間內，sales_metrics_daily 中缺哪幾天？
  const daysInRange: string[] = [];
  {
    const s = new Date(start + "T00:00:00Z");
    const e = new Date(end + "T00:00:00Z");
    for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
      daysInRange.push(d.toISOString().slice(0, 10));
    }
  }
  const datesWithData = new Set(typedRows.map((r) => r.date));
  const missingDates = daysInRange.filter((d) => !datesWithData.has(d));

  // Daily trend — 每日的彙總（給前端畫趨勢圖）
  const dailyMap = new Map<string, Metric & { date: string }>();
  for (const r of typedRows) {
    const existing = dailyMap.get(r.date);
    if (existing) {
      existing.calls += r.calls;
      existing.call_minutes = (Number(existing.call_minutes) || 0) + (Number(r.call_minutes) || 0);
      existing.connected += r.connected;
      existing.raw_appointments += r.raw_appointments;
      existing.appointments_show += r.appointments_show;
      existing.raw_demos += r.raw_demos;
      existing.closures += r.closures;
      existing.net_revenue_daily = (Number(existing.net_revenue_daily) || 0) + (Number(r.net_revenue_daily) || 0);
      existing.net_revenue_contract = (Number(existing.net_revenue_contract) || 0) + (Number(r.net_revenue_contract) || 0);
    } else {
      dailyMap.set(r.date, {
        date: r.date,
        calls: r.calls,
        call_minutes: Number(r.call_minutes) || 0,
        connected: r.connected,
        raw_appointments: r.raw_appointments,
        appointments_show: r.appointments_show,
        raw_demos: r.raw_demos,
        closures: r.closures,
        net_revenue_daily: Number(r.net_revenue_daily) || 0,
        net_revenue_contract: Number(r.net_revenue_contract) || 0,
      });
    }
  }
  const dailyTrend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // 🌐 品牌橫向對比 — 拉全部 brand 的 same-period 彙總（忽略 brand filter）
  let brandCompare: Array<{
    brand: string;
    people: number;
    calls: number;
    connected: number;
    raw_appointments: number;
    appointments_show: number;
    closures: number;
    net_revenue_daily: number;
    rates: FunnelRates;
  }> = [];
  if (!brand) {
    // 在全集團視角才算品牌對比 (避免單品牌 view 重複計算)
    const byBrand = new Map<string, { people: Set<string>; m: Metric }>();
    for (const r of typedRows) {
      const b = r.brand || "(unknown)";
      const entry = byBrand.get(b) || { people: new Set<string>(), m: emptyMetric() };
      if (r.email) entry.people.add(r.email);
      else if (r.salesperson_id) entry.people.add(r.salesperson_id);
      entry.m = addMetric(entry.m, {
        calls: r.calls,
        call_minutes: Number(r.call_minutes) || 0,
        connected: r.connected,
        raw_appointments: r.raw_appointments,
        appointments_show: r.appointments_show,
        raw_demos: r.raw_demos,
        closures: r.closures,
        net_revenue_daily: Number(r.net_revenue_daily) || 0,
        net_revenue_contract: Number(r.net_revenue_contract) || 0,
      });
      byBrand.set(b, entry);
    }
    brandCompare = Array.from(byBrand.entries())
      .map(([br, v]) => ({
        brand: br,
        people: v.people.size,
        calls: v.m.calls,
        connected: v.m.connected,
        raw_appointments: v.m.raw_appointments,
        appointments_show: v.m.appointments_show,
        closures: v.m.closures,
        net_revenue_daily: v.m.net_revenue_daily,
        rates: computeRates(v.m),
      }))
      .sort((a, b) => b.net_revenue_daily - a.net_revenue_daily);
  }

  // Data integrity issues — 原始 row level 檢查（跨日前）
  const dataIssues: DataIssue[] = [];
  for (const r of typedRows) {
    for (const issue of checkIntegrity({
      name: r.name,
      email: r.email,
      date: r.date,
      calls: r.calls,
      connected: r.connected,
      raw_appointments: r.raw_appointments,
      appointments_show: r.appointments_show,
      closures: r.closures,
    })) {
      dataIssues.push(issue);
    }
  }

  return Response.json({
    ok: true,
    date,
    period,
    range: { start, end },
    brand: brand || "(all)",
    count,
    rows: rowsWithRates,
    teamAggregate,
    orgAggregate,
    brandSummary,
    brandRates,
    dailyTrend,
    dataIssues,
    brandCompare,
    sources: sources || [],
    missingDates,
    daysInRange: daysInRange.length,
    daysWithData: daysInRange.length - missingDates.length,
  });
}
