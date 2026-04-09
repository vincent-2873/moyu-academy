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

async function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic({ apiKey });
}

async function callClaude(
  system: string,
  userPrompt: string,
  maxTokens = 2000
): Promise<string> {
  const client = await getAnthropicClient();
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

// ─── Fallback Data ──────────────────────────────────────────────────────────

const FALLBACK_ANNOUNCEMENTS = [
  { title: "☀️ 早安！今天也是充滿機會的一天", content: "每一通電話都是一個機會，每一次拒絕都是離成交更近一步。今天的目標：比昨天多打 5 通，多一份用心。業務的世界沒有奇蹟，只有累積。加油，摸魚人！" },
  { title: "🔥 週一衝刺！新的一週新的開始", content: "週一是業務員的黃金日！客戶經過週末沉澱，更容易接受新資訊。今天把握黃金時段 10:00-11:30 和 14:00-16:00，集中火力開發。記住：量大質優，先求量再求質！" },
  { title: "💪 堅持的力量：頂尖業務的秘密", content: "統計顯示，80% 的成交發生在第 5-12 次跟進。大多數業務在第 3 次就放棄了。今天的任務：翻出你的跟進名單，找出那些「快要放棄」的客戶，再給他們一次機會。堅持，就是你的超能力！" },
  { title: "🎯 今日金句：不是客戶不需要，是你還沒找到痛點", content: "每個客戶都有需求，只是有些藏得比較深。今天練習多問「為什麼」——為什麼現在不考慮？為什麼覺得不需要？每個「為什麼」背後都藏著一個成交機會。用 SPIN 提問法，挖出客戶真正的需求！" },
  { title: "📞 電話開發小提醒：語速決定成敗", content: "研究顯示，最佳電話銷售語速是每分鐘 140-170 字。太快客戶聽不懂，太慢客戶沒耐心。今天打電話時注意：開頭放慢 20%，重點加重語氣，結尾保持堅定。你的聲音就是你的名片！" },
  { title: "🌟 學習日報：今天你進步了嗎？", content: "每天花 15 分鐘回顧今天的通話：哪一通處理得最好？哪一通可以更好？寫下來，明天就能進步。頂尖業務不是天生的，是每天進步 1% 累積出來的。打開你的對練模組，練一輪再下班！" },
  { title: "🏆 挑戰自己：今天的小目標", content: "給自己設一個可達成的小目標：多打 3 通電話、多約 1 個見面、多練 1 次對練。小目標帶來小成就，小成就累積大信心。記住：不跟別人比，只跟昨天的自己比。你已經在進步的路上了！" },
];

const FALLBACK_QUIZZES: QuizQuestion[][] = [
  [
    { question: "客戶說「我再考慮看看」，以下哪個回應最有效？", options: ["好的，那您慢慢考慮", "請問您主要在考慮哪個部分呢？", "現在不買以後會漲價喔", "要不要我明天再打給您？"], correct: 1, explanation: "詢問客戶具體在考慮什麼，能幫助你了解真正的顧慮，進而針對性地解決異議。" },
    { question: "SPIN 銷售法中的 'I' 代表什麼？", options: ["Interest（興趣）", "Information（資訊）", "Implication（暗示影響）", "Introduction（介紹）"], correct: 2, explanation: "Implication 是讓客戶理解問題如果不解決會帶來什麼影響，加深痛點感受。" },
    { question: "電話開發的最佳時段是？", options: ["早上 8:00-9:00", "早上 10:00-11:30", "中午 12:00-13:00", "晚上 20:00-21:00"], correct: 1, explanation: "10:00-11:30 是客戶最容易接聽且心情較好的時段，避免太早或午休時間打擾。" },
    { question: "面對價格異議，以下哪個策略最不建議？", options: ["強調價值而非價格", "提供分期付款方案", "立即給予最大折扣", "用對比法凸顯 CP 值"], correct: 2, explanation: "立即給最大折扣會讓客戶覺得原價虛高，也壓縮了談判空間。應先強調價值，再視情況給優惠。" },
    { question: "建立客戶信任的第一步是？", options: ["展示專業證照", "認真傾聽客戶需求", "分享成功案例", "提供免費試用"], correct: 1, explanation: "傾聽是建立信任的基礎。客戶感受到被理解和重視，才會願意敞開心胸接受你的建議。" },
  ],
  [
    { question: "以下哪個是有效的開場白技巧？", options: ["直接介紹產品功能", "先建立共同話題或共鳴", "詢問是否有時間聊", "報上公司名稱和職位"], correct: 1, explanation: "建立共同話題能快速拉近距離，讓客戶卸下防備，比直接推銷更有效。" },
    { question: "客戶說「你們比 XX 公司貴」，最好的回應是？", options: ["那我幫您打折", "我們品質比較好", "您覺得 XX 公司哪些地方吸引您呢？", "貴有貴的道理"], correct: 2, explanation: "反問能了解客戶真正的比較標準，同時也能找出競爭對手的弱點來差異化。" },
    { question: "跟進客戶的最佳頻率是？", options: ["每天打一通", "3-5 天一次，每次帶新價值", "等客戶主動聯繫", "一週打三通以上"], correct: 1, explanation: "3-5 天跟進一次，每次提供新的資訊或價值，既不會太頻繁騷擾，也不會讓客戶遺忘你。" },
    { question: "成交前的最後一步，最重要的是？", options: ["再次強調優惠", "確認客戶理解所有條款", "催促客戶盡快決定", "分享更多成功案例"], correct: 1, explanation: "確認客戶理解所有條款和細節，能避免後續糾紛，也展現專業和誠信。" },
    { question: "面對沉默型客戶，最好的策略是？", options: ["不斷說話填滿空白", "使用開放式問題引導", "直接進入產品介紹", "認為他沒興趣就放棄"], correct: 1, explanation: "開放式問題（如「您覺得...」「能分享一下...」）能引導沉默型客戶開口，打開對話空間。" },
  ],
  [
    { question: "「假設成交法」的核心概念是？", options: ["假裝已經成交來騙客戶", "在對話中自然地假設客戶會購買", "先收錢再說明條款", "假設客戶沒有預算"], correct: 1, explanation: "假設成交法是在對話中自然帶入「購買後」的場景，例如「您開始使用後...」，引導客戶進入擁有的想像。" },
    { question: "處理「我要跟家人商量」的異議，最佳做法是？", options: ["說「不用商量，自己決定就好」", "了解家人可能的顧慮，提供相應資料", "直接約下次帶家人一起來", "放棄這個客戶"], correct: 1, explanation: "理解家人的角色和可能顧慮，提供針對性的資料，幫助客戶在家人面前也能說明清楚。" },
    { question: "業務新人最常犯的錯誤是？", options: ["打太多電話", "過度傾聽客戶", "說太多、聽太少", "太常跟進客戶"], correct: 2, explanation: "新手業務最常見的錯誤是急於介紹產品，忽略傾聽客戶的真實需求。80/20 法則：80% 聽，20% 說。" },
    { question: "以下哪個不是有效的異議處理步驟？", options: ["先同理客戶感受", "確認具體的顧慮點", "立即反駁客戶觀點", "提供解決方案"], correct: 2, explanation: "立即反駁會讓客戶感覺不被尊重。正確的流程是：同理→確認→解決→確認滿意。" },
    { question: "電話結束前最重要的動作是？", options: ["說謝謝再見", "確認下次聯繫的時間和方式", "再推一次產品", "詢問是否有其他需求"], correct: 1, explanation: "確認下次聯繫時間能維持跟進節奏，避免「打完就忘」。每通電話都應該有明確的下一步。" },
  ],
];

// ─── Step 1: AI Morning Announcement ────────────────────────────────────────

async function generateMorningAnnouncement(): Promise<StepResult> {
  const step = "morning_announcement";
  try {
    const supabase = getSupabaseAdmin();
    const today = todayString();

    let title: string;
    let content: string;

    try {
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
      title = parsed.title;
      content = parsed.content;
    } catch {
      // AI failed — use fallback
      const dayIndex = new Date().getDay(); // 0-6
      const fallback = FALLBACK_ANNOUNCEMENTS[dayIndex % FALLBACK_ANNOUNCEMENTS.length];
      title = fallback.title;
      content = fallback.content;
    }

    const { error } = await supabase.from("announcements").insert({
      title,
      content,
      type: "morning",
      is_ai_generated: true,
      priority: 1,
      created_by: "ai_system",
    });

    if (error) throw error;
    return { step, success: true, detail: title };
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

    let questions: QuizQuestion[];

    try {
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

      const parsed = extractJSON(text) as QuizQuestion[];
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Invalid quiz format");
      questions = parsed;
    } catch {
      // AI failed — use fallback quiz
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      questions = FALLBACK_QUIZZES[dayOfYear % FALLBACK_QUIZZES.length];
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

// ─── Step 7: AI Tutor — Proactive Student Care ────────────────────────────

async function aiTutorCheck(): Promise<StepResult> {
  const step = "ai_tutor_check";
  try {
    const supabase = getSupabaseAdmin();

    // Get all active users
    const { data: users, error: usersErr } = await supabase
      .from("users")
      .select("id, email, name, created_at")
      .eq("status", "active");
    if (usersErr) throw usersErr;
    if (!users || users.length === 0) return { step, success: true, detail: "No users" };

    // Get progress, quiz, sparring data
    const { data: progress } = await supabase.from("user_progress").select("user_id, module_id, updated_at").order("updated_at", { ascending: false });
    const { data: quizScores } = await supabase.from("quiz_scores").select("user_id, score, created_at").order("created_at", { ascending: false });
    const { data: sparringRecs } = await supabase.from("sparring_records").select("user_email, scores, created_at").order("created_at", { ascending: false });

    // Build per-user profile
    const progressMap: Record<string, { lastUpdate: string; modules: number }> = {};
    if (progress) {
      for (const p of progress) {
        if (!progressMap[p.user_id]) progressMap[p.user_id] = { lastUpdate: p.updated_at, modules: 0 };
        progressMap[p.user_id].modules++;
      }
    }

    const quizMap: Record<string, { lastScore: number; avgScore: number; count: number }> = {};
    if (quizScores) {
      const grouped: Record<string, number[]> = {};
      for (const q of quizScores) {
        if (!grouped[q.user_id]) grouped[q.user_id] = [];
        grouped[q.user_id].push(q.score);
      }
      for (const [uid, scores] of Object.entries(grouped)) {
        quizMap[uid] = { lastScore: scores[0], avgScore: scores.reduce((a, b) => a + b, 0) / scores.length, count: scores.length };
      }
    }

    let notifCount = 0;

    for (const user of users) {
      const daysSinceJoin = Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000);
      const prog = progressMap[user.id];
      const quiz = quizMap[user.id];

      // Determine if user needs attention
      let tutorMessage: string | null = null;
      let tutorTitle: string | null = null;
      let severity: "info" | "warning" = "info";

      // Case 1: New user (joined 1-2 days ago) with no progress
      if (daysSinceJoin >= 1 && daysSinceJoin <= 2 && (!prog || prog.modules === 0)) {
        tutorTitle = `👋 ${user.name || "同學"}，第一天還好嗎？`;
        tutorMessage = `你加入已經 ${daysSinceJoin} 天了，還沒有開始訓練課程喔！建議先從 Day 1 開始，聽聽開發 Call 錄音，熟悉電話銷售的節奏。有任何問題都可以問 AI 小助手！加油 💪`;
        severity = "info";
      }
      // Case 2: User stalled (no progress in 2+ days but not caught by inactive alert)
      else if (prog && daysSinceJoin > 2) {
        const lastUpdate = new Date(prog.lastUpdate);
        const stalledDays = Math.floor((Date.now() - lastUpdate.getTime()) / 86400000);
        if (stalledDays >= 2 && stalledDays < 3) {
          tutorTitle = `📚 ${user.name || "同學"}，好幾天沒練習了`;
          tutorMessage = `你已經 ${stalledDays} 天沒有新的學習紀錄了。目前完成了 ${prog.modules} 個模組，繼續加油！每天花 30 分鐘就能完成一個模組，不要中斷學習的節奏。今天就回來練一下吧！`;
          severity = "info";
        }
      }
      // Case 3: Quiz scores dropping
      if (quiz && quiz.count >= 2 && quiz.lastScore < quiz.avgScore * 0.7 && !tutorMessage) {
        tutorTitle = `📝 ${user.name || "同學"}，最近測驗分數下降了`;
        tutorMessage = `你最近一次測驗只得了 ${quiz.lastScore} 分，低於你的平均 ${Math.round(quiz.avgScore)} 分。沒關係！建議重新複習一下訓練教材，特別是銷售話術和異議處理的部分。知識需要反覆練習才能內化。你可以的！`;
        severity = "warning";
      }
      // Case 4: Never done sparring
      if (daysSinceJoin >= 3 && sparringRecs) {
        const userSparring = sparringRecs.filter(r => r.user_email === user.email);
        if (userSparring.length === 0 && !tutorMessage) {
          tutorTitle = `🎯 ${user.name || "同學"}，試試 AI 對練吧！`;
          tutorMessage = `你已經加入 ${daysSinceJoin} 天了，但還沒有嘗試 AI 對練功能。對練是提升銷售能力最快的方式！AI 會扮演不同類型的客戶，幫你練習話術和異議處理。每天練一次，進步超有感！`;
          severity = "info";
        }
      }

      if (tutorTitle && tutorMessage) {
        // Check if we already sent a similar message recently (within 2 days)
        const { data: recent } = await supabase
          .from("ai_notifications")
          .select("id")
          .eq("user_email", user.email)
          .eq("type", "ai_tutor")
          .gte("created_at", daysAgo(2))
          .limit(1);

        if (!recent || recent.length === 0) {
          const { error } = await supabase.from("ai_notifications").insert({
            user_email: user.email,
            type: "ai_tutor",
            title: tutorTitle,
            message: tutorMessage,
            severity,
          });
          if (!error) notifCount++;
        }
      }
    }

    return { step, success: true, detail: `Checked ${users.length} users, sent ${notifCount} tutor messages` };
  } catch (err) {
    return { step, success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Step 8: Generate Articles Inline ──────────────────────────────────────

const ARTICLE_CATEGORIES = ["sales_technique", "mindset", "industry_trend", "negotiation", "client_management"] as const;
const ARTICLE_CAT_LABELS: Record<string, string> = {
  sales_technique: "銷售技巧", mindset: "心態與自我成長", industry_trend: "產業趨勢",
  negotiation: "談判與溝通", client_management: "客戶經營",
};

async function generateArticles(): Promise<StepResult> {
  const step = "article_generation";
  try {
    const supabase = getSupabaseAdmin();
    const shuffled = [...ARTICLE_CATEGORIES].sort(() => Math.random() - 0.5);
    const batchSize = 3;
    const todayCategories = shuffled.slice(0, batchSize);

    const searchQueries = [
      "best sales techniques free course", "B2B sales strategies",
      "negotiation skills tips", "client relationship management",
      "業務銷售技巧 免費課程", "銷售心態 成長 文章", "談判技巧 教學",
      "客戶經營 策略", "SPIN 銷售法 實戰", "電話行銷 技巧",
    ];

    let insertedCount = 0;

    for (let i = 0; i < todayCategories.length; i++) {
      const cat = todayCategories[i];
      const query = searchQueries.sort(() => Math.random() - 0.5)[0];

      try {
        const text = await callClaude(
          `你是一位資深業務培訓專家。根據搜尋主題產出一篇高品質的業務力課程文章。
規則：繁體中文、實用具體可操作、包含話術範例和情境模擬。
回覆 JSON：{"title":"標題","summary":"80字內摘要","content":"Markdown 格式 500-800 字","source":"來源","key_takeaways":["重點1","重點2","重點3"],"tags":["標籤1","標籤2"],"ai_analysis":"200字深度分析"}`,
          `主題：「${query}」\n類別：${ARTICLE_CAT_LABELS[cat]}\n只回覆 JSON。`,
          2000
        );

        const match = text.match(/\{[\s\S]*\}/);
        if (!match) continue;
        const parsed = JSON.parse(match[0]);

        const { error } = await supabase.from("articles").insert({
          title: parsed.title, category: cat, summary: parsed.summary,
          content: parsed.content, source: parsed.source || "AI 綜合分析",
          source_url: "AI 綜合分析", source_language: "zh-TW",
          key_takeaways: parsed.key_takeaways || [], tags: parsed.tags || [],
          ai_analysis: parsed.ai_analysis || "", is_ai_generated: true,
        });
        if (!error) insertedCount++;
      } catch {
        continue;
      }
    }

    return { step, success: true, detail: `Generated ${insertedCount}/${batchSize} articles` };
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
    aiTutorCheck,
    generateArticles,
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
