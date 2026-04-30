import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { requireCallerEmail } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/me/training/quiz-grade
// body: { user_email, module_id, answers: { [question_id]: option_id | option_id[] | string } }
// 回傳: { score, pass, breakdown, progress_id }

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { user_email, module_id, answers } = body;
  if (!user_email || !module_id || !answers) {
    return NextResponse.json({ error: "missing user_email/module_id/answers" }, { status: 400 });
  }
  const authErr = requireCallerEmail(req, user_email);
  if (authErr) return authErr;
  const sb = getSupabaseAdmin();

  const [{ data: user }, { data: mod }] = await Promise.all([
    sb.from("users").select("id, name").eq("email", user_email).maybeSingle(),
    sb.from("training_modules").select("*").eq("id", module_id).maybeSingle(),
  ]);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });
  if (!mod) return NextResponse.json({ error: "module not found" }, { status: 404 });
  if (mod.module_type !== "quiz") return NextResponse.json({ error: "module not quiz" }, { status: 400 });

  const content = (mod.content as any) || {};
  const questions = (content.questions || []) as any[];
  const passScore = Number(content.pass_score) || 60;

  const breakdown: { id: string; correct: boolean; user_answer: any; correct_answer: any; explanation?: string }[] = [];
  let total = 0;
  let got = 0;

  for (const q of questions) {
    const userAns = answers[q.id];
    const isMulti = q.type === "multi_choice";
    let correct = false;
    let correctAnswer: any;

    if (q.type === "single_choice") {
      const correctOpt = (q.options || []).find((o: any) => o.correct);
      correctAnswer = correctOpt?.id;
      correct = userAns === correctOpt?.id;
    } else if (q.type === "multi_choice") {
      const correctIds = (q.options || []).filter((o: any) => o.correct).map((o: any) => o.id).sort();
      correctAnswer = correctIds;
      const userIds = Array.isArray(userAns) ? [...userAns].sort() : [];
      correct = correctIds.length === userIds.length && correctIds.every((id: string, i: number) => id === userIds[i]);
    } else if (q.type === "text") {
      const expect = String(q.expected_answer || "").trim().toLowerCase();
      const got = String(userAns || "").trim().toLowerCase();
      correctAnswer = q.expected_answer;
      correct = expect.length > 0 && got === expect;
    }

    breakdown.push({ id: q.id, correct, user_answer: userAns, correct_answer: correctAnswer, explanation: q.explanation });
    total += 1;
    if (correct) got += 1;
  }

  const score = total > 0 ? Math.round((got / total) * 100) : 0;
  const pass = score >= passScore;

  // 寫 progress
  const { data: existing } = await sb
    .from("training_user_progress")
    .select("id, attempts")
    .eq("user_id", user.id)
    .eq("module_id", module_id)
    .maybeSingle();

  const payload = {
    user_id: user.id,
    module_id: module_id,
    status: pass ? "completed" : "in_progress",
    score,
    attempts: (existing?.attempts || 0) + 1,
    started_at: existing ? undefined : new Date().toISOString(),
    completed_at: pass ? new Date().toISOString() : null,
    metadata: { quiz_breakdown: breakdown, total, got },
    updated_at: new Date().toISOString(),
  };

  let progressRow;
  if (existing) {
    const { data } = await sb.from("training_user_progress").update(payload).eq("id", existing.id).select().single();
    progressRow = data;
  } else {
    const { data } = await sb.from("training_user_progress").insert(payload).select().single();
    progressRow = data;
  }

  // auto-stamp on pass
  if (pass) {
    try {
      const proto = req.headers.get("x-forwarded-proto") || "https";
      const host = req.headers.get("host") || "";
      if (host) {
        await fetch(`${proto}://${host}/api/me/training/auto-stamp`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.CRON_SECRET || ""}` },
          body: JSON.stringify({
            user_email,
            trigger_type: "module_complete",
            context: { module_id, day: mod.day_offset },
          }),
        });
      }
    } catch {}
  }

  return NextResponse.json({ score, pass, total, got, breakdown, progress_id: progressRow?.id });
}
