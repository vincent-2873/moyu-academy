import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * v3 Commands API — Claude 每天產出的命令（推給人類員工執行）
 *
 * GET    /api/v3/commands                          全部命令
 * GET    /api/v3/commands?owner=foo@bar.com        指定接收者
 * GET    /api/v3/commands?status=pending           指定狀態
 * GET    /api/v3/commands?pillar=sales             指定支柱
 * GET    /api/v3/commands?project_id=uuid          指定專案
 * POST   /api/v3/commands                          新增命令（Claude 或 admin 產生）
 * PATCH  /api/v3/commands                          更新狀態（id 必填）
 *                                                   同時寫入 v3_response_log 供學習
 */

const VALID_SEVERITY = ["info", "normal", "high", "critical"] as const;
const VALID_STATUS = ["pending", "acknowledged", "done", "blocked", "ignored"] as const;
const VALID_PILLARS = ["sales", "legal", "recruit"] as const;

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const owner = url.searchParams.get("owner");
    const status = url.searchParams.get("status");
    const pillar = url.searchParams.get("pillar");
    const projectId = url.searchParams.get("project_id");

    let query = supabase
      .from("v3_commands")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (owner) query = query.eq("owner_email", owner);
    if (status) query = query.eq("status", status);
    if (pillar) query = query.eq("pillar_id", pillar);
    if (projectId) query = query.eq("project_id", projectId);

    const { data, error } = await query;
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    // 統計
    const stats = {
      total: data?.length || 0,
      pending: data?.filter((c) => c.status === "pending").length || 0,
      acknowledged: data?.filter((c) => c.status === "acknowledged").length || 0,
      done: data?.filter((c) => c.status === "done").length || 0,
      blocked: data?.filter((c) => c.status === "blocked").length || 0,
      ignored: data?.filter((c) => c.status === "ignored").length || 0,
      critical: data?.filter((c) => c.severity === "critical").length || 0,
    };

    return Response.json({ ok: true, commands: data || [], stats });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const {
      project_id,
      pillar_id,
      owner_email,
      title,
      detail,
      severity,
      deadline,
      ai_generated,
      ai_reasoning,
    } = body;

    if (!owner_email || !title) {
      return Response.json(
        { ok: false, error: "owner_email / title 必填" },
        { status: 400 },
      );
    }
    if (pillar_id && !VALID_PILLARS.includes(pillar_id)) {
      return Response.json(
        { ok: false, error: `pillar_id 必須是 ${VALID_PILLARS.join(", ")}` },
        { status: 400 },
      );
    }
    if (severity && !VALID_SEVERITY.includes(severity)) {
      return Response.json(
        { ok: false, error: `severity 必須是 ${VALID_SEVERITY.join(", ")}` },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("v3_commands")
      .insert({
        project_id: project_id || null,
        pillar_id: pillar_id || null,
        owner_email,
        title,
        detail: detail || null,
        severity: severity || "normal",
        deadline: deadline || null,
        status: "pending",
        ai_generated: ai_generated !== false, // 預設 true
        ai_reasoning: ai_reasoning || null,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, command: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { id, status, blocked_reason, note } = body;

    if (!id) {
      return Response.json({ ok: false, error: "id 必填" }, { status: 400 });
    }
    if (status && !VALID_STATUS.includes(status)) {
      return Response.json(
        { ok: false, error: `status 必須是 ${VALID_STATUS.join(", ")}` },
        { status: 400 },
      );
    }

    // 先抓原始命令算 response_time
    const { data: original } = await supabase
      .from("v3_commands")
      .select("created_at, owner_email, status")
      .eq("id", id)
      .single();

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (status === "acknowledged") updates.acknowledged_at = new Date().toISOString();
    if (status === "done") updates.done_at = new Date().toISOString();
    if (status === "blocked" && blocked_reason) updates.blocked_reason = blocked_reason;

    const { data, error } = await supabase
      .from("v3_commands")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    // 寫入 response_log 給 Claude 學習用
    if (status && original) {
      const createdAt = new Date(original.created_at).getTime();
      const responseSeconds = Math.floor((Date.now() - createdAt) / 1000);
      const { error: logErr } = await supabase.from("v3_response_log").insert({
        command_id: id,
        owner_email: original.owner_email,
        action: status,
        response_time_seconds: responseSeconds,
        note: note || null,
      });
      if (logErr) console.error("[v3_response_log] insert failed:", logErr.message);
    }

    return Response.json({ ok: true, command: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
