import { getSupabaseAdmin } from "@/lib/supabase";
import { hasGoogleCredentials, readRecruitSheet, getSheetRowLink } from "@/lib/google-api";
import { linePush, buildCommandsFlex } from "@/lib/line-notify";
import { NextRequest } from "next/server";

/**
 * 招聘自動化 — 每日 07:00 TW (UTC 23:00)
 *
 * 1. 讀 Google Sheet 邀約紀錄表 → 找墨凡/睿富的記錄
 * 2. 根據每筆記錄的狀態，產出今日具體任務：
 *    - 📞 電話邀約（已發信未回覆）
 *    - 🎤 面試（今天/明天有面試）
 *    - 🔄 追蹤（offer/到職/二面）
 * 3. 寫入 v3_commands + LINE 推播
 *
 * 重點：不再用 Claude 猜任務，直接從 Google Sheet 的真實資料產出
 */

export const maxDuration = 60;

function todayTaipei(): string {
  const now = new Date();
  const tp = new Date(now.getTime() + 8 * 3600 * 1000);
  return tp.toISOString().slice(0, 10);
}

function tomorrowTaipei(): string {
  const now = new Date();
  const tp = new Date(now.getTime() + 8 * 3600 * 1000 + 24 * 3600 * 1000);
  return tp.toISOString().slice(0, 10);
}

function daysBetween(dateStr: string): number {
  const d = new Date(dateStr);
  return Math.floor((Date.now() - d.getTime()) / (24 * 3600 * 1000));
}

interface TaskRow {
  owner_email: string;
  pillar_id: "recruit";
  title: string;
  detail: string;
  severity: "critical" | "high" | "normal" | "info";
  status: "pending";
  ai_generated: true;
  ai_reasoning: string;
  deadline: string;
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
  const today = todayTaipei();
  const tomorrow = tomorrowTaipei();
  const endOfDay = new Date(Date.now() + 12 * 3600 * 1000).toISOString();

  // ═══════════════════════════════════════════════
  // 1. 讀 Google Sheet（如果有 credentials）
  // ═══════════════════════════════════════════════
  let sheetRows: Awaited<ReturnType<typeof readRecruitSheet>> = [];
  let sheetError: string | null = null;
  const hasGCreds = hasGoogleCredentials();

  if (hasGCreds) {
    try {
      sheetRows = await readRecruitSheet({
        channels: ["墨凡", "睿富"],
        daysBack: 30,
      });
    } catch (err) {
      sheetError = err instanceof Error ? err.message : String(err);
      console.error("[recruit-auto-outreach] Sheet read failed:", sheetError);
    }
  }

  // ═══════════════════════════════════════════════
  // 2. 也從 Supabase 拉資料（補充 Sheet 沒有的）
  // ═══════════════════════════════════════════════
  const { data: dbRecruits } = await supabase
    .from("recruits")
    .select("*")
    .not("owner_email", "is", null);

  const { data: dbOutreach } = await supabase
    .from("outreach_log")
    .select("*")
    .not("owner_email", "is", null);

  // ═══════════════════════════════════════════════
  // 3. 找所有招聘員
  // ═══════════════════════════════════════════════
  // 從 Sheet 的負責人 + DB 的 owner_email 合併
  const recruiterSet = new Set<string>();
  for (const row of sheetRows) {
    if (row.recruiter) recruiterSet.add(row.recruiter);
  }
  for (const r of dbRecruits || []) {
    if (r.owner_email) recruiterSet.add(r.owner_email);
  }

  // 找對應的 users（有 email 的）
  const { data: usersData } = await supabase
    .from("users")
    .select("email, name, line_user_id")
    .eq("status", "active");

  const usersByName: Record<string, { email: string; name: string }> = {};
  const usersByEmail: Record<string, { email: string; name: string }> = {};
  for (const u of usersData || []) {
    if (u.name) usersByName[u.name] = u;
    if (u.email) usersByEmail[u.email] = u;
  }

  // 招聘員名字 → email 的靜態 mapping（Sheet 上的負責人名字對不到 users 表時用）
  const RECRUITER_MAP: Record<string, string> = {
    Lynn: "lynn@xplatform.world",
    Lora: "lora@xplatform.world",
    Sense: "sense@xplatform.world",
    Han: "han@xplatform.world",
    Nick: "nick@xplatform.world",
    Stetson: "stetson@xplatform.world",
    Vincent: "vincent@xuemi.co",
    Aliz: "aliz@xplatform.world",
    Jeff: "jeff@xplatform.world",
    Odelia: "odelia@xplatform.world",
    FANNY: "fanny@xplatform.world",
    Eden: "eden@xplatform.world",
  };

  // ═══════════════════════════════════════════════
  // 4. 清掉今天已有的 recruit commands
  // ═══════════════════════════════════════════════
  await supabase
    .from("v3_commands")
    .delete()
    .eq("pillar_id", "recruit")
    .eq("ai_generated", true)
    .gte("created_at", today + "T00:00:00Z")
    .lt("created_at", today + "T23:59:59Z");

  // ═══════════════════════════════════════════════
  // 5. 從 Sheet 資料產出任務
  // ═══════════════════════════════════════════════
  const tasksByRecruiter: Record<string, TaskRow[]> = {};

  for (const row of sheetRows) {
    const recruiter = row.recruiter;
    const user = usersByName[recruiter];
    const email = user?.email || RECRUITER_MAP[recruiter] || (recruiter.includes("@") ? recruiter : null);
    if (!email) continue;

    if (!tasksByRecruiter[email]) tasksByRecruiter[email] = [];
    const tasks = tasksByRecruiter[email];
    const sheetLink = getSheetRowLink(row.rowIndex);

    // ── 🎤 面試（今天/明天有面試時間）──
    if (row.interviewTime) {
      const iDate = new Date(row.interviewTime);
      // 轉台北時間的 YYYY-MM-DD（Sheet 的時間可能沒有 timezone）
      const taipeiDate = new Date(iDate.getTime() + 8 * 3600 * 1000);
      const iDateStr = taipeiDate.toISOString().slice(0, 10);
      if (iDateStr === today || iDateStr === tomorrow) {
        // 只處理還沒有出席狀況的
        if (!row.attendanceStatus) {
          const when = iDateStr === today ? "今天" : "明天";
          const time = iDate.toLocaleTimeString("zh-TW", {
            hour: "2-digit", minute: "2-digit", timeZone: "Asia/Taipei",
          });
          tasks.push({
            owner_email: email,
            pillar_id: "recruit",
            title: `🎤 面試 — ${row.name}`,
            detail: [
              row.phone ? `📞 ${row.phone}` : null,
              `${when} ${time} · ${row.branch || "待定"}`,
              row.interviewManager ? `主管: ${row.interviewManager}` : null,
              row.inviteRecord || null,
              `📋 邀約紀錄: ${sheetLink}`,
            ].filter(Boolean).join("\n"),
            severity: iDateStr === today ? "critical" : "high",
            status: "pending",
            ai_generated: true,
            ai_reasoning: `interview_${when}_sheet_row_${row.rowIndex}`,
            deadline: endOfDay,
          });
        }
        continue; // 有面試就不用再產其他任務
      }
    }

    // ── 📞 電話邀約（已發信、還沒有面試時間）──
    if (!row.interviewTime && row.inviteDate) {
      const days = daysBetween(row.inviteDate);
      if (days >= 1 && days <= 14) {
        // 判斷邀約方式
        const isCallInvite = row.inviteMethod === "電話邀約";
        const action = isCallInvite ? "📞 電話跟進" : "📞 追蹤回覆";
        tasks.push({
          owner_email: email,
          pillar_id: "recruit",
          title: `${action} — ${row.name}`,
          detail: [
            row.phone ? `📞 ${row.phone}` : null,
            `${row.inviteMethod} · ${row.channel} · ${days}天前邀約`,
            row.inviteRecord || null,
            `📋 邀約紀錄: ${sheetLink}`,
          ].filter(Boolean).join("\n"),
          severity: days >= 5 ? "high" : "normal",
          status: "pending",
          ai_generated: true,
          ai_reasoning: `follow_up_${days}d_sheet_row_${row.rowIndex}`,
          deadline: endOfDay,
        });
      }
    }

    // ── 🔄 Offer 跟進 ──
    if (row.isHired === "錄取" && !row.arrivalTime && !row.arrivalIntent) {
      tasks.push({
        owner_email: email,
        pillar_id: "recruit",
        title: `🔄 Offer 跟進 — ${row.name}`,
        detail: [
          row.phone ? `📞 ${row.phone}` : null,
          "已錄取但尚未確認到職意願",
          `📋 邀約紀錄: ${sheetLink}`,
        ].filter(Boolean).join("\n"),
        severity: "critical",
        status: "pending",
        ai_generated: true,
        ai_reasoning: `offer_follow_up_sheet_row_${row.rowIndex}`,
        deadline: endOfDay,
      });
    }

    // ── 🔄 二面安排 ──
    if (row.isArrangeSecond === "是" && !row.secondInterviewTime) {
      tasks.push({
        owner_email: email,
        pillar_id: "recruit",
        title: `🔄 安排二面 — ${row.name}`,
        detail: [
          row.phone ? `📞 ${row.phone}` : null,
          "一面通過，需安排二面時間",
          `📋 邀約紀錄: ${sheetLink}`,
        ].filter(Boolean).join("\n"),
        severity: "high",
        status: "pending",
        ai_generated: true,
        ai_reasoning: `arrange_second_sheet_row_${row.rowIndex}`,
        deadline: endOfDay,
      });
    }
  }

  // ═══════════════════════════════════════════════
  // 6. 也從 DB 補充 Sheet 沒有的任務（到職/試用期追蹤）
  // ═══════════════════════════════════════════════
  for (const r of dbRecruits || []) {
    if (!r.owner_email) continue;
    if (!tasksByRecruiter[r.owner_email]) tasksByRecruiter[r.owner_email] = [];

    if (r.stage === "onboarded" || r.stage === "probation") {
      const enteredDate = r.stage_entered_at || r.hired_at || r.created_at;
      const days = daysBetween(enteredDate);
      if (r.stage === "onboarded" && days >= 7) {
        tasksByRecruiter[r.owner_email].push({
          owner_email: r.owner_email,
          pillar_id: "recruit",
          title: `🔄 追蹤到職 — ${r.name}`,
          detail: [
            r.phone ? `📞 ${r.phone}` : null,
            `到職 ${days} 天，確認適應狀況`,
          ].filter(Boolean).join("\n"),
          severity: "normal",
          status: "pending",
          ai_generated: true,
          ai_reasoning: "onboarding_follow_up",
          deadline: endOfDay,
        });
      }
    }
  }

  // ═══════════════════════════════════════════════
  // 7. 排序 + 寫入 v3_commands + LINE 推播
  // ═══════════════════════════════════════════════
  const sevOrder: Record<string, number> = { critical: 0, high: 1, normal: 2, info: 3 };
  const results: Array<{ email: string; tasks: number; mode?: string }> = [];

  for (const [email, tasks] of Object.entries(tasksByRecruiter)) {
    tasks.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9));

    if (tasks.length === 0) {
      results.push({ email, tasks: 0 });
      continue;
    }

    const { data: inserted } = await supabase
      .from("v3_commands")
      .insert(tasks)
      .select("id, title, detail, severity");

    if (inserted && inserted.length > 0) {
      const callCount = tasks.filter((t) => t.title.includes("📞")).length;
      const interviewCount = tasks.filter((t) => t.title.includes("🎤")).length;
      const otherCount = inserted.length - callCount - interviewCount;

      const summary = [
        interviewCount > 0 ? `🎤 ${interviewCount} 場面試` : null,
        callCount > 0 ? `📞 ${callCount} 通電話` : null,
        otherCount > 0 ? `🔄 ${otherCount} 項追蹤` : null,
      ].filter(Boolean).join(" · ");

      const flex = buildCommandsFlex(
        inserted as Array<{ id: string; title: string; detail: string | null; severity: "info" | "normal" | "high" | "critical" }>,
        `今日招聘 — ${summary}`
      );

      const pushRes = await linePush({
        title: "📋 今日招聘任務",
        body: `${summary}\n\n打開招聘工作台查看詳情`,
        flexMessage: flex,
        userEmail: email,
        priority: tasks.some((t) => t.severity === "critical") ? "critical" : "high",
        reason: "recruit_auto_outreach",
      });

      results.push({ email, tasks: inserted.length, mode: pushRes.mode });
    } else {
      results.push({ email, tasks: tasks.length });
    }
  }

  // Log
  const totalTasks = results.reduce((sum, r) => sum + r.tasks, 0);
  await supabase.from("claude_actions").insert({
    action_type: "recruit_auto_outreach",
    target: today,
    summary: `招聘自動化: ${results.length} 招聘員, ${totalTasks} 任務, ${sheetRows.length} Sheet 記錄`,
    details: { results, sheetRowsProcessed: sheetRows.length },
    result: "success",
  });

  return Response.json({
    ok: true,
    date: today,
    hasGoogleCreds: hasGCreds,
    sheetError,
    sheetRows: sheetRows.length,
    recruiters: results.length,
    totalTasks,
    results,
  });
}
