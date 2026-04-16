import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * GET /api/legal/cases
 *   query:
 *     ?owner=email    過濾承辦人
 *     ?kind=          過濾案件類型
 *     ?brand=         過濾品牌代碼
 *     ?status=open|closed|archived|all (default open)
 *     ?overdue=1      只回傳超過 response_deadline 的
 *     ?limit=100
 *
 * POST /api/legal/cases
 *   body: { title, kind, brand_code, agency?, primary_party_name?, owner_email,
 *           response_deadline?, amount_claimed?, filed_date?, summary?,
 *           case_no_external?, year_roc? }
 */

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const url = new URL(req.url);
  const owner = url.searchParams.get("owner");
  const kind = url.searchParams.get("kind");
  const brand = url.searchParams.get("brand");
  const status = url.searchParams.get("status") || "open";
  const overdue = url.searchParams.get("overdue") === "1";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 500);

  let q = supabase.from("legal_cases").select("*").order("created_at", { ascending: false }).limit(limit);
  if (owner) q = q.eq("owner_email", owner);
  if (kind) q = q.eq("kind", kind);
  if (brand) q = q.eq("brand_code", brand);
  if (status !== "all") q = q.eq("status", status);
  if (overdue) {
    const today = new Date().toISOString().slice(0, 10);
    q = q.lt("response_deadline", today).eq("status", "open");
  }
  const { data, error } = await q;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  // 順便算 stats
  const stats = {
    total: data?.length || 0,
    by_kind: {} as Record<string, number>,
    by_brand: {} as Record<string, number>,
    overdue: 0,
    due_this_week: 0,
  };
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  for (const c of data || []) {
    stats.by_kind[c.kind] = (stats.by_kind[c.kind] || 0) + 1;
    if (c.brand_code) stats.by_brand[c.brand_code] = (stats.by_brand[c.brand_code] || 0) + 1;
    if (c.response_deadline && c.status === "open") {
      const dl = new Date(c.response_deadline);
      if (dl < now) stats.overdue++;
      else if (dl <= weekAhead) stats.due_this_week++;
    }
  }

  return Response.json({ ok: true, data: data || [], stats });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await req.json();
  const {
    title, kind, brand_code, agency, primary_party_name,
    owner_email, reviewer_email, response_deadline, amount_claimed,
    filed_date, summary, case_no_external, year_roc, agency_type,
    hearing_date, severity,
  } = body;

  if (!title || !kind || !owner_email) {
    return Response.json({ ok: false, error: "title + kind + owner_email required" }, { status: 400 });
  }

  // 內部案號規則：YY(品牌)法字YYMMDDNNN號
  let caseNoInternal = body.case_no_internal;
  if (!caseNoInternal && brand_code) {
    const now = new Date();
    const yy = (now.getFullYear() - 1911).toString(); // 民國年
    const mmdd = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    // 查當日已有幾筆
    const prefix = `${yy}${brand_code}法字${mmdd}`;
    const { count } = await supabase
      .from("legal_cases")
      .select("id", { count: "exact", head: true })
      .like("case_no_internal", `${prefix}%`);
    const seq = String((count || 0) + 1).padStart(3, "0");
    caseNoInternal = `${prefix}${seq}號`;
  }

  // party upsert
  let primaryPartyId: string | null = null;
  if (primary_party_name) {
    const { data: existing } = await supabase
      .from("legal_parties").select("id").eq("name", primary_party_name).limit(1).maybeSingle();
    if (existing) primaryPartyId = existing.id;
    else {
      const { data: inserted } = await supabase.from("legal_parties").insert({
        name: primary_party_name,
        kind: kind === "consumer_dispute" ? "consumer" : null,
        phone: body.party_phone || null,
        email: body.party_email || null,
      }).select().single();
      primaryPartyId = inserted?.id || null;
    }
  }

  const { data, error } = await supabase.from("legal_cases").insert({
    title, kind, brand_code, agency, agency_type, primary_party_name,
    primary_party_id: primaryPartyId,
    owner_email, reviewer_email, response_deadline, amount_claimed,
    filed_date, summary, case_no_external, case_no_internal: caseNoInternal,
    year_roc: year_roc || (new Date().getFullYear() - 1911),
    hearing_date, severity: severity || "normal",
    created_by: owner_email,
  }).select().single();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  // 寫 timeline
  await supabase.from("legal_case_events").insert({
    case_id: data.id,
    event_type: "intake",
    title: "案件建立",
    detail: `由 ${owner_email} 建立`,
    actor_email: owner_email,
  });

  // 寫 v3_commands 給承辦人
  await supabase.from("v3_commands").insert({
    owner_email,
    pillar_id: "legal",
    title: `📥 新案件：${title}`,
    detail: summary || "",
    severity: severity || "normal",
    deadline: response_deadline ? new Date(response_deadline).toISOString() : null,
    status: "pending",
    ai_generated: false,
    ai_reasoning: `legal_case_${kind}`,
  });

  return Response.json({ ok: true, case: data });
}
