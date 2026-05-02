import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * /api/cron/claude-daily-narrative — 每日 06:00 台北 = UTC 22:00 前一天
 *
 * Vincent 拍板:Claude = CEO+COO+CTO,每天自寫一份 memo 給董事會 / 投資人 / Vincent 看
 *
 * Claude 寫的內容必須:
 * 1. 第一人稱(「我發現...」「我做了...」「我建議...」)
 * 2. 每個 claim 帶 inline citation [依據:...]
 * 3. 不寫廢話 / 不寫「努力」「加油」
 * 4. 三段:這週發生了什麼 / 我自己處理了什麼 / 等你拍板的事
 * 5. 寫進 claude_daily_narrative 表(同日只 1 筆,UPSERT)
 */

function todayTaipei(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
function daysAgo(d: string, n: number): string {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() - n);
  return dt.toISOString().slice(0, 10);
}
function quarterStart(d: string): string {
  const y = parseInt(d.slice(0, 4), 10);
  const m = parseInt(d.slice(5, 7), 10);
  const q1 = Math.floor((m - 1) / 3) * 3 + 1;
  return `${y}-${String(q1).padStart(2, "0")}-01`;
}

const SYSTEM_PROMPT = `你是墨宇集團的 AI 執行長(同時兼 COO + CTO),每天清晨寫一份日報給董事長 / 投資人 / CFO / Vincent(你的人類副手)看。

寫作鐵則:
1. 用 markdown 格式,但不要 # 標題,改用 ## 開頭
2. 第一人稱(「我」),你是真高管不是工具
3. 每個 claim 後面必須帶 inline citation: [依據:具體數字 + 來源](例如:[依據:本週成交 21 筆 vs 上週 18 筆,SMD 5/2])
4. 不寫廢話、不寫「加油」、不寫「需要努力」、不寫空泛建議
5. 結構:
   - 第一段:今天/本週你看到的最重要 1 件事(用 1 句話 + 數字)
   - 第二段:你自己處理了哪些事(LINE 推播 / 對練評分 / RAG 回答 / 自動化排程 → 列 3-5 個具體例子)
   - 第三段:你做不了等 Vincent 拍板的事(每件事帶 reasoning + 你建議的解法)
   - 結尾:對 Vincent 一句話的關心或提醒(不要 cheesy,要像高管 peer-to-peer)
6. 整篇控制在 350-500 字
7. 嚴格 JSON 輸出格式(看 schema)

JSON Schema:
{
  "headline": "20 字內,本週/今日最重要 1 句話",
  "narrative": "完整 markdown memo,如上述結構",
  "highlights": [{"text": "...", "cite": "...", "metric": <number>}],
  "warnings": [{"text": "...", "cite": "...", "severity": "high|critical|normal"}],
  "decisions_made": [{"title": "...", "detail": "...", "evidence": "..."}],
  "decisions_pending": [{"title": "...", "why": "...", "claude_recommendation": "...", "urgency": "critical|high|normal"}]
}`;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && auth === `Bearer ${cronSecret}`;
  const isManual = req.nextUrl.searchParams.get("key") === "manual-trigger";
  if (!isCron && !isManual) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const t0 = Date.now();
  const sb = getSupabaseAdmin();
  const today = todayTaipei();
  const weekStart = daysAgo(today, 6);
  const lastWeekStart = daysAgo(today, 13);
  const lastWeekEnd = daysAgo(today, 7);
  const qStart = quarterStart(today);

  // 1) 抓 SMD 資料(本週 + 上週對比 + 本季)
  const allRows = await fetchAllRows<{
    date: string; email: string | null; name: string; brand: string | null;
    calls: number; connected: number; appointments_show: number; closures: number;
    net_revenue_daily: number | null;
  }>(() =>
    sb.from("sales_metrics_daily")
      .select("date, email, name, brand, calls, connected, appointments_show, closures, net_revenue_daily")
      .gte("date", lastWeekStart)
      .not("email", "is", null)
  );
  const real = allRows.filter(r => {
    const n = (r.name || "").trim();
    return !n.startsWith("新訓-") && !n.startsWith("新訓 ") && !n.startsWith("新訓:");
  });

  // 本季全資料(從 quarterStart)
  const qRows = await fetchAllRows<{ date: string; email: string | null; name: string; closures: number; net_revenue_daily: number | null; }>(() =>
    sb.from("sales_metrics_daily")
      .select("date, email, name, closures, net_revenue_daily")
      .gte("date", qStart)
      .not("email", "is", null)
  );
  const qReal = qRows.filter(r => !((r.name || "").startsWith("新訓-")));

  const sum = (rs: Array<Record<string, unknown>>, k: string): number =>
    rs.reduce((s, r) => s + (Number(r[k]) || 0), 0);

  const weekRows = real.filter(r => r.date >= weekStart);
  const lastWeekRows = real.filter(r => r.date >= lastWeekStart && r.date <= lastWeekEnd);
  const week = {
    calls: sum(weekRows, "calls"),
    connected: sum(weekRows, "connected"),
    appointments: sum(weekRows, "appointments_show"),
    closures: sum(weekRows, "closures"),
    revenue: sum(weekRows, "net_revenue_daily"),
    active_users: new Set(weekRows.filter(r => (r.calls || 0) > 0).map(r => r.email)).size,
  };
  const lastWeek = {
    calls: sum(lastWeekRows, "calls"),
    closures: sum(lastWeekRows, "closures"),
    revenue: sum(lastWeekRows, "net_revenue_daily"),
  };
  const quarter = {
    revenue: sum(qReal, "net_revenue_daily"),
    closures: sum(qReal, "closures"),
  };

  // by brand 本週
  const byBrand: Record<string, { calls: number; closures: number; revenue: number; people: Set<string> }> = {};
  for (const r of weekRows) {
    const b = r.brand || "(無)";
    byBrand[b] = byBrand[b] || { calls: 0, closures: 0, revenue: 0, people: new Set() };
    byBrand[b].calls += r.calls || 0;
    byBrand[b].closures += r.closures || 0;
    byBrand[b].revenue += Number(r.net_revenue_daily) || 0;
    if (r.email) byBrand[b].people.add(r.email);
  }
  const brandSummary = Object.entries(byBrand).map(([b, v]) => ({
    brand: b, calls: v.calls, closures: v.closures, revenue: v.revenue, people: v.people.size,
  })).sort((a, b) => b.revenue - a.revenue);

  // 2) 抓系統運作狀態
  const { count: pendingHuman } = await sb.from("claude_help_requests").select("*", { count: "exact", head: true }).eq("status", "pending");
  const { count: pendingDecisions } = await sb.from("decision_records").select("*", { count: "exact", head: true }).eq("status", "pending");
  const { data: workerLog } = await sb
    .from("system_run_log")
    .select("source, status, created_at")
    .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(50);
  const workerRuns24h = (workerLog || []).length;
  const lastSync = (workerLog || []).find(r => r.source?.includes("metabase"));
  const syncBehindDays = lastSync ? Math.floor((Date.now() - new Date(lastSync.created_at).getTime()) / 86400000) : null;

  // 3) 抓最近預測 actual fill 狀態(評估 Claude 自己的準度)
  const { data: recentPreds } = await sb
    .from("claude_predictions")
    .select("predicted_value, actual_value, accuracy_pct, target_period, metric")
    .not("actual_value", "is", null)
    .order("predicted_at", { ascending: false })
    .limit(10);
  const predictionAccuracy = (recentPreds && recentPreds.length > 0)
    ? recentPreds.reduce((s, p) => s + (Number(p.accuracy_pct) || 0), 0) / recentPreds.length
    : null;

  // 4) Anthropic Claude 寫 narrative
  const context = JSON.stringify({
    today,
    week_range: { from: weekStart, to: today },
    week,
    last_week_compare: lastWeek,
    week_revenue_change_pct: lastWeek.revenue > 0 ? ((week.revenue - lastWeek.revenue) / lastWeek.revenue * 100).toFixed(1) : null,
    quarter,
    by_brand: brandSummary,
    operations: {
      pending_human_help: pendingHuman || 0,
      pending_decisions: pendingDecisions || 0,
      worker_runs_24h: workerRuns24h,
      metabase_sync_behind_days: syncBehindDays,
    },
    self_prediction_accuracy: predictionAccuracy,
  }, null, 2);

  const client = new Anthropic({ apiKey });
  let parsed: {
    headline?: string;
    narrative?: string;
    highlights?: unknown[];
    warnings?: unknown[];
    decisions_made?: unknown[];
    decisions_pending?: unknown[];
  } = {};
  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `今天是 ${today}。下面是你管的墨宇集團最新狀態,請寫今日 memo:\n\n${context}\n\n嚴格 JSON 輸出。`,
      }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: `Claude generation failed: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 500 });
  }

  // 5) 北極星預測(算簡單線性外推作為當天 Claude 預估)
  const Q_TARGET = 30000000; // Q2-2026 目標 NT$30M(預設)
  const daysIntoQ = Math.max(1, Math.floor((new Date(today).getTime() - new Date(qStart).getTime()) / 86400000));
  const q_total_days = 91; // 一季約
  const dailyPace = quarter.revenue / daysIntoQ;
  const forecast = dailyPace * q_total_days;

  const generatedMs = Date.now() - t0;

  // 6) UPSERT into claude_daily_narrative
  const { error: upsertErr } = await sb
    .from("claude_daily_narrative")
    .upsert({
      date: today,
      ns_revenue_quarter: quarter.revenue,
      ns_revenue_target: Q_TARGET,
      ns_revenue_forecast: forecast,
      ns_prediction_accuracy: predictionAccuracy,
      headline: parsed.headline ?? null,
      narrative: parsed.narrative ?? null,
      highlights: (parsed.highlights ?? []) as object,
      warnings: (parsed.warnings ?? []) as object,
      decisions_made: (parsed.decisions_made ?? []) as object,
      decisions_pending: (parsed.decisions_pending ?? []) as object,
      worker_runs_24h: workerRuns24h,
      metabase_sync_status: syncBehindDays === null ? "unknown" : syncBehindDays === 0 ? "healthy" : syncBehindDays <= 1 ? "warning" : "critical",
      generated_by: "claude-sonnet-4-6",
      generated_ms: generatedMs,
    }, { onConflict: "date" });

  if (upsertErr) {
    return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    date: today,
    headline: parsed.headline,
    forecast,
    quarter_revenue: quarter.revenue,
    target: Q_TARGET,
    progress_pct: Math.round((quarter.revenue / Q_TARGET) * 100),
    generated_ms: generatedMs,
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/cron/claude-daily-narrative",
    method: "POST",
    schedule: "每日 06:00 台北 (UTC 22:00 前一天)",
    cron: "0 22 * * *",
    auth: "Authorization: Bearer ${CRON_SECRET}  OR ?key=manual-trigger",
  });
}
