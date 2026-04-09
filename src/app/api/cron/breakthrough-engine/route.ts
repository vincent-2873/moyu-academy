import { getSupabaseAdmin } from "@/lib/supabase";
import { linePush } from "@/lib/line-notify";
import { NextRequest } from "next/server";

/**
 * 突破推力引擎 — 違反人性介入規則
 *
 * 排程建議：每天 09:00 / 12:00 / 18:00 / 21:00 跑 (Vercel Cron)
 *
 * 規則 (rule_id)：
 * - sales_silent_today      今天 0 通電話 → soft 警告
 * - sales_silent_2days      連續 2 天 0 通電話 → hard 介入
 * - no_checkin_morning      早上 10 點還沒 check-in → medium
 * - too_comfortable_3days   連續 3 天舒適度 ≥ 8 → hard
 * - manager_inactive_24h    主管 24 小時沒上線 → hard
 * - low_appointment_3days   連續 3 天 0 邀約 → medium
 *
 * severity 對應：
 * - soft     站內提示
 * - medium   站內提示 + LINE 推播
 * - hard     LINE 推播 + claude_tasks 建立
 * - escalate 升級到主管 + 緊急 LINE
 */

interface RuleResult {
  rule_id: string;
  triggered: number;
  severity: string;
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const startTime = Date.now();
  const results: RuleResult[] = [];
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(now - 86400000).toISOString().slice(0, 10);

  try {
    // 抓所有 active 業務
    const { data: users } = await supabase
      .from("users")
      .select("id, email, name, brand, role, status")
      .eq("status", "active");
    const allUsers = users || [];
    const salesUsers = allUsers.filter((u) =>
      ["sales_rep", "reserve_cadre", "mentor"].includes(u.role)
    );
    const managers = allUsers.filter((u) =>
      ["super_admin", "brand_manager", "team_leader"].includes(u.role)
    );

    // 抓最近 3 天 KPI
    const threeDaysAgo = new Date(now - 3 * 86400000).toISOString().slice(0, 10);
    const { data: kpis } = await supabase
      .from("kpi_entries")
      .select("user_id, date, calls, valid_calls, appointments")
      .gte("date", threeDaysAgo);

    // 抓最近 3 天 check-in
    const { data: checkins } = await supabase
      .from("human_state_checkin")
      .select("user_email, date, comfort_level")
      .gte("date", threeDaysAgo);

    // 抓主管活動
    const { data: activities } = await supabase
      .from("user_activity")
      .select("user_email, last_heartbeat");
    const activityMap = new Map<string, string>();
    (activities || []).forEach((a) => activityMap.set(a.user_email, a.last_heartbeat));

    // ─── 規則 1: 今天 0 通電話 ──────────────────────────────────
    const todayKpis = (kpis || []).filter((k) => k.date === today);
    const calledToday = new Set(todayKpis.filter((k) => (k.calls || 0) > 0).map((k) => k.user_id));
    const silentToday = salesUsers.filter((u) => !calledToday.has(u.id));
    let r1Triggered = 0;
    for (const user of silentToday) {
      const triggered = await fireRule(supabase, {
        rule_id: "sales_silent_today",
        user_email: user.email,
        trigger_reason: `${user.name} 今天 0 通電話 — 還沒開口`,
        intervention: "1 小時內回報今日通數，否則升級警報",
        severity: "soft",
      });
      if (triggered) r1Triggered++;
    }
    results.push({ rule_id: "sales_silent_today", triggered: r1Triggered, severity: "soft" });

    // ─── 規則 2: 連續 2 天 0 通電話 → hard ──────────────────────
    const yesterdayKpis = (kpis || []).filter((k) => k.date === yesterday);
    const calledYesterday = new Set(
      yesterdayKpis.filter((k) => (k.calls || 0) > 0).map((k) => k.user_id)
    );
    const silent2days = salesUsers.filter(
      (u) => !calledToday.has(u.id) && !calledYesterday.has(u.id)
    );
    let r2Triggered = 0;
    for (const user of silent2days) {
      const triggered = await fireRule(supabase, {
        rule_id: "sales_silent_2days",
        user_email: user.email,
        trigger_reason: `${user.name} 連續 2 天 0 通電話 — 在偷懶`,
        intervention: "立刻打 5 通；今天結束前未達標將通知主管",
        severity: "hard",
      });
      if (triggered) {
        r2Triggered++;
        await linePush({
          title: `🔥 ${user.name} 連 2 天沒開口`,
          body: `${user.brand} | ${user.email}\n強制執行：立刻打 5 通電話\n未達標將升級到主管`,
          priority: "high",
        });
      }
    }
    results.push({ rule_id: "sales_silent_2days", triggered: r2Triggered, severity: "hard" });

    // ─── 規則 3: 早上 10 點還沒 check-in → medium ──────────────
    const currentHour = new Date().getHours();
    if (currentHour >= 10) {
      const checkedInToday = new Set(
        (checkins || []).filter((c) => c.date === today).map((c) => c.user_email)
      );
      const noCheckin = allUsers.filter((u) => !checkedInToday.has(u.email));
      let r3Triggered = 0;
      for (const user of noCheckin) {
        const triggered = await fireRule(supabase, {
          rule_id: "no_checkin_morning",
          user_email: user.email,
          trigger_reason: `${user.name} 早上 10 點還沒填 daily check-in`,
          intervention: "立刻填 check-in，否則系統將鎖定學習進度",
          severity: "medium",
        });
        if (triggered) r3Triggered++;
      }
      results.push({ rule_id: "no_checkin_morning", triggered: r3Triggered, severity: "medium" });
    }

    // ─── 規則 4: 連續 3 天舒適度 ≥ 8 → hard ─────────────────────
    const comfortByUser = new Map<string, number[]>();
    (checkins || []).forEach((c) => {
      if (!comfortByUser.has(c.user_email)) comfortByUser.set(c.user_email, []);
      comfortByUser.get(c.user_email)!.push(c.comfort_level || 0);
    });
    let r4Triggered = 0;
    for (const [email, comforts] of comfortByUser) {
      if (comforts.length >= 3 && comforts.every((c) => c >= 8)) {
        const user = allUsers.find((u) => u.email === email);
        if (!user) continue;
        const triggered = await fireRule(supabase, {
          rule_id: "too_comfortable_3days",
          user_email: email,
          trigger_reason: `${user.name} 連續 3 天舒適度 ≥ 8 — 太爽了沒在突破`,
          intervention: "今天必須做一件「明知會痛但會做」的具體動作並回報",
          severity: "hard",
        });
        if (triggered) {
          r4Triggered++;
          await linePush({
            title: `🔥 ${user.name} 太舒適了`,
            body: `連續 3 天舒適度爆表 — 系統判定沒在突破\n今天指派：做一件痛但有效的事`,
            priority: "high",
          });
        }
      }
    }
    results.push({ rule_id: "too_comfortable_3days", triggered: r4Triggered, severity: "hard" });

    // ─── 規則 5: 主管 24 小時沒上線 → hard ───────────────────────
    let r5Triggered = 0;
    for (const m of managers) {
      const beat = activityMap.get(m.email);
      const isInactive = !beat || now - new Date(beat).getTime() > 86400000;
      if (isInactive) {
        const triggered = await fireRule(supabase, {
          rule_id: "manager_inactive_24h",
          user_email: m.email,
          trigger_reason: `主管 ${m.name} 已 24 小時沒進系統 — 自己也在偷懶`,
          intervention: "立刻上線督導團隊",
          severity: "hard",
        });
        if (triggered) {
          r5Triggered++;
          await linePush({
            title: `🔥 主管 ${m.name} 24h 未上線`,
            body: `${m.brand}\n主管督導職責中斷 — 立刻上線`,
            priority: "high",
          });
        }
      }
    }
    results.push({ rule_id: "manager_inactive_24h", triggered: r5Triggered, severity: "hard" });

    // ─── 規則 6: 連續 3 天 0 邀約 → medium ───────────────────────
    const apptByUser = new Map<string, number[]>();
    (kpis || []).forEach((k) => {
      if (!apptByUser.has(k.user_id)) apptByUser.set(k.user_id, []);
      apptByUser.get(k.user_id)!.push(k.appointments || 0);
    });
    let r6Triggered = 0;
    for (const [userId, appts] of apptByUser) {
      if (appts.length >= 3 && appts.every((a) => a === 0)) {
        const user = salesUsers.find((u) => u.id === userId);
        if (!user) continue;
        const triggered = await fireRule(supabase, {
          rule_id: "low_appointment_3days",
          user_email: user.email,
          trigger_reason: `${user.name} 連續 3 天 0 邀約 — 開口品質有問題`,
          intervention: "今晚交一份對練錄音給主管聽",
          severity: "medium",
        });
        if (triggered) r6Triggered++;
      }
    }
    results.push({ rule_id: "low_appointment_3days", triggered: r6Triggered, severity: "medium" });

    // 記錄這次跑的結果
    await supabase.from("claude_actions").insert({
      action_type: "breakthrough_engine",
      target: "all_users",
      summary: `跑完 6 條規則，總共觸發 ${results.reduce((s, r) => s + r.triggered, 0)} 次介入`,
      details: { results, duration_ms: Date.now() - startTime },
      result: "success",
    });

    return Response.json({
      ok: true,
      duration_ms: Date.now() - startTime,
      total_triggered: results.reduce((s, r) => s + r.triggered, 0),
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    try {
      await supabase.from("claude_actions").insert({
        action_type: "breakthrough_engine",
        target: "all_users",
        summary: `引擎執行失敗: ${msg}`,
        details: { results, error: msg },
        result: "failed",
      });
    } catch {}
    return Response.json({ ok: false, error: msg, results }, { status: 500 });
  }
}

/** 觸發單一規則：去重（每人每規則 12 小時內不重複） + 寫 breakthrough_log */
async function fireRule(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  args: {
    rule_id: string;
    user_email: string;
    trigger_reason: string;
    intervention: string;
    severity: "soft" | "medium" | "hard" | "escalate";
  }
): Promise<boolean> {
  const since = new Date(Date.now() - 12 * 3600000).toISOString();
  const { data: existing } = await supabase
    .from("breakthrough_log")
    .select("id")
    .eq("rule_id", args.rule_id)
    .eq("user_email", args.user_email)
    .gte("created_at", since)
    .limit(1);

  if (existing && existing.length > 0) return false;

  await supabase.from("breakthrough_log").insert({
    rule_id: args.rule_id,
    user_email: args.user_email,
    trigger_reason: args.trigger_reason,
    intervention: args.intervention,
    severity: args.severity,
  });

  return true;
}
