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
function periodRange(period: "day" | "week" | "month", anchor: string): { start: string; end: string } {
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
  // month
  const start = new Date(d);
  start.setUTCDate(1);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0); // last day of that month
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
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

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  const period = (req.nextUrl.searchParams.get("period") || "day") as "day" | "week" | "month";
  const date = req.nextUrl.searchParams.get("date") || todayTaipei();
  const { start, end } = periodRange(period, date);

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

  const teamAggregate = Array.from(teamMap.values()).sort(
    (a, b) => b.metric.net_revenue_daily - a.metric.net_revenue_daily || b.metric.calls - a.metric.calls
  );

  // metabase_sources 的最新同步狀態
  const { data: sources } = await supabase
    .from("metabase_sources")
    .select("brand, question_id, question_name, last_sync_at, last_sync_rows, last_sync_status, last_sync_error, enabled");

  return Response.json({
    ok: true,
    date,
    period,
    range: { start, end },
    brand: brand || "(all)",
    count,
    rows,
    teamAggregate,
    brandSummary,
    sources: sources || [],
  });
}
