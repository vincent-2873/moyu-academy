import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";
import { linePush } from "@/lib/line-notify";
import { NextRequest } from "next/server";

/**
 * 週報 cron — 每週一 08:00 台北 = UTC 00:00
 *
 * 流程：
 *   1. 撈上週 (Mon→Sun) 每天每個 brand 的 sales_metrics_daily
 *   2. 算全集團彙總 + 每個 brand 的漏斗率
 *   3. 算個人排行 (top 5 by revenue, bottom 5 silent)
 *   4. 呼叫 Claude 生成戰情官風格的 recap
 *   5. LINE push 到 Vincent
 *
 * 每週一開工前 CEO 就能看到「上週打什麼仗」
 */

const SYSTEM_PROMPT = `你是墨宇戰情中樞的 CEO 助理 Claude，現在要給 Vincent 寫一份上週的業務週報。

鐵則：
1. 這是 LINE 訊息，最多 15 行，關鍵數字一定帶 (千位逗號)
2. 開頭第一行 = 最強結論 (例「上週全集團 3,543 通 / 4 成交 / NT$34 萬 — 成交率 28.6% 其實還不錯，但量太小」)
3. 每個品牌一行 + 該品牌 MVP (不要列全部人，只列有成交的)
4. 最後給下週的 3 個明確建議 (不是空泛的「再努力」而是「xx 品牌的接通率 4% 太低，可能名單過期」這種有方向的建議)
5. 用 emoji 區隔段 (📊 🔴 ✅ 🏆 💡)
6. 禁 markdown 的 ** 和 # — LINE 不 render`;

function weekRange(): { start: string; end: string } {
  // 上週一 → 上週日 (台北時區)
  const now = new Date();
  const tp = new Date(now.getTime() + 8 * 3600 * 1000);
  const day = tp.getUTCDay(); // 0=Sun
  // 今天到本週一: delta = day === 0 ? -6 : 1 - day
  const thisMonday = new Date(tp);
  thisMonday.setUTCDate(tp.getUTCDate() + (day === 0 ? -6 : 1 - day));
  const lastMonday = new Date(thisMonday);
  lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
  const lastSunday = new Date(lastMonday);
  lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);
  return {
    start: lastMonday.toISOString().slice(0, 10),
    end: lastSunday.toISOString().slice(0, 10),
  };
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();
  const { start, end } = weekRange();

  const { data: rows, error } = await supabase
    .from("sales_metrics_daily")
    .select("date, brand, email, name, team, calls, connected, raw_appointments, appointments_show, raw_demos, closures, net_revenue_daily")
    .gte("date", start)
    .lte("date", end);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const all = rows || [];
  if (all.length === 0) {
    await linePush({
      title: "📊 上週戰情週報",
      body: `上週 ${start} → ${end}\n\n⚠️ 整週沒有資料進系統 — 可能 Metabase 沒同步 / 歷史資料還沒回補。先去灌資料再回來看這份報告。`,
      priority: "normal",
      reason: "system",
      userEmail: "vincent@xuemi.co",
    });
    return Response.json({ ok: true, noData: true, range: { start, end } });
  }

  // 彙總
  const total = all.reduce(
    (acc, r) => ({
      calls: acc.calls + (Number(r.calls) || 0),
      connected: acc.connected + (Number(r.connected) || 0),
      appts: acc.appts + (Number(r.raw_appointments) || 0),
      shows: acc.shows + (Number(r.appointments_show) || 0),
      demos: acc.demos + (Number(r.raw_demos) || 0),
      closes: acc.closes + (Number(r.closures) || 0),
      revenue: acc.revenue + (Number(r.net_revenue_daily) || 0),
    }),
    { calls: 0, connected: 0, appts: 0, shows: 0, demos: 0, closes: 0, revenue: 0 }
  );

  // By brand
  const byBrand = new Map<string, { calls: number; closes: number; revenue: number; people: Set<string> }>();
  for (const r of all) {
    const b = r.brand || "unknown";
    const entry = byBrand.get(b) || { calls: 0, closes: 0, revenue: 0, people: new Set<string>() };
    entry.calls += Number(r.calls) || 0;
    entry.closes += Number(r.closures) || 0;
    entry.revenue += Number(r.net_revenue_daily) || 0;
    if (r.email) entry.people.add(r.email as string);
    byBrand.set(b, entry);
  }

  // Top 5 by revenue
  const byPerson = new Map<string, { name: string; team: string; brand: string; revenue: number; closes: number; calls: number }>();
  for (const r of all) {
    const k = (r.email as string) || (r.name as string);
    if (!k) continue;
    const entry = byPerson.get(k) || { name: (r.name as string) || k, team: (r.team as string) || "-", brand: (r.brand as string) || "-", revenue: 0, closes: 0, calls: 0 };
    entry.revenue += Number(r.net_revenue_daily) || 0;
    entry.closes += Number(r.closures) || 0;
    entry.calls += Number(r.calls) || 0;
    byPerson.set(k, entry);
  }
  const top5 = Array.from(byPerson.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const silent = Array.from(byPerson.values()).filter((p) => p.calls === 0).slice(0, 5);

  // Gen context for Claude
  const context = [
    `上週日期: ${start} → ${end}`,
    `全集團: ${total.calls} 通 · ${total.connected} 接通 · ${total.appts} 邀約 · ${total.shows} 出席 · ${total.closes} 成交 · NT$${total.revenue.toLocaleString()}`,
    total.calls > 0 ? `接通率 ${((total.connected / total.calls) * 100).toFixed(1)}%` : "",
    total.connected > 0 ? `邀約率 ${((total.appts / total.connected) * 100).toFixed(1)}%` : "",
    total.appts > 0 ? `出席率 ${((total.shows / total.appts) * 100).toFixed(1)}%` : "",
    total.shows > 0 ? `成交率 ${((total.closes / total.shows) * 100).toFixed(1)}%` : "",
    "",
    "各品牌:",
    ...Array.from(byBrand.entries()).map(
      ([b, v]) => `  ${b}: ${v.calls} 通 · ${v.closes} 成交 · NT$${v.revenue.toLocaleString()} · ${v.people.size} 人`
    ),
    "",
    "Top 5 業績:",
    ...top5.map((p, i) => `  ${i + 1}. ${p.name}(${p.team}/${p.brand}): ${p.calls} 通 · ${p.closes} 成交 · NT$${p.revenue.toLocaleString()}`),
    "",
    silent.length > 0 ? `整週 0 通的: ${silent.map((p) => p.name).join("、")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `${SYSTEM_PROMPT}\n\n【上週資料】\n${context}`,
    messages: [{ role: "user", content: "請生成上週的戰情週報給 Vincent。" }],
  });
  const report = msg.content[0]?.type === "text" ? msg.content[0].text : "(Claude 沒有回答)";

  // Push LINE
  const pushRes = await linePush({
    title: `📊 上週戰情週報 ${start}→${end}`,
    body: report,
    priority: "normal",
    reason: "system",
    userEmail: "vincent@xuemi.co",
  });

  // Log to claude_actions
  await supabase.from("claude_actions").insert({
    action_type: "weekly_report",
    target: "vincent@xuemi.co",
    summary: `上週戰情週報 ${start}→${end}`,
    details: {
      range: { start, end },
      totals: total,
      report_preview: report.slice(0, 500),
      pushed: pushRes.ok,
    },
    result: pushRes.ok ? "success" : "failed",
  });

  return Response.json({
    ok: true,
    range: { start, end },
    totals: total,
    pushed: pushRes.ok,
    report,
  });
}
