import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 人類狀態 Check-in API
 *
 * GET  /api/human-state?email=xxx     讀取自己今天的 check-in（如有）
 * POST /api/human-state               提交今天的 check-in
 *
 * 違反人性原則：
 * - 不接受模糊（「還可以」「普通」） — 強制 1-10 量化
 * - 必填「今天最逃避的事」「今天最不想做但會做的事」
 * - 系統會用這份資料判斷是否觸發 breakthrough
 */

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const email = url.searchParams.get("email");
    if (!email) return Response.json({ ok: false, error: "email 必填" }, { status: 400 });

    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("human_state_checkin")
      .select("*")
      .eq("user_email", email)
      .eq("date", today)
      .maybeSingle();

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

    return Response.json({ ok: true, checkin: data, has_checked_in: !!data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const {
      user_email,
      energy,
      mood,
      comfort_level,
      avoidance,
      today_commit,
      breakthrough_action,
    } = body;

    if (!user_email) {
      return Response.json({ ok: false, error: "user_email 必填" }, { status: 400 });
    }
    if (
      typeof energy !== "number" ||
      typeof mood !== "number" ||
      typeof comfort_level !== "number"
    ) {
      return Response.json(
        { ok: false, error: "energy / mood / comfort_level 必須是 1-10 的數字" },
        { status: 400 }
      );
    }
    if (energy < 1 || energy > 10 || mood < 1 || mood > 10 || comfort_level < 1 || comfort_level > 10) {
      return Response.json(
        { ok: false, error: "分數必須在 1-10 之間" },
        { status: 400 }
      );
    }
    if (!avoidance || !today_commit) {
      return Response.json(
        { ok: false, error: "avoidance（最逃避的事）和 today_commit（今天會做的）必填" },
        { status: 400 }
      );
    }

    // 計算 ai_score：舒適度越高 + 沒有逃避內容 = 紅旗
    const ai_score =
      comfort_level >= 8
        ? "red_too_comfortable"
        : avoidance.length < 5
        ? "red_no_real_avoidance"
        : energy <= 3
        ? "yellow_low_energy"
        : "green";

    const today = new Date().toISOString().slice(0, 10);

    // upsert：同一天只保留一筆
    const { data, error } = await supabase
      .from("human_state_checkin")
      .upsert(
        {
          user_email,
          date: today,
          energy,
          mood,
          comfort_level,
          avoidance,
          today_commit,
          breakthrough_action: breakthrough_action || null,
          ai_score,
        },
        { onConflict: "user_email,date" }
      )
      .select()
      .single();

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

    // 紅旗：寫入 breakthrough_log 觸發後續介入
    if (ai_score.startsWith("red_")) {
      await supabase.from("breakthrough_log").insert({
        rule_id: `checkin_${ai_score}`,
        user_email,
        trigger_reason:
          ai_score === "red_too_comfortable"
            ? `舒適度 ${comfort_level}/10 — 太爽了，沒在突破`
            : `逃避欄位太短（${avoidance.length} 字）— 沒誠實面對`,
        intervention: "系統將指派你今天必須完成一件具體破舒適圈動作",
        severity: "medium",
      });
    }

    return Response.json({ ok: true, checkin: data, ai_score });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
