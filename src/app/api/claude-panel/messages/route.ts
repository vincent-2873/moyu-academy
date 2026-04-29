import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

/**
 * Claude 對話側欄 — 載入 session 對話歷史
 *
 * GET /api/claude-panel/messages?email=xxx&session_id=xxx
 * Response: { messages: [{role, content, created_at}] }
 */

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  const sessionId = url.searchParams.get("session_id");

  if (!email || !sessionId) {
    return NextResponse.json({ messages: [], error: "missing email/session_id" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  const { data: user } = await sb
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ messages: [] });
  }

  const { data: rows } = await sb
    .from("claude_conversations")
    .select("id, role, content, created_at")
    .eq("user_id", user.id)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(100);

  return NextResponse.json({ messages: rows || [] });
}
