import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";
import { requireCallerEmail } from "@/lib/auth";

/**
 * 成就系統 — 主要服務新人，但老人也能拿到長期里程碑
 *
 * GET /api/me/achievements?email=<email>
 *
 * 依 sales_metrics_daily 的累積值 + 歷史軌跡，找出該業務「已達成」「接近達成」「還很遠」
 * 的里程碑。這不是裝飾性的徽章 — 是給新人「看得見進度」的工具，
 * 因為新人沒有客戶、沒有成交、沒有成就感，只會想離職。
 *
 * 設計哲學：
 *   - 前 5 個成就是「一定拿得到」的基礎里程碑（第 1 通、第 100 通、第 1 個邀約等）
 *   - 中間是「累積型」（第 1000 通、第 10 個成交等）
 *   - 最後是「成長型」（首次日破百通、首次週達標、首次月破 $10 萬等）
 *   - 不顯示「已完成」的成就（已拿過就消失）→ 永遠有新目標
 *   - 每個成就都有「距離」欄位，讓人知道還差多少
 */

interface Achievement {
  id: string;
  tier: "rookie" | "growing" | "veteran" | "elite";
  icon: string;
  title: string;
  description: string;
  metric: string; // which metric it tracks
  target: number;
  actual: number;
  pct: number; // 0-100
  unlocked: boolean;
  unlockedAt?: string; // 如果 unlocked 才有
}

function todayTaipei(): string {
  const now = new Date();
  const tp = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return tp.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return Response.json({ ok: false, error: "email required" }, { status: 400 });
  }
  const authErr = requireCallerEmail(req, email);
  if (authErr) return authErr;

  const supabase = getSupabaseAdmin();

  // 拉該業務的所有歷史 (最多 180 天)
  const since = new Date();
  since.setDate(since.getDate() - 180);
  const { data: rows, error } = await supabase
    .from("sales_metrics_daily")
    .select("date, calls, call_minutes, connected, raw_appointments, appointments_show, closures, net_revenue_daily")
    .eq("email", email)
    .gte("date", since.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const allRows = rows || [];
  if (allRows.length === 0) {
    return Response.json({ ok: true, email, bound: false, achievements: [] });
  }

  // 計算累積值
  const cum = {
    calls: 0,
    call_minutes: 0,
    connected: 0,
    raw_appointments: 0,
    appointments_show: 0,
    closures: 0,
    revenue: 0,
    days_active: 0,
  };
  let maxDailyCalls = 0;
  let maxDailyRevenue = 0;
  let streakDays = 0; // 連續打電話天數 (calls > 0)
  let longestStreak = 0;
  let currentStreak = 0;

  // 找「首次」達成的日期
  const firstDate: Record<string, string | null> = {
    first_call: null,
    first_appointment: null,
    first_show: null,
    first_closure: null,
    first_100_calls_day: null, // 首次單日破百通
    first_10k_day: null, // 首次單日破 $10k
  };

  let prevDate: string | null = null;
  for (const r of allRows) {
    const calls = Number(r.calls) || 0;
    const minutes = Number(r.call_minutes) || 0;
    const connected = Number(r.connected) || 0;
    const appts = Number(r.raw_appointments) || 0;
    const shows = Number(r.appointments_show) || 0;
    const closes = Number(r.closures) || 0;
    const rev = Number(r.net_revenue_daily) || 0;
    const d = r.date as string;

    cum.calls += calls;
    cum.call_minutes += minutes;
    cum.connected += connected;
    cum.raw_appointments += appts;
    cum.appointments_show += shows;
    cum.closures += closes;
    cum.revenue += rev;
    if (calls > 0 || minutes > 0) cum.days_active += 1;

    if (calls > maxDailyCalls) maxDailyCalls = calls;
    if (rev > maxDailyRevenue) maxDailyRevenue = rev;

    if (firstDate.first_call == null && calls > 0) firstDate.first_call = d;
    if (firstDate.first_appointment == null && appts > 0) firstDate.first_appointment = d;
    if (firstDate.first_show == null && shows > 0) firstDate.first_show = d;
    if (firstDate.first_closure == null && closes > 0) firstDate.first_closure = d;
    if (firstDate.first_100_calls_day == null && calls >= 100) firstDate.first_100_calls_day = d;
    if (firstDate.first_10k_day == null && rev >= 10000) firstDate.first_10k_day = d;

    // 連續打電話 streak
    if (calls > 0) {
      if (prevDate) {
        const prev = new Date(prevDate);
        const cur = new Date(d);
        const diffDays = (cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays <= 3) {
          // 3 天內算連續 (容忍週末)
          currentStreak += 1;
        } else {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }
      if (currentStreak > longestStreak) longestStreak = currentStreak;
      prevDate = d;
    }
  }
  streakDays = currentStreak;

  // 定義成就列表
  type Def = Omit<Achievement, "actual" | "pct" | "unlocked" | "unlockedAt">;
  const defs: Array<Def & { actual: number; unlockedAt?: string | null }> = [
    // ROOKIE (新人第 1 週) — 大量小勝利讓新人有希望
    {
      id: "first_call",
      tier: "rookie",
      icon: "📞",
      title: "打出第一通",
      description: "踏出銷售生涯第一步",
      metric: "cum.calls",
      target: 1,
      actual: cum.calls,
      unlockedAt: firstDate.first_call || undefined,
    },
    {
      id: "first_10_calls",
      tier: "rookie",
      icon: "🔟",
      title: "累積 10 通",
      description: "熱身階段已結束，聲線熟了",
      metric: "cum.calls",
      target: 10,
      actual: cum.calls,
    },
    {
      id: "first_30_minutes",
      tier: "rookie",
      icon: "⏰",
      title: "單日累計通時 30 分",
      description: "半小時等於跨過新人門檻",
      metric: "cum.call_minutes",
      target: 30,
      actual: cum.call_minutes,
    },
    {
      id: "first_connected",
      tier: "rookie",
      icon: "✅",
      title: "第一次有人接起來",
      description: "對方真的聽到你的聲音",
      metric: "cum.connected",
      target: 1,
      actual: cum.connected,
    },
    {
      id: "first_100_calls",
      tier: "rookie",
      icon: "💯",
      title: "累積 100 通",
      description: "打滿 100 通才開始進入狀況",
      metric: "cum.calls",
      target: 100,
      actual: cum.calls,
    },
    {
      id: "first_appointment",
      tier: "rookie",
      icon: "📅",
      title: "第一個邀約",
      description: "第一次讓客戶說「好，我來」",
      metric: "cum.raw_appointments",
      target: 1,
      actual: cum.raw_appointments,
      unlockedAt: firstDate.first_appointment || undefined,
    },
    {
      id: "first_show",
      tier: "rookie",
      icon: "🪑",
      title: "第一個出席",
      description: "你的邀約客戶真的出現了",
      metric: "cum.appointments_show",
      target: 1,
      actual: cum.appointments_show,
      unlockedAt: firstDate.first_show || undefined,
    },
    {
      id: "first_closure",
      tier: "rookie",
      icon: "🎯",
      title: "第一張成交",
      description: "你的第一筆簽單 — 從這裡開始你是業務",
      metric: "cum.closures",
      target: 1,
      actual: cum.closures,
      unlockedAt: firstDate.first_closure || undefined,
    },
    // GROWING (進入狀況)
    {
      id: "calls_1000",
      tier: "growing",
      icon: "📊",
      title: "累積 1,000 通",
      description: "肌肉記憶開始建立",
      metric: "cum.calls",
      target: 1000,
      actual: cum.calls,
    },
    {
      id: "first_100_calls_day",
      tier: "growing",
      icon: "🔥",
      title: "單日破百通",
      description: "第一次一天打到 100 通 — 你的天花板提高了",
      metric: "maxDailyCalls",
      target: 100,
      actual: maxDailyCalls,
      unlockedAt: firstDate.first_100_calls_day || undefined,
    },
    {
      id: "appointments_50",
      tier: "growing",
      icon: "📋",
      title: "50 個邀約",
      description: "邀約已是你的日常",
      metric: "cum.raw_appointments",
      target: 50,
      actual: cum.raw_appointments,
    },
    {
      id: "closures_5",
      tier: "growing",
      icon: "⭐",
      title: "5 張成交",
      description: "從單次成交到穩定產出",
      metric: "cum.closures",
      target: 5,
      actual: cum.closures,
    },
    {
      id: "revenue_100k",
      tier: "growing",
      icon: "💰",
      title: "累積 $100,000",
      description: "第一個十萬 — 你已經在養自己",
      metric: "cum.revenue",
      target: 100000,
      actual: cum.revenue,
    },
    // VETERAN
    {
      id: "calls_5000",
      tier: "veteran",
      icon: "🎖️",
      title: "累積 5,000 通",
      description: "這個量只有老業務才做得出",
      metric: "cum.calls",
      target: 5000,
      actual: cum.calls,
    },
    {
      id: "closures_20",
      tier: "veteran",
      icon: "🏆",
      title: "20 張成交",
      description: "穩定中型業務",
      metric: "cum.closures",
      target: 20,
      actual: cum.closures,
    },
    {
      id: "first_10k_day",
      tier: "veteran",
      icon: "💎",
      title: "單日破 $10,000",
      description: "第一次單日收入破萬",
      metric: "maxDailyRevenue",
      target: 10000,
      actual: maxDailyRevenue,
      unlockedAt: firstDate.first_10k_day || undefined,
    },
    {
      id: "revenue_500k",
      tier: "veteran",
      icon: "💵",
      title: "累積 $500,000",
      description: "半百萬營收里程碑",
      metric: "cum.revenue",
      target: 500000,
      actual: cum.revenue,
    },
    {
      id: "streak_10",
      tier: "veteran",
      icon: "⚡",
      title: "連續 10 天打電話",
      description: "紀律才是業務真正的天賦",
      metric: "longestStreak",
      target: 10,
      actual: longestStreak,
    },
    // ELITE
    {
      id: "calls_10000",
      tier: "elite",
      icon: "👑",
      title: "累積 10,000 通",
      description: "五位數通次 — 你的每一通都已是藝術",
      metric: "cum.calls",
      target: 10000,
      actual: cum.calls,
    },
    {
      id: "closures_100",
      tier: "elite",
      icon: "🌟",
      title: "100 張成交",
      description: "百單俱樂部",
      metric: "cum.closures",
      target: 100,
      actual: cum.closures,
    },
    {
      id: "revenue_1m",
      tier: "elite",
      icon: "💸",
      title: "累積 $1,000,000",
      description: "七位數業績俱樂部",
      metric: "cum.revenue",
      target: 1000000,
      actual: cum.revenue,
    },
  ];

  const achievements: Achievement[] = defs.map((d) => {
    const pct = Math.min(100, Math.round((d.actual / d.target) * 100));
    const unlocked = d.actual >= d.target;
    return {
      id: d.id,
      tier: d.tier,
      icon: d.icon,
      title: d.title,
      description: d.description,
      metric: d.metric,
      target: d.target,
      actual: d.actual,
      pct,
      unlocked,
      unlockedAt: unlocked ? d.unlockedAt || undefined : undefined,
    };
  });

  // 剛解鎖的 (7 天內)
  const now = Date.now();
  const recentlyUnlocked = achievements.filter((a) => {
    if (!a.unlocked || !a.unlockedAt) return false;
    const unlockedMs = new Date(a.unlockedAt).getTime();
    return now - unlockedMs < 7 * 24 * 60 * 60 * 1000;
  });

  // 進行中 (未解鎖 + pct >= 30 — 快拿到的)
  const inProgress = achievements
    .filter((a) => !a.unlocked && a.pct >= 30)
    .sort((a, b) => b.pct - a.pct);

  // 下一個目標 (未解鎖 + 最接近的 3 個)
  const upNext = achievements
    .filter((a) => !a.unlocked)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);

  // 已解鎖 (按時間倒序)
  const unlocked = achievements
    .filter((a) => a.unlocked)
    .sort((a, b) => {
      if (!a.unlockedAt) return 1;
      if (!b.unlockedAt) return -1;
      return b.unlockedAt.localeCompare(a.unlockedAt);
    });

  return Response.json({
    ok: true,
    email,
    bound: true,
    stats: {
      totalAchievements: achievements.length,
      unlockedCount: unlocked.length,
      daysActive: cum.days_active,
      longestStreak,
      currentStreak: streakDays,
    },
    recentlyUnlocked,
    inProgress,
    upNext,
    unlocked,
    all: achievements,
    today: todayTaipei(),
  });
}
