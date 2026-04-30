import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import type { Pillar } from "@/lib/rag-pillars";

/**
 * POST /api/admin/rag/auto-classify-pillar
 *
 * 用 Claude 自動分類既有 knowledge_chunks 的 pillar
 *
 * Body:
 *   { dry_run?: boolean, only_common?: boolean }
 *   - dry_run=true 不寫 DB,只回 proposed classifications(default false)
 *   - only_common=true 只重 classify pillar='common' 的 chunk(default true)
 *
 * 邏輯:
 *   1. 撈 chunks(filter only_common ? pillar='common' : 全部)
 *   2. 送 chunk title + content 前 800 字 給 Claude
 *   3. Claude 回 strict JSON: { pillar: 'hr'|'legal'|'sales'|'common', confidence: 0-1, reason: string }
 *   4. confidence >= 0.7 才實際 update,否則 keep common(safe default)
 *   5. 回傳 batch summary + sample
 *
 * 預估 cost: 34 chunks × 1k token × $0.003 = ~$0.10(用 Vincent 之前儲值的 OpenAI / Claude)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `你是墨宇集團的知識庫分類官。
輸入是一則訓練文件的 title + 內容前 800 字。
你要分類它屬於哪個 pillar(知識池):

- hr      → 招聘 SOP、面試題、HRBP、留任、人才測評、招募策略、新訓
- legal   → 合約、法務、合規、智財、案件、政府申報
- sales   → 銷售話術、業績、漏斗、KPI、產品知識、業務技巧、Q1381 解讀、銷售方法論(GROW/SPIN/黃金圈)
- common  → 集團政策、福利、戰情中樞 SOP、跨領域通用、文化、入門基礎、不確定

鐵則:
1. 只能回 strict JSON,不加任何 markdown / 解釋
2. format: {"pillar":"sales","confidence":0.85,"reason":"提到通次/邀約/出席/成交"}
3. confidence 範圍 0-1(0=瞎猜,1=非常確定)
4. 沒把握 → confidence < 0.7 → 系統會 fallback common
5. 不要傾向某 pillar,根據實際內容判斷`;

interface ClaudeResult {
  pillar: Pillar;
  confidence: number;
  reason: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun = body.dry_run === true;
  const onlyCommon = body.only_common !== false; // default true

  const sb = getSupabaseAdmin();
  const started = Date.now();

  // 1. 撈 chunks
  const chunks = await fetchAllRows<{ id: string; title: string; content: string; pillar: string }>(() => {
    let q = sb.from("knowledge_chunks").select("id, title, content, pillar");
    if (onlyCommon) q = q.eq("pillar", "common");
    return q;
  });

  if (chunks.length === 0) {
    return NextResponse.json({ ok: true, note: "no chunks to classify", duration_ms: Date.now() - started });
  }

  const client = new Anthropic({ apiKey });

  const results: Array<{ id: string; title: string; old_pillar: string; new_pillar: Pillar; confidence: number; reason: string; updated: boolean }> = [];
  const errors: string[] = [];

  for (const c of chunks) {
    try {
      const userText = `Title: ${c.title || "(無)"}\n\nContent (前 800 字):\n${(c.content || "").slice(0, 800)}`;
      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userText }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        errors.push(`${c.id}: no JSON in Claude response`);
        continue;
      }
      const parsed: ClaudeResult = JSON.parse(jsonMatch[0]);
      const validPillars: Pillar[] = ["hr", "legal", "sales", "common"];
      if (!validPillars.includes(parsed.pillar)) {
        errors.push(`${c.id}: invalid pillar=${parsed.pillar}`);
        continue;
      }

      // confidence < 0.7 → fallback common(保守)
      const finalPillar: Pillar = parsed.confidence >= 0.7 ? parsed.pillar : "common";
      const willUpdate = !dryRun && finalPillar !== c.pillar;

      if (willUpdate) {
        const { error } = await sb.from("knowledge_chunks")
          .update({ pillar: finalPillar })
          .eq("id", c.id);
        if (error) {
          errors.push(`${c.id} update: ${error.message}`);
        }
      }

      results.push({
        id: c.id,
        title: (c.title || "").slice(0, 50),
        old_pillar: c.pillar,
        new_pillar: finalPillar,
        confidence: parsed.confidence,
        reason: parsed.reason?.slice(0, 100) || "",
        updated: willUpdate,
      });
    } catch (e) {
      errors.push(`${c.id}: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  // Aggregate
  const distribution: Record<string, number> = {};
  for (const r of results) {
    distribution[r.new_pillar] = (distribution[r.new_pillar] || 0) + 1;
  }
  const updatedCount = results.filter((r) => r.updated).length;

  // Log
  await sb.from("claude_actions").insert({
    action_type: "rag_auto_classify_pillar",
    target: "knowledge_chunks",
    summary: `dry_run=${dryRun}: classified ${results.length}, updated ${updatedCount}, distribution=${JSON.stringify(distribution)}`,
    details: { results: results.slice(0, 10), errors: errors.slice(0, 5) },
    result: errors.length === 0 ? "success" : "partial",
  });

  return NextResponse.json({
    ok: true,
    dry_run: dryRun,
    only_common_filter: onlyCommon,
    total_chunks_scanned: chunks.length,
    classified: results.length,
    updated: updatedCount,
    distribution,
    errors: errors.slice(0, 5),
    sample_results: results.slice(0, 10),
    duration_ms: Date.now() - started,
  });
}
