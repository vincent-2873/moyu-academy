import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 招聘漏斗 + 104 發信追蹤 API
 *
 * GET /api/admin/recruit-pipeline
 *   回傳: 求職者 + 發信紀錄 + 排程進度
 *
 * POST /api/admin/recruit-pipeline
 *   body.action: 'add_candidate' | 'log_outreach' | 'update_schedule'
 *
 * 這個 API 負責管理整個招聘流程:
 *   1. 求職者 (recruits table)
 *   2. 104/LinkedIn 發信追蹤 (outreach_log table)
 *   3. 每週目標 vs 實際進度 (recruit_schedule table)
 */

interface RecruitSummary {
  totalCandidates: number;
  byStage: Record<string, number>;
  thisWeekOutreach: number;
  thisWeekInterviews: number;
  thisWeekHires: number;
  schedule?: {
    targetOutreach: number;
    actualOutreach: number;
    targetInterviews: number;
    actualInterviews: number;
    pct: number;
  };
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const brand = req.nextUrl.searchParams.get("brand");

  // 1. Candidates
  let candidateQuery = supabase
    .from("recruits")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (brand) candidateQuery = candidateQuery.eq("brand", brand);
  const { data: candidates, error: candErr } = await candidateQuery;

  // 2. Outreach log (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  let outreachQuery = supabase
    .from("outreach_log")
    .select("*")
    .gte("sent_at", thirtyDaysAgo.toISOString())
    .order("sent_at", { ascending: false })
    .limit(200);
  if (brand) outreachQuery = outreachQuery.eq("brand", brand);
  const { data: outreach } = await outreachQuery;

  // 3. This week's schedule
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const weekStart = monday.toISOString().slice(0, 10);
  let schedQuery = supabase
    .from("recruit_schedule")
    .select("*")
    .eq("week_start", weekStart);
  if (brand) schedQuery = schedQuery.eq("brand", brand);
  const { data: schedule } = await schedQuery;

  // Summary
  const candidateList = candidates || [];
  const byStage: Record<string, number> = {};
  for (const c of candidateList) {
    const stage = (c.stage as string) || "new";
    byStage[stage] = (byStage[stage] || 0) + 1;
  }

  const weekOutreach = (outreach || []).filter((o) => {
    const d = new Date(o.sent_at as string);
    return d >= monday;
  });

  const sched = schedule && schedule.length > 0 ? schedule[0] : null;

  const summary: RecruitSummary = {
    totalCandidates: candidateList.length,
    byStage,
    thisWeekOutreach: weekOutreach.length,
    thisWeekInterviews: weekOutreach.filter((o) => o.status === "interview_scheduled").length,
    thisWeekHires: candidateList.filter((c) => c.hired_at && new Date(c.hired_at as string) >= monday).length,
    schedule: sched
      ? {
          targetOutreach: Number(sched.target_outreach) || 50,
          actualOutreach: Number(sched.actual_outreach) || weekOutreach.length,
          targetInterviews: Number(sched.target_interviews) || 5,
          actualInterviews: Number(sched.actual_interviews) || 0,
          pct: Math.round(
            (weekOutreach.length / (Number(sched.target_outreach) || 50)) * 100
          ),
        }
      : undefined,
  };

  return Response.json({
    ok: true,
    summary,
    candidates: candidateList,
    outreach: outreach || [],
    schedule: schedule || [],
    weekStart,
  });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await req.json();
  const { action } = body;

  if (action === "add_candidate") {
    const { name, email, phone, source, brand, position, resume_url, notes, owner_email } = body;
    if (!name || !owner_email) {
      return Response.json({ ok: false, error: "name + owner_email 必填" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("recruits")
      .insert({
        name,
        email: email || null,
        phone: phone || null,
        source: source || "104",
        brand: brand || null,
        position: position || null,
        resume_url: resume_url || null,
        notes: notes || null,
        owner_email,
        stage: "new",
      })
      .select()
      .single();
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, candidate: data });
  }

  if (action === "log_outreach") {
    const { candidate_name, candidate_email, platform, job_title, brand, message_template, owner_email } = body;
    if (!candidate_name || !owner_email) {
      return Response.json({ ok: false, error: "candidate_name + owner_email 必填" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("outreach_log")
      .insert({
        candidate_name,
        candidate_email: candidate_email || null,
        platform: platform || "104",
        job_title: job_title || null,
        brand: brand || null,
        message_template: message_template || null,
        owner_email,
      })
      .select()
      .single();
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, outreach: data });
  }

  if (action === "update_schedule") {
    const { week_start, brand: sBrand, target_outreach, target_interviews, target_hires, owner_email } = body;
    if (!week_start || !sBrand) {
      return Response.json({ ok: false, error: "week_start + brand 必填" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("recruit_schedule")
      .upsert(
        {
          week_start,
          brand: sBrand,
          target_outreach: target_outreach || 50,
          target_interviews: target_interviews || 5,
          target_hires: target_hires || 1,
          owner_email: owner_email || null,
        },
        { onConflict: "week_start,brand" }
      )
      .select()
      .single();
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, schedule: data });
  }

  return Response.json({ ok: false, error: "unknown action" }, { status: 400 });
}
