import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * GET  /api/recruit/generate-tasks
 *   掃 outreach_104_queue (reply_status='interested')，
 *   若尚無對應 v3_commands 則自動產生 recruit 任務。
 *
 * POST /api/recruit/generate-tasks
 *   body: { assignTo?: string }
 *   同上，但可指定 owner_email（批次指派給特定招聘員）。
 */

const DEFAULT_OWNER = "lynn@xplatform.world";

export async function GET() {
  return handleGenerate(DEFAULT_OWNER);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const assignTo = (body.assignTo as string) || DEFAULT_OWNER;
  return handleGenerate(assignTo);
}

async function handleGenerate(ownerEmail: string) {
  try {
    const supabase = getSupabaseAdmin();

    // 1. 取所有 interested 求職者
    const { data: interested, error: qErr } = await supabase
      .from("outreach_104_queue")
      .select("id, candidate_name, candidate_phone, last_reply_text, reply_received_at, account, candidate_104_id")
      .eq("reply_status", "interested")
      .order("reply_received_at", { ascending: true });

    if (qErr) {
      return Response.json({ ok: false, error: qErr.message }, { status: 500 });
    }
    if (!interested || interested.length === 0) {
      return Response.json({ ok: true, generated: 0, message: "沒有待處理的有興趣求職者" });
    }

    // 2. 取已存在的 recruit 任務，用 ai_reasoning LIKE 'queue_id:xxx' 做比對
    const { data: existingCmds } = await supabase
      .from("v3_commands")
      .select("ai_reasoning")
      .eq("pillar_id", "recruit")
      .not("ai_reasoning", "is", null);

    const existingQueueIds = new Set<string>();
    if (existingCmds) {
      for (const cmd of existingCmds) {
        const match = (cmd.ai_reasoning as string)?.match(/queue_id:([a-f0-9-]+)/);
        if (match) existingQueueIds.add(match[1]);
      }
    }

    // 3. 為每個尚無任務的求職者建立 v3_commands
    const now = Date.now();
    const toInsert: Array<Record<string, unknown>> = [];

    for (const row of interested) {
      if (existingQueueIds.has(row.id)) continue;

      const replyAt = row.reply_received_at ? new Date(row.reply_received_at).getTime() : now;
      const hoursAgo = (now - replyAt) / 3600_000;
      const severity = hoursAgo > 48 ? "critical" : hoursAgo > 24 ? "high" : "normal";

      const replyPreview = (row.last_reply_text || "").slice(0, 40);
      const title = `📞 聯絡 ${row.candidate_name} — ${replyPreview || "有興趣"}`;
      const detail = [
        `求職者：${row.candidate_name}`,
        `電話：${row.candidate_phone || "未知"}`,
        `104 帳號：${row.account || "-"}`,
        `104 ID：${row.candidate_104_id || "-"}`,
        `回覆內容：${row.last_reply_text || "(無)"}`,
        `回覆時間：${row.reply_received_at || "-"}`,
        `距回覆已過 ${Math.floor(hoursAgo)} 小時`,
        "",
        "請盡快致電聯絡，確認意願並安排面試。",
      ].join("\n");

      toInsert.push({
        pillar_id: "recruit",
        owner_email: ownerEmail,
        title,
        detail,
        severity,
        status: "pending",
        ai_generated: true,
        ai_reasoning: `queue_id:${row.id}`,
      });
    }

    if (toInsert.length === 0) {
      return Response.json({ ok: true, generated: 0, message: "所有求職者已有對應任務" });
    }

    const { error: insertErr } = await supabase
      .from("v3_commands")
      .insert(toInsert);

    if (insertErr) {
      return Response.json({ ok: false, error: insertErr.message }, { status: 500 });
    }

    // 4. 記錄 claude_actions
    await supabase.from("claude_actions").insert({
      action_type: "recruit_generate_tasks",
      target: `${toInsert.length} tasks`,
      summary: `自動產生 ${toInsert.length} 筆招聘任務，指派給 ${ownerEmail}`,
      details: { count: toInsert.length, ownerEmail },
      result: "success",
    });

    return Response.json({
      ok: true,
      generated: toInsert.length,
      assignedTo: ownerEmail,
      message: `已產生 ${toInsert.length} 筆招聘任務`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
