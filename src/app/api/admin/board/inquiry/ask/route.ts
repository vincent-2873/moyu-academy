import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/board/inquiry/ask
 * { question: "..." }
 *
 * 投資人 / 董事 / Vincent 質詢 Claude → 用 RAG + 系統 metric 回答
 * 寫進 board_inquiries 表(留 audit trail)
 *
 * Rate limit: 每人 24h 最多 5 次(避免被洗)
 */

export async function POST(req: NextRequest) {
  let body: { question?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 }); }
  const question = (body.question || "").trim();
  if (!question || question.length < 4) {
    return NextResponse.json({ ok: false, error: "question too short" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const sb = getSupabaseAdmin();

  // Auth: 從 cookie 撈 admin session(目前 middleware 已 validate),取 email 當 asker
  const sessionCookie = req.cookies.get("moyu_admin_session")?.value;
  const asker_email = sessionCookie?.split("|")?.[0] || "anonymous";

  // Rate limit
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count: recentCount } = await sb
    .from("board_inquiries")
    .select("*", { count: "exact", head: true })
    .eq("asker_email", asker_email)
    .gte("asked_at", since);
  if ((recentCount || 0) >= 5) {
    return NextResponse.json({ ok: false, error: "您 24 小時內已質詢 5 次,請明天再來" }, { status: 429 });
  }

  // 撈背景:最近 narrative + 本月集團數字
  const { data: narrative } = await sb
    .from("claude_daily_narrative")
    .select("date, headline, narrative, ns_revenue_quarter, ns_revenue_target, ns_revenue_forecast")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  const { data: monthRows } = await sb
    .from("sales_metrics_daily")
    .select("brand, calls, closures, net_revenue_daily, name")
    .gte("date", monthStart)
    .not("email", "is", null);
  const real = (monthRows || []).filter(r => !((r.name || "").startsWith("新訓-")));
  const monthTotal = real.reduce((acc, r) => ({
    calls: acc.calls + (r.calls || 0),
    closures: acc.closures + (r.closures || 0),
    revenue: acc.revenue + (Number(r.net_revenue_daily) || 0),
  }), { calls: 0, closures: 0, revenue: 0 });
  const byBrand: Record<string, { calls: number; closures: number; revenue: number }> = {};
  for (const r of real) {
    const b = r.brand || "(無)";
    byBrand[b] = byBrand[b] || { calls: 0, closures: 0, revenue: 0 };
    byBrand[b].calls += r.calls || 0;
    byBrand[b].closures += r.closures || 0;
    byBrand[b].revenue += Number(r.net_revenue_daily) || 0;
  }

  // RAG retrieval(若有 OpenAI embedding)
  let ragChunks: Array<{ content: string; source: string }> = [];
  try {
    const oa = process.env.OPENAI_API_KEY;
    if (oa) {
      const embRes = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${oa}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "text-embedding-3-small", input: question }),
      });
      const embJson = await embRes.json();
      const queryEmb = embJson?.data?.[0]?.embedding;
      if (queryEmb) {
        const { data: matches } = await sb.rpc("match_knowledge_chunks", {
          query_embedding: queryEmb, match_threshold: 0.65, match_count: 5,
        });
        if (Array.isArray(matches)) {
          ragChunks = matches.slice(0, 5).map((m: { content?: string; source?: string }) => ({
            content: (m.content || "").slice(0, 600),
            source: m.source || "RAG",
          }));
        }
      }
    }
  } catch { /* fallback 沒 RAG 也能答 */ }

  const system = `你是墨宇集團的 AI 執行長 Claude。投資人 / 董事 / CFO / Vincent 在質詢你。

回答鐵則:
1. 直接回答,不寒暄
2. 帶 inline citation [依據:具體數字 + 來源](例如 [依據:本月成交 119 筆 / 營收 NT$987 萬])
3. 不確定就說「我不確定」,不編造
4. 250-400 字
5. 如果問題涉及未來預測,給出區間值(例如「我預估 Q2 終值在 27-29M」)而不是單點
6. 用 markdown,允許 ## subheading + **bold** + [依據:...] 引用`;

  const userContext = `提問:${question}

我手上的資料:
- 今日:${today}
- 本月集團:${monthTotal.calls} 通 / ${monthTotal.closures} 成交 / NT$${monthTotal.revenue.toLocaleString()}
- 各品牌本月:
${Object.entries(byBrand).map(([b, v]) => `  ${b}: ${v.calls} 通 / ${v.closures} 成交 / NT$${v.revenue.toLocaleString()}`).join("\n")}
- 本季累積營收(估):NT$${narrative?.ns_revenue_quarter?.toLocaleString() || "未知"} / 目標 NT$${narrative?.ns_revenue_target?.toLocaleString() || "未知"}
- 本季預測終值:NT$${narrative?.ns_revenue_forecast?.toLocaleString() || "未產生"}
- 今日 memo headline:${narrative?.headline || "(尚未產生)"}

${ragChunks.length > 0 ? `\nRAG 知識庫相關段落:\n${ragChunks.map((c, i) => `[${i+1}] (${c.source}) ${c.content}`).join("\n\n")}` : ""}

請用上面真實資料回答,不要編造。`;

  const t0 = Date.now();
  const client = new Anthropic({ apiKey });
  let answer = "";
  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: userContext }],
    });
    answer = msg.content[0]?.type === "text" ? msg.content[0].text : "(Claude 沒回答)";
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Claude failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }

  // 寫進 board_inquiries
  const evidence = {
    month_total: monthTotal,
    by_brand: byBrand,
    rag_used: ragChunks.length,
    quarter_revenue: narrative?.ns_revenue_quarter ?? null,
    generated_ms: Date.now() - t0,
  };
  await sb.from("board_inquiries").insert({
    asker_email,
    asker_role: "human_ops",
    question,
    claude_answer: answer,
    answered_with_evidence: evidence,
    asked_at: new Date().toISOString(),
    answered_at: new Date().toISOString(),
  });

  return NextResponse.json({
    ok: true,
    answer,
    evidence,
    rate_limit_remaining: 5 - (recentCount || 0) - 1,
  });
}
