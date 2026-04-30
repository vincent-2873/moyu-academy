import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/training-ops/attention
 * Task 1.4 stub:回 urgent / normal pending claude_help_requests
 * 後續加 StuckCard 細節(claude_attempts JSON 解析)
 */
export async function GET() {
  const sb = getSupabaseAdmin();

  try {
    const [urgentRes, normalRes, todayRes] = await Promise.all([
      sb.from("claude_help_requests")
        .select("id, title")
        .eq("source", "training")
        .eq("status", "pending")
        .eq("category", "urgent")
        .order("created_at", { ascending: false }),
      sb.from("claude_help_requests")
        .select("id, title")
        .eq("source", "training")
        .eq("status", "pending")
        .eq("category", "normal")
        .order("created_at", { ascending: false }),
      sb.from("claude_help_requests")
        .select("id", { count: "exact", head: true })
        .eq("source", "training")
        .eq("status", "resolved")
        .gte("resolved_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
    ]);

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      urgent: urgentRes.data ?? [],
      normal: normalRes.data ?? [],
      resolved_today: todayRes.count ?? 0,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
