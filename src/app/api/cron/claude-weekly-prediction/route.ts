import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * /api/cron/claude-weekly-prediction — Wave 8 #2 prediction 閉環
 *
 * 每週一 09:00 台北 = UTC 01:00 跑
 * Vincent 拍板:Claude 自己預測下週 KPI,月底自動 fill actual,投資人質詢「Claude 多準?」有真數字
 *
 * 流程:
 * 1. 拿過去 4 週 SMD(sales_metrics_daily)作 baseline
 * 2. call Claude 預測本週(週一-週日)4 個 metric
 *    - calls (總通話)
 *    - closures (總成交)
 *    - revenue (總營收)
 *    - conversion_rate (邀約→成交)
 * 3. INSERT 4 row 進 claude_predictions(target_period='week-YYYY-Www')
 * 4. idempotent — 同週 + metric 已存在 → skip
 *
 * Verify accuracy:
 * - prediction-actual-fill cron 月底/週底跑 → 從 SMD 算 actual → UPDATE row
 */

const SYSTEM_PROMPT = `你是墨宇集團的 AI 執行長,負責每週一預測本週 4 個關鍵 KPI 給董事會。

【鐵則】
1. 你是 CEO,不是占卜師 — 預測必須有 reasoning,基於過去 4 週 baseline
2. 給「中位點 + 區間」(low / high)— 區間反映你的信心度
3. **嚴格 JSON 輸出**(下方 schema)

【你會看到的資料】
- 過去 4 週 SMD daily aggregate(每日 calls / closures / appointments)
- 5 品牌(nschool / xuemi / ooschool / aischool / xlab)各自週累計
- 過去若干個 prediction 跟實際差距(如有,給 self-aware reasoning)

【JSON Schema】
{
  "predictions": [
    {
      "metric": "calls",
      "predicted_value": 1240,
      "predicted_low": 1100,
      "predicted_high": 1380,
      "reasoning": "過去 4 週週均 1180,本週週一-週日 7 個工作日,但 Q2 啟動效應預估 +5% [依據:過去 4 週 SMD 平均週通話 1180]"
    },
    { "metric": "closures", ... },
    { "metric": "revenue", ... },
    { "metric": "conversion_rate", ... }
  ]
}

【metric 定義】
- calls: 整週總通話數
- closures: 整週總成交數
- revenue: 整週總營收(NT$,假設每筆成交平均 NT$8 萬,如過去資料有真實 revenue 可用真實平均)
- conversion_rate: 整週「邀約 show → 成交」轉換率(0-1 區間,例 0.32 = 32%)

緊張、實在、針對性。`;

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function tpeToday(): Date {
  return new Date(Date.now() + 8 * 3600 * 1000);
}

function daysAgo(d: Date, n: number): string {
  const dt = new Date(d);
  dt.setUTCDate(dt.getUTCDate() - n);
  return dt.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const manualTrigger = url.searchParams.get("key") === "manual-trigger";

  try {
    const sb = getSupabaseAdmin();
    const now = tpeToday();
    const targetWeek = `week-${isoWeek(now)}`;

    // idempotent — 已預測本週 → skip
    const { data: existing } = await sb
      .from("claude_predictions")
      .select("metric")
      .eq("target_period", targetWeek);

    if (existing && existing.length >= 4 && !manualTrigger) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: `${targetWeek} already has ${existing.length} predictions`,
        target_period: targetWeek,
      });
    }

    // 拿過去 28 天 SMD
    const fromDate = daysAgo(now, 28);
    const toDate = daysAgo(now, 1);

    const smdRows = await fetchAllRows<{
      date: string; brand: string | null;
      calls: number; closures: number; appointments_show: number; connected: number;
    }>(() =>
      sb.from("sales_metrics_daily")
        .select("date, brand, calls, closures, appointments_show, connected")
        .gte("date", fromDate)
        .lte("date", toDate)
    );

    if (!smdRows || smdRows.length === 0) {
      return NextResponse.json({
        ok: false,
        error: `no SMD data in past 28 days (${fromDate} ~ ${toDate})`,
      }, { status: 200 });
    }

    // aggregate by week
    const weeklyAgg: Record<string, { calls: number; closures: number; appts: number }> = {};
    smdRows.forEach((r) => {
      const w = isoWeek(new Date(r.date));
      if (!weeklyAgg[w]) weeklyAgg[w] = { calls: 0, closures: 0, appts: 0 };
      weeklyAgg[w].calls += r.calls || 0;
      weeklyAgg[w].closures += r.closures || 0;
      weeklyAgg[w].appts += r.appointments_show || 0;
    });

    // 拉過去預測 vs actual(self-aware)
    const { data: pastPreds } = await sb
      .from("claude_predictions")
      .select("target_period, metric, predicted_value, actual_value, accuracy_pct")
      .not("actual_value", "is", null)
      .order("predicted_at", { ascending: false })
      .limit(8);

    const baseline = `過去 4 週 weekly aggregate (TPE):
${Object.entries(weeklyAgg).map(([w, agg]) => `  ${w}: calls=${agg.calls}, closures=${agg.closures}, appts=${agg.appts}, conv=${agg.appts > 0 ? (agg.closures / agg.appts).toFixed(3) : 'N/A'}`).join("\n")}

過去預測 vs 實際 (self-aware 用):
${(pastPreds || []).slice(0, 6).map((p) => `  ${p.target_period} ${p.metric}: 預測 ${p.predicted_value} → 實際 ${p.actual_value}, 誤差 ${p.accuracy_pct}%`).join("\n") || "  (尚無 fill 過 actual 的 prediction)"}

預測目標週: ${targetWeek}
今天: ${now.toISOString().slice(0, 10)} (TPE)

請輸出 4 個 metric 的預測。`;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });
    const startMs = Date.now();
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: baseline }],
    });
    const elapsed = Date.now() - startMs;

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ ok: false, error: "Claude output no JSON", raw: text.slice(0, 500) }, { status: 500 });
    }

    let parsed: { predictions: Array<{ metric: string; predicted_value: number; predicted_low?: number; predicted_high?: number; reasoning: string }> };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return NextResponse.json({ ok: false, error: "JSON parse failed", raw: jsonMatch[0].slice(0, 500) }, { status: 500 });
    }

    if (!Array.isArray(parsed.predictions)) {
      return NextResponse.json({ ok: false, error: "predictions not array" }, { status: 500 });
    }

    // INSERT or UPSERT
    const inserted: Array<{ metric: string; value: number }> = [];
    for (const p of parsed.predictions) {
      const metric = String(p.metric || "").toLowerCase();
      if (!["calls", "closures", "revenue", "conversion_rate"].includes(metric)) continue;
      const val = Number(p.predicted_value);
      if (!isFinite(val)) continue;

      // 同 target+metric 已存在 → 不重複,但允許 manualTrigger 覆寫
      const exists = (existing || []).some((e) => e.metric === metric);
      if (exists && !manualTrigger) continue;
      if (exists && manualTrigger) {
        await sb.from("claude_predictions")
          .delete()
          .eq("target_period", targetWeek)
          .eq("metric", metric);
      }

      const { error: insErr } = await sb.from("claude_predictions").insert({
        target_period: targetWeek,
        metric,
        predicted_value: val,
        predicted_low: p.predicted_low ?? null,
        predicted_high: p.predicted_high ?? null,
        reasoning: p.reasoning || null,
        rag_evidence: { weekly_baseline: weeklyAgg, past_predictions: pastPreds?.slice(0, 6) || [] },
      });
      if (!insErr) inserted.push({ metric, value: val });
    }

    // log
    await sb.from("system_run_log").insert({
      source: "claude-weekly-prediction",
      status: "success",
      metadata: {
        target_period: targetWeek,
        inserted_count: inserted.length,
        elapsed_ms: elapsed,
        manual: manualTrigger,
      },
    });

    return NextResponse.json({
      ok: true,
      target_period: targetWeek,
      inserted,
      elapsed_ms: elapsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const GET = POST;
