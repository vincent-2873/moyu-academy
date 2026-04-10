import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * v3 Departments API — 部門管理
 *
 * GET    /api/v3/departments              全部部門 + 含 positions 計數
 * GET    /api/v3/departments?brand=xxx    指定品牌
 * POST   /api/v3/departments              新增部門
 * PATCH  /api/v3/departments              更新部門（id 必填）
 * DELETE /api/v3/departments?id=xxx       刪除部門
 */

const tableMissing = (e: { message?: string; code?: string } | null) =>
  e && (e.code === "42P01" || e.code === "PGRST205" || e.message?.includes("does not exist") || e.message?.includes("Could not find the table"));

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const brand = url.searchParams.get("brand");

    let query = supabase.from("v3_departments").select("*").order("display_order");
    if (brand) query = query.eq("brand", brand);

    const { data: departments, error } = await query;
    if (tableMissing(error)) {
      return Response.json(
        { ok: false, error: "v3 ERP 資料表還沒建立，請執行 supabase-migration-v3-erp.sql", missing_migration: true },
        { status: 503 },
      );
    }
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

    // 順便拉 positions 與用戶數
    const { data: positions } = await supabase.from("v3_positions").select("id, department_id, title, level");
    const { data: users } = await supabase.from("users").select("id, email, name, department_id, position_id");

    const enriched = (departments || []).map((d) => {
      const deptPositions = (positions || []).filter((p) => p.department_id === d.id);
      const deptUsers = (users || []).filter((u) => u.department_id === d.id);
      return {
        ...d,
        position_count: deptPositions.length,
        user_count: deptUsers.length,
        positions: deptPositions,
      };
    });

    return Response.json({ ok: true, departments: enriched });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { code, name, icon, color, brand, description, lead_email, parent_id, display_order } = body;

    if (!code || !name) {
      return Response.json({ ok: false, error: "code / name 必填" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("v3_departments")
      .insert({
        code,
        name,
        icon: icon || "🏢",
        color: color || "#7c6cf0",
        brand: brand || null,
        description: description || null,
        lead_email: lead_email || null,
        parent_id: parent_id || null,
        display_order: display_order ?? 0,
      })
      .select()
      .single();

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, department: data });
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

    const { data, error } = await supabase
      .from("v3_departments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, department: data });
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

    const { error } = await supabase.from("v3_departments").delete().eq("id", id);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
