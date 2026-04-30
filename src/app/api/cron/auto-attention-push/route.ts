import { getSupabaseAdmin } from "@/lib/supabase";
import { linePush, buildCommandsFlex } from "@/lib/line-notify";
import { NextRequest } from "next/server";

/**
 * 🚨 Auto Attention Push — 每日主動掃描 + 派任務 + LINE 推播
 *
 * 排程: 台北 10:00 = UTC 02:00, "0 2 * * *"
 * (早於 daily-briefing-push 09:00 可能已經跑過，這個是下午追擊)
 *
 * 邏輯:
 *   1. 撈今天的 sales_metrics_daily 所有 rows
 *   2. 對每個業務跑 4 條 attention 規則
 *      · 整天 0 通 (critical)
 *      · 打 100+ 無成交 (high)
 *      · 打 30+ 無邀約 (high)
 *      · 2+ 出席無成交 (medium)
 *   3. 對被命中的業務，insert 3 個針對性 v3_commands
 *   4. Push Flex Message LINE 給該業務本人 (不是組長) — 每個 command 一個 bubble + postback 按鈕
 *   5. (如果有 team_leader) 也 push 一份「你組裡有 N 人需關心」的 text LINE 給組長
 *
 * 差異 vs manager-care-push:
 *   - manager-care 只看 "連續 2 天掛蛋"
 *   - auto-attention 看 "今天當下" 的 4 種狀況
 *   - auto-attention 會主動 insert v3_commands 並 push Flex 給業務本人
 *   - manager-care 只 push text 給組長
 */

interface AttentionHit {
  email: string;
  name: string;
  team: string | null;
  brand: string;
  reason: string;
  severity: "critical" | "high" | "medium";
  suggestedTasks: Array<{ title: string; detail: string; severity: "critical" | "high" | "normal" }>;
}

// 單人單日 calls 上限(超過視為資料異常,如 bot / 累積資料 / 機械 dial,不算量多質差)
const SINGLE_DAY_CALLS_ANOMALY_THRESHOLD = 500;
// 量多質差 calls 範圍:[100, 500],但同時要求 connect_rate >= 5% 才算「真的有打到人但成交不出來」
const LOW_QUALITY_MIN_CALLS = 100;
const LOW_QUALITY_MIN_CONNECT_RATE = 0.05;

function detectAttention(rows: Array<Record<string, unknown>>): AttentionHit[] {
  const hits: AttentionHit[] = [];
  for (const r of rows) {
    const email = (r.email as string) || "";
    if (!email) continue;
    const calls = Number(r.calls) || 0;
    const closures = Number(r.closures) || 0;
    const connected = Number(r.connected) || 0;
    const appointments = Number(r.raw_appointments) || 0;
    const shows = Number(r.appointments_show) || 0;
    const name = (r.name as string) || email;
    const team = (r.team as string) || null;
    const brand = (r.brand as string) || "-";

    if (calls === 0) {
      hits.push({
        email, name, team, brand,
        reason: "整天 0 通電話",
        severity: "critical",
        suggestedTasks: [
          { title: "立即開始打第一通", detail: "不論發生什麼，現在馬上撥出 1 通電話，把節奏找回來", severity: "critical" },
          { title: "跟主管 LINE 說明狀態", detail: "告訴組長你今天為什麼上午 0 通，讓他能幫你", severity: "high" },
          { title: "下午 3:00 前衝 30 通", detail: "從現在到 15:00 均速每 5 分鐘 1 通，目標 30 通回節奏", severity: "high" },
        ],
      });
      continue;
    }
    // 單日打 500+ 通視為資料異常(單人 unrealistic)— 不算「量多質差」
    if (calls >= SINGLE_DAY_CALLS_ANOMALY_THRESHOLD) {
      hits.push({
        email, name, team, brand,
        reason: `${calls} 通 (資料異常 — 超過 ${SINGLE_DAY_CALLS_ANOMALY_THRESHOLD} 通/日 unrealistic,可能 bot/累積資料)`,
        severity: "medium",
        suggestedTasks: [
          { title: "確認該員工是否為機械 dial 角色", detail: `Vincent: ${name} 今天 ${calls} 通,如果是 call center 分工(專職撥號) — 應從 sales_alert_rules 排除`, severity: "high" },
          { title: "Metabase 對 raw 資料是否累積", detail: "去 Metabase 直接 query 看是否「按日期」filter 對齊", severity: "normal" },
        ],
      });
      continue;
    }
    if (calls >= LOW_QUALITY_MIN_CALLS && closures === 0) {
      const connectRate = calls > 0 ? connected / calls : 0;
      // 加 ratio gate:必須 connect_rate >= 5% 才算「打得到人但成交不出來」
      // 連接率太低 → 對方根本沒接,不是「量多質差」是「lead 品質差」
      if (connectRate < LOW_QUALITY_MIN_CONNECT_RATE) {
        hits.push({
          email, name, team, brand,
          reason: `${calls} 通 · 接通率 ${(connectRate * 100).toFixed(1)}% (lead 品質差,不是量多質差)`,
          severity: "medium",
          suggestedTasks: [
            { title: "review lead 來源", detail: "對方根本不接電話 → 換 lead 名單 / 改打時間 / 換通路", severity: "high" },
            { title: "確認電話號碼有效", detail: "連接率 < 5% 通常是名單死號,要 review 號碼來源", severity: "normal" },
          ],
        });
        continue;
      }
      hits.push({
        email, name, team, brand,
        reason: `${calls} 通 · 0 成交 · 接通率 ${(connectRate * 100).toFixed(1)}% (量多質差)`,
        severity: "high",
        suggestedTasks: [
          { title: "聽今天 3 通最久的錄音", detail: "挑超過 3 分鐘的通話，用戰情官 6 維度打分，找自己的卡點", severity: "high" },
          { title: "跟主管 1-on-1 復盤", detail: "下班前 15 分鐘，問主管「為什麼量到了成交沒來」", severity: "high" },
          { title: "換一套開場白試 20 通", detail: "原本的開場白不管用了，換一套，看轉換率有沒有改善", severity: "normal" },
        ],
      });
      continue;
    }
    if (calls >= 30 && appointments === 0) {
      hits.push({
        email, name, team, brand,
        reason: `${calls} 通 · 0 邀約 (轉換卡住)`,
        severity: "high",
        suggestedTasks: [
          { title: "找老手陪打 10 通", detail: "請組內最強的業務坐旁邊，陪打 10 通現場教你怎麼轉邀約", severity: "high" },
          { title: "今天至少拿 1 個邀約", detail: "目標不是量，是 1 個邀約就好，證明手感還在", severity: "high" },
          { title: "看 3 個最近成交錄音", detail: "下班前研究別人怎麼轉邀約", severity: "normal" },
        ],
      });
      continue;
    }
    if (shows >= 2 && closures === 0) {
      hits.push({
        email, name, team, brand,
        reason: `${shows} 出席 · 0 成交 (結案卡住)`,
        severity: "medium",
        suggestedTasks: [
          { title: "做結案話術演練 3 次", detail: "找主管或同事演練「要錢」話術 3 次，下一個 demo 就用", severity: "high" },
          { title: "review 今天 demo 錄音", detail: "每場 demo 找出 1 個可以更直接 ask 的時點", severity: "normal" },
        ],
      });
    }
  }
  return hits;
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

  const { data: rows, error } = await supabase
    .from("sales_metrics_daily")
    .select("email, name, team, brand, calls, raw_appointments, appointments_show, closures")
    .eq("date", today)
    .not("is_monthly_rollup", "is", true);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const hits = detectAttention(rows || []);
  if (hits.length === 0) {
    return Response.json({ ok: true, hits: 0, today });
  }

  const pushed: Array<{ email: string; status: string; count: number }> = [];
  for (const hit of hits) {
    // 1. insert 3 commands
    const cmdRows = hit.suggestedTasks.map((t) => ({
      owner_email: hit.email,
      pillar_id: "sales",
      title: t.title,
      detail: t.detail,
      severity: t.severity,
      status: "pending",
      ai_generated: true,
      ai_reasoning: `auto-attention: ${hit.reason}`,
      deadline: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    }));
    const { data: inserted } = await supabase
      .from("v3_commands")
      .insert(cmdRows)
      .select("id, title, detail, severity");

    // 2. Push Flex to the sales_rep
    if (inserted && inserted.length > 0) {
      const flex = buildCommandsFlex(
        inserted as Array<{
          id: string;
          title: string;
          detail: string | null;
          severity: "info" | "normal" | "high" | "critical";
        }>,
        `🚨 ${hit.name}: ${hit.reason} — 3 項立即任務`
      );
      const pushRes = await linePush({
        title: `🚨 ${hit.name} — ${hit.reason}`,
        body: `🚨 ${hit.name}: ${hit.reason}\n\n你現在有 ${inserted.length} 項立即任務，在 LINE 點按鈕標記狀態`,
        flexMessage: flex,
        priority: hit.severity === "critical" ? "critical" : "high",
        userEmail: hit.email,
        reason: "auto_attention",
      });
      pushed.push({ email: hit.email, status: pushRes.mode, count: inserted.length });
    }
  }

  // Log
  await supabase.from("claude_actions").insert({
    action_type: "auto_attention_push",
    target: "system",
    summary: `自動 attention: 偵測 ${hits.length} 人 · 推 ${pushed.length} 份 LINE`,
    details: { hits: hits.length, pushed },
    result: "success",
  });

  return Response.json({ ok: true, date: today, hits: hits.length, pushed });
}
