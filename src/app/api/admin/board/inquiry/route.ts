import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/admin/board/inquiry  → 質詢歷史
 * POST /api/admin/board/inquiry  → 提問 + 暫存(實際 LLM 回答走戰情官側欄)
 *
 * 對應 system-tree v2 §投資人中心 §質詢 Claude(/admin/board/inquiry)
 * 從 D26 schema board_inquiries
 */
export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("board_inquiries")
    .select("id, asker_email, asker_role, question, claude_answer, context, exported_pdf_url, asked_at, answered_at")
    .order("asked_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({
      ok: false,
      error: error.message,
      hint: "若是 'relation does not exist',表示 D26 SQL Phase 4 schema 還沒 apply",
      records: [],
    }, { status: 200 });
  }

  return NextResponse.json({
    ok: true,
    count: data?.length ?? 0,
    records: data ?? [],
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question = (body.question ?? "").toString().trim();
    const asker_email = (body.asker_email ?? "").toString();
    const asker_role = (body.asker_role ?? "investor").toString();

    if (!question) {
      return NextResponse.json({ ok: false, error: "question is required" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("board_inquiries")
      .insert({
        asker_email: asker_email || null,
        asker_role,
        question,
        claude_answer: null,
        context: null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, record: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
