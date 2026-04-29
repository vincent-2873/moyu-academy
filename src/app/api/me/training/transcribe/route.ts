import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/me/training/transcribe
 *
 * 員工錄音 → Groq Whisper 轉文字 → Claude 三點評估 → 寫 training_user_progress
 *
 * Body (multipart/form-data):
 *   file:       audio file (mp3/wav/m4a/webm,Groq 支援格式)
 *   email:      user email
 *   module_id:  正在做的訓練 module id
 *   framework_hint?: 可選 — 客製化評估架構(若不傳則用 module.content.framework)
 *
 * Response:
 *   { transcript, evaluation: {順暢, 邏輯, 語氣, missing_steps, suggestions}, score, progress_id }
 *
 * Cost:
 *   - Groq Whisper Large v3: ~$0.111 / 小時音訊(便宜爆了 vs OpenAI $6/小時)
 *   - Claude Sonnet 4.6: ~$0.003 / k token output
 *   - 一通 5 分鐘錄音: 總成本 ~$0.01
 *
 * 紅線: 音檔不存 Storage,只存 transcript text + 評估
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const startTs = Date.now();
  const sb = getSupabaseAdmin();

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const email = formData.get("email") as string | null;
    const moduleId = formData.get("module_id") as string | null;
    const frameworkHint = formData.get("framework_hint") as string | null;

    if (!file || !email || !moduleId) {
      return NextResponse.json({ error: "missing file/email/module_id" }, { status: 400 });
    }

    // 1. 撈 user + module
    const [{ data: user }, { data: mod }] = await Promise.all([
      sb.from("users").select("id, name, stage, brand").eq("email", email).maybeSingle(),
      sb.from("training_modules").select("*").eq("id", moduleId).maybeSingle(),
    ]);
    if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });
    if (!mod) return NextResponse.json({ error: "module not found" }, { status: 404 });

    // 2. Groq Whisper 轉文字
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ error: "GROQ_API_KEY missing in env" }, { status: 500 });
    }

    const groqForm = new FormData();
    groqForm.append("file", file);
    groqForm.append("model", "whisper-large-v3");
    groqForm.append("response_format", "verbose_json");
    groqForm.append("language", "zh");

    const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}` },
      body: groqForm,
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      await sb.from("system_run_log").insert({
        source: "api:/api/me/training/transcribe",
        status: "fail",
        error_message: `Groq error ${groqRes.status}: ${errText.slice(0, 200)}`,
        duration_ms: Date.now() - startTs,
      });
      return NextResponse.json({ error: `Whisper failed: ${groqRes.status}`, detail: errText.slice(0, 300) }, { status: 502 });
    }

    const whisperData = await groqRes.json();
    const transcript = whisperData.text || "";
    const segments = whisperData.segments || [];

    // 3. Claude 三點評估(順暢 / 邏輯 / 語氣)+ 架構命中率
    const framework = frameworkHint
      || (mod.content as any)?.framework
      || ((mod.content as any)?.stages?.map((s: any) => s.name).join(" → "))
      || "破冰 → 背景探索 → 經驗確認 → 動機詢問 → 價值疊加 → 教學說明 → 定價分期 → 行動呼籲";

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });
    }
    const anthropic = new Anthropic({ apiKey });

    const evalPrompt = `你是訓練官 Yu,要評估員工這通對練錄音。

員工: ${user.name || email} · 階段: ${user.stage || "?"} · 品牌: ${user.brand || "?"}
正在練的 module: ${mod.title}
要對照的架構: ${framework}

錄音逐字稿:
"""
${transcript.slice(0, 8000)}
"""

請給三點評估 + 架構命中率。**輸出嚴格 JSON**:

{
  "順暢": { "score": 0-100, "comment": "1-2 句具體" },
  "邏輯": { "score": 0-100, "comment": "1-2 句具體,點名漏了哪些步驟" },
  "語氣": { "score": 0-100, "comment": "1-2 句具體,語調 / 笑容 / 急躁" },
  "missing_steps": ["架構上漏掉的步驟名,如 '背景探索' '價值疊加'"],
  "suggestions": ["1 條具體可執行建議,如 '對練 1 場補延伸話題'"],
  "overall_score": 0-100
}

只輸出 JSON,不要其他文字。`;

    const claudeRes = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: evalPrompt }],
    });

    let evaluation: any = null;
    try {
      const text = claudeRes.content[0].type === "text" ? claudeRes.content[0].text : "{}";
      // 容錯: 抓 JSON object
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      evaluation = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      evaluation = { error: "claude returned non-JSON", raw: claudeRes.content };
    }

    const overallScore = evaluation?.overall_score ?? null;

    // 4. 寫 training_user_progress (upsert)
    const { data: existing } = await sb
      .from("training_user_progress")
      .select("id, attempts")
      .eq("user_id", user.id)
      .eq("module_id", moduleId)
      .maybeSingle();

    const progressPayload = {
      user_id: user.id,
      module_id: moduleId,
      status: overallScore && overallScore >= 60 ? "completed" : "in_progress",
      score: overallScore,
      attempts: (existing?.attempts || 0) + 1,
      started_at: existing ? undefined : new Date().toISOString(),
      completed_at: overallScore && overallScore >= 60 ? new Date().toISOString() : null,
      metadata: {
        transcript: transcript.slice(0, 20000),
        evaluation,
        segments_count: segments.length,
        whisper_duration_sec: whisperData.duration || null,
      },
      updated_at: new Date().toISOString(),
    };

    let progressRow;
    if (existing) {
      const { data } = await sb.from("training_user_progress").update(progressPayload).eq("id", existing.id).select().single();
      progressRow = data;
    } else {
      const { data } = await sb.from("training_user_progress").insert(progressPayload).select().single();
      progressRow = data;
    }

    // 5. 觸發印章(如果 module 有 reward.stamp 且 first time complete)
    if (overallScore && overallScore >= 60 && (mod.reward as any)?.stamp && !existing?.attempts) {
      await sb.from("training_stamps").insert({
        user_id: user.id,
        stamp_code: `module_${moduleId}`,
        stamp_name: (mod.reward as any).stamp,
        rarity: (mod.reward as any).rarity || "common",
        source_module_id: moduleId,
      });
    }

    // 6. log
    await sb.from("system_run_log").insert({
      source: "api:/api/me/training/transcribe",
      status: "ok",
      rows_in: 1,
      rows_out: 1,
      duration_ms: Date.now() - startTs,
      metadata: {
        user_id: user.id,
        module_id: moduleId,
        transcript_len: transcript.length,
        score: overallScore,
      },
    });

    return NextResponse.json({
      transcript,
      evaluation,
      score: overallScore,
      progress_id: progressRow?.id,
      duration_ms: Date.now() - startTs,
    });
  } catch (err: any) {
    await sb.from("system_run_log").insert({
      source: "api:/api/me/training/transcribe",
      status: "fail",
      duration_ms: Date.now() - startTs,
      error_message: String(err?.message || err).slice(0, 500),
    });
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
