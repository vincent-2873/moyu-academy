import { getSupabaseAdmin } from "@/lib/supabase";
import { linePush } from "@/lib/line-notify";
import { NextRequest } from "next/server";

/**
 * v3 LINE Dispatch — 把 v3_commands 透過 LINE 推給負責人
 *
 * POST /api/v3/dispatch
 *   body 可選：
 *     { command_id: "uuid" }                // 推單一命令
 *     { command_ids: ["uuid1", "uuid2"] }   // 推多個命令
 *     { daily: true }                        // 自動拉今天 pending 全推
 *
 * 流程：
 *   1. 拉出對應 command
 *   2. 用 owner_email 找 users.line_user_id
 *   3. 呼叫 linePush 推送（沒 token 自動進 stub mode）
 *   4. 寫入 v3_line_dispatch 紀錄
 *
 * GET /api/v3/dispatch?command_id=xxx       // 看某個命令的推送紀錄
 */

const SEVERITY_TO_PRIORITY: Record<string, "critical" | "high" | "normal" | "low"> = {
  critical: "critical",
  high: "high",
  normal: "normal",
  info: "low",
};

interface V3CommandRow {
  id: string;
  project_id: string | null;
  pillar_id: string | null;
  owner_email: string;
  title: string;
  detail: string | null;
  severity: string;
  deadline: string | null;
  status: string;
  ai_reasoning: string | null;
}

const PILLAR_LABEL: Record<string, string> = {
  sales: "💰 業務",
  legal: "⚖️ 法務",
  recruit: "🎯 招聘",
};

function buildBody(c: V3CommandRow): string {
  let body = c.detail || "(無詳細說明)";
  if (c.deadline) body += `\n\n🕒 截止：${new Date(c.deadline).toLocaleString("zh-TW")}`;
  if (c.ai_reasoning) body += `\n\n💡 Claude 判斷依據：${c.ai_reasoning}`;
  body += `\n\n→ 完成後到後台命令中心點「✓ 完成」`;
  return body;
}

async function dispatchOne(supabase: ReturnType<typeof getSupabaseAdmin>, c: V3CommandRow) {
  const pillarLabel = c.pillar_id ? PILLAR_LABEL[c.pillar_id] || c.pillar_id : "";
  const title = pillarLabel ? `${pillarLabel}｜${c.title}` : c.title;
  const priority = SEVERITY_TO_PRIORITY[c.severity] || "normal";

  const result = await linePush({
    title,
    body: buildBody(c),
    priority,
    taskId: c.id,
    userEmail: c.owner_email,
    reason: "v3_command",
  });

  // 記錄到 v3_line_dispatch
  await supabase.from("v3_line_dispatch").insert({
    command_id: c.id,
    recipient_email: c.owner_email,
    recipient_line_user_id: result.resolvedUserId || null,
    push_status: result.ok ? "sent" : "failed",
    push_error: result.error || null,
  });

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json().catch(() => ({}));
    const { command_id, command_ids, daily } = body;

    let targetIds: string[] = [];

    if (command_id) {
      targetIds = [command_id];
    } else if (Array.isArray(command_ids)) {
      targetIds = command_ids;
    } else if (daily) {
      // 拉今天 pending 的命令（包含 deadline 是今天 / 沒 deadline 但 ai_generated）
      const { data, error } = await supabase
        .from("v3_commands")
        .select("id")
        .eq("status", "pending")
        .order("severity", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) {
        return Response.json({ ok: false, error: error.message }, { status: 500 });
      }
      targetIds = (data || []).map((c) => c.id);
    } else {
      return Response.json(
        { ok: false, error: "需要提供 command_id / command_ids / daily:true 之一" },
        { status: 400 },
      );
    }

    if (targetIds.length === 0) {
      return Response.json({ ok: true, dispatched: 0, results: [], message: "沒有需要推送的命令" });
    }

    // 拉完整命令資料
    const { data: commands, error } = await supabase
      .from("v3_commands")
      .select("id, project_id, pillar_id, owner_email, title, detail, severity, deadline, status, ai_reasoning")
      .in("id", targetIds);

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    const results = await Promise.all(
      (commands || []).map(async (c) => {
        const r = await dispatchOne(supabase, c as V3CommandRow);
        return {
          command_id: c.id,
          owner: c.owner_email,
          ok: r.ok,
          mode: r.mode,
          error: r.error || null,
        };
      }),
    );

    const success = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    return Response.json({
      ok: true,
      dispatched: results.length,
      success,
      failed,
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const commandId = url.searchParams.get("command_id");

    let query = supabase
      .from("v3_line_dispatch")
      .select("*")
      .order("pushed_at", { ascending: false })
      .limit(100);

    if (commandId) query = query.eq("command_id", commandId);

    const { data, error } = await query;
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, dispatches: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
