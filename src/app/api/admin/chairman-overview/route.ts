import { NextRequest } from "next/server";
import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";
import { taipeiToday, taipeiDaysAgo } from "@/lib/time";
import { parseDateRangeQS } from "@/lib/dateRange";

/**
 * 董事長指揮中心 — 5 個業務品牌橫向比對
 *
 * 2026-05-02 Wave 7 fix:Vincent 拍板「HR/招募全砍」
 * 2026-05-02 Wave 8 #1:支援 ?from=&to= query(TimeRangePicker 整頁聯動)
 * - 沒帶 from/to → 維持原本 today + 過去 7 天視窗
 * - 帶了 → today_xxx 表「該區間最後一天 KPI」、week_xxx 表「整個區間累計」
 */

const SALES_BRANDS = ["nschool", "xuemi", "ooschool", "aischool", "xlab"];

interface BrandSnapshot {
  id: string;
  name: string;
  color: string;
  active_reps: number;
  silent_reps: number;
  silent_ratio: number;
  today_calls: number;
  today_valid_calls: number;
  today_appointments: number;
  today_closures: number;
  week_calls: number;
  week_closures: number;
  call_to_appt_rate: number;
  appt_to_close_rate: number;
  status: "healthy" | "warning" | "critical" | "unknown";
  diagnosis: string;
}

const BRAND_META: Record<string, { name: string; color: string }> = {
  nschool: { name: "nSchool 財經", color: "#C8884B" },
  xuemi: { name: "XUEMI 學米", color: "#7C6CF0" },
  ooschool: { name: "OOschool 無限", color: "#4F46E5" },
  aischool: { name: "AIschool 智能", color: "#10B981" },
  xlab: { name: "X LAB 實驗室", color: "#B8474A" },
};

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const today = taipeiToday();

    // Wave 8 #1: 接受 ?from=&to= 從 TimeRangePicker
    const url = new URL(req.url);
    const { from: qFrom, to: qTo } = parseDateRangeQS(url.searchParams);
    const periodFrom = qFrom || taipeiDaysAgo(7);
    const periodTo = qTo || today;
    const usingCustomRange = !!(qFrom && qTo);

    const [usersRes, smdRows] = await Promise.all([
      supabase.from("users").select("id, email, name, brand, status, role").eq("status", "active"),
      fetchAllRows<{ salesperson_id: string | null; email: string; brand: string | null; date: string; calls: number; connected: number; appointments_show: number; closures: number; name: string }>(() =>
        supabase.from("sales_metrics_daily")
          .select("salesperson_id, email, brand, date, calls, connected, appointments_show, closures, name")
          .gte("date", periodFrom)
          .lte("date", periodTo)
      ),
    ]);

    const kpis = smdRows.filter(r => {
      const n = (r.name || "").trim();
      return !n.startsWith("新訓-") && !n.startsWith("新訓 ") && !n.startsWith("新訓:");
    }).map(r => ({
      user_id: r.salesperson_id || undefined,
      user_email: (r.email || "").toLowerCase(),
      brand: r.brand || undefined,
      date: r.date,
      calls: r.calls || 0,
      valid_calls: r.connected || 0,
      appointments: r.appointments_show || 0,
      closures: r.closures || 0,
    }));

    const datesInWeek = Array.from(new Set(kpis.map(k => k.date))).sort();
    const latestDate = datesInWeek[datesInWeek.length - 1];
    // Wave 8 #1: 自訂區間時,effectiveToday = 區間最後一天(periodTo)有資料則取它,否則 latestDate
    const todayHasData = usingCustomRange
      ? kpis.some(k => k.date === periodTo)
      : kpis.some(k => k.date === today);
    const effectiveToday = usingCustomRange
      ? (todayHasData ? periodTo : (latestDate || periodTo))
      : (todayHasData ? today : (latestDate || today));

    const users = usersRes.data || [];
    const userBrandMap = new Map<string, string>();
    const userEmailMap = new Map<string, string>();
    users.forEach((u) => {
      if (u.id) userBrandMap.set(u.id, u.brand);
      if (u.email) userEmailMap.set(u.email.toLowerCase(), u.brand);
    });

    function kpiBrand(k: { user_id?: string; user_email?: string; brand?: string }): string | null {
      if (k.brand) return k.brand;
      if (k.user_id && userBrandMap.has(k.user_id)) return userBrandMap.get(k.user_id) || null;
      if (k.user_email && userEmailMap.has(k.user_email)) return userEmailMap.get(k.user_email) || null;
      return null;
    }

    const brandSnapshots: BrandSnapshot[] = SALES_BRANDS.map((brandId) => {
      const brandUsers = users.filter((u) => u.brand === brandId);
      const activeReps = brandUsers.length;

      const todayKpis = kpis.filter((k) => k.date === effectiveToday && kpiBrand(k) === brandId);
      const weekKpis = kpis.filter((k) => kpiBrand(k) === brandId);

      const todayCalls = todayKpis.reduce((s, k) => s + (k.calls || 0), 0);
      const todayValid = todayKpis.reduce((s, k) => s + (k.valid_calls || 0), 0);
      const todayAppts = todayKpis.reduce((s, k) => s + (k.appointments || 0), 0);
      const todayCloses = todayKpis.reduce((s, k) => s + (k.closures || 0), 0);

      const weekCalls = weekKpis.reduce((s, k) => s + (k.calls || 0), 0);
      const weekCloses = weekKpis.reduce((s, k) => s + (k.closures || 0), 0);

      const silentSet = new Set(brandUsers.map((u) => u.id));
      todayKpis.forEach((k) => {
        if ((k.calls || 0) > 0 && k.user_id) silentSet.delete(k.user_id);
      });
      const silentReps = silentSet.size;
      const silentRatio = activeReps > 0 ? silentReps / activeReps : 0;

      const callToAppt = todayValid > 0 ? todayAppts / todayValid : 0;
      const apptToClose = todayAppts > 0 ? todayCloses / todayAppts : 0;

      let status: BrandSnapshot["status"] = "healthy";
      let diagnosis = "正常運作中";

      const isWorkday = (() => {
        const d = new Date(effectiveToday + "T00:00:00Z").getUTCDay();
        return d >= 1 && d <= 5;
      })();
      const dataNotReady = !todayHasData;

      if (activeReps === 0) {
        status = "unknown";
        diagnosis = "此品牌沒有任何在線業務";
      } else if (dataNotReady && silentRatio === 1) {
        status = "unknown";
        diagnosis = isWorkday
          ? `今日 Metabase 尚未同步(latest=${effectiveToday}),稍後再看`
          : `週末/假日 不在同步排程,顯示 ${effectiveToday} 的最近工作日資料`;
      } else if (silentRatio > 0.5) {
        status = "critical";
        diagnosis = `${Math.round(silentRatio * 100)}% 業務今天 0 通電話 — 需立即介入`;
      } else if (silentRatio > 0.2) {
        status = "warning";
        diagnosis = `${silentReps} 位業務今天還沒開口`;
      } else if (todayCalls < activeReps * 30) {
        status = "warning";
        diagnosis = `平均每人僅 ${(todayCalls / Math.max(1, activeReps)).toFixed(0)} 通 — 未達 30 通底線`;
      } else if (todayCloses === 0 && todayAppts > 0) {
        status = "warning";
        diagnosis = `${todayAppts} 個邀約 0 成交 — 收網能力要看`;
      } else {
        diagnosis = `平均 ${(todayCalls / Math.max(1, activeReps)).toFixed(0)} 通／人,正常推進`;
      }

      return {
        id: brandId,
        name: BRAND_META[brandId].name,
        color: BRAND_META[brandId].color,
        active_reps: activeReps,
        silent_reps: silentReps,
        silent_ratio: silentRatio,
        today_calls: todayCalls,
        today_valid_calls: todayValid,
        today_appointments: todayAppts,
        today_closures: todayCloses,
        week_calls: weekCalls,
        week_closures: weekCloses,
        call_to_appt_rate: callToAppt,
        appt_to_close_rate: apptToClose,
        status,
        diagnosis,
      };
    });

    const totalCallsToday = brandSnapshots.reduce((s, b) => s + b.today_calls, 0);
    const totalApptsToday = brandSnapshots.reduce((s, b) => s + b.today_appointments, 0);
    const totalClosesToday = brandSnapshots.reduce((s, b) => s + b.today_closures, 0);
    const totalActiveReps = brandSnapshots.reduce((s, b) => s + b.active_reps, 0);
    const totalSilent = brandSnapshots.reduce((s, b) => s + b.silent_reps, 0);

    const criticalCompanies = brandSnapshots.filter((b) => b.status === "critical");
    const warningCompanies = brandSnapshots.filter((b) => b.status === "warning");

    return Response.json({
      ok: true,
      generated_at: new Date().toISOString(),
      data_source: {
        sales_kpi: "sales_metrics_daily (Metabase Q1381 incremental sync)",
        note: "本頁 today 自動 fallback to latest workday(週末/假日資料未 finalize 時用最近一個工作日)。HR/招募系統已於 Wave 7 (2026-05-02) 砍除。",
      },
      period: {
        from: periodFrom,
        to: periodTo,
        custom: usingCustomRange,
      },
      effective_date: effectiveToday,
      effective_date_is_today: todayHasData,
      empire: {
        total_active_reps: totalActiveReps,
        total_silent_today: totalSilent,
        total_calls_today: totalCallsToday,
        total_appointments_today: totalApptsToday,
        total_closures_today: totalClosesToday,
        critical_count: criticalCompanies.length,
        warning_count: warningCompanies.length,
      },
      sales_brands: brandSnapshots,
      alerts: criticalCompanies
        .map((b) => ({ level: "critical", company: b.name, message: b.diagnosis }))
        .concat(
          warningCompanies.map((b) => ({ level: "warning", company: b.name, message: b.diagnosis })),
        ),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
