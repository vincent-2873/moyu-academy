import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

// GET /api/admin/claude-tasks?status=pending
// 列出 Claude 指派的所有任務
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    let query = supabase
      .from("claude_tasks")
      .select("*")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({ tasks: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// POST /api/admin/claude-tasks
// Claude 自己建立新任務
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { title, description, category, priority, why, expected_input, blocked_features } = body;

    if (!title || !description || !category) {
      return Response.json(
        { error: "title, description, category are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("claude_tasks")
      .insert({
        title,
        description,
        category,
        priority: priority || "normal",
        why: why || null,
        expected_input: expected_input || null,
        blocked_features: blocked_features || [],
      })
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ task: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/admin/claude-tasks
// 用戶更新任務狀態 (in_progress / done / cancelled / blocked)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { id, status, user_response } = body;

    if (!id || !status) {
      return Response.json({ error: "id and status are required" }, { status: 400 });
    }

    const update: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (user_response !== undefined) update.user_response = user_response;
    if (status === "done") update.done_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("claude_tasks")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ task: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/claude-tasks?id=...
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return Response.json({ error: "id is required" }, { status: 400 });

    const { error } = await supabase.from("claude_tasks").delete().eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
