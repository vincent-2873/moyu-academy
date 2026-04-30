import { getSupabaseAdmin } from "@/lib/supabase";
import { linePush, buildCommandsFlex } from "@/lib/line-notify";
import { NextRequest } from "next/server";

/**
 * 新訓師徒制自動派任務 — 依【新訓後安排.xlsx】的 4 週爬坡 SOP
 *
 * 排程: 每日 08:45 TW = UTC 00:45
 *
 * 來源: 新訓後安排.xlsx 的「進度安排」sheet + 「總覽」sheet
 *
 * 4 週制度:
 *   第 1 週 (Day 1-5): 建立習慣 · 30→60 通 · 師徒全示範 · 降低挫折感
 *   第 2 週 (Day 6-10): 標準對齊 · 穩定 80 通 · 1 邀約/日 · 觀摩 Demo 3 場
 *   第 3 週 (Day 11-15): 實戰上手 · 穩定 100 通 · 新人主講 Demo · 師徒在旁即時救援
 *   第 4 週 (Day 16-20): 獨立驗收 · 穩定 120 通 · 完全放手 · 自我數據診斷
 *
 * 師徒制核心:
 *   - 第 1 週: 教練 Coach (手把手)
 *   - 第 2 週: 標竿 Model (要求數據達標)
 *   - 第 3 週: 副駕駛 Co-pilot (新人主講，師徒在旁)
 *   - 第 4 週: 顧問 Advisor (完全放手觀察)
 *
 * 每日回饋: 2+1 格式 (2 個優點 + 1 個建議)
 */

interface TrainingDay {
  day: number;
  week: number;
  callTarget: number;
  inviteTarget: number;
  showTarget: number;
  weekLabel: string;
  mentorRole: string;
  tasks: Array<{ title: string; detail: string; severity: "critical" | "high" | "normal" }>;
}

const TRAINING_PLAN: TrainingDay[] = [
  // ── 第 1 週: 建立習慣 · Coach ──
  {
    day: 1, week: 1, callTarget: 30, inviteTarget: 0, showTarget: 0,
    weekLabel: "第一週 · 建立習慣", mentorRole: "教練 Coach",
    tasks: [
      { title: "今日目標 30 通 — 熟悉撥打系統", detail: "不管結果，先把 30 通打完。重點是熟悉系統操作 + 講順開場白。師傅會在旁邊打給你看，你照著做", severity: "critical" },
      { title: "師傅全示範 3 通", detail: "看師傅親自打 3 通電話，注意他的開場白、語速、被拒絕時的反應。你今天只需要模仿", severity: "high" },
      { title: "下班前 1:1 回饋 (15 分鐘)", detail: "今天的 2 個做對的地方 + 1 個可以改的。填回饋紀錄表", severity: "normal" },
    ],
  },
  {
    day: 2, week: 1, callTarget: 30, inviteTarget: 0, showTarget: 0,
    weekLabel: "第一週 · 建立習慣", mentorRole: "教練 Coach",
    tasks: [
      { title: "今日 30 通 — 嘗試完成初步需求確認", detail: "比昨天多一步：接通後不只自我介紹，試著問對方 1 個需求問題 (例：「您目前有在考慮進修嗎」)", severity: "critical" },
      { title: "師傅陪同撥打 — 即時旁聽給回饋", detail: "師傅坐在旁邊聽你打，每通結束後給你 1 句話回饋", severity: "high" },
      { title: "練習處理軟釘子拒絕", detail: "客戶說「不需要」「考慮看看」「太忙了」→ 你的標準回應是什麼？今天下班前跟師傅對練 3 次", severity: "normal" },
    ],
  },
  {
    day: 3, week: 1, callTarget: 40, inviteTarget: 0, showTarget: 0,
    weekLabel: "第一週 · 建立習慣", mentorRole: "教練 Coach",
    tasks: [
      { title: "今日 40 通 — 開始爬坡", detail: "比前兩天多 10 通。節奏開始加快，每 7 分鐘 1 通", severity: "critical" },
      { title: "錄音檢討 — 挑昨天最好的 1 通 + 最差的 1 通", detail: "聽自己的錄音，找出「哪句話讓客戶感興趣」和「哪句話讓客戶掛電話」", severity: "high" },
      { title: "2+1 回饋紀錄表填寫", detail: "師傅給的 2 個優點 + 1 個建議，寫在紀錄表裡。這週累計 3 天的回饋", severity: "normal" },
    ],
  },
  {
    day: 4, week: 1, callTarget: 50, inviteTarget: 0, showTarget: 0,
    weekLabel: "第一週 · 建立習慣", mentorRole: "教練 Coach",
    tasks: [
      { title: "今日 50 通 — 練習走完整體架構", detail: "從開場白 → 需求確認 → 產品簡介 → 邀約嘗試，整個流程走一遍。不用管結果，走完就好", severity: "critical" },
      { title: "話術對練 — 師傅模擬客戶 3 次異議處理", detail: "師傅扮演客戶，你扮演業務。3 種常見異議：太貴 / 不需要 / 再想想", severity: "high" },
      { title: "提前預告：明天目標 60 通 + 1 邀約", detail: "今晚心裡準備好，明天要開始嘗試邀約了。你已經知道怎麼說，明天就用上它", severity: "normal" },
    ],
  },
  {
    day: 5, week: 1, callTarget: 60, inviteTarget: 1, showTarget: 0,
    weekLabel: "第一週 · 建立習慣", mentorRole: "教練 Coach",
    tasks: [
      { title: "今日 60 通 + 至少 1 個邀約嘗試", detail: "第一週最後一天衝刺。60 通裡至少嘗試邀約 1 次 (不一定要成功，嘗試就好)", severity: "critical" },
      { title: "師傅觀察期 — 確認動作沒變形", detail: "師傅今天不主動教，只觀察你有沒有用前 4 天學的東西", severity: "high" },
      { title: "心態建設 — 分享成功案例 + 預告下週", detail: "下週目標 80 通/天 + 每天 1 邀約。今天回家好好休息，下週開始進入「標準對齊」階段", severity: "normal" },
    ],
  },
  // ── 第 2 週: 標準對齊 · Model ──
  {
    day: 6, week: 2, callTarget: 80, inviteTarget: 1, showTarget: 0,
    weekLabel: "第二週 · 標準對齊", mentorRole: "標竿 Model",
    tasks: [
      { title: "今日 80 通 + 1 邀約 — 對齊正式業務門檻", detail: "第二週開始用正式業務的最低標準要求自己。80 通 = 每 6 分鐘 1 通", severity: "critical" },
      { title: "師傅嚴格監督 — 不達標需留下來檢討", detail: "今天開始師傅不再「溫柔教學」而是「嚴格要求」。80 通沒到就加班打完", severity: "high" },
      { title: "記錄拒絕原因 — 至少 3 種不同拒絕類型", detail: "每次被拒絕後記下 1 句「客戶怎麼說的」。下班前整理出 3 種最常見的拒絕原因", severity: "normal" },
    ],
  },
  {
    day: 7, week: 2, callTarget: 80, inviteTarget: 1, showTarget: 0,
    weekLabel: "第二週 · 標準對齊", mentorRole: "標竿 Model",
    tasks: [
      { title: "今日 80 通 + 1 邀約", detail: "維持昨天節奏。今天的重點不是通次而是邀約 — 至少嘗試邀約 3 次，目標成功 1 次", severity: "critical" },
      { title: "師傅實戰示範 Demo #1 — 你旁聽做筆記", detail: "師傅示範完整 Demo 1 場，你在旁邊看。記錄：他怎麼開場 / 怎麼介紹產品 / 怎麼 close", severity: "high" },
      { title: "分析昨天 3 種拒絕 — 跟師傅討論怎麼轉", detail: "把昨天記的 3 種拒絕拿出來，跟師傅一起想「如果客戶這樣說，我該怎麼接」", severity: "normal" },
    ],
  },
  {
    day: 8, week: 2, callTarget: 80, inviteTarget: 1, showTarget: 0,
    weekLabel: "第二週 · 標準對齊", mentorRole: "標竿 Model",
    tasks: [
      { title: "今日 80 通 + 1 邀約 — 熟練邀約轉 Demo 話術", detail: "練習「從邀約到安排 Demo 時間」的完整流程。客戶答應來 → 你要怎麼確認時間/地點/需求", severity: "critical" },
      { title: "師傅 2+1 回饋 — 重點放在邀約話術的開口契機", detail: "今天的回饋聚焦在：你在電話裡的哪個 moment 應該切入邀約？你錯過了哪些 moment？", severity: "high" },
    ],
  },
  {
    day: 9, week: 2, callTarget: 80, inviteTarget: 1, showTarget: 0,
    weekLabel: "第二週 · 標準對齊", mentorRole: "標竿 Model",
    tasks: [
      { title: "今日 80 通 + 1 邀約 — 爭取開始做 Demo", detail: "如果本週有邀約成功的客戶，今天或明天安排第一場 Demo。師傅在旁陪同", severity: "critical" },
      { title: "師傅實戰示範 Demo #2 — 重點放在解反對問題", detail: "這次的 Demo 示範聚焦在客戶說「太貴了」「要考慮」「我問問老婆」時怎麼處理", severity: "high" },
    ],
  },
  {
    day: 10, week: 2, callTarget: 80, inviteTarget: 1, showTarget: 0,
    weekLabel: "第二週 · 標準對齊", mentorRole: "標竿 Model",
    tasks: [
      { title: "今日 80 通 + 整理本週 Demo 準客戶名單", detail: "回顧這週的邀約紀錄，列出所有答應要來的客戶。下週你要自己跑 Demo 了", severity: "critical" },
      { title: "師傅實戰示範 Demo #3 — 最後一次完整看", detail: "這是你最後一次純看師傅跑 Demo。下週開始你主講，師傅在旁救援", severity: "high" },
      { title: "心態建設 — 預告第三週「你要上場了」", detail: "下週 100 通/天 + 你主講 Demo + 師傅只在旁邊看。今天好好回想這兩週學到的所有東西", severity: "normal" },
    ],
  },
  // ── 第 3 週: 實戰上手 · Co-pilot ──
  {
    day: 11, week: 3, callTarget: 100, inviteTarget: 2, showTarget: 0,
    weekLabel: "第三週 · 實戰上手", mentorRole: "副駕駛 Co-pilot",
    tasks: [
      { title: "今日 100 通 + 2 邀約 — 正式進入百通門檻", detail: "從今天起你是準正式業務。100 通 = 每 5 分鐘 1 通，全天不停", severity: "critical" },
      { title: "你主講 Demo — 師傅在旁即時救援", detail: "你是主角了。師傅只在你卡住時幫你接話。做完後 15 分鐘復盤", severity: "high" },
    ],
  },
  {
    day: 12, week: 3, callTarget: 100, inviteTarget: 2, showTarget: 1,
    weekLabel: "第三週 · 實戰上手", mentorRole: "副駕駛 Co-pilot",
    tasks: [
      { title: "今日 100 通 + 2 邀約 + 1 出席", detail: "開始追出席率了。你約的人有沒有真的來？沒來的要打電話追", severity: "critical" },
      { title: "獨立跑 Demo 1 場 (師傅旁觀)", detail: "師傅今天全程不說話，你自己跑完一場 Demo。做完再復盤", severity: "high" },
    ],
  },
  // Day 13-15 similar pattern...
  {
    day: 15, week: 3, callTarget: 100, inviteTarget: 2, showTarget: 1,
    weekLabel: "第三週 · 實戰上手", mentorRole: "副駕駛 Co-pilot",
    tasks: [
      { title: "第三週結算 — 你的數據診斷能力開始了", detail: "自己看這週的數據：接通率多少？邀約率多少？跟第二週比改善了什麼？下週是獨立驗收", severity: "critical" },
      { title: "跟師傅做最後一次 1:1 回顧", detail: "3 週的成長軌跡：第 1 週你是什麼樣、現在你是什麼樣、下週你該往哪個方向", severity: "high" },
    ],
  },
  // ── 第 4 週: 獨立驗收 · Advisor ──
  {
    day: 16, week: 4, callTarget: 120, inviteTarget: 3, showTarget: 1,
    weekLabel: "第四週 · 獨立驗收 (畢業週)", mentorRole: "顧問 Advisor",
    tasks: [
      { title: "今日 120 通 + 3 邀約 + 1 出席 — 正式業務標準", detail: "從今天起用正式業務的全標準衡量你。師傅完全放手，只觀察", severity: "critical" },
      { title: "獨立完成 Demo — 師傅只看不說", detail: "師傅旁聽但全程不介入。看你能不能自己走完一場 Demo 到 close", severity: "high" },
      { title: "開始學自我數據診斷", detail: "每天下班前自己看 /me 頁面，分析自己的接通率/邀約率/出席率。師傅不會再幫你看，你要自己找問題", severity: "normal" },
    ],
  },
  {
    day: 20, week: 4, callTarget: 120, inviteTarget: 3, showTarget: 1,
    weekLabel: "第四週 · 畢業", mentorRole: "顧問 Advisor",
    tasks: [
      { title: "🎓 新訓畢業 — 進入違反人性規則監測", detail: "恭喜完成 4 週新訓。從下週起你的 KPI 由 Claude 自動監測，達不到會被派補救任務", severity: "critical" },
      { title: "填寫完整的 4 週回饋紀錄", detail: "回顧 20 天的成長：第 1 天 30 通到今天 120 通，你覺得自己最大的改變是什麼？", severity: "high" },
      { title: "跟師傅正式道謝 + 新人轉正式業務", detail: "你不再是新人了。你是正式業務。用你這 4 週學到的所有東西去賺錢", severity: "normal" },
    ],
  },
];

function getTrainingDay(dayNum: number): TrainingDay | null {
  // Exact match
  const exact = TRAINING_PLAN.find((t) => t.day === dayNum);
  if (exact) return exact;
  // Fallback to the closest day with the same week
  const week = dayNum <= 5 ? 1 : dayNum <= 10 ? 2 : dayNum <= 15 ? 3 : dayNum <= 20 ? 4 : null;
  if (!week) return null;
  const weekDays = TRAINING_PLAN.filter((t) => t.week === week);
  // Get the latest defined day for this week
  return weekDays[weekDays.length - 1] || null;
}

function todayTaipei(): string {
  const now = new Date();
  const tp = new Date(now.getTime() + 8 * 3600 * 1000);
  return tp.toISOString().slice(0, 10);
}


export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    if (
      !req.headers.get("x-vercel-cron") &&
      !req.headers.get("x-zeabur-cron") &&
      req.nextUrl.searchParams.get("key") !== "manual-trigger"
    ) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();
  const today = todayTaipei();

  // Find all people whose first day in sales_metrics_daily was within last 20 working days
  const twentyFiveDaysAgo = new Date();
  twentyFiveDaysAgo.setDate(twentyFiveDaysAgo.getDate() - 25);
  const earliest = twentyFiveDaysAgo.toISOString().slice(0, 10);

  const { data: allRows } = await supabase
    .from("sales_metrics_daily")
    .select("email, name, brand, team, date")
    .gte("date", earliest)
    .order("date", { ascending: true });

  // Determine each person's first_day
  const firstDayMap = new Map<string, { first_day: string; name: string; brand: string; team: string }>();
  for (const r of allRows || []) {
    const email = r.email as string;
    if (!email) continue;
    if (!firstDayMap.has(email)) {
      firstDayMap.set(email, {
        first_day: r.date as string,
        name: (r.name as string) || email,
        brand: (r.brand as string) || "-",
        team: (r.team as string) || "-",
      });
    }
  }

  // Find rookies: first_day within last 20 working days
  const todayDate = new Date(today);
  const rookies: Array<{ email: string; name: string; brand: string; team: string; trainingDay: number; plan: TrainingDay }> = [];
  for (const [email, info] of firstDayMap.entries()) {
    const firstDate = new Date(info.first_day);
    const daysSince = Math.floor((todayDate.getTime() - firstDate.getTime()) / (1000 * 3600 * 24));
    // Count only weekdays (rough: daysSince * 5/7)
    const workDays = Math.round(daysSince * 5 / 7) + 1;
    if (workDays < 1 || workDays > 20) continue;
    const plan = getTrainingDay(workDays);
    if (!plan) continue;
    rookies.push({ email, name: info.name, brand: info.brand, team: info.team, trainingDay: workDays, plan });
  }

  const pushed: Array<{ email: string; day: number; week: number; tasks: number; mode: string }> = [];

  for (const rookie of rookies) {
    // Clear today's previously-inserted training commands
    await supabase
      .from("v3_commands")
      .delete()
      .eq("owner_email", rookie.email)
      .eq("ai_generated", true)
      .gte("created_at", today + "T00:00:00Z")
      .lt("created_at", today + "T23:59:59Z")
      .like("ai_reasoning", "rookie_training%");

    // Insert
    const rows = rookie.plan.tasks.map((t) => ({
      owner_email: rookie.email,
      pillar_id: "sales",
      title: `[新訓 Day ${rookie.trainingDay}] ${t.title}`,
      detail: `${rookie.plan.weekLabel} · ${rookie.plan.mentorRole}\n\n${t.detail}\n\n📊 今日目標: ${rookie.plan.callTarget} 通${rookie.plan.inviteTarget > 0 ? ` · ${rookie.plan.inviteTarget} 邀約` : ""}${rookie.plan.showTarget > 0 ? ` · ${rookie.plan.showTarget} 出席` : ""}`,
      severity: t.severity,
      status: "pending",
      ai_generated: true,
      ai_reasoning: `rookie_training day ${rookie.trainingDay} week ${rookie.plan.week} · ${rookie.plan.weekLabel}`,
      deadline: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    }));
    const { data: inserted } = await supabase
      .from("v3_commands")
      .insert(rows)
      .select("id, title, detail, severity");

    // Push Flex LINE
    if (inserted && inserted.length > 0) {
      const flex = buildCommandsFlex(
        inserted as Array<{ id: string; title: string; detail: string | null; severity: "info" | "normal" | "high" | "critical" }>,
        `🌱 ${rookie.name} · Day ${rookie.trainingDay} · ${rookie.plan.weekLabel}`
      );
      const res = await linePush({
        title: `🌱 新訓 Day ${rookie.trainingDay} · ${rookie.name}`,
        body: `🌱 ${rookie.plan.weekLabel} · Day ${rookie.trainingDay}\n${rookie.plan.mentorRole}\n\n📊 目標: ${rookie.plan.callTarget} 通${rookie.plan.inviteTarget > 0 ? ` · ${rookie.plan.inviteTarget} 邀約` : ""}${rookie.plan.showTarget > 0 ? ` · ${rookie.plan.showTarget} 出席` : ""}\n\n${inserted.length} 項任務，點按鈕標記狀態`,
        flexMessage: flex,
        userEmail: rookie.email,
        priority: "high",
        reason: "rookie_training",
      });
      pushed.push({ email: rookie.email, day: rookie.trainingDay, week: rookie.plan.week, tasks: inserted.length, mode: res.mode });
    }
  }

  await supabase.from("claude_actions").insert({
    action_type: "rookie_training_push",
    target: "system",
    summary: `新訓推播: 偵測 ${rookies.length} 個新人 · 推 ${pushed.length} 人`,
    details: { date: today, rookies: rookies.length, pushed },
    result: "success",
  });

  return Response.json({ ok: true, date: today, rookies: rookies.length, pushed });
}
