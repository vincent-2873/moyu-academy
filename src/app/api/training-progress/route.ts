import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/training-progress
 * Body: { email, unit_code, status, score?, total?, passed?, series_complete? }
 * 來源：前端 iframe postMessage listener 把 interactive.html 完成事件轉發過來
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, unit_code, status, score, total, passed, series_complete } = body;

    if (!email || !unit_code || !status) {
      return NextResponse.json({ error: "email, unit_code, status required" }, { status: 400 });
    }
    if (!["not_started", "watching", "quiz_pending", "passed", "failed"].includes(status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from("training_unit_progress")
      .select("id, attempt_count, first_viewed_at")
      .eq("trainee_email", email)
      .eq("unit_code", unit_code)
      .maybeSingle();

    const now = new Date().toISOString();
    const row = {
      trainee_email: email,
      unit_code,
      status,
      score: score ?? null,
      total: total ?? null,
      passed: passed ?? null,
      series_complete: series_complete ?? false,
      first_viewed_at: existing?.first_viewed_at ?? now,
      completed_at: status === "passed" || status === "failed" ? now : null,
      attempt_count: (existing?.attempt_count ?? 0) + (status === "passed" || status === "failed" ? 1 : 0),
      updated_at: now,
    };

    const { error } = await supabase
      .from("training_unit_progress")
      .upsert(row, { onConflict: "trainee_email,unit_code" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/training-progress error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/training-progress?email=xxx
 * 回傳該使用者所有訓練單元的進度
 */
export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email");
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("training_unit_progress")
      .select("unit_code, status, score, total, passed, series_complete, completed_at, attempt_count")
      .eq("trainee_email", email);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const progress: Record<string, typeof data extends (infer T)[] ? T : never> = Object.fromEntries(
      (data || []).map((p) => [p.unit_code, p])
    );
    return NextResponse.json({ progress });
  } catch (err) {
    console.error("GET /api/training-progress error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
