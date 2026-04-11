import { getSupabaseAdmin } from "@/lib/supabase";
import { linePush } from "@/lib/line-notify";
import { NextRequest } from "next/server";

/**
 * 主管關心推播 — 每日 08:30 台北 = UTC 00:30
 *
 * 邏輯：
 *   1. 撈最近 7 天 sales_metrics_daily
 *   2. 依 email 找出「連續 ≥2 天 0 成交且 0 邀約」的人 (definitely struggling)
 *   3. 用 team 欄位 group → 找該 team 的 team_leader (role='team_leader' && team 欄位相同)
 *   4. LINE push 該 team_leader: 你組裡 X 和 Y 連續 2 天掛蛋，今天要特別關心
 *   5. 沒 team_leader 的 push Vincent (super_admin)
 *
 * 目的: 讓主管每天早上自動收到「誰需要我今天特別關照」清單，不用自己去挖資料
 */

interface PersonStatus {
  email: string;
  name: string;
  team: string | null;
  brand: string;
  silentDays: number; // 連續 0 成交 0 邀約 0 出席
  allZeroDays: number; // 連續 0 通
  lastCalls: number;
  lastDate: string;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    if (
      !req.headers.get("x-vercel-cron") &&
      !req.headers.get("x-zeabur-cron") &&
      req.nextUrl.searchParams.get("key") !== "manual-trigger"
    ) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const start = sevenDaysAgo.toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .from("sales_metrics_daily")
    .select("date, email, name, team, brand, calls, raw_appointments, appointments_show, closures")
    .gte("date", start)
    .order("date", { ascending: false });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  // Group by email
  const byPerson = new Map<string, PersonStatus>();
  for (const r of rows || []) {
    const email = r.email as string | null;
    if (!email) continue;
    const existing = byPerson.get(email) || {
      email,
      name: (r.name as string) || email,
      team: (r.team as string) || null,
      brand: (r.brand as string) || "-",
      silentDays: 0,
      allZeroDays: 0,
      lastCalls: 0,
      lastDate: r.date as string,
    };

    const zeroShowAndClose =
      (Number(r.closures) || 0) === 0 &&
      (Number(r.appointments_show) || 0) === 0 &&
      (Number(r.raw_appointments) || 0) === 0;
    const zeroCalls = (Number(r.calls) || 0) === 0;

    if (zeroShowAndClose) existing.silentDays += 1;
    if (zeroCalls) existing.allZeroDays += 1;

    if ((r.date as string) > existing.lastDate) {
      existing.lastDate = r.date as string;
      existing.lastCalls = Number(r.calls) || 0;
    }
    byPerson.set(email, existing);
  }

  // Struggling = 連續 2 天 0 邀約 0 出席 0 成交 (工具期的人)
  const struggling = Array.from(byPerson.values()).filter((p) => p.silentDays >= 2);

  // Group struggling by team
  const byTeam = new Map<string, PersonStatus[]>();
  for (const p of struggling) {
    const k = p.team || "(未分組)";
    const arr = byTeam.get(k) || [];
    arr.push(p);
    byTeam.set(k, arr);
  }

  // For each team: find team_leader in users table, push LINE
  const pushed: Array<{ team: string; leader: string | null; count: number; mode: string }> = [];
  for (const [team, members] of byTeam.entries()) {
    // Find team leader (role='team_leader' in same team)
    const { data: leaders } = await supabase
      .from("users")
      .select("email, name, role, team")
      .eq("team", team)
      .eq("role", "team_leader")
      .limit(1);

    const leader = leaders && leaders.length > 0 ? leaders[0] : null;
    const targetEmail = leader ? (leader.email as string) : "vincent@xuemi.co";
    const leaderName = leader ? (leader.name as string) : "Vincent (無組長 → 預設 CEO)";

    const body = [
      `🔴 ${team} 組裡有 ${members.length} 人連續 2+ 天掛蛋`,
      "",
      "今天需要特別關心的人:",
      ...members.map((m) => `  · ${m.name} (連續 ${m.silentDays} 天 0 邀約 0 成交)`),
      "",
      "💡 Claude 建議:",
      "1. 先 1-on-1 問狀態 (不是罵人，是問「卡在哪」)",
      "2. 陪他打 10 通，現場教開場白",
      "3. 如果是名單問題 → 幫他換一批新名單",
      "4. 如果是心態問題 → 先讓他聽別人的錄音",
      "",
      "資料來源: 墨宇戰情中樞 · Claude 自動分析",
    ].join("\n");

    const pushRes = await linePush({
      title: `🔴 ${team} 組有 ${members.length} 人需要關心`,
      body,
      priority: "high",
      reason: "alert",
      userEmail: targetEmail,
    });
    pushed.push({ team, leader: leaderName, count: members.length, mode: pushRes.mode });
  }

  // Log to claude_actions
  await supabase.from("claude_actions").insert({
    action_type: "manager_care_push",
    target: "system",
    summary: `主管關心推播 · ${struggling.length} 人需要關心 · 已推 ${pushed.length} 組`,
    details: { struggling_count: struggling.length, teams_pushed: pushed },
    result: "success",
  });

  return Response.json({
    ok: true,
    struggling_count: struggling.length,
    teams_pushed: pushed,
    range_start: start,
  });
}
