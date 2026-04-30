import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActionType = "self_handle" | "delegate_to_leader" | "voice_memo" | "mark_resolved";

const ACTION_TO_STATUS: Record<ActionType, "handling" | "resolved"> = {
  self_handle:         "handling",
  delegate_to_leader:  "handling",
  voice_memo:          "handling",
  mark_resolved:       "resolved",
};

const ACTION_TO_LABEL: Record<ActionType, string> = {
  self_handle:        "Vincent 親自接",
  delegate_to_leader: "派組長談",
  voice_memo:         "留 voice memo",
  mark_resolved:      "標記已處理",
};

/**
 * POST /api/admin/training-ops/attention/[id]/action
 *
 * Body: { action: 'self_handle' | 'delegate_to_leader' | 'voice_memo' | 'mark_resolved', note?: string }
 * 寫 status + resolution_action,resolved 時也寫 resolved_at
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = getSupabaseAdmin();

  let body: { action?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action;
  if (!action || !(action in ACTION_TO_STATUS)) {
    return NextResponse.json(
      { ok: false, error: `Invalid action. Allowed: ${Object.keys(ACTION_TO_STATUS).join(", ")}` },
      { status: 400 }
    );
  }
  const validAction = action as ActionType;

  const status = ACTION_TO_STATUS[validAction];
  const update: Record<string, string | null> = {
    status,
    resolution_action: ACTION_TO_LABEL[validAction],
  };
  if (body.note) update.resolution_note = body.note;
  if (status === "resolved") update.resolved_at = new Date().toISOString();

  try {
    const { data, error } = await sb.from("claude_help_requests")
      .update(update)
      .eq("id", id)
      .select("id, status, resolution_action, resolved_at")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, updated: data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
