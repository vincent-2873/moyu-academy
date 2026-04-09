import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 招聘漏斗 API
 *
 * GET    /api/admin/recruits           列出所有候選人（可用 ?stage= ?brand= 過濾）
 * POST   /api/admin/recruits           新增候選人
 * PATCH  /api/admin/recruits           更新候選人 / 推進階段（會寫 recruit_events）
 * DELETE /api/admin/recruits?id=xxx    刪除候選人
 *
 * 階段：applied → screening → interview_1 → interview_2 → offer → onboarded → probation → passed
 *       任何階段可轉 dropped / rejected
 */

const VALID_STAGES = [
  "applied",
  "screening",
  "interview_1",
  "interview_2",
  "offer",
  "onboarded",
  "probation",
  "passed",
  "dropped",
  "rejected",
];

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const stage = url.searchParams.get("stage");
    const brand = url.searchParams.get("brand");

    let query = supabase
      .from("recruits")
      .select("*")
      .order("created_at", { ascending: false });

    if (stage) query = query.eq("stage", stage);
    if (brand && brand !== "all") query = query.eq("brand", brand);

    const { data, error } = await query;
    if (error) return Response.json({ error: error.message }, { status: 500 });

    // 計算各階段人數
    const stageCount: Record<string, number> = {};
    VALID_STAGES.forEach((s) => (stageCount[s] = 0));
    (data || []).forEach((r) => {
      stageCount[r.stage] = (stageCount[r.stage] || 0) + 1;
    });

    return Response.json({
      ok: true,
      recruits: data || [],
      stage_count: stageCount,
      total: data?.length || 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const {
      name,
      phone,
      email,
      brand,
      source,
      stage = "applied",
      notes,
    } = body;

    if (!name || !brand) {
      return Response.json(
        { ok: false, error: "name 和 brand 必填" },
        { status: 400 }
      );
    }
    if (!VALID_STAGES.includes(stage)) {
      return Response.json(
        { ok: false, error: `stage 必須是 ${VALID_STAGES.join(", ")}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("recruits")
      .insert({
        name,
        phone: phone || null,
        email: email || null,
        brand,
        source: source || null,
        stage,
        notes: notes || null,
        stage_entered_at: now,
      })
      .select()
      .single();

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

    // 寫入 recruit_events
    if (data) {
      await supabase.from("recruit_events").insert({
        recruit_id: data.id,
        from_stage: null,
        to_stage: stage,
        reason: "新增候選人",
      });
    }

    return Response.json({ ok: true, recruit: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { id, stage, notes, reason } = body;

    if (!id) return Response.json({ ok: false, error: "id 必填" }, { status: 400 });

    // 先讀現狀
    const { data: existing } = await supabase
      .from("recruits")
      .select("stage")
      .eq("id", id)
      .single();

    const update: Record<string, unknown> = {};
    if (stage) {
      if (!VALID_STAGES.includes(stage)) {
        return Response.json(
          { ok: false, error: `stage 必須是 ${VALID_STAGES.join(", ")}` },
          { status: 400 }
        );
      }
      update.stage = stage;
      update.stage_entered_at = new Date().toISOString();
    }
    if (notes !== undefined) update.notes = notes;

    const { data, error } = await supabase
      .from("recruits")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

    // 階段變更時寫 event
    if (stage && existing && existing.stage !== stage) {
      await supabase.from("recruit_events").insert({
        recruit_id: id,
        from_stage: existing.stage,
        to_stage: stage,
        reason: reason || `階段推進 ${existing.stage} → ${stage}`,
      });
    }

    return Response.json({ ok: true, recruit: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return Response.json({ ok: false, error: "id 必填" }, { status: 400 });

    const { error } = await supabase.from("recruits").delete().eq("id", id);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
