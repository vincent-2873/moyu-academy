import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 每日掃描:偵測所有員工的 first_action 和 streak_days 印章資格,自動蓋章
 *
 * 觸發:cron.yml schedule 台北 23:00 = UTC 15:00(下班後跑)
 * 也支援 manual via Authorization: Bearer CRON_SECRET / x-zeabur-cron
 *
 * 偵測規則(從 stamp_rules table 讀):
 *   first_action.call         → 員工第一次 calls > 0
 *   first_action.appointment  → 員工第一次 raw_appointments > 0
 *   first_action.close        → 員工第一次 closures > 0
 *   streak_days.7 / 30 / N    → 員工連續 N 天 calls > 0
 *
 * Idempotent:auto-stamp endpoint 自己 dedup,同 user + stamp_code 不會重蓋
 *
 * Vincent 2026-04-30 反饋 #7:印章規則 first_action + streak_days 沒人 call
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SalesRow {
  email: string;
  date: string;
  calls: number;
  raw_appointments: number;
  closures: number;
}

interface StampRule {
  code: string;
  trigger_type: string;
  trigger_config: { action?: string; days?: number };
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const bypassed = req.headers.get("x-zeabur-cron") || req.headers.get("x-cron-bypass");
  if (cronSecret && !bypassed && auth !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const started = Date.now();

  // 1. 撈 stamp_rules where trigger_type ∈ (first_action, streak_days)
  const { data: rules } = await sb
    .from("stamp_rules")
    .select("code, trigger_type, trigger_config")
    .in("trigger_type", ["first_action", "streak_days"])
    .eq("is_active", true);

  const firstActionRules = (rules || []).filter((r: StampRule) => r.trigger_type === "first_action");
  const streakDaysRules = (rules || []).filter((r: StampRule) => r.trigger_type === "streak_days");

  if (firstActionRules.length === 0 && streakDaysRules.length === 0) {
    return Response.json({ ok: true, note: "no first_action or streak_days rules" });
  }

  // 2. 撈所有 sales_metrics_daily(fetchAllRows 繞 1000 cap)
  const allRows = await fetchAllRows<SalesRow>(() =>
    sb.from("sales_metrics_daily")
      .select("email, date, calls, raw_appointments, closures")
      .not("email", "is", null)
      .order("date", { ascending: true })
  );

  // 3. Group by email
  const byEmail = new Map<string, SalesRow[]>();
  for (const r of allRows) {
    if (!byEmail.has(r.email)) byEmail.set(r.email, []);
    byEmail.get(r.email)!.push(r);
  }

  const triggers: Array<{ email: string; trigger_type: string; context: Record<string, unknown> }> = [];

  // 4. For each user, detect first_action + max streak
  for (const [email, rows] of byEmail.entries()) {
    // first_action — 找最早一筆 X > 0 的 row
    for (const rule of firstActionRules) {
      const action = rule.trigger_config?.action;
      if (!action) continue;
      const field = action === "call" ? "calls"
        : action === "appointment" ? "raw_appointments"
        : action === "close" ? "closures" : null;
      if (!field) continue;
      const firstHit = rows.find((r) => Number((r as unknown as Record<string, unknown>)[field]) > 0);
      if (firstHit) {
        triggers.push({ email, trigger_type: "first_action", context: { action, first_date: firstHit.date } });
      }
    }

    // streak_days — 計算最大連續上工天數(calls > 0 視為上工)
    let maxStreak = 0;
    let curStreak = 0;
    let prevDate: Date | null = null;
    for (const r of rows) {
      const isWorked = Number(r.calls) > 0;
      const curDate = new Date(r.date);
      if (isWorked) {
        if (prevDate && (curDate.getTime() - prevDate.getTime()) === 86400000) {
          curStreak += 1;
        } else {
          curStreak = 1;
        }
        if (curStreak > maxStreak) maxStreak = curStreak;
        prevDate = curDate;
      } else {
        curStreak = 0;
        prevDate = null;
      }
    }
    if (maxStreak > 0) {
      // 對每條 streak rule 檢查
      for (const rule of streakDaysRules) {
        const reqDays = Number(rule.trigger_config?.days) || 0;
        if (maxStreak >= reqDays) {
          triggers.push({ email, trigger_type: "streak_days", context: { days: maxStreak, threshold: reqDays } });
        }
      }
    }
  }

  // 5. Call auto-stamp endpoint(internal — bypass auth via service-side hop)
  // 為避免 caller-ID auth,直接 inline call stamp logic
  let stampedCount = 0;
  let skippedCount = 0;

  // Group triggers by email,1 user 1 fetch user_id
  const userMap = new Map<string, string>();
  const distinctEmails = Array.from(new Set(triggers.map((t) => t.email)));
  if (distinctEmails.length > 0) {
    const { data: users } = await sb.from("users").select("id, email").in("email", distinctEmails);
    for (const u of (users || []) as Array<{ id: string; email: string }>) {
      userMap.set(u.email.toLowerCase(), u.id);
    }
  }

  for (const t of triggers) {
    const userId = userMap.get(t.email.toLowerCase());
    if (!userId) { skippedCount += 1; continue; }
    // Match stamp_rule
    const matchingRules = (rules || []).filter((r: StampRule) => {
      if (r.trigger_type !== t.trigger_type) return false;
      const cfg = r.trigger_config || {};
      if (t.trigger_type === "first_action") return cfg.action === t.context.action;
      if (t.trigger_type === "streak_days") return Number(cfg.days || 0) <= Number(t.context.days || 0);
      return false;
    });
    for (const rule of matchingRules) {
      // idempotency: same user + stamp_code only once
      const { data: existing } = await sb
        .from("training_stamps")
        .select("id")
        .eq("user_id", userId)
        .eq("stamp_code", rule.code)
        .limit(1);
      if (existing && existing.length > 0) { skippedCount += 1; continue; }
      const fullRule = (rules || []).find((r: { code: string }) => r.code === rule.code) as { code: string; trigger_type: string; trigger_config: Record<string, unknown>; name?: string; rarity?: string } | undefined;
      const { error } = await sb.from("training_stamps").insert({
        user_id: userId,
        stamp_code: rule.code,
        stamp_name: (fullRule as { name?: string })?.name || rule.code,
        rarity: (fullRule as { rarity?: string })?.rarity || "common",
        metadata: { trigger_type: t.trigger_type, context: t.context, source: "daily-stamp-detect-cron" },
      });
      if (!error) stampedCount += 1;
    }
  }

  // Log
  await sb.from("claude_actions").insert({
    action_type: "daily_stamp_detect",
    target: "system",
    summary: `自動偵測:${triggers.length} 個 trigger,${stampedCount} 蓋章 / ${skippedCount} skip`,
    details: { triggers_count: triggers.length, stamped: stampedCount, skipped: skippedCount },
    result: "success",
  });

  return Response.json({
    ok: true,
    duration_ms: Date.now() - started,
    users_scanned: byEmail.size,
    triggers_detected: triggers.length,
    stamped: stampedCount,
    skipped: skippedCount,
  });
}

export async function POST(req: NextRequest) { return GET(req); }
