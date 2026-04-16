import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * GET /api/legal/cases/[id] — 案件詳情 + 時間軸 + 文件清單
 * PATCH /api/legal/cases/[id] — 更新案件欄位（狀態/承辦/備註）
 */

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const [caseR, evR, docR] = await Promise.all([
    supabase.from("legal_cases").select("*").eq("id", id).maybeSingle(),
    supabase.from("legal_case_events").select("*").eq("case_id", id).order("event_date", { ascending: false }),
    supabase.from("legal_case_documents").select("*").eq("case_id", id).order("created_at", { ascending: false }),
  ]);
  if (caseR.error || !caseR.data) return Response.json({ ok: false, error: "not found" }, { status: 404 });
  return Response.json({ ok: true, case: caseR.data, events: evR.data || [], documents: docR.data || [] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const body = await req.json();
  const { byEmail, ...patch } = body;

  // 允許更新的欄位
  const allow = [
    "title", "kind", "brand_code", "agency", "agency_type",
    "primary_party_name", "owner_email", "reviewer_email",
    "stage", "status", "severity",
    "filed_date", "response_deadline", "hearing_date", "closure_date",
    "amount_claimed", "amount_settled", "payment_method", "finance_company",
    "summary", "tags", "onedrive_path", "case_no_external", "our_lawyer", "opposing_lawyer",
  ];
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allow) {
    if (patch[k] !== undefined) update[k] = patch[k];
  }

  const { data, error } = await supabase.from("legal_cases").update(update).eq("id", id).select().single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  // timeline
  await supabase.from("legal_case_events").insert({
    case_id: id,
    event_type: patch.status ? "status_change" : "update",
    title: patch.status ? `狀態變更 → ${patch.status}` : "更新欄位",
    detail: `${byEmail || "?"} 更新了 ${Object.keys(patch).filter(k => k !== "byEmail").join(", ")}`,
    actor_email: byEmail || null,
    payload: patch,
  });

  return Response.json({ ok: true, case: data });
}

/**
 * POST /api/legal/cases/[id] — 新增 timeline 事件（通用事件入口）
 * body: { event_type, title, detail?, actor_email }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const body = await req.json();
  const { event_type, title, detail, actor_email, payload } = body;
  if (!event_type || !title) return Response.json({ ok: false, error: "event_type + title required" }, { status: 400 });

  const { data, error } = await supabase.from("legal_case_events").insert({
    case_id: id, event_type, title, detail, actor_email, payload,
  }).select().single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  // 若是關鍵事件自動改 stage
  const stageMap: Record<string, string> = {
    drafted: "drafting", reviewed: "review", sealed: "sealed",
    dispatched: "dispatched", hearing_scheduled: "hearing",
    hearing_done: "hearing", judged: "judged", settled: "finalised",
    closed: "closed",
  };
  if (stageMap[event_type]) {
    await supabase.from("legal_cases").update({
      stage: stageMap[event_type], updated_at: new Date().toISOString(),
    }).eq("id", id);
  }
  return Response.json({ ok: true, event: data });
}
