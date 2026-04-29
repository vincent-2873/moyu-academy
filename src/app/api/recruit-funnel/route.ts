import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 獵頭公司招聘員前台 API
 *
 * GET    /api/recruit-funnel?owner=email  招聘員查看自己負責的求職者
 * POST   /api/recruit-funnel              新增求職者（記錄 owner_email）
 * PATCH  /api/recruit-funnel              更新階段（需附 owner 檢查權限）
 *
 * 與 /api/admin/recruits 共用同一張 recruits 表，但前台受限於 owner_email。
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
    const owner = url.searchParams.get("owner");
    if (!owner) {
      return Response.json({ ok: false, error: "owner 必填" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("recruits")
      .select("*")
      .eq("owner_email", owner)
      .order("created_at", { ascending: false });

    if (error) {
      // owner_email 欄位可能還沒建，退回查所有（後台補欄位後就會 filter）
      const msg = error.message || "";
      if (msg.includes("owner_email") || msg.toLowerCase().includes("column")) {
        const { data: all, error: err2 } = await supabase
          .from("recruits")
          .select("*")
          .order("created_at", { ascending: false });
        if (err2) {
          return Response.json({ ok: false, error: err2.message }, { status: 500 });
        }
        return Response.json({ ok: true, recruits: all || [], owner, legacy: true });
      }
      return Response.json({ ok: false, error: msg }, { status: 500 });
    }

    return Response.json({ ok: true, recruits: data || [], owner });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { name, phone, email, brand, source, notes, owner } = body;

    if (!name || !brand || !owner) {
      return Response.json(
        { ok: false, error: "name / brand / owner 必填" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      name,
      phone: phone || null,
      email: email || null,
      brand,
      source: source || null,
      stage: "applied",
      notes: notes || null,
      stage_entered_at: now,
      owner_email: owner,
    };

    let { data, error } = await supabase
      .from("recruits")
      .insert(payload)
      .select()
      .single();

    // 若 owner_email 欄位還沒建，重試不帶 owner_email
    if (error && (error.message || "").includes("owner_email")) {
      delete payload.owner_email;
      const retry = await supabase.from("recruits").insert(payload).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (data) {
      await supabase
        .from("recruit_events")
        .insert({
          recruit_id: data.id,
          from_stage: null,
          to_stage: "applied",
          reason: `招聘員 ${owner} 新增求職者`,
        })
        .then(
          () => null,
          () => null
        );
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
    const { id, stage, notes, owner } = body;

    if (!id || !owner) {
      return Response.json({ ok: false, error: "id / owner 必填" }, { status: 400 });
    }

    if (stage && !VALID_STAGES.includes(stage)) {
      return Response.json(
        { ok: false, error: `stage 必須是 ${VALID_STAGES.join(", ")}` },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from("recruits")
      .select("stage, owner_email")
      .eq("id", id)
      .single();

    // 驗證所有權（若 owner_email 存在於表中）
    if (existing && (existing as { owner_email?: string }).owner_email) {
      if ((existing as { owner_email?: string }).owner_email !== owner) {
        return Response.json(
          { ok: false, error: "無權修改他人的求職者" },
          { status: 403 }
        );
      }
    }

    const update: Record<string, unknown> = {};
    if (stage) {
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

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (stage && existing && (existing as { stage?: string }).stage !== stage) {
      await supabase
        .from("recruit_events")
        .insert({
          recruit_id: id,
          from_stage: (existing as { stage?: string }).stage ?? null,
          to_stage: stage,
          reason: `招聘員 ${owner} 推進 ${(existing as { stage?: string }).stage} → ${stage}`,
        })
        .then(
          () => null,
          () => null
        );
    }

    return Response.json({ ok: true, recruit: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
