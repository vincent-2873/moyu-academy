import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ClaudeAttempt {
  attempted_at: string;
  action: string;
  result: string;
}

interface AttentionItem {
  id: string;
  user_name: string;
  user_email: string;
  brand: string;
  current_day: number;
  stuck_days: number;
  title: string;
  description: string | null;
  claude_attempts: ClaudeAttempt[];
  claude_recommendation: string | null;
  category: "urgent" | "normal";
  created_at: string;
  resolved_at: string | null;
}

/**
 * GET /api/admin/training-ops/attention
 *
 * 三段:urgent / normal pending + 今日已處理(24h 內 resolved)
 * 每筆帶 Claude 嘗試清單 + 判斷,給 StuckCard 元件 render
 */
export async function GET() {
  const sb = getSupabaseAdmin();
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  try {
    const [pendingRes, resolvedRes] = await Promise.all([
      sb.from("claude_help_requests")
        .select("id, related_user_id, title, description, claude_attempts, claude_recommendation, category, status, created_at, resolved_at")
        .eq("source", "training")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      sb.from("claude_help_requests")
        .select("id, related_user_id, title, description, claude_attempts, claude_recommendation, category, status, created_at, resolved_at")
        .eq("source", "training")
        .eq("status", "resolved")
        .gte("resolved_at", dayAgo)
        .order("resolved_at", { ascending: false }),
    ]);

    const allRows = [...(pendingRes.data ?? []), ...(resolvedRes.data ?? [])];
    const userIds = allRows
      .map(r => r.related_user_id)
      .filter((id): id is string => id !== null);

    const userMap = new Map<string, { name: string; email: string; brand: string; current_day: number }>();
    if (userIds.length > 0) {
      const { data: usersData } = await sb.from("users")
        .select("id, name, email, brand, training_current_day")
        .in("id", userIds);
      for (const u of usersData ?? []) {
        userMap.set(u.id, {
          name: u.name ?? "(未命名)",
          email: u.email ?? "",
          brand: u.brand ?? "(unknown)",
          current_day: u.training_current_day ?? 0,
        });
      }
    }

    function shape(r: typeof allRows[0]): AttentionItem {
      const u = r.related_user_id ? userMap.get(r.related_user_id) : null;
      const stuckDays = r.created_at
        ? Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000)
        : 0;
      const attempts = Array.isArray(r.claude_attempts)
        ? (r.claude_attempts as ClaudeAttempt[])
        : [];
      return {
        id: r.id,
        user_name: u?.name ?? "(未知)",
        user_email: u?.email ?? "",
        brand: u?.brand ?? "(unknown)",
        current_day: u?.current_day ?? 0,
        stuck_days: stuckDays,
        title: r.title ?? "",
        description: r.description,
        claude_attempts: attempts,
        claude_recommendation: r.claude_recommendation,
        category: (r.category === "urgent" || r.category === "normal") ? r.category : "normal",
        created_at: r.created_at,
        resolved_at: r.resolved_at,
      };
    }

    const pending = (pendingRes.data ?? []).map(shape);
    const urgent = pending.filter(p => p.category === "urgent");
    const normal = pending.filter(p => p.category === "normal");
    const resolvedToday = (resolvedRes.data ?? []).map(shape);

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      urgent,
      normal,
      resolved_today: resolvedToday,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
