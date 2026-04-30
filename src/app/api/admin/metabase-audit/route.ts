import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";
import { queryCard, normaliseRow } from "@/lib/metabase";

/**
 * 2026-04-30 末段:Metabase 三方對比 audit
 *
 * GET /api/admin/metabase-audit?from=2026-04-01&to=2026-04-13
 *
 * 三方對比:
 *   1. live = 即時跑 Metabase question 1381 拿到的真實值
 *   2. db = 我們 sales_metrics_daily 已有資料(過濾 is_monthly_rollup)
 *   3. diff = 逐 email 比較 calls / closures / net_revenue_daily 差異
 *
 * 用法:
 *   1. 從 admin 後台或 curl(帶 admin cookie)呼叫
 *   2. 比對結果 JSON
 *   3. 找差異 → 知道是 「Metabase 沒抓到」還是「DB 有髒 row」
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AggRow {
  email: string;
  name: string;
  brand: string;
  calls: number;
  closures: number;          // 分潤成交數(raw)
  net_closures: number;      // 按日期分潤淨成交數
  raw_appointments: number;
  appointments_show: number;
  net_revenue_daily: number;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  if (!from || !to) {
    return NextResponse.json({
      error: "from + to required",
      example: "/api/admin/metabase-audit?from=2026-04-01&to=2026-04-13",
    }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // ───────────────── 1. DB 現有資料 ─────────────────
  const dbRows = await fetchAllRows<{
    email: string; name: string; brand: string;
    calls: number; closures: number; net_closures_daily: number;
    raw_appointments: number; appointments_show: number;
    net_revenue_daily: number; date: string; is_monthly_rollup: boolean | null;
  }>(() =>
    sb.from("sales_metrics_daily")
      .select("email, name, brand, calls, closures, net_closures_daily, raw_appointments, appointments_show, net_revenue_daily, date, is_monthly_rollup")
      .gte("date", from)
      .lte("date", to)
  );

  // 統計 DB 內 rollup row 與 daily row 數量(diagnostic)
  const dbAllCount = dbRows.length;
  const dbRollupCount = dbRows.filter((r) => r.is_monthly_rollup === true).length;
  const dbDailyCount = dbRows.filter((r) => r.is_monthly_rollup !== true).length;

  // 過濾掉 rollup,只用 daily 算
  const dbDaily = dbRows.filter((r) => r.is_monthly_rollup !== true);
  const dbAgg: Record<string, AggRow> = {};
  for (const r of dbDaily) {
    const k = (r.email || "").toLowerCase();
    if (!k) continue;
    if (!dbAgg[k]) dbAgg[k] = {
      email: k, name: r.name || k, brand: r.brand || "",
      calls: 0, closures: 0, net_closures: 0, raw_appointments: 0,
      appointments_show: 0, net_revenue_daily: 0,
    };
    dbAgg[k].calls += Number(r.calls || 0);
    dbAgg[k].closures += Number(r.closures || 0);
    dbAgg[k].net_closures += Number(r.net_closures_daily || 0);
    dbAgg[k].raw_appointments += Number(r.raw_appointments || 0);
    dbAgg[k].appointments_show += Number(r.appointments_show || 0);
    dbAgg[k].net_revenue_daily += Number(r.net_revenue_daily || 0);
  }

  // 同 email 多 row 偵測(可能是「同人多 salesperson_id」造成翻倍 root cause)
  const dupEmailDays: Record<string, { date: string; rows: number }[]> = {};
  const byEmailDate: Record<string, Record<string, number>> = {};
  for (const r of dbDaily) {
    const k = (r.email || "").toLowerCase();
    if (!k) continue;
    if (!byEmailDate[k]) byEmailDate[k] = {};
    byEmailDate[k][r.date] = (byEmailDate[k][r.date] || 0) + 1;
  }
  for (const [email, dates] of Object.entries(byEmailDate)) {
    const dups = Object.entries(dates).filter(([, c]) => c > 1);
    if (dups.length > 0) {
      dupEmailDays[email] = dups.map(([d, c]) => ({ date: d, rows: c }));
    }
  }

  // ───────────────── 2. Metabase live ─────────────────
  // 撈 enabled brand
  const { data: sources } = await sb
    .from("metabase_sources")
    .select("brand, question_id")
    .eq("enabled", true);

  const liveAgg: Record<string, AggRow> = {};
  const liveErrors: { brand: string; question_id: number; error: string }[] = [];
  const liveBrandCounts: Record<string, number> = {};

  for (const src of (sources || []) as { brand: string; question_id: number }[]) {
    try {
      const result = await queryCard(src.question_id, { startDate: from, endDate: to });
      liveBrandCounts[src.brand] = result.rowCount;
      for (const row of result.rows) {
        // normaliseRow 預設要 date,但 Metabase question 沒回 date(是聚合過的),所以用 from-to 中間日期
        const norm = normaliseRow(result.cols, row, src.brand, from);
        if (!norm || !norm.email) continue;
        const k = norm.email.toLowerCase();
        if (!liveAgg[k]) liveAgg[k] = {
          email: k, name: norm.name || k, brand: norm.brand,
          calls: 0, closures: 0, net_closures: 0, raw_appointments: 0,
          appointments_show: 0, net_revenue_daily: 0,
        };
        liveAgg[k].calls += norm.calls;
        liveAgg[k].closures += norm.closures;
        liveAgg[k].net_closures += norm.net_closures_daily;
        liveAgg[k].raw_appointments += norm.raw_appointments;
        liveAgg[k].appointments_show += norm.appointments_show;
        liveAgg[k].net_revenue_daily += norm.net_revenue_daily;
      }
    } catch (err: any) {
      liveErrors.push({
        brand: src.brand, question_id: src.question_id,
        error: String(err?.message || err).slice(0, 300),
      });
    }
  }

  // ───────────────── 3. Diff ─────────────────
  const allEmails = new Set([...Object.keys(dbAgg), ...Object.keys(liveAgg)]);
  const diff = Array.from(allEmails).map((email) => {
    const d = dbAgg[email];
    const l = liveAgg[email];
    return {
      email,
      name: l?.name || d?.name || email,
      brand: l?.brand || d?.brand || "",
      // db side
      db_calls: d?.calls || 0,
      db_closures: d?.closures || 0,
      db_net_closures: d?.net_closures || 0,
      db_revenue: d?.net_revenue_daily || 0,
      // live side
      live_calls: l?.calls || 0,
      live_closures: l?.closures || 0,
      live_net_closures: l?.net_closures || 0,
      live_revenue: l?.net_revenue_daily || 0,
      // diff
      diff_calls: (d?.calls || 0) - (l?.calls || 0),
      diff_closures: (d?.closures || 0) - (l?.closures || 0),
      diff_revenue: (d?.net_revenue_daily || 0) - (l?.net_revenue_daily || 0),
      only_in_db: !l,
      only_in_live: !d,
    };
  }).sort((a, b) => Math.abs(b.diff_revenue) - Math.abs(a.diff_revenue));

  // 大差異警報
  const bigDiff = diff.filter((d) => Math.abs(d.diff_revenue) > 10000 || Math.abs(d.diff_calls) > 50);

  return NextResponse.json({
    ok: true,
    range: { from, to },
    summary: {
      db: {
        total_rows: dbAllCount,
        rollup_rows: dbRollupCount,
        daily_rows: dbDailyCount,
        unique_emails: Object.keys(dbAgg).length,
        total_calls: Object.values(dbAgg).reduce((s, x) => s + x.calls, 0),
        total_closures: Object.values(dbAgg).reduce((s, x) => s + x.closures, 0),
        total_revenue: Object.values(dbAgg).reduce((s, x) => s + x.net_revenue_daily, 0),
      },
      live: {
        brands_queried: Object.keys(liveBrandCounts).length,
        per_brand_rows: liveBrandCounts,
        unique_emails: Object.keys(liveAgg).length,
        total_calls: Object.values(liveAgg).reduce((s, x) => s + x.calls, 0),
        total_closures: Object.values(liveAgg).reduce((s, x) => s + x.closures, 0),
        total_revenue: Object.values(liveAgg).reduce((s, x) => s + x.net_revenue_daily, 0),
        errors: liveErrors,
      },
      diff_count: diff.length,
      big_diff_count: bigDiff.length,
      duplicate_emails_with_multi_rows_per_day: Object.keys(dupEmailDays).length,
    },
    duplicate_email_dates: dupEmailDays,
    big_diff: bigDiff.slice(0, 30),
    full_diff: diff,
  });
}
