import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/decisions
 * 對應 system-tree v2:
 *   - /admin/board/decisions(全部拍板紀錄)
 *   - /admin/human/sign-off(今天 / 本週必拍板)
 *
 * 從 Phase 4 schema D26 decision_records table 撈
 * 排序:critical 優先 + due_date ASC
 */
export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("decision_records")
    .select("id, category, title, context, claude_recommendation, vincent_decision, status, urgency, due_date, signoff_chain, created_at, approved_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    // Phase 4 schema 還沒 apply 之前 table 不存在,回友善 message
    return NextResponse.json({
      ok: false,
      error: error.message,
      decisions: [],
      hint: "若是 'relation does not exist',表示 D26 SQL Phase 4 schema 還沒 apply",
    }, { status: 200 });  // 200 讓 UI 顯示 placeholder 不要 crash
  }

  const today = new Date();
  today.setHours(23, 59, 59);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const todayMust = (data ?? []).filter(d => d.status === "pending" && d.urgency === "critical");
  const weekMust = (data ?? []).filter(d =>
    d.status === "pending" &&
    d.urgency === "high"
  );
  const approved = (data ?? []).filter(d => d.status === "approved");
  const others = (data ?? []).filter(d => !["pending", "approved"].includes(d.status ?? ""));

  return NextResponse.json({
    ok: true,
    counts: {
      total: data?.length ?? 0,
      today_must: todayMust.length,
      week_must: weekMust.length,
      approved: approved.length,
      others: others.length,
    },
    today_must: todayMust,
    week_must: weekMust,
    approved,
    others,
  });
}
