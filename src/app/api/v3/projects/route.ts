import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * v3 Projects API — 3 大支柱（業務 / 法務 / 招聘）的專案管理
 *
 * GET    /api/v3/projects               所有專案，按支柱分組
 * GET    /api/v3/projects?pillar=sales  指定支柱
 * POST   /api/v3/projects               新增專案
 * PATCH  /api/v3/projects                更新專案（id 必填）
 */

const VALID_PILLARS = ["sales", "legal", "recruit"] as const;
const VALID_HEALTH = ["healthy", "warning", "critical", "unknown"] as const;
const VALID_STATUS = ["active", "paused", "done", "dropped"] as const;

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const pillar = url.searchParams.get("pillar");

    let query = supabase
      .from("v3_projects")
      .select("*")
      .order("pillar_id", { ascending: true })
      .order("created_at", { ascending: false });

    if (pillar) query = query.eq("pillar_id", pillar);

    const { data: projects, error } = await query;
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    // 同時抓 pillars 結構
    const { data: pillars } = await supabase
      .from("v3_pillars")
      .select("*")
      .order("display_order");

    // 按 pillar 分組
    const grouped: Record<string, typeof projects> = {};
    (pillars || []).forEach((p) => {
      grouped[p.id] = (projects || []).filter((pr) => pr.pillar_id === p.id);
    });

    return Response.json({
      ok: true,
      pillars: pillars || [],
      projects: projects || [],
      grouped,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { pillar_id, name, goal, owner_email, deadline, kpi_target, diagnosis, next_action } = body;

    if (!pillar_id || !name || !goal) {
      return Response.json(
        { ok: false, error: "pillar_id / name / goal 必填" },
        { status: 400 },
      );
    }
    if (!VALID_PILLARS.includes(pillar_id)) {
      return Response.json(
        { ok: false, error: `pillar_id 必須是 ${VALID_PILLARS.join(", ")}` },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("v3_projects")
      .insert({
        pillar_id,
        name,
        goal,
        owner_email: owner_email || null,
        deadline: deadline || null,
        kpi_target: kpi_target || null,
        diagnosis: diagnosis || null,
        next_action: next_action || null,
        status: "active",
        health: "unknown",
        progress: 0,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, project: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return Response.json({ ok: false, error: "id 必填" }, { status: 400 });
    }

    if (updates.health && !VALID_HEALTH.includes(updates.health)) {
      return Response.json(
        { ok: false, error: `health 必須是 ${VALID_HEALTH.join(", ")}` },
        { status: 400 },
      );
    }
    if (updates.status && !VALID_STATUS.includes(updates.status)) {
      return Response.json(
        { ok: false, error: `status 必須是 ${VALID_STATUS.join(", ")}` },
        { status: 400 },
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("v3_projects")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, project: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
