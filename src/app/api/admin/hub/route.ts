import { NextResponse } from "next/server";
import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/hub — 集團戰情中心 unified API
 *
 * Vincent 規格:不要切換來切換去,一頁聚合所有區資料
 *  - SMD 真資料(today + week + last week)
 *  - 5 brand 橫向比對
 *  - Top + Struggling 業務
 *  - legal_cases / training / claude_help_requests / system_run_log 摘要
 *  - Vincent next-actions(從多源 cross-check 出來的待處理事項)
 */

const SALES_BRANDS = ["nschool", "xuemi", "ooschool", "aischool", "xlab"];
const BRAND_NAMES: Record<string, string> = {
  nschool: "nSchool 財經",
  xuemi: "XUEMI 學米",
  ooschool: "OOschool 無限",
  aischool: "AIschool 智能",
  xlab: "X LAB 實驗室",
};

function todayTaipei(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
function daysAgo(d: string, n: number): string {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() - n);
  return dt.toISOString().slice(0, 10);
}

interface SmdRow {
  date: string;
  email: string | null;
  name: string;
  brand: string | null;
  calls: number;
  connected: number;
  appointments_show: number;
  closures: number;
  net_revenue_daily: number | null;
}

export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const today = todayTaipei();
    const weekStart = daysAgo(today, 6);
    const lastWeekEnd = daysAgo(today, 7);
    const lastWeekStart = daysAgo(today, 13);
    const threeDaysAgo = daysAgo(today, 2);

    // 撈 14 天 SMD,排除新訓-
    const allRows = await fetchAllRows<SmdRow>(() =>
      sb.from("sales_metrics_daily")
        .select("date, email, name, brand, calls, connected, appointments_show, closures, net_revenue_daily")
        .gte("date", lastWeekStart)
        .not("email", "is", null)
    );

    const real = allRows.filter(r => {
      const n = (r.name || "").trim();
      return !n.startsWith("新訓-") && !n.startsWith("新訓 ") && !n.startsWith("新訓:");
    });

    // 找 effective today
    const dates = Array.from(new Set(real.map(r => r.date))).sort();
    const todayHasData = real.some(r => r.date === today);
    const effectiveToday = todayHasData ? today : (dates[dates.length - 1] || today);

    // Today rows
    const todayRows = real.filter(r => r.date === effectiveToday);
    const weekRows = real.filter(r => r.date >= weekStart && r.date <= today);
    const lastWeekRows = real.filter(r => r.date >= lastWeekStart && r.date <= lastWeekEnd);

    const sum = (rs: SmdRow[], k: keyof SmdRow): number => rs.reduce((s, r) => s + (Number(r[k]) || 0), 0);

    const todayCalls = sum(todayRows, "calls");
    const todayAppts = sum(todayRows, "appointments_show");
    const todayCloses = sum(todayRows, "closures");
    const todayRevenue = sum(todayRows, "net_revenue_daily");
    const weekCalls = sum(weekRows, "calls");
    const weekAppts = sum(weekRows, "appointments_show");
    const weekCloses = sum(weekRows, "closures");
    const weekRevenue = sum(weekRows, "net_revenue_daily");
    const lastWeekRevenue = sum(lastWeekRows, "net_revenue_daily");
    const weekVsLastPct = lastWeekRevenue > 0 ? ((weekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 : 0;

    const activeUsersToday = new Set(todayRows.filter(r => (r.calls || 0) > 0).map(r => (r.email || "").toLowerCase())).size;
    const allUsersInWeek = new Set(real.filter(r => r.date >= weekStart).map(r => (r.email || "").toLowerCase()));
    const silentToday = allUsersInWeek.size - activeUsersToday;

    // silent 3 days
    const silent3dEmails = new Set<string>();
    for (const email of allUsersInWeek) {
      const last3 = real.filter(r => (r.email || "").toLowerCase() === email && r.date >= threeDaysAgo);
      if (last3.length > 0 && last3.every(r => (r.calls || 0) === 0)) silent3dEmails.add(email);
    }

    // Brand snapshots
    const brandSnaps = SALES_BRANDS.map(brandId => {
      const todayBrandRows = todayRows.filter(r => r.brand === brandId);
      const weekBrandRows = weekRows.filter(r => r.brand === brandId);
      const people = new Set(weekBrandRows.map(r => (r.email || "").toLowerCase())).size;
      const todayCalls = sum(todayBrandRows, "calls");
      const weekCalls = sum(weekBrandRows, "calls");
      const weekCloses = sum(weekBrandRows, "closures");
      const weekRevenue = sum(weekBrandRows, "net_revenue_daily");
      const todayActive = new Set(todayBrandRows.filter(r => (r.calls || 0) > 0).map(r => (r.email || "").toLowerCase())).size;
      const silentRatio = people > 0 ? (people - todayActive) / people : 0;

      let status: "healthy" | "warning" | "critical" | "unknown" = "healthy";
      let diagnosis = "正常推進";
      if (people === 0) {
        status = "unknown"; diagnosis = "無業務在線";
      } else if (!todayHasData && silentRatio === 1) {
        status = "unknown"; diagnosis = `${effectiveToday} 資料(週末/未 sync)`;
      } else if (silentRatio > 0.5) {
        status = "critical"; diagnosis = `${Math.round(silentRatio * 100)}% silent — 需介入`;
      } else if (silentRatio > 0.2) {
        status = "warning"; diagnosis = `${people - todayActive} 位未開口`;
      } else if (todayCalls < people * 30) {
        status = "warning"; diagnosis = `人均 ${(todayCalls / Math.max(1, people)).toFixed(0)} 通(<30 底線)`;
      }

      return {
        brand: brandId,
        name: BRAND_NAMES[brandId],
        today_calls: todayCalls,
        week_calls: weekCalls,
        week_closures: weekCloses,
        week_revenue: weekRevenue,
        people,
        status,
        diagnosis,
      };
    });

    // Top today (by calls)
    const personMap = new Map<string, { name: string; brand: string; calls: number; closures: number }>();
    for (const r of todayRows) {
      const k = (r.email || "").toLowerCase();
      if (!k) continue;
      const e = personMap.get(k) || { name: r.name || k, brand: r.brand || "—", calls: 0, closures: 0 };
      e.calls += r.calls || 0;
      e.closures += r.closures || 0;
      personMap.set(k, e);
    }
    const topToday = Array.from(personMap.values())
      .sort((a, b) => b.calls - a.calls || b.closures - a.closures)
      .slice(0, 5);

    // Struggling: 撥 100+ 通 0 成交(本週)
    const weekPersonMap = new Map<string, { name: string; brand: string; calls: number; closures: number; appointments: number }>();
    for (const r of weekRows) {
      const k = (r.email || "").toLowerCase();
      if (!k) continue;
      const e = weekPersonMap.get(k) || { name: r.name || k, brand: r.brand || "—", calls: 0, closures: 0, appointments: 0 };
      e.calls += r.calls || 0;
      e.closures += r.closures || 0;
      e.appointments += r.appointments_show || 0;
      weekPersonMap.set(k, e);
    }
    const struggling = Array.from(weekPersonMap.values())
      .filter(p => p.calls > 100 && p.closures === 0)
      .map(p => ({
        name: p.name, brand: p.brand, calls: p.calls, closures: p.closures,
        reason: p.appointments === 0
          ? `本週 ${p.calls} 通 / 0 邀約 — 開場白要修`
          : `本週 ${p.calls} 通 / ${p.appointments} 邀約 / 0 成交 — 收尾節奏要修`,
      }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 5);

    // Legal cases
    const { data: legalCasesData } = await sb.from("legal_cases").select("status, due_at");
    const legalCases = legalCasesData || [];
    const openCases = legalCases.filter(c => c.status !== "closed" && c.status !== "resolved").length;
    const todayDate = new Date(today);
    const oneWeek = new Date(today);
    oneWeek.setDate(oneWeek.getDate() + 7);
    const dueWeek = legalCases.filter(c => c.due_at && new Date(c.due_at) >= todayDate && new Date(c.due_at) <= oneWeek && c.status !== "closed").length;
    const overdue = legalCases.filter(c => c.due_at && new Date(c.due_at) < todayDate && c.status !== "closed").length;

    // Training
    const { count: inTraining } = await sb.from("training_assignments").select("*", { count: "exact", head: true }).eq("status", "active");
    // (簡化:沒詳細 students endpoint,只用 count)
    const trainingTodayActive = 0; // TODO Wave 3
    const trainingStuck = 0;
    const trainingNeedAttention = 0;

    // Claude / sync health
    const { data: syncRuns } = await sb
      .from("system_run_log")
      .select("source, status, created_at")
      .ilike("source", "%metabase%")
      .order("created_at", { ascending: false })
      .limit(5);
    const lastSync = syncRuns?.[0];
    const lastSyncDate = lastSync?.created_at?.slice(0, 10);
    let daysBehind: number | null = null;
    if (lastSyncDate) {
      const diff = (new Date(today).getTime() - new Date(lastSyncDate).getTime()) / 86400000;
      daysBehind = Math.floor(diff);
    }
    const syncHealth = daysBehind == null ? "unknown" : daysBehind === 0 ? "healthy" : daysBehind <= 1 ? "warning" : "critical";

    // pending claude_help_requests
    const { count: pendingHuman } = await sb.from("claude_help_requests").select("*", { count: "exact", head: true }).eq("status", "pending");

    // Next actions
    const nextActions: Array<{ urgency: "critical" | "high" | "normal"; title: string; detail: string; href?: string }> = [];
    if (overdue > 0) nextActions.push({ urgency: "critical", title: `${overdue} 件法務案件已逾期`, detail: "需立刻處理或調整 deadline", href: "/admin/legal/cases" });
    if (silent3dEmails.size > 0) nextActions.push({ urgency: "high", title: `${silent3dEmails.size} 位業務連 3 天 silent`, detail: "可能撞牆或離職前兆", href: "/admin/sales/individual" });
    if (struggling.length > 0) nextActions.push({ urgency: "high", title: `${struggling.length} 位業務量多無成交`, detail: "本週需 1on1 練收尾", href: "/admin/sales/individual" });
    if (dueWeek > 0) nextActions.push({ urgency: "normal", title: `${dueWeek} 件法務本週到期`, detail: "提前準備回函", href: "/admin/legal/cases" });
    if (pendingHuman && pendingHuman > 0) nextActions.push({ urgency: "high", title: `Claude 有 ${pendingHuman} 件待你拍板`, detail: "AI 處理不了的案子", href: "/admin/human/sos" });
    if (syncHealth === "critical") nextActions.push({ urgency: "critical", title: "Metabase 同步落後", detail: `last=${lastSyncDate}, 落後 ${daysBehind} 天`, href: "/admin/settings/health" });
    if (nextActions.length === 0) nextActions.push({ urgency: "normal", title: "沒有需立即處理的事", detail: "AI 自動運作中,本週繼續觀察數字" });

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      empire: {
        today_calls: todayCalls,
        today_appointments: todayAppts,
        today_closures: todayCloses,
        today_revenue: todayRevenue,
        week_calls: weekCalls,
        week_appointments: weekAppts,
        week_closures: weekCloses,
        week_revenue: weekRevenue,
        week_vs_last_pct: weekVsLastPct,
        active_users: activeUsersToday,
        silent_today: silentToday,
        silent_3d: silent3dEmails.size,
        effective_date: effectiveToday,
        effective_date_is_today: todayHasData,
      },
      brands: brandSnaps,
      top_today: topToday,
      struggling,
      legal: { open_cases: openCases, due_week: dueWeek, overdue },
      training: {
        in_training: inTraining || 0,
        today_active: trainingTodayActive,
        stuck: trainingStuck,
        need_attention: trainingNeedAttention,
      },
      claude: {
        last_sync_at: lastSync?.created_at || null,
        sync_health: syncHealth,
        days_behind: daysBehind,
        recent_runs: (syncRuns || []).map(r => ({ source: r.source, status: r.status, at: r.created_at })),
        pending_human: pendingHuman || 0,
      },
      next_actions: nextActions,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
