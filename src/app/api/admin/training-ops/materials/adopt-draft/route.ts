import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DraftModule {
  day_offset: number;
  sequence: number;
  module_type: string;
  title: string;
  description: string;
  duration_min: number;
}

/**
 * POST /api/admin/training-ops/materials/adopt-draft
 *
 * Body: { path_id: string, brand: string, indices?: number[] }
 *   indices 不傳 = 全部採用,傳 = 只採用對應 index 的 module
 *
 * 從 path_completeness.claude_drafts 撈 saved JSON,batch INSERT 到 training_modules
 * INSERT 用 ON CONFLICT (path_id, day_offset, sequence) DO NOTHING 避免重複
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const pathId = String(body.path_id ?? "");
  const brand = String(body.brand ?? "");
  const indices: number[] | undefined = Array.isArray(body.indices) ? body.indices : undefined;

  if (!pathId || !brand) {
    return NextResponse.json({ ok: false, error: "path_id and brand required" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  try {
    // 撈 saved drafts
    const { data: completeness, error: fetchErr } = await sb.from("path_completeness")
      .select("claude_drafts")
      .eq("path_id", pathId)
      .eq("brand", brand)
      .single();

    if (fetchErr || !completeness?.claude_drafts) {
      return NextResponse.json(
        { ok: false, error: "No drafts found. Run generate-draft first." },
        { status: 404 }
      );
    }

    const drafts: DraftModule[] = (completeness.claude_drafts as { modules?: DraftModule[] }).modules ?? [];
    const toAdopt = indices
      ? drafts.filter((_, i) => indices.includes(i))
      : drafts;

    if (toAdopt.length === 0) {
      return NextResponse.json({ ok: false, error: "No modules to adopt" }, { status: 400 });
    }

    // INSERT 到 training_modules(prod 既有命名:day_offset / duration_min / required)
    const rowsToInsert = toAdopt.map(m => ({
      path_id: pathId,
      day_offset: m.day_offset,
      sequence: m.sequence,
      module_type: m.module_type,
      title: m.title,
      description: m.description,
      content: {},                         // Phase 2 user 用到時填
      duration_min: m.duration_min,
      required: true,
      completion_criteria: defaultCompletionCriteria(m.module_type),
    }));

    const { data: inserted, error: insertErr } = await sb.from("training_modules")
      .upsert(rowsToInsert, { onConflict: "path_id,day_offset,sequence", ignoreDuplicates: true })
      .select("id, day_offset, sequence, module_type, title");

    if (insertErr) {
      return NextResponse.json(
        { ok: false, error: `INSERT failed: ${insertErr.message}` },
        { status: 500 }
      );
    }

    // 更新 path_completeness 計數
    const { count: actualCount } = await sb.from("training_modules")
      .select("id", { count: "exact", head: true })
      .eq("path_id", pathId);

    await sb.from("path_completeness")
      .update({
        total_modules_actual: actualCount ?? 0,
        computed_at: new Date().toISOString(),
      })
      .eq("path_id", pathId)
      .eq("brand", brand);

    return NextResponse.json({
      ok: true,
      adopted_count: inserted?.length ?? 0,
      total_now: actualCount ?? 0,
      adopted: inserted ?? [],
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

function defaultCompletionCriteria(moduleType: string): Record<string, unknown> {
  switch (moduleType) {
    case "video":      return { min_watch_pct: 80 };
    case "sparring":   return { min_score: 70, min_attempts: 3 };
    case "reflection": return { min_words: 100 };
    case "quiz":       return { min_score: 70 };
    case "task":       return { manual_check: true };
    default:           return {};
  }
}
