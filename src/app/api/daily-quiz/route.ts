import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const date =
      searchParams.get("date") ?? new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("daily_quizzes")
      .select("*")
      .eq("quiz_date", date)
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ data });
  } catch (err) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { quiz_id, user_email, answers } = body;

    if (!quiz_id || !user_email || !answers) {
      return Response.json(
        { error: "quiz_id, user_email, and answers are required" },
        { status: 400 }
      );
    }

    // Fetch the quiz to get correct answers
    const { data: quiz, error: quizError } = await supabase
      .from("daily_quizzes")
      .select("*")
      .eq("id", quiz_id)
      .single();

    if (quizError || !quiz) {
      return Response.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Calculate score
    const correctAnswers: number[] = quiz.correct_answers;
    let correctCount = 0;
    for (let i = 0; i < correctAnswers.length; i++) {
      if (answers[i] === correctAnswers[i]) {
        correctCount++;
      }
    }
    const score = Math.round((correctCount / correctAnswers.length) * 100);

    // Insert attempt
    const { data: attempt, error: attemptError } = await supabase
      .from("quiz_attempts")
      .insert({
        quiz_id,
        user_email,
        answers,
        score,
      })
      .select()
      .single();

    if (attemptError) {
      return Response.json({ error: attemptError.message }, { status: 500 });
    }

    return Response.json({ data: attempt, score }, { status: 201 });
  } catch (err) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
