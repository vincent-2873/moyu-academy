import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 🔮 個人行為深度分析 — Claude 真正理解這個人
 *
 * GET /api/me/prediction?email=<email>
 *
 * 不是「通次少 多打幾通」這種廢話。
 * 是透徹了解這位業務的:
 *   - 行為模式變化 (接通率在漲但邀約率在掉 = 話術問題不是名單問題)
 *   - 心理狀態推測 (賺了一筆就放鬆 vs 連續被拒開始躲)
 *   - 跟「同等級同期」比較 (不是跟 Top 比，是跟同樣新人 / 同組 / 同品牌比)
 *   - 具體 coaching 方向 (不是 "多打電話"，是 "你的開場白在第 15 秒失去客戶")
 *
 * 數據先用 rule-based 算投射，分析文字由 Claude 生成。
 * Cache 在 claude_actions (每人每天 1 次深度分析)
 */

const ANALYSIS_PROMPT = `你是墨宇戰情中樞的「行為分析師」，不是勵志導師。
你要透徹分析這位業務的行為數據，像職業教練看球員比賽影片一樣精準。

鐵則:
1. 禁止說「加油」「你可以的」「努力」「多打電話」「通次不夠要多打」— 這些是沒用的廢話
2. 你看的是 RATE OF CHANGE（變化率），不是絕對值。今天 100 通不重要，從昨天 150 掉到今天 100 才重要
3. 你看的是 CONVERSION FUNNEL 的哪一層在漏。接通 → 邀約 → 出席 → 成交，是哪層卡的？
4. 你要推測 WHY — 是名單品質？撥打時段？開場白？客戶 objection 處理？心態？post-close relaxation？
5. 給的建議必須是「這個人才需要做的事」，不是任何人都能用的泛用建議
6. 跟 peers 比較要精確（同組/同品牌/同期入職），不是跟全集團 top 比

輸出格式 (strict JSON):
{
  "behaviorDiagnosis": "2-3 句話精準描述這個人目前的狀態（看數據變化趨勢 + 跟 peer 的差距 + 可能的根因）",
  "keyInsight": "1 句最重要的發現 — 這個人最需要知道的 1 件事",
  "rootCause": "根因推測 — 為什麼他卡在這裡（從數據裡推理，不是猜）",
  "coachingDirection": {
    "focus": "接下來 24 小時的訓練方向 (一句話)",
    "specificAction": "具體動作 (要夠具體到可以現在就做，不是「多打電話」)",
    "expectedOutcome": "做完後預期會看到什麼改善"
  },
  "peerComparison": "跟同組/同品牌的比較 — 他在哪裡比別人強、哪裡比別人弱",
  "riskFlag": "⚠️ 如果有的話：burnout / 離職前兆 / post-close 放鬆 / 被拒絕太多次開始躲",
  "monthProjection": {
    "projected": "預測月底結果 (NT$ + 成交數)",
    "confidence": "high/medium/low",
    "condition": "在什麼條件下才能達到 (如果有的話)"
  }
}`;

interface DailyRow {
  date: string;
  calls: number;
  connected: number;
  appts: number;
  shows: number;
  closes: number;
  revenue: number;
  callMinutes: number;
}

function todayTaipei(): string {
  const now = new Date();
  const tp = new Date(now.getTime() + 8 * 3600 * 1000);
  return tp.toISOString().slice(0, 10);
}

// Vercel Hobby: extend function timeout for Claude API calls
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return Response.json({ ok: false, error: "email required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const today = todayTaipei();

  // Check cache (same person same day only 1 deep analysis)
  const cacheKey = `prediction_${email}_${today}`;
  const { data: cached } = await supabase
    .from("claude_actions")
    .select("details")
    .eq("action_type", "deep_prediction")
    .eq("target", cacheKey)
    .maybeSingle();
  if (cached && cached.details) {
    return Response.json({ ok: true, email, bound: true, ...(cached.details as Record<string, unknown>), cached: true });
  }

  // Pull 30 days of data
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: myRows } = await supabase
    .from("sales_metrics_daily")
    .select("date, calls, connected, raw_appointments, appointments_show, closures, net_revenue_daily, call_minutes, brand, team, name, level")
    .eq("email", email)
    .gte("date", thirtyDaysAgo.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  if (!myRows || myRows.length === 0) {
    return Response.json({ ok: true, email, bound: false });
  }

  const latest = myRows[myRows.length - 1] as Record<string, unknown>;
  const profile = {
    name: (latest.name as string) || email,
    brand: (latest.brand as string) || "-",
    team: (latest.team as string) || "-",
    level: (latest.level as string) || null,
  };

  const daily: DailyRow[] = myRows.map((r) => ({
    date: r.date as string,
    calls: Number(r.calls) || 0,
    connected: Number(r.connected) || 0,
    appts: Number(r.raw_appointments) || 0,
    shows: Number(r.appointments_show) || 0,
    closes: Number(r.closures) || 0,
    revenue: Number(r.net_revenue_daily) || 0,
    callMinutes: Number(r.call_minutes) || 0,
  }));

  // Rule-based numbers (still useful for UI)
  const nowTp = new Date(Date.now() + 8 * 3600 * 1000);
  const hourTw = nowTp.getUTCHours() + nowTp.getUTCMinutes() / 60;
  const elapsedFrac = Math.max(0, Math.min(1, (hourTw - 9) / 11));
  const todayData = daily.find((d) => d.date === today);
  const activeDays = daily.filter((d) => d.date !== today && d.calls > 0);
  const avgCalls = activeDays.length > 0 ? activeDays.reduce((s, d) => s + d.calls, 0) / activeDays.length : 0;
  const projectedCalls = elapsedFrac > 0.1 ? Math.round((todayData?.calls || 0) / elapsedFrac) : Math.round(avgCalls);

  // Month stats
  const monthStart = today.slice(0, 8) + "01";
  const monthRows = daily.filter((d) => d.date >= monthStart);
  const monthRev = monthRows.reduce((s, d) => s + d.revenue, 0);
  const monthCloses = monthRows.reduce((s, d) => s + d.closes, 0);
  const daysInMonth = new Date(new Date(today).getFullYear(), new Date(today).getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - parseInt(today.slice(-2), 10);
  const avgDailyRev = monthRows.length > 0 ? monthRev / monthRows.length : 0;
  const projectedMonthRev = Math.round(monthRev + avgDailyRev * daysRemaining);

  // Peer data (same brand this month)
  const { data: peerRows } = await supabase
    .from("sales_metrics_daily")
    .select("email, name, team, calls, connected, raw_appointments, appointments_show, closures, net_revenue_daily")
    .eq("brand", profile.brand)
    .gte("date", monthStart);
  const peerByEmail = new Map<string, { name: string; team: string; calls: number; connected: number; appts: number; shows: number; closes: number; rev: number }>();
  for (const r of peerRows || []) {
    const e = (r.email as string) || "";
    if (!e) continue;
    const p = peerByEmail.get(e) || { name: (r.name as string) || e, team: (r.team as string) || "-", calls: 0, connected: 0, appts: 0, shows: 0, closes: 0, rev: 0 };
    p.calls += Number(r.calls) || 0;
    p.connected += Number(r.connected) || 0;
    p.appts += Number(r.raw_appointments) || 0;
    p.shows += Number(r.appointments_show) || 0;
    p.closes += Number(r.closures) || 0;
    p.rev += Number(r.net_revenue_daily) || 0;
    peerByEmail.set(e, p);
  }
  const peers = Array.from(peerByEmail.values()).sort((a, b) => b.rev - a.rev);
  const myPeerIdx = peers.findIndex((p) => p.name === profile.name);
  const sameTeam = peers.filter((p) => p.team === profile.team);

  // Build Claude context
  const context = [
    `【業務】${profile.name} · ${profile.brand} · ${profile.team} · 等級 ${profile.level || "未分"}`,
    "",
    "【最近 7 天 (日粒度)】",
    ...daily.slice(-7).map((d) => {
      const cr = d.calls > 0 ? (d.connected / d.calls * 100).toFixed(1) : "0";
      const ir = d.connected > 0 ? (d.appts / d.connected * 100).toFixed(1) : "0";
      const avgMin = d.calls > 0 ? (d.callMinutes / d.calls).toFixed(1) : "0";
      return `  ${d.date}: ${d.calls}通 · 接通${d.connected}(${cr}%) · 邀約${d.appts}(${ir}%) · 出席${d.shows} · 成交${d.closes} · $${d.revenue.toLocaleString()} · 均通${avgMin}分`;
    }),
    "",
    `【本月累計】${monthRev.toLocaleString()} / ${monthCloses} 成交 / ${monthRows.length} 天有資料`,
    `【月底預估】NT$${projectedMonthRev.toLocaleString()} (剩 ${daysRemaining} 天)`,
    "",
    `【同品牌 ${profile.brand} 本月排名 (共 ${peers.length} 人)】`,
    `  他排名 #${myPeerIdx + 1}`,
    `  Top 3: ${peers.slice(0, 3).map((p, i) => `${i + 1}.${p.name} $${p.rev.toLocaleString()} (${p.calls}通/${p.closes}成)`).join(" · ")}`,
    "",
    `【同組 ${profile.team} 對比 (${sameTeam.length} 人)】`,
    ...sameTeam.map((p) => {
      const cr = p.calls > 0 ? ((p.connected / p.calls) * 100).toFixed(0) : "0";
      const ir = p.connected > 0 ? ((p.appts / p.connected) * 100).toFixed(1) : "0";
      return `  ${p.name}: ${p.calls}通 接通率${cr}% 邀約率${ir}% ${p.closes}成交 $${p.rev.toLocaleString()}`;
    }),
    "",
    `【30 天趨勢 — 接通率/邀約率/成交率】`,
    ...daily.slice(-10).map((d) => {
      const cr = d.calls > 0 ? (d.connected / d.calls * 100).toFixed(0) : "-";
      const ir = d.connected > 0 ? (d.appts / d.connected * 100).toFixed(1) : "-";
      const sr = d.appts > 0 ? (d.shows / d.appts * 100).toFixed(0) : "-";
      return `  ${d.date}: 接通${cr}% → 邀約${ir}% → 出席${sr}%`;
    }),
  ].join("\n");

  // Call Claude for deep analysis
  let analysis: Record<string, unknown> = {};
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        system: ANALYSIS_PROMPT,
        messages: [{ role: "user", content: context }],
      });
      let text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      // Strip code fences (```json ... ```) — Claude often wraps JSON in code blocks
      text = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        let jsonStr = jsonMatch[0];
        // Recovery: if JSON is truncated (common when max_tokens hit), try to close it
        const openBraces = (jsonStr.match(/\{/g) || []).length;
        const closeBraces = (jsonStr.match(/\}/g) || []).length;
        if (openBraces > closeBraces) {
          // Truncate at last complete field, close all braces
          const lastComma = jsonStr.lastIndexOf(",");
          const lastColon = jsonStr.lastIndexOf(":");
          if (lastComma > lastColon) {
            jsonStr = jsonStr.slice(0, lastComma);
          }
          for (let i = 0; i < openBraces - closeBraces; i++) {
            jsonStr += "}";
          }
        }
        try {
          analysis = JSON.parse(jsonStr);
        } catch {
          // Second attempt: try to extract individual fields
          try {
            const fields: Record<string, string> = {};
            for (const field of ["behaviorDiagnosis", "keyInsight", "rootCause", "peerComparison", "riskFlag"]) {
              const m = text.match(new RegExp(`"${field}"\\s*:\\s*"([^"]*(?:\\\\"[^"]*)*)"`));
              if (m) fields[field] = m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
            }
            if (Object.keys(fields).length > 0) {
              analysis = fields;
            } else {
              analysis = { raw: text };
            }
          } catch {
            analysis = { raw: text };
          }
        }
      } else {
        analysis = { raw: text };
      }
    } catch (e) {
      analysis = { error: e instanceof Error ? e.message : "Claude call failed" };
    }
  }

  // Combine numerical data + Claude analysis
  const result = {
    ok: true,
    email,
    bound: true,
    profile,
    // === 數值層 (rule-based, 給 UI 用) ===
    todayProjection: {
      now: `${Math.floor(hourTw)}:${String(Math.floor((hourTw % 1) * 60)).padStart(2, "0")}`,
      elapsedPct: Math.round(elapsedFrac * 100),
      currentCalls: todayData?.calls || 0,
      projectedCalls,
      avgHistoricalCalls: Math.round(avgCalls),
    },
    monthProjection: {
      currentRev: monthRev,
      currentCloses: monthCloses,
      projectedMonthRev,
      daysRemaining,
    },
    brandRank: myPeerIdx >= 0 ? myPeerIdx + 1 : null,
    brandTotal: peers.length,
    // === Claude 分析層 (真正有價值的部分) ===
    ...analysis,
    generatedAt: new Date().toISOString(),
  };

  // Cache
  await supabase.from("claude_actions").insert({
    action_type: "deep_prediction",
    target: cacheKey,
    summary: (analysis as { keyInsight?: string }).keyInsight || `${profile.name} 深度分析`,
    details: result,
    result: "success",
  });

  return Response.json(result);
}
