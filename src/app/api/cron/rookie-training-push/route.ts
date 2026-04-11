import { getSupabaseAdmin } from "@/lib/supabase";
import { linePush, buildCommandsFlex } from "@/lib/line-notify";
import { NextRequest } from "next/server";

/**
 * 新人訓練自動派任務 — 每日 08:45 TW = UTC 00:45
 *
 * 邏輯:
 *   1. 找「新人」= 他在 sales_metrics_daily 的最早一天 (first_day) < 14 天前
 *   2. 計算 training_day = today - first_day + 1 (1-14)
 *   3. 依 training_day 派不同的新人里程碑任務:
 *      · Day 1: 打出第 1 通 / 通時破 30 分 / 聽 3 個老手錄音
 *      · Day 2-3: 50 通基本量 / 第 1 個邀約 / 記錄 3 個拒絕話術
 *      · Day 4-7: 100 通日 / 第 1 個出席 / 參加 1 場 demo 學習
 *      · Day 8-10: 150 通日 / 第 1 筆成交 / 自己跑 1 場 demo
 *      · Day 11-14: 130 通 + 獨立完成 demo / 進入正式規則
 *   4. Push 透過 Flex LINE 到新人本人
 *
 * 這不是替代 daily-briefing-push，而是 REPLACEMENT for 新人
 * (老手跑 briefing, 新人跑 training)
 */

interface RookieStage {
  dayRange: [number, number];
  label: string;
  tasks: Array<{ title: string; detail: string; severity: "critical" | "high" | "normal" }>;
}

const ROOKIE_STAGES: RookieStage[] = [
  {
    dayRange: [1, 1],
    label: "入職第 1 天",
    tasks: [
      { title: "打出生涯第 1 通電話", detail: "不論結果好壞，今天就是要撥出第 1 通。這是踏出業務人生的第一步", severity: "critical" },
      { title: "今日通時破 30 分", detail: "不是看你打幾通，是看你在線上多久。30 分鐘讓嘴巴熟悉說話節奏", severity: "high" },
      { title: "聽 3 個老手成交錄音", detail: "找組內最強業務，請他發 3 個最近成交的通話錄音，自己聽 1 次做筆記", severity: "normal" },
    ],
  },
  {
    dayRange: [2, 3],
    label: "入職第 2-3 天",
    tasks: [
      { title: "今日至少 50 通電話", detail: "新人門檻 50 通，平均每 6 分鐘 1 通，節奏感要熟", severity: "high" },
      { title: "拿到第 1 個邀約", detail: "量不是重點，是你要證明你能讓 1 個客戶說「好，我來」", severity: "high" },
      { title: "記錄 3 個被拒絕的話術", detail: "下班前寫下今天被打槍的 3 種拒絕，跟主管討論怎麼轉", severity: "normal" },
    ],
  },
  {
    dayRange: [4, 7],
    label: "入職第 4-7 天",
    tasks: [
      { title: "衝到單日 100 通", detail: "量開始進入正式業務門檻。節奏每 5 分鐘 1 通", severity: "high" },
      { title: "拿到第 1 個出席", detail: "邀約要兌現。今週目標 1 個客戶真的來了", severity: "high" },
      { title: "參加 1 場同事的 demo", detail: "坐在旁邊看資深業務跑 demo，記錄 3 個你學到的話術", severity: "normal" },
    ],
  },
  {
    dayRange: [8, 10],
    label: "入職第 8-10 天",
    tasks: [
      { title: "單日 150 通 (新人進階門檻)", detail: "量再推一下，進入準正式業務門檻", severity: "high" },
      { title: "拿到生涯第 1 筆成交", detail: "這是最重要的里程碑 — 從這一刻起你是業務", severity: "critical" },
      { title: "獨立跑 1 場 demo (有主管陪)", detail: "不是同事跑你看，是你跑主管看。開始建立自己的節奏", severity: "high" },
    ],
  },
  {
    dayRange: [11, 14],
    label: "入職第 11-14 天 (畢業週)",
    tasks: [
      { title: "每日 130 通 (正式業務門檻)", detail: "從這週起你要用正式業務的標準打分", severity: "high" },
      { title: "獨立完成 1 場 demo (主管只看不說)", detail: "主管旁聽但不介入，看你能不能自己完成一場", severity: "high" },
      { title: "第 14 天後進入違反人性監測", detail: "恭喜畢業。從下週起你的每通電話都會被 Claude 監測，達不到規則會被派補救任務", severity: "normal" },
    ],
  },
];

function getStage(day: number): RookieStage | null {
  for (const s of ROOKIE_STAGES) {
    if (day >= s.dayRange[0] && day <= s.dayRange[1]) return s;
  }
  return null;
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
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const earliest = twoWeeksAgo.toISOString().slice(0, 10);

  // Find all rows within last 14 days to determine each person's first_day
  const { data: allRows } = await supabase
    .from("sales_metrics_daily")
    .select("email, name, brand, date")
    .gte("date", earliest)
    .order("date", { ascending: true });

  const firstDayByEmail = new Map<string, { first_day: string; name: string; brand: string }>();
  for (const r of allRows || []) {
    const email = r.email as string;
    if (!email) continue;
    if (!firstDayByEmail.has(email)) {
      firstDayByEmail.set(email, {
        first_day: r.date as string,
        name: (r.name as string) || email,
        brand: (r.brand as string) || "-",
      });
    }
  }

  // Filter to rookies: first_day is within last 14 days
  const todayDate = new Date(today);
  const rookies: Array<{ email: string; name: string; brand: string; trainingDay: number; stage: RookieStage }> = [];
  for (const [email, info] of firstDayByEmail.entries()) {
    const firstDate = new Date(info.first_day);
    const trainingDay = Math.floor((todayDate.getTime() - firstDate.getTime()) / (1000 * 3600 * 24)) + 1;
    if (trainingDay < 1 || trainingDay > 14) continue;
    const stage = getStage(trainingDay);
    if (!stage) continue;
    rookies.push({ email, name: info.name, brand: info.brand, trainingDay, stage });
  }

  const pushed: Array<{ email: string; day: number; tasks: number; mode: string }> = [];

  for (const rookie of rookies) {
    // Clean up today's previously-inserted rookie commands (avoid dup)
    await supabase
      .from("v3_commands")
      .delete()
      .eq("owner_email", rookie.email)
      .eq("ai_generated", true)
      .gte("created_at", today + "T00:00:00Z")
      .lt("created_at", today + "T23:59:59Z")
      .like("ai_reasoning", "rookie_training%");

    // Insert stage tasks
    const rows = rookie.stage.tasks.map((t) => ({
      owner_email: rookie.email,
      pillar_id: "sales",
      title: `[新人 Day ${rookie.trainingDay}] ${t.title}`,
      detail: t.detail,
      severity: t.severity,
      status: "pending",
      ai_generated: true,
      ai_reasoning: `rookie_training day ${rookie.trainingDay} · ${rookie.stage.label}`,
      deadline: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    }));
    const { data: inserted } = await supabase
      .from("v3_commands")
      .insert(rows)
      .select("id, title, detail, severity");

    // LINE push Flex carousel
    if (inserted && inserted.length > 0) {
      const flex = buildCommandsFlex(
        inserted as Array<{
          id: string;
          title: string;
          detail: string | null;
          severity: "info" | "normal" | "high" | "critical";
        }>,
        `🌱 ${rookie.name} · 新人 Day ${rookie.trainingDay} · ${rookie.stage.label}`
      );
      const res = await linePush({
        title: `🌱 新人 Day ${rookie.trainingDay} · ${rookie.name}`,
        body: `🌱 新人訓練 Day ${rookie.trainingDay} · ${rookie.stage.label}\n\n今天你有 ${inserted.length} 個任務，點按鈕標記完成`,
        flexMessage: flex,
        userEmail: rookie.email,
        priority: "high",
        reason: "rookie_training",
      });
      pushed.push({ email: rookie.email, day: rookie.trainingDay, tasks: inserted.length, mode: res.mode });
    }
  }

  await supabase.from("claude_actions").insert({
    action_type: "rookie_training_push",
    target: "system",
    summary: `新人訓練推播: 偵測 ${rookies.length} 個新人 · 推 ${pushed.length} 人`,
    details: { date: today, rookies: rookies.length, pushed },
    result: "success",
  });

  return Response.json({
    ok: true,
    date: today,
    rookies: rookies.length,
    pushed,
  });
}
