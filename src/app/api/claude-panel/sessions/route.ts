import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/claude-panel/sessions?email=xxx
 *
 * 2026-04-30 Wave D:列出該 user 的所有對話 session
 *
 * Response:
 *   { sessions: [{ session_id, last_message_at, message_count, last_user_msg, last_assistant_msg }] }
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const sb = getSupabaseAdmin();

  // 1. 撈 user
  const { data: user } = await sb
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!user) return NextResponse.json({ sessions: [] });

  // 2. 撈該 user 所有對話 row(過去 30 天)
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: rows } = await sb
    .from("claude_conversations")
    .select("session_id, role, content, created_at")
    .eq("user_id", user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (!rows || rows.length === 0) return NextResponse.json({ sessions: [] });

  // 3. group by session_id,取最後一則 user / assistant 訊息 + count
  const bySession: Record<string, {
    session_id: string;
    last_message_at: string;
    message_count: number;
    last_user_msg: string;
    last_assistant_msg: string;
  }> = {};

  for (const r of rows) {
    const sid = r.session_id as string;
    if (!sid) continue;
    if (!bySession[sid]) {
      bySession[sid] = {
        session_id: sid,
        last_message_at: r.created_at,
        message_count: 0,
        last_user_msg: "",
        last_assistant_msg: "",
      };
    }
    const s = bySession[sid];
    s.message_count++;
    if (r.created_at > s.last_message_at) s.last_message_at = r.created_at;
    if (r.role === "user" && !s.last_user_msg) s.last_user_msg = ((r.content as string) || "").slice(0, 80);
    if (r.role === "assistant" && !s.last_assistant_msg) s.last_assistant_msg = ((r.content as string) || "").slice(0, 80);
  }

  const sessions = Object.values(bySession)
    .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))
    .slice(0, 50);

  return NextResponse.json({ sessions });
}
