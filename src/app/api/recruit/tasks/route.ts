import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * GET   /api/recruit/tasks?owner=email&status=pending   列出某人的招聘任務
 * GET   /api/recruit/tasks?unassigned=1                 列出 Lynn 底下的未認領任務
 * PATCH /api/recruit/tasks                              更新任務（reassign / 改狀態）
 *   body: { id, assignTo?, status? }
 */

const MANAGER_EMAIL = "lynn@xplatform.world";

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);
    const owner = url.searchParams.get("owner");
    const status = url.searchParams.get("status");
    const unassigned = url.searchParams.get("unassigned");

    let query = supabase
      .from("v3_commands")
      .select("*")
      .eq("pillar_id", "recruit")
      .order("created_at", { ascending: false })
      .limit(200);

    if (unassigned === "1") {
      // 未認領 = owner 是 manager 且 status 是 pending
      query = query.eq("owner_email", MANAGER_EMAIL).eq("status", "pending");
    } else {
      if (owner) query = query.eq("owner_email", owner);
      if (status) query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({
      ok: true,
      tasks: data || [],
      count: data?.length || 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json();
    const { id, assignTo, status } = body;

    if (!id) {
      return Response.json({ ok: false, error: "id 必填" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (assignTo) updates.owner_email = assignTo;
    if (status) {
      updates.status = status;
      if (status === "acknowledged") updates.acknowledged_at = new Date().toISOString();
      if (status === "done") updates.done_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ ok: false, error: "沒有要更新的欄位" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("v3_commands")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    // 寫 response_log
    if (status) {
      const createdAt = data?.created_at ? new Date(data.created_at).getTime() : Date.now();
      const responseSeconds = Math.floor((Date.now() - createdAt) / 1000);
      await supabase.from("v3_response_log").insert({
        command_id: id,
        owner_email: data?.owner_email || assignTo,
        action: status,
        response_time_seconds: responseSeconds,
        note: assignTo ? `reassigned to ${assignTo}` : null,
      }).then(() => {});
    }

    return Response.json({ ok: true, task: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
