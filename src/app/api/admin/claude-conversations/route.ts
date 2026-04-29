import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

/**
 * 後台 — 主管查看員工 Claude 對話
 *
 * GET  /api/admin/claude-conversations?target_email=xxx&session_id=xxx&viewer_email=xxx&reason=xxx
 *
 * - 查 target user 的對話
 * - 自動寫 audit log (viewer / target / session / 時間 / 原因)
 * - 員工不會看到這個 audit log (透明監督政策, Vincent 拍板)
 *
 * 認證: middleware.ts 已驗 admin HMAC cookie 才能進 /api/admin/*
 */

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const targetEmail = url.searchParams.get("target_email");
  const sessionId = url.searchParams.get("session_id");
  const viewerEmail = url.searchParams.get("viewer_email");
  const reason = url.searchParams.get("reason") || "";

  if (!targetEmail) {
    return NextResponse.json({ error: "missing target_email" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  const [{ data: targetUser }, { data: viewerUser }] = await Promise.all([
    sb.from("users").select("id, name, email, stage, stage_path, brand, capability_scope").eq("email", targetEmail).maybeSingle(),
    viewerEmail
      ? sb.from("users").select("id, capability_scope").eq("email", viewerEmail).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!targetUser) {
    return NextResponse.json({ error: "target user not found" }, { status: 404 });
  }

  // Query
  let query = sb
    .from("claude_conversations")
    .select("id, session_id, role, content, metadata, created_at")
    .eq("user_id", targetUser.id)
    .order("created_at", { ascending: true });

  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  const { data: messages } = await query.limit(500);

  // 寫 audit log (員工看不到, super_admin / brand_manager / team_leader 才能 query 此 endpoint)
  if (viewerUser) {
    await sb.from("claude_conversation_audit_log").insert({
      viewer_id: viewerUser.id,
      target_user_id: targetUser.id,
      viewed_session_id: sessionId,
      viewer_capability_scope: viewerUser.capability_scope,
      reason,
    });
  }

  // Sessions 列表
  const { data: sessions } = await sb
    .from("claude_conversations")
    .select("session_id, created_at")
    .eq("user_id", targetUser.id)
    .order("created_at", { ascending: false });

  const distinctSessions = Array.from(
    new Set((sessions || []).map((s) => s.session_id))
  ).slice(0, 20);

  return NextResponse.json({
    target: targetUser,
    sessions: distinctSessions,
    messages: messages || [],
  });
}
