import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StepResult {
  step: string;
  success: boolean;
  detail?: string;
  error?: string;
}

interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correct: number;
  explanation: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Anthropic = require("@anthropic-ai/sdk");
  return new Anthropic({ apiKey });
}

async function callClaude(
  system: string,
  userPrompt: string,
  maxTokens = 2000
): Promise<string> {
  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userPrompt }],
  });
  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}

function extractJSON(text: string): unknown {
  // Try to find JSON in markdown code blocks or raw text
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!match) throw new Error("No JSON found in response");
  return JSON.parse(match[1] || match[0]);
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function isSunday(): boolean {
  return new Date().getDay() === 0;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ─── Step 1: AI Morning Announcement ────────────────────────────────────────

async function generateMorningAnnouncement(): Promise<StepResult> {
  const step = "morning_announcement";
  try {
    const supabase = getSupabaseAdmin();
    const today = todayString();

    const text = await callClaude(
      `你是摸魚學院的 AI 助教，風格幽默、正面、帶點「摸魚」調侃但又鼓勵大家努力。
用繁體中文撰寫。回覆 JSON 格式：{"title": "標題", "content": "內容（100-200字）"}`,
      `今天是 ${today}，請寫一段摸魚學院的每日早安公告。
要求：
1. 標題要吸睛，可以有 emoji
2. 內容要鼓勵業務同仁，帶點幽默
3. 可以提到今天的日期、天氣概念、業務金句等
4. 結尾鼓勵大家開始一天的工作

只回覆 JSON。`
    );

    const parsed = extractJSON(text) as { title: string; content: string };

    const { error } = await supabase.from("announcements").insert({
      title: parsed.title,
      content: parsed.content,
      type: "morning",
      is_ai_generated: true,
      priority: 1,
      created_by: "ai_system",
    });

    if (error) throw error;
    return { step, success: true, detail: parsed.title };
  } catch (err) {
    return { step, success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Step 2: Inactive User Alerts ───────────────────────────────────────────

async function detectInactiveUsers(): Promise<StepResult> {
  const step = "inactive_user_alerts";
  try {
    const supabase = getSupabaseAdmin();
    const threshold = daysAgo(3);

    // Get all users
    const { data: users, error: usersErr } = await supabase
      .from("users")
      .select("id, email, name, created_at");
    if (usersErr) throw usersErr;
    if (!users || users.length === 0) return { step, success: true, detail: "No users found" };

    // Get latest activity per user from user_progress
    const { data: progress } = await supabase
      .from("user_progress")
      .select("user_id, updated_at")
      .order("updated_at", { ascending: false });

    // Build a map of user_id -> latest updated_at
    const latestActivity: Record<string, string> = {};
    if (progress) {
      for (const p of progress) {
        if (!latestActivity[p.user_id]) {
          latestActivity[p.user_id] = p.updated_at;
        }
      }
    }

    const inactiveUsers = users.filter((u) => {
      const lastActive = latestActivity[u.id] || u.created_at;
      return new Date(lastActive) < new Date(threshold);
    });

    let insertedCount = 0;
    for (const user of inactiveUsers) {
      const lastActive = latestActivity[user.id] || user.created_at;
      const daysSince = Math.floor(
        (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24)
      );

      const { error } = await supabase.from("ai_notifications").insert({
        user_email: user.email,
        type: "inactive_alert",
        title: `${user.name || "同學"} 已 ${daysSince} 天沒有活動`,
        message: `${user.name || user.email} 已經 ${daysSince} 天沒有學習記錄，建議主動關心或推送學習提醒。`,
        severity: "warning",
      });

      if (!error) insertedCount++;
    }

    return {
      step,
      success: true,
      detail: `Found ${inactiveUsers.length} inactive users, inserted ${insertedCount} alerts`,
    };
  } catch (err) {
    return { step, success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Step 3: KPI Anomaly Detection ─────────────────────────────────────────

async function detectKPIAnomalies(): Promise<StepResult> {
  const step = "kpi_anomaly_detection";
  try {
    const supabase = getSupabaseAdmin();

    // Get yesterday's date range
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const { data: entries, error: kpiErr } = await supabase
      .from("kpi_entries")
      .select("*")
      .gte("date", yesterdayStr)
      .lt("date", todayString());

    if (kpiErr) throw kpiErr;
    if (!entries || entries.length === 0) {
      return { step, success: true, detail: "No KPI entries for yesterday" };
    }

    let alertCount = 0;
    for (const entry of entries) {
      const calls = entry.calls ?? entry.call_count ?? 0;
      if (calls < 20) {
        const { error } = await supabase.from("ai_notifications").insert({
          user_email: entry.user_email || entry.email,
          type: "kpi_low",
          title: `KPI 警告：${yesterdayStr} 撥打量偏低`,
          message: `昨日（${yesterdayStr}）撥打量僅 ${calls} 通，低於基準 20 通。建議今天加強電話開發，把量補上來！`,
          severity: "warning",
        });
        if (!error) alertCount++;
      }
    }

    return {
      step,
      success: true,
      detail: `Checked ${entries.length} entries, created ${alertCount} low-KPI alerts`,
    };
  } catch (err) {
    return { step, success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Step 4: AI Daily Quiz Generation ───────────────────────────────────────

async function generateDailyQuiz(): Promise<StepResult> {
  const step = "daily_quiz_generation";
  try {
    const supabase = getSupabaseAdmin();
    const today = todayString();

    // Check if quiz already exists for today
    const { data: existing } = await supabase
      .from("daily_quizzes")
      .select("id")
      .eq("date", today)
      .limit(1);

    if (existing && existing.length > 0) {
      return { step, success: true, detail: "Quiz already exists for today" };
    }

    const text = await callClaude(
      `你是一位業務銷售培訓專家。請出 5 題關於銷售技巧的選擇題。用繁體中文。
回覆一個 JSON 陣列，每個元素格式：
{
  "question": "問題",
  "options": ["A選項", "B選項", "C選項", "D選項"],
  "correct": 0,
  "explanation": "解答說明"
}
correct 是正確答案的 index (0-3)。
只回覆 JSON 陣列。`,
      `請出 5 題業務銷售相關的選擇題。主題可涵蓋：
- 客戶開發與陌生開發
- 銷售話術與異議處理
- 成交技巧
- 客戶關係管理
- 業務心態與時間管理

難度：中等，適合有 1-3 年經驗的業務人員。
每題要有明確的正確答案和實用的解答說明。`,
      3000
    );

    const questions = extractJSON(text) as QuizQuestion[];

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("Invalid quiz format returned from AI");
    }

    const { error } = await supabase.from("daily_quizzes").insert({
      date: today,
      questions,
    });

    if (error) throw error;
    return { step, success: true, detail: `Generated ${questions.length} questions for ${today}` };
  } catch (err) {
    return { step, success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Step 5: Sparring Trend Analysis ────────────────────────────────────────

async function analyzeSparringTrends(): Promise<StepResult> {
  const step = "sparring_trend_analysis";
  try {
    const supabase = getSupabaseAdmin();

    // Get all sparring records
    const { data: records, error: recErr } = await supabase
      .from("sparring_records")
      .select("*")
      .order("created_at", { ascending: false });

    if (recErr) throw recErr;
    if (!records || records.length === 0) {
      return { step, success: true, detail: "No sparring records found" };
    }

    // Group by user
    const userRecords: Record<string, typeof records> = {};
    for (const r of records) {
      const key = r.user_email || r.user_id || r.email;
      if (!key) continue;
      if (!userRecords[key]) userRecords[key] = [];
      userRecords[key].push(r);
    }

    // Analyze users with 3+ records
    const dimensions = [
      "opening",
      "needs_discovery",
      "objection_handling",
      "closing",
      "rapport",
      "product_knowledge",
      "empathy",
      "confidence",
    ];

    let notificationCount = 0;

    for (const [userKey, recs] of Object.entries(userRecords)) {
      if (recs.length < 3) continue;

      // Aggregate scores per dimension
      const dimScores: Record<string, { total: number; count: number }> = {};
      for (const rec of recs) {
        const scores = rec.scores || rec.dimension_scores || rec.feedback?.scores || {};
        for (const dim of dimensions) {
          if (scores[dim] !== undefined && scores[dim] !== null) {
            if (!dimScores[dim]) dimScores[dim] = { total: 0, count: 0 };
            dimScores[dim].total += Number(scores[dim]);
            dimScores[dim].count += 1;
          }
        }
      }

      // Find weakest dimension
      let weakest: string | null = null;
      let lowestAvg = Infinity;
      for (const [dim, { total, count }] of Object.entries(dimScores)) {
        if (count === 0) continue;
        const avg = total / count;
        if (avg < lowestAvg) {
          lowestAvg = avg;
          weakest = dim;
        }
      }

      if (!weakest) continue;

      const dimensionLabels: Record<string, string> = {
        opening: "開場白",
        needs_discovery: "需求探索",
        objection_handling: "異議處理",
        closing: "成交技巧",
        rapport: "建立信任",
        product_knowledge: "產品知識",
        empathy: "同理心",
        confidence: "自信表達",
      };

      const personaMap: Record<string, string> = {
        opening: "冷淡型客戶",
        needs_discovery: "沉默型客戶",
        objection_handling: "挑剔型客戶",
        closing: "猶豫型客戶",
        rapport: "防備型客戶",
        product_knowledge: "專業型客戶",
        empathy: "情緒型客戶",
        confidence: "強勢型客戶",
      };

      const label = dimensionLabels[weakest] || weakest;
      const persona = personaMap[weakest] || "挑戰型客戶";

      const { error } = await supabase.from("ai_notifications").insert({
        user_email: userKey,
        type: "sparring_recommendation",
        title: `AI 建議：加強「${label}」練習`,
        message: `根據你最近 ${recs.length} 次的對練記錄，「${label}」是你目前最需要加強的維度（平均 ${lowestAvg.toFixed(1)} 分）。建議找「${persona}」角色多練習，針對性提升這個能力！`,
        severity: "info",
      });

      if (!error) notificationCount++;
    }

    return {
      step,
      success: true,
      detail: `Analyzed ${Object.keys(userRecords).length} users, sent ${notificationCount} recommendations`,
    };
  } catch (err) {
    return { step, success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Step 6: AI Weekly Report (Sunday only) ─────────────────────────────────

async function generateWeeklyReport(): Promise<StepResult> {
  const step = "weekly_report";

  if (!isSunday()) {
    return { step, success: true, detail: "Skipped (not Sunday)" };
  }

  try {
    const supabase = getSupabaseAdmin();
    const weekAgo = daysAgo(7);
    const today = todayString();

    // Gather weekly data in parallel
    const [usersRes, progressRes, quizRes, sparringRes, kpiRes] = await Promise.all([
      supabase.from("users").select("id, email, name").limit(500),
      supabase.from("user_progress").select("*").gte("updated_at", weekAgo),
      supabase.from("daily_quizzes").select("*").gte("date", daysAgo(7).slice(0, 10)),
      supabase.from("sparring_records").select("*").gte("created_at", weekAgo),
      supabase.from("kpi_entries").select("*").gte("date", daysAgo(7).slice(0, 10)),
    ]);

    const userCount = usersRes.data?.length ?? 0;
    const progressCount = progressRes.data?.length ?? 0;
    const quizCount = quizRes.data?.length ?? 0;
    const sparringCount = sparringRes.data?.length ?? 0;
    const kpiCount = kpiRes.data?.length ?? 0;

    // Build a data summary for Claude
    const dataSummary = {
      period: `${daysAgo(7).slice(0, 10)} ~ ${today}`,
      total_users: userCount,
      progress_records: progressCount,
      quizzes_generated: quizCount,
      sparring_sessions: sparringCount,
      kpi_entries: kpiCount,
    };

    const text = await callClaude(
      `你是摸魚學院的 AI 數據分析師。請根據本週的數據摘要，撰寫一份繁體中文的週報。
回覆 JSON：{"title": "週報標題", "summary": "300-500字的週報內容，包含數據亮點、需關注事項、下週建議"}`,
      `本週數據摘要：
${JSON.stringify(dataSummary, null, 2)}

請撰寫本週的 AI 週報，包含：
1. 整體學習數據概覽
2. 本週亮點（活躍度、對練次數等）
3. 需要關注的事項（不活躍用戶、低 KPI 等）
4. 下週的建議和目標

只回覆 JSON。`,
      2000
    );

    const parsed = extractJSON(text) as { title: string; summary: string };

    const { error } = await supabase.from("weekly_reports").insert({
      title: parsed.title,
      content: parsed.summary,
      week_start: daysAgo(7).slice(0, 10),
      week_end: today,
      data_snapshot: dataSummary,
      is_ai_generated: true,
    });

    if (error) throw error;
    return { step, success: true, detail: parsed.title };
  } catch (err) {
    return { step, success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const results: StepResult[] = [];

  // Run all steps independently — each catches its own errors
  const steps = [
    generateMorningAnnouncement,
    detectInactiveUsers,
    detectKPIAnomalies,
    generateDailyQuiz,
    analyzeSparringTrends,
    generateWeeklyReport,
  ];

  for (const stepFn of steps) {
    const result = await stepFn();
    results.push(result);
    console.log(`[daily-automation] ${result.step}: ${result.success ? "OK" : "FAIL"} — ${result.detail || result.error || ""}`);
  }

  const elapsed = Date.now() - startTime;
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return Response.json({
    ok: failed === 0,
    date: todayString(),
    elapsed_ms: elapsed,
    summary: `${succeeded}/${results.length} steps succeeded`,
    results,
    timestamp: new Date().toISOString(),
  });
}
