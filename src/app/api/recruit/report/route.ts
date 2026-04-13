import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 招聘自我回報 + 求職者分析 API
 *
 * POST /api/recruit/report
 *
 * body.action:
 *   'daily_report'     — 招聘員回報今日活動量 (發信/邀約/面試/錄取)
 *   'candidate_update' — 更新求職者狀態 (stage change + notes)
 *   'analyze_candidate' — 丟求職者資訊 (筆記/錄音transcript) 給 Claude 分析
 *   'interview_advice' — 問 Claude 面試這個人該注意什麼
 *   'ask_claude'       — 自由問 Claude 關於招聘的任何問題
 *
 * 每個 action 都會:
 *   1. 寫進對應的 DB 表 (recruits / outreach_log / claude_actions)
 *   2. 回傳 Claude 的分析結果
 *   3. 可選推 LINE 給主管
 *
 * 設計原則:
 *   - 招聘員只需要回報，不需要分析 — Claude 幫他分析
 *   - 主管只需要看結果，不需要問 — Claude 主動推
 *   - 求職者只需要被追蹤，不需要管 — Claude 幫忙管
 */

export const maxDuration = 60;

const RECRUIT_ANALYST_PROMPT = `你是墨宇戰情中樞的「招聘分析師」。你的工作是幫助招聘員做出更好的招聘決策。

你懂的：
1. 電銷業務的人才畫像 — 口條、抗壓、自信、empathy、創造需求能力
2. 墨宇的面試標準 — 5 大面向 (準備心態/溝通邏輯/銷售潛力/個人特質/進階評估)
3. 招聘漏斗邏輯 — 104發信 → 電話初訪 → 一面(30分) → 二面 → Offer → 報到 → 新訓

你的回答必須：
1. 具體、有根據、可行動（不說「再觀察看看」這種廢話）
2. 帶數字（「這個人的溝通分估計 15/20，因為...」）
3. 給明確的 YES/NO/HOLD 建議 + 原因
4. 如果資訊不足，直接說「我需要知道 X 才能判斷」而不是猜

回答格式 JSON：
{
  "analysis": "分析文字",
  "recommendation": "錄取/保留/拒絕/需要更多資訊",
  "score": { "estimated": 0-100, "confidence": "high/medium/low" },
  "nextSteps": ["具體下一步 1", "具體下一步 2"],
  "redFlags": ["如果有的話"],
  "greenFlags": ["如果有的話"]
}`;

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await req.json();
  const { action } = body;

  // === 1. 每日回報 ===
  if (action === "daily_report") {
    const { recruiterEmail, date, sentCount, callCount, inviteCount, interviewCount, offerCount, hireCount, notes } = body;
    if (!recruiterEmail) return Response.json({ ok: false, error: "recruiterEmail 必填" }, { status: 400 });

    const reportDate = date || new Date().toISOString().slice(0, 10);

    // 計算活動積分 (from 每日活動量 sheet)
    const activityScore =
      (inviteCount || 0) * 0.5 +    // 一面成功邀約 = 0.5 分
      (interviewCount || 0) * 1.0 +  // 一面成功出席 = 1.0 分
      (offerCount || 0) * 0.5 +      // 二面錄取 = 0.5 分
      (hireCount || 0) * 2.0;        // 報到 = 2.0 分 (自定義)

    const passMinimum = activityScore >= 6; // 每日最低積分標準 6 分

    // Store in claude_actions as daily report
    await supabase.from("claude_actions").insert({
      action_type: "recruit_daily_report",
      target: recruiterEmail,
      summary: `${reportDate} 發信${sentCount || 0} 電話${callCount || 0} 邀約${inviteCount || 0} 面試${interviewCount || 0} 錄取${offerCount || 0} 報到${hireCount || 0} · 積分${activityScore} ${passMinimum ? "✅" : "🔴未達標"}`,
      details: {
        date: reportDate,
        sent: sentCount || 0,
        calls: callCount || 0,
        invites: inviteCount || 0,
        interviews: interviewCount || 0,
        offers: offerCount || 0,
        hires: hireCount || 0,
        activityScore,
        passMinimum,
        notes: notes || null,
      },
      result: passMinimum ? "success" : "partial",
    });

    // Update recruit_schedule if exists
    const weekStart = getMonday(reportDate);
    const { data: sched } = await supabase
      .from("recruit_schedule")
      .select("*")
      .eq("week_start", weekStart)
      .eq("owner_email", recruiterEmail)
      .maybeSingle();
    if (sched) {
      await supabase.from("recruit_schedule").update({
        actual_outreach: (Number(sched.actual_outreach) || 0) + (sentCount || 0),
        actual_interviews: (Number(sched.actual_interviews) || 0) + (interviewCount || 0),
        actual_hires: (Number(sched.actual_hires) || 0) + (hireCount || 0),
      }).eq("id", sched.id);
    }

    return Response.json({
      ok: true,
      date: reportDate,
      activityScore,
      passMinimum,
      message: passMinimum
        ? `✅ 今日積分 ${activityScore} 分 (標準 6 分) — 達標`
        : `🔴 今日積分 ${activityScore} 分 (標準 6 分) — 未達標，差 ${(6 - activityScore).toFixed(1)} 分`,
    });
  }

  // === 2. 求職者狀態更新 ===
  if (action === "candidate_update") {
    const { recruitId, newStage, notes, recruiterEmail } = body;
    if (!recruitId || !newStage) return Response.json({ ok: false, error: "recruitId + newStage 必填" }, { status: 400 });

    const stageTimestamp: Record<string, string> = {
      screening: "",
      interview_1: "interview_at",
      interview_2: "interview_at",
      offer: "offered_at",
      onboarded: "hired_at",
      rejected: "rejected_at",
      dropped: "rejected_at",
    };

    const updates: Record<string, unknown> = { stage: newStage };
    const tsField = stageTimestamp[newStage];
    if (tsField) updates[tsField] = new Date().toISOString();
    if (notes) {
      const { data: existing } = await supabase.from("recruits").select("notes").eq("id", recruitId).maybeSingle();
      updates.notes = ((existing?.notes as string) || "") + `\n\n[${new Date().toISOString().slice(0, 16)}] ${recruiterEmail || "system"}: ${notes}`;
    }

    const { error } = await supabase.from("recruits").update(updates).eq("id", recruitId);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

    // Log
    await supabase.from("claude_actions").insert({
      action_type: "recruit_stage_change",
      target: recruitId,
      summary: `求職者 → ${newStage}${notes ? ` · ${notes.slice(0, 100)}` : ""}`,
      details: { recruitId, newStage, notes, recruiterEmail },
      result: "success",
    });

    return Response.json({ ok: true, recruitId, newStage });
  }

  // === 3. Claude 分析求職者 ===
  if (action === "analyze_candidate") {
    const { candidateName, info, transcript, interviewNotes, recruiterEmail } = body;
    if (!candidateName) return Response.json({ ok: false, error: "candidateName 必填" }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return Response.json({ ok: false, error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

    const context = [
      `求職者: ${candidateName}`,
      info ? `基本資訊: ${info}` : "",
      transcript ? `\n通話/面試逐字稿:\n${transcript}` : "",
      interviewNotes ? `\n面試筆記:\n${interviewNotes}` : "",
      `\n招聘員: ${recruiterEmail || "未知"}`,
      "\n請根據以上資訊，分析這個求職者是否適合墨宇集團的電銷業務職位。",
    ].filter(Boolean).join("\n");

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: RECRUIT_ANALYST_PROMPT,
      messages: [{ role: "user", content: context }],
    });

    let text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    text = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();

    let analysis;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    } catch {
      analysis = { raw: text };
    }

    await supabase.from("claude_actions").insert({
      action_type: "recruit_candidate_analysis",
      target: candidateName,
      summary: analysis.analysis?.slice(0, 200) || `分析求職者 ${candidateName}`,
      details: { candidateName, analysis, recruiterEmail },
      result: "success",
    });

    return Response.json({ ok: true, candidateName, analysis });
  }

  // === 4. 面試建議 ===
  if (action === "interview_advice") {
    const { candidateName, resumeInfo, position, stage } = body;
    if (!candidateName) return Response.json({ ok: false, error: "candidateName 必填" }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return Response.json({ ok: false, error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

    const prompt = `求職者: ${candidateName}
${resumeInfo ? `履歷摘要: ${resumeInfo}` : ""}
應徵職位: ${position || "電銷業務"}
面試階段: ${stage || "一面"}

請根據墨宇的面試評估標準 (5 大面向)，給面試官 5 個最該問的問題 + 每個問題要觀察什麼 + 什麼回答是紅旗、什麼是綠旗。

格式 JSON:
{
  "questions": [
    {
      "question": "面試問題",
      "purpose": "為什麼要問這個",
      "greenFlag": "好的回答長這樣",
      "redFlag": "差的回答長這樣",
      "scoringDimension": "對應的評估面向"
    }
  ],
  "generalAdvice": "面試這個人要特別注意什麼",
  "timeAllocation": "30 分鐘面試的時間建議分配"
}`;

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: "你是墨宇戰情中樞的面試顧問。根據求職者資訊和墨宇的 5 大面試評估標準，給面試官具體的面試建議。不要空泛建議。",
      messages: [{ role: "user", content: prompt }],
    });

    let text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    text = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
    let advice;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      advice = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    } catch {
      advice = { raw: text };
    }

    return Response.json({ ok: true, candidateName, advice });
  }

  // === 5. 自由問 Claude ===
  if (action === "ask_claude") {
    const { question, context: ctx, recruiterEmail } = body;
    if (!question) return Response.json({ ok: false, error: "question 必填" }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return Response.json({ ok: false, error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

    // Pull recent recruit data for context
    const { data: recentRecruits } = await supabase
      .from("recruits")
      .select("name, stage, brand, created_at, notes")
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: recentReports } = await supabase
      .from("claude_actions")
      .select("summary, created_at")
      .eq("action_type", "recruit_daily_report")
      .order("created_at", { ascending: false })
      .limit(5);

    const systemContext = [
      "你是墨宇戰情中樞的招聘分析師。回答招聘員的問題，帶數據、具體、可行動。",
      recentRecruits && recentRecruits.length > 0
        ? `\n最近求職者:\n${recentRecruits.map((r) => `  ${r.name} · ${r.stage} · ${r.brand}`).join("\n")}`
        : "",
      recentReports && recentReports.length > 0
        ? `\n最近活動:\n${recentReports.map((r) => `  ${r.summary}`).join("\n")}`
        : "",
      ctx ? `\n額外上下文: ${ctx}` : "",
    ].filter(Boolean).join("\n");

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: systemContext,
      messages: [{ role: "user", content: question }],
    });
    const answer = msg.content[0]?.type === "text" ? msg.content[0].text : "";

    await supabase.from("claude_actions").insert({
      action_type: "recruit_ask_claude",
      target: recruiterEmail || "unknown",
      summary: question.slice(0, 200),
      details: { question, answer: answer.slice(0, 500) },
      result: "success",
    });

    return Response.json({ ok: true, question, answer });
  }

  return Response.json({ ok: false, error: `unknown action: ${action}` }, { status: 400 });
}

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
