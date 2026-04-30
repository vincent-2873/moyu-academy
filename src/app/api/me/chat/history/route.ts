import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { requireCallerEmail } from "@/lib/auth";

/**
 * GET /api/me/chat/history?email=X[&session_id=Y][&limit=N]
 *
 * 撈使用者 claude_conversations 對話 history(戰情官 chat)
 *
 * 模式:
 *   - 沒 session_id:回最近 N 個 session 的最後 message + counts(像 chat list)
 *   - 帶 session_id:回該 session 全部 message(包括 user + assistant)
 *
 * Vincent 2026-04-30 反饋 #8:戰情官對話 history 過去消失,要持久化 + UI 撈得到
 *
 * Response:
 *   - sessions (no session_id): [{ session_id, last_message_at, last_message_preview, msg_count }]
 *   - messages (with session_id): [{ id, role, content, created_at, metadata }]
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "missing email" }, { status: 400 });
  const authErr = requireCallerEmail(req, email);
  if (authErr) return authErr;

  const sessionId = req.nextUrl.searchParams.get("session_id");
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") || 20), 1), 100);

  const sb = getSupabaseAdmin();

  // 找 user_id
  const { data: user } = await sb.from("users").select("id").eq("email", email).maybeSingle();
  if (!user?.id) return NextResponse.json({ error: "user not found" }, { status: 404 });

  if (sessionId) {
    // Mode 1: messages of a specific session
    const { data: msgs, error } = await sb
      .from("claude_conversations")
      .select("id, role, content, created_at, metadata")
      .eq("user_id", user.id)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      mode: "messages",
      session_id: sessionId,
      messages: msgs || [],
      count: (msgs || []).length,
    });
  }

  // Mode 2: list of recent sessions
  // 撈最近 limit*5 條 messages,然後 group by session_id 取 last
  const { data: rows, error } = await sb
    .from("claude_conversations")
    .select("session_id, role, content, created_at, metadata")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit * 10);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sessionMap = new Map<string, { session_id: string; last_message_at: string; last_message_preview: string; last_role: string; msg_count: number; first_metadata: Record<string, unknown> | null }>();
  for (const r of (rows || []) as Array<{ session_id: string; role: string; content: string; created_at: string; metadata: Record<string, unknown> | null }>) {
    const sid = r.session_id;
    if (!sid) continue;
    if (!sessionMap.has(sid)) {
      sessionMap.set(sid, {
        session_id: sid,
        last_message_at: r.created_at,
        last_message_preview: (r.content || "").slice(0, 100),
        last_role: r.role,
        msg_count: 0,
        first_metadata: r.metadata,
      });
    }
    sessionMap.get(sid)!.msg_count += 1;
  }

  const sessions = Array.from(sessionMap.values()).slice(0, limit);

  return NextResponse.json({
    mode: "sessions",
    sessions,
    count: sessions.length,
  });
}
