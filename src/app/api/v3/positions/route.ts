import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * v3 Positions API — 職位管理
 *
 * GET    /api/v3/positions                          全部職位
 * GET    /api/v3/positions?department_id=xxx        指定部門
 * POST   /api/v3/positions                          新增職位
 * PATCH  /api/v3/positions                          更新職位
 * DELETE /api/v3/positions?id=xxx                   刪除職位
 */

const VALID_LEVELS = ["staff", "lead", "manager", "director"] as const;
type Level = (typeof VALID_LEVELS)[number];

const tableMissing = (e: { message?: string; code?: string } | null) =>
  e && (e.code === "42P01" || e.code === "PGRST205" || e.message?.includes("does not exist") || e.message?.includes("Could not find the table"));

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const departmentId = url.searchParams.get("department_id");

    let query = supabase.from("v3_positions").select("*").order("display_order");
    if (departmentId) query = query.eq("department_id", departmentId);

    const { data, error } = await query;
    if (tableMissing(error)) {
      return Response.json(
        { ok: false, error: "v3 ERP 資料表還沒建立，請執行 supabase-migration-v3-erp.sql", missing_migration: true },
        { status: 503 },
      );
    }
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

    // 帶上每個職位的人數
    const { data: users } = await supabase.from("users").select("id, position_id");
    const enriched = (data || []).map((p) => ({
      ...p,
      user_count: (users || []).filter((u) => u.position_id === p.id).length,
    }));

    return Response.json({ ok: true, positions: enriched });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { department_id, title, level, description, responsibilities, base_kpi, reports_to_position_id, display_order } = body;

    if (!department_id || !title) {
      return Response.json({ ok: false, error: "department_id / title 必填" }, { status: 400 });
    }
    if (level && !VALID_LEVELS.includes(level as Level)) {
      return Response.json({ ok: false, error: `level 必須是 ${VALID_LEVELS.join(", ")}` }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("v3_positions")
      .insert({
        department_id,
        title,
        level: level || "staff",
        description: description || null,
        responsibilities: responsibilities || [],
        base_kpi: base_kpi || [],
        reports_to_position_id: reports_to_position_id || null,
        display_order: display_order ?? 0,
      })
      .select()
      .single();

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, position: data });
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

    if (!id) return Response.json({ ok: false, error: "id 必填" }, { status: 400 });
    if (updates.level && !VALID_LEVELS.includes(updates.level as Level)) {
      return Response.json({ ok: false, error: `level 必須是 ${VALID_LEVELS.join(", ")}` }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("v3_positions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, position: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) return Response.json({ ok: false, error: "id 必填" }, { status: 400 });

    const { error } = await supabase.from("v3_positions").delete().eq("id", id);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
