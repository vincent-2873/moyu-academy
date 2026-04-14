import { getSupabaseAdmin } from "@/lib/supabase";
import { linePush, buildCommandsFlex } from "@/lib/line-notify";
import { NextRequest } from "next/server";

/**
 * 招聘員每日任務自動產出 — 每天 09:15 TW = UTC 01:15
 *
 * 不用 Claude 猜「今天做什麼」— 直接從資料庫拉出具體行動：
 *
 * 1. 📞 要打的電話：
 *    - 面試確認（interview 階段 + 面試時間在今天/明天）
 *    - 未回覆跟進（outreach 發出 2+ 天沒回覆）
 *    - offer 跟進（offer 階段超過 3 天未確認）
 *
 * 2. ✉️ 要發的信：
 *    - 新求職者邀約（recruits stage=new/applied，還沒發過 outreach）
 *    - 面試結果通知（已面試完的，需要回覆結果）
 *
 * 3. 🔄 其他跟進：
 *    - 到職確認（onboarded 階段超過 7 天沒更新）
 *    - 試用期追蹤（probation 階段）
 *
 * 全部寫進 v3_commands (pillar=recruit) + LINE 推播
 */

export const maxDuration = 60;

function todayTaipei(): string {
  const now = new Date();
  const tp = new Date(now.getTime() + 8 * 3600 * 1000);
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
  const tomorrow = new Date(Date.now() + 32 * 3600 * 1000).toISOString().slice(0, 10);

  // ═══════════════════════════════════════════════
  // 1. 找所有招聘員（有在 recruits 表當 owner 的人）
  // ═══════════════════════════════════════════════
  const { data: recruiterRows } = await supabase
    .from("recruits")
    .select("owner_email")
    .not("owner_email", "is", null);

  const recruiterEmails = [...new Set(
    (recruiterRows || []).map((r) => r.owner_email).filter(Boolean) as string[]
  )];

  if (recruiterEmails.length === 0) {
    return Response.json({ ok: true, message: "no recruiters found", pushed: 0 });
  }

  // ═══════════════════════════════════════════════
  // 2. 批量拉資料
  // ═══════════════════════════════════════════════
  const { data: allRecruits } = await supabase
    .from("recruits")
    .select("id, name, phone, email, stage, brand, owner_email, stage_entered_at, interview_at, offered_at, hired_at, created_at, notes")
    .not("owner_email", "is", null);

  const { data: allOutreach } = await supabase
    .from("outreach_log")
    .select("id, candidate_name, candidate_email, platform, status, sent_at, response_at, follow_up_count, owner_email, job_title")
    .not("owner_email", "is", null);

  // 清掉今天已有的 recruit commands（避免重跑 cron 重複）
  await supabase
    .from("v3_commands")
    .delete()
    .eq("pillar_id", "recruit")
    .eq("ai_generated", true)
    .gte("created_at", today + "T00:00:00Z")
    .lt("created_at", today + "T23:59:59Z");

  const results: Array<{ email: string; tasks: number; mode?: string }> = [];

  // ═══════════════════════════════════════════════
  // 3. 每個招聘員產出具體任務
  // ═══════════════════════════════════════════════
  for (const email of recruiterEmails) {
    const myRecruits = (allRecruits || []).filter((r) => r.owner_email === email);
    const myOutreach = (allOutreach || []).filter((o) => o.owner_email === email);
    const tasks: TaskRow[] = [];
    const endOfDay = new Date(Date.now() + 12 * 3600 * 1000).toISOString();

    // ──────────────────────────────────────────
    // 📞 面試確認電話（面試在今天或明天）
    // ──────────────────────────────────────────
    for (const r of myRecruits) {
      if (!r.interview_at) continue;
      const interviewDate = r.interview_at.slice(0, 10);
      if (interviewDate === today || interviewDate === tomorrow) {
        const when = interviewDate === today ? "今天" : "明天";
        const time = new Date(r.interview_at).toLocaleTimeString("zh-TW", {
          hour: "2-digit", minute: "2-digit", timeZone: "Asia/Taipei",
        });
        tasks.push({
          owner_email: email,
          pillar_id: "recruit",
          title: `📞 打電話給 ${r.name} — 確認${when}面試`,
          detail: [
            r.phone ? `電話: ${r.phone}` : null,
            `面試時間: ${when} ${time}`,
            r.brand ? `品牌: ${r.brand}` : null,
          ].filter(Boolean).join("\n"),
          severity: interviewDate === today ? "critical" : "high",
          status: "pending",
          ai_generated: true,
          ai_reasoning: "interview_confirmation",
          deadline: endOfDay,
        });
      }
    }

    // ──────────────────────────────────────────
    // 📞 未回覆跟進電話（outreach 發出 2+ 天沒回覆）
    // ──────────────────────────────────────────
    for (const o of myOutreach) {
      if (o.status !== "sent" && o.status !== "no_response") continue;
      if (!o.sent_at) continue;
      const days = daysBetween(o.sent_at);
      if (days >= 2 && days <= 7) {
        // 找對應的 recruit 看有沒有電話
        const recruit = myRecruits.find(
          (r) => r.name === o.candidate_name || r.email === o.candidate_email
        );
        tasks.push({
          owner_email: email,
          pillar_id: "recruit",
          title: `📞 打電話跟進 ${o.candidate_name} — ${days}天未回覆`,
          detail: [
            recruit?.phone ? `電話: ${recruit.phone}` : null,
            `平台: ${o.platform || "104"}`,
            `職缺: ${o.job_title || "業務"}`,
            `已發信 ${days} 天，第 ${(o.follow_up_count || 0) + 1} 次跟進`,
          ].filter(Boolean).join("\n"),
          severity: days >= 5 ? "high" : "normal",
          status: "pending",
          ai_generated: true,
          ai_reasoning: "outreach_follow_up",
          deadline: endOfDay,
        });
      }
    }

    // ──────────────────────────────────────────
    // ✉️ 新求職者邀約（有 recruit 但沒有 outreach 記錄）
    // ──────────────────────────────────────────
    const outreachedNames = new Set(myOutreach.map((o) => o.candidate_name));
    for (const r of myRecruits) {
      if (r.stage !== "new" && r.stage !== "applied") continue;
      if (outreachedNames.has(r.name)) continue;
      const daysOld = daysBetween(r.created_at);
      if (daysOld > 14) continue; // 超過 14 天的就不管了

      tasks.push({
        owner_email: email,
        pillar_id: "recruit",
        title: `✉️ 發邀約信給 ${r.name} — 新求職者`,
        detail: [
          r.phone ? `電話: ${r.phone}` : null,
          r.email ? `Email: ${r.email}` : null,
          `來源: ${r.brand || "104"}`,
          `登記 ${daysOld} 天，尚未聯繫`,
        ].filter(Boolean).join("\n"),
        severity: daysOld >= 3 ? "high" : "normal",
        status: "pending",
        ai_generated: true,
        ai_reasoning: "new_candidate_outreach",
        deadline: endOfDay,
      });
    }

    // ──────────────────────────────────────────
    // 📞 Offer 跟進（offer 階段超過 3 天）
    // ──────────────────────────────────────────
    for (const r of myRecruits) {
      if (r.stage !== "offer") continue;
      if (!r.offered_at && !r.stage_entered_at) continue;
      const offerDate = r.offered_at || r.stage_entered_at;
      const days = daysBetween(offerDate);
      if (days >= 3) {
        tasks.push({
          owner_email: email,
          pillar_id: "recruit",
          title: `📞 打電話給 ${r.name} — Offer ${days}天未回覆`,
          detail: [
            r.phone ? `電話: ${r.phone}` : null,
            `已發 Offer ${days} 天，催促確認`,
          ].filter(Boolean).join("\n"),
          severity: "critical",
          status: "pending",
          ai_generated: true,
          ai_reasoning: "offer_follow_up",
          deadline: endOfDay,
        });
      }
    }

    // ──────────────────────────────────────────
    // 🔄 到職/試用期追蹤
    // ──────────────────────────────────────────
    for (const r of myRecruits) {
      if (r.stage === "onboarded" || r.stage === "probation") {
        const enteredDate = r.stage_entered_at || r.hired_at || r.created_at;
        const days = daysBetween(enteredDate);
        if (r.stage === "onboarded" && days >= 7) {
          tasks.push({
            owner_email: email,
            pillar_id: "recruit",
            title: `🔄 追蹤 ${r.name} 到職狀況 — 已${days}天`,
            detail: [
              r.phone ? `電話: ${r.phone}` : null,
              `到職 ${days} 天，確認適應狀況`,
            ].filter(Boolean).join("\n"),
            severity: "normal",
            status: "pending",
            ai_generated: true,
            ai_reasoning: "onboarding_follow_up",
            deadline: endOfDay,
          });
        }
        if (r.stage === "probation" && days % 7 === 0) { // 每 7 天追蹤一次
          tasks.push({
            owner_email: email,
            pillar_id: "recruit",
            title: `🔄 追蹤 ${r.name} 試用期 — 第${Math.floor(days / 7)}週`,
            detail: [
              r.phone ? `電話: ${r.phone}` : null,
              `試用期第 ${Math.floor(days / 7)} 週，確認表現`,
            ].filter(Boolean).join("\n"),
            severity: "normal",
            status: "pending",
            ai_generated: true,
            ai_reasoning: "probation_follow_up",
            deadline: endOfDay,
          });
        }
      }
    }

    // ──────────────────────────────────────────
    // 排序: critical → high → normal → info
    // ──────────────────────────────────────────
    const sevOrder: Record<string, number> = { critical: 0, high: 1, normal: 2, info: 3 };
    tasks.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9));

    if (tasks.length === 0) {
      results.push({ email, tasks: 0 });
      continue;
    }

    // ──────────────────────────────────────────
    // 寫入 v3_commands
    // ──────────────────────────────────────────
    const { data: inserted } = await supabase
      .from("v3_commands")
      .insert(tasks)
      .select("id, title, detail, severity");

    // ──────────────────────────────────────────
    // LINE 推播
    // ──────────────────────────────────────────
    if (inserted && inserted.length > 0) {
      const callCount = tasks.filter((t) => t.title.includes("打電話") || t.title.includes("📞")).length;
      const msgCount = tasks.filter((t) => t.title.includes("發") && t.title.includes("信") || t.title.includes("✉️")).length;
      const otherCount = inserted.length - callCount - msgCount;

      const summary = [
        callCount > 0 ? `📞 ${callCount} 通電話` : null,
        msgCount > 0 ? `✉️ ${msgCount} 封信` : null,
        otherCount > 0 ? `🔄 ${otherCount} 項追蹤` : null,
      ].filter(Boolean).join(" · ");

      const flex = buildCommandsFlex(
        inserted as Array<{ id: string; title: string; detail: string | null; severity: "info" | "normal" | "high" | "critical" }>,
        `今日招聘任務 — ${summary}`
      );

      const pushRes = await linePush({
        title: "📋 今日招聘任務",
        body: `${summary}\n\n打開招聘工作台查看詳情`,
        flexMessage: flex,
        userEmail: email,
        priority: tasks.some((t) => t.severity === "critical") ? "critical" : "high",
        reason: "recruiter_briefing",
      });

      results.push({ email, tasks: inserted.length, mode: pushRes.mode });
    } else {
      results.push({ email, tasks: tasks.length });
    }
  }

  // Log
  const totalTasks = results.reduce((sum, r) => sum + r.tasks, 0);
  await supabase.from("claude_actions").insert({
    action_type: "recruiter_briefing_push",
    target: today,
    summary: `招聘晨報: ${recruiterEmails.length} 位招聘員, ${totalTasks} 個任務`,
    details: { results },
    result: "success",
  });

  return Response.json({ ok: true, date: today, recruiters: recruiterEmails.length, results });
}
