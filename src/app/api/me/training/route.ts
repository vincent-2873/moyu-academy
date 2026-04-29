import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/me/training?email=xxx
 *
 * 回給 /learn page 渲染:
 *   - user 的 stage / stage_path / brand
 *   - assignment(start_date / current_day / status)
 *   - path 的所有 module
 *   - user 自己每個 module 的 progress
 *   - 已蓋的 stamps
 */

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "missing email" }, { status: 400 });

  const sb = getSupabaseAdmin();

  const { data: user } = await sb
    .from("users")
    .select("id, email, name, stage, stage_path, brand, capability_scope, location_id, business_line_id, created_at")
    .eq("email", email)
    .maybeSingle();

  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  // 找 user 的 active assignment(business 或 recruit,根據 stage_path)
  const pathTypeFilter = user.stage_path === "recruit" ? "recruit" : "business";

  const { data: paths } = await sb
    .from("training_paths")
    .select("*")
    .eq("path_type", pathTypeFilter);

  const path = paths?.[0]; // 簡化: 只取第一條 default path
  if (!path) {
    return NextResponse.json({
      user,
      path: null,
      modules: [],
      progress: [],
      stamps: [],
      assignment: null,
    });
  }

  // 載入 path 的 modules
  const { data: modules } = await sb
    .from("training_modules")
    .select("*")
    .eq("path_id", path.id)
    .order("day_offset")
    .order("sequence");

  // 找 user 在這個 path 的 assignment
  let { data: assignment } = await sb
    .from("training_assignments")
    .select("*")
    .eq("user_id", user.id)
    .eq("path_id", path.id)
    .maybeSingle();

  // 沒 assignment -> 自動創一個(start_date = user.created_at 或 today)
  if (!assignment) {
    const startDate = user.created_at ? new Date(user.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const { data: newAssign } = await sb
      .from("training_assignments")
      .insert({
        user_id: user.id,
        path_id: path.id,
        start_date: startDate,
        current_day: Math.max(0, Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000)),
        status: "active",
      })
      .select()
      .single();
    assignment = newAssign;
  }

  // 計算 current_day(動態)
  if (assignment) {
    const startMs = new Date(assignment.start_date).getTime();
    assignment.current_day = Math.max(0, Math.floor((Date.now() - startMs) / 86400000));
  }

  // user progress
  const { data: progress } = await sb
    .from("training_user_progress")
    .select("*")
    .eq("user_id", user.id);

  // user stamps
  const { data: stamps } = await sb
    .from("training_stamps")
    .select("*")
    .eq("user_id", user.id)
    .order("earned_at", { ascending: false });

  return NextResponse.json({
    user,
    path,
    modules: modules || [],
    progress: progress || [],
    stamps: stamps || [],
    assignment,
  });
}
