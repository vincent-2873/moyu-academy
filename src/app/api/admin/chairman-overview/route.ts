import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";
import { taipeiToday, taipeiDaysAgo } from "@/lib/time";

/**
 * 董事長指揮中心 — 跨公司聚合監測 API
 *
 * 一次回傳所有 5 家公司今天的核心數據，給董事長一頁式戰局視角。
 *
 * 5 家公司：
 *   1. nschool   (財經學院)
 *   2. xuemi     (學米職能)
 *   3. ooschool  (無限學院)
 *   4. aischool  (AI 未來學院)
 *   5. moyuhunt  (墨宇獵頭) — 無業務 KPI，看招聘漏斗
 *
 * 業務公司指標：
 *   - 在線業務員、今日通數、今日有效通、今日邀約、今日成交
 *   - 轉換率（有效通 → 邀約 → 成交）
 *   - 沒開口比例（critical 警報）
 *
 * 獵頭公司指標：
 *   - 漏斗各階段人數、本週新增、本月通過、流失率
 */

const SALES_BRANDS = ["nschool", "xuemi", "ooschool", "aischool"];

interface BrandSnapshot {
  id: string;
  name: string;
  color: string;
  type: "sales" | "recruit";
  // sales metrics
  active_reps?: number;
  silent_reps?: number;
  silent_ratio?: number;
  today_calls?: number;
  today_valid_calls?: number;
  today_appointments?: number;
  today_closures?: number;
  week_calls?: number;
  week_closures?: number;
  call_to_appt_rate?: number;
  appt_to_close_rate?: number;
  status: "healthy" | "warning" | "critical" | "unknown";
  diagnosis: string;
  // recruit metrics (only moyuhunt)
  funnel_total?: number;
  funnel_by_stage?: Record<string, number>;
  this_week_new?: number;
  this_month_passed?: number;
  this_month_dropped?: number;
  conversion_rate?: number;
}

const BRAND_META: Record<string, { name: string; color: string }> = {
  nschool: { name: "nSchool 財經", color: "#feca57" },
  xuemi: { name: "XUEMI 學米", color: "#7c6cf0" },
  ooschool: { name: "OOschool 無限", color: "#4F46E5" },
  aischool: { name: "AIschool 智能", color: "#10B981" },
  moyuhunt: { name: "墨宇獵頭", color: "#fb923c" },
};

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const now = Date.now();
    // 2026-04-30 Wave A B6 fix:用台北 TZ today + B8 fix:fetchAllRows 繞 1000 row cap
    const today = taipeiToday();
    const weekAgo = taipeiDaysAgo(7);
    const monthAgo = taipeiDaysAgo(30);

    // 並行抓取所有資料(kpi_entries / recruits / sparring 都用 fetchAllRows 防 1000 cap)
    const [usersRes, kpis, recruits, sparrings] = await Promise.all([
      supabase.from("users").select("id, email, name, brand, status, role").eq("status", "active"),
      fetchAllRows<{ user_id: string; user_email: string; brand: string; date: string; calls: number; valid_calls: number; appointments: number; closures: number }>(() =>
        supabase.from("kpi_entries")
          .select("user_id, user_email, brand, date, calls, valid_calls, appointments, closures")
          .gte("date", weekAgo)
      ),
      fetchAllRows<{ id: string; name: string; brand: string; stage: string; created_at: string; stage_entered_at: string }>(() =>
        supabase.from("recruits").select("id, name, brand, stage, created_at, stage_entered_at")
      ),
      fetchAllRows<{ user_email: string; brand: string; score: number; created_at: string }>(() =>
        supabase.from("sparring_records")
          .select("user_email, brand, score, created_at")
          .gte("created_at", new Date(now - 7 * 86400000).toISOString())
      ),
    ]);

    const users = usersRes.data || [];

    // 用 user_id → brand 對照表（KPI 表如果沒記 brand 欄位就 fallback）
    const userBrandMap = new Map<string, string>();
    const userEmailMap = new Map<string, string>();
    users.forEach((u) => {
      if (u.id) userBrandMap.set(u.id, u.brand);
      if (u.email) userEmailMap.set(u.email, u.brand);
    });

    function kpiBrand(k: { user_id?: string; user_email?: string; brand?: string }): string | null {
      if (k.brand) return k.brand;
      if (k.user_id && userBrandMap.has(k.user_id)) return userBrandMap.get(k.user_id) || null;
      if (k.user_email && userEmailMap.has(k.user_email)) return userEmailMap.get(k.user_email) || null;
      return null;
    }

    // ─── 建構 4 家業務公司快照 ───
    const brandSnapshots: BrandSnapshot[] = SALES_BRANDS.map((brandId) => {
      const brandUsers = users.filter((u) => u.brand === brandId);
      const activeReps = brandUsers.length;

      // 今日 KPI
      const todayKpis = kpis.filter((k) => k.date === today && kpiBrand(k) === brandId);
      const weekKpis = kpis.filter((k) => kpiBrand(k) === brandId);

      const todayCalls = todayKpis.reduce((s, k) => s + (k.calls || 0), 0);
      const todayValid = todayKpis.reduce((s, k) => s + (k.valid_calls || 0), 0);
      const todayAppts = todayKpis.reduce((s, k) => s + (k.appointments || 0), 0);
      const todayCloses = todayKpis.reduce((s, k) => s + (k.closures || 0), 0);

      const weekCalls = weekKpis.reduce((s, k) => s + (k.calls || 0), 0);
      const weekCloses = weekKpis.reduce((s, k) => s + (k.closures || 0), 0);

      // 沒開口的人
      const silentSet = new Set(brandUsers.map((u) => u.id));
      todayKpis.forEach((k) => {
        if ((k.calls || 0) > 0 && k.user_id) silentSet.delete(k.user_id);
      });
      const silentReps = silentSet.size;
      const silentRatio = activeReps > 0 ? silentReps / activeReps : 0;

      // 轉換率
      const callToAppt = todayValid > 0 ? todayAppts / todayValid : 0;
      const apptToClose = todayAppts > 0 ? todayCloses / todayAppts : 0;

      // 狀態判定（董事長視角：要嚴格）
      let status: BrandSnapshot["status"] = "healthy";
      let diagnosis = "正常運作中";

      if (activeReps === 0) {
        status = "unknown";
        diagnosis = "此品牌沒有任何在線業務 — 沒人在打仗";
      } else if (silentRatio > 0.5) {
        status = "critical";
        diagnosis = `${Math.round(silentRatio * 100)}% 業務今天 0 通電話 — 整團隊偷懶`;
      } else if (silentRatio > 0.2) {
        status = "warning";
        diagnosis = `${silentReps} 位業務今天還沒開口 — 該逼了`;
      } else if (todayCalls < activeReps * 30) {
        status = "warning";
        diagnosis = `平均每人僅 ${(todayCalls / Math.max(1, activeReps)).toFixed(0)} 通 — 未達 30 通底線`;
      } else if (todayCloses === 0 && todayAppts > 0) {
        status = "warning";
        diagnosis = `${todayAppts} 個邀約 0 成交 — 收網能力有問題`;
      } else {
        diagnosis = `平均 ${(todayCalls / Math.max(1, activeReps)).toFixed(0)} 通／人，正常推進`;
      }

      return {
        id: brandId,
        name: BRAND_META[brandId].name,
        color: BRAND_META[brandId].color,
        type: "sales" as const,
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

    // ─── 獵頭公司快照 ───
    const funnelByStage: Record<string, number> = {};
    recruits.forEach((r) => {
      funnelByStage[r.stage] = (funnelByStage[r.stage] || 0) + 1;
    });
    const funnelTotal = recruits.filter(
      (r) => !["passed", "dropped", "rejected"].includes(r.stage),
    ).length;
    const thisWeekNew = recruits.filter(
      (r) => new Date(r.created_at).toISOString().slice(0, 10) >= weekAgo,
    ).length;
    const thisMonthPassed = recruits.filter(
      (r) => r.stage === "passed" && new Date(r.created_at).toISOString().slice(0, 10) >= monthAgo,
    ).length;
    const thisMonthDropped = recruits.filter(
      (r) =>
        ["dropped", "rejected"].includes(r.stage) &&
        new Date(r.created_at).toISOString().slice(0, 10) >= monthAgo,
    ).length;
    const totalFinal = thisMonthPassed + thisMonthDropped;
    const conversionRate = totalFinal > 0 ? thisMonthPassed / totalFinal : 0;

    let recruitStatus: BrandSnapshot["status"] = "healthy";
    let recruitDiagnosis = "招聘漏斗運作中";
    if (recruits.length === 0) {
      recruitStatus = "unknown";
      recruitDiagnosis = "招聘系統空的 — 沒任何求職者";
    } else if (funnelTotal < 5) {
      recruitStatus = "critical";
      recruitDiagnosis = "漏斗快空了，下個月會無人可用";
    } else if (funnelTotal < 10) {
      recruitStatus = "warning";
      recruitDiagnosis = `漏斗只剩 ${funnelTotal} 人 — 廣告該加碼`;
    } else if (conversionRate < 0.1 && totalFinal > 5) {
      recruitStatus = "warning";
      recruitDiagnosis = `轉換率僅 ${Math.round(conversionRate * 100)}% — 篩選效率太低`;
    } else {
      recruitDiagnosis = `漏斗 ${funnelTotal} 人，本週新增 ${thisWeekNew} 位`;
    }

    const recruitSnapshot: BrandSnapshot = {
      id: "moyuhunt",
      name: BRAND_META.moyuhunt.name,
      color: BRAND_META.moyuhunt.color,
      type: "recruit",
      funnel_total: funnelTotal,
      funnel_by_stage: funnelByStage,
      this_week_new: thisWeekNew,
      this_month_passed: thisMonthPassed,
      this_month_dropped: thisMonthDropped,
      conversion_rate: conversionRate,
      status: recruitStatus,
      diagnosis: recruitDiagnosis,
    };

    // ─── 全集團聚合 ───
    const totalCallsToday = brandSnapshots.reduce((s, b) => s + (b.today_calls || 0), 0);
    const totalApptsToday = brandSnapshots.reduce((s, b) => s + (b.today_appointments || 0), 0);
    const totalClosesToday = brandSnapshots.reduce((s, b) => s + (b.today_closures || 0), 0);
    const totalActiveReps = brandSnapshots.reduce((s, b) => s + (b.active_reps || 0), 0);
    const totalSilent = brandSnapshots.reduce((s, b) => s + (b.silent_reps || 0), 0);
    const totalSparringWeek = sparrings.length;
    const avgSparringWeek =
      totalSparringWeek > 0
        ? sparrings.reduce((s, sp) => s + (sp.score || 0), 0) / totalSparringWeek
        : 0;

    const criticalCompanies = [...brandSnapshots, recruitSnapshot].filter(
      (b) => b.status === "critical",
    );
    const warningCompanies = [...brandSnapshots, recruitSnapshot].filter(
      (b) => b.status === "warning",
    );

    return Response.json({
      ok: true,
      generated_at: new Date().toISOString(),
      empire: {
        total_active_reps: totalActiveReps,
        total_silent_today: totalSilent,
        total_calls_today: totalCallsToday,
        total_appointments_today: totalApptsToday,
        total_closures_today: totalClosesToday,
        total_sparring_week: totalSparringWeek,
        avg_sparring_week: avgSparringWeek,
        critical_count: criticalCompanies.length,
        warning_count: warningCompanies.length,
        recruit_funnel_total: funnelTotal,
      },
      sales_brands: brandSnapshots,
      recruit: recruitSnapshot,
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
