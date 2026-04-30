import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/training-ops/materials
 * Task 1.5 stub:回每個 path × brand 完整度
 * 後續加 Claude 自動補草稿邏輯
 */
export async function GET() {
  const sb = getSupabaseAdmin();

  try {
    const [pathsRes, modulesRes] = await Promise.all([
      sb.from("training_paths")
        .select("id, code, brand, total_days")
        .eq("is_active", true)
        .like("code", "sales_14d_%"),
      sb.from("training_modules")
        .select("path_id"),
    ]);

    const moduleCount = new Map<string, number>();
    for (const m of modulesRes.data ?? []) {
      const pid = String(m.path_id);
      moduleCount.set(pid, (moduleCount.get(pid) ?? 0) + 1);
    }

    const expectedPerDay = 2;
    const by_brand = (pathsRes.data ?? []).map(p => {
      const expected = (p.total_days ?? 14) * expectedPerDay;
      const actual = moduleCount.get(String(p.id)) ?? 0;
      const missing = Math.max(0, expected - actual);
      const status: "complete" | "incomplete" | "empty" =
        actual === 0 ? "empty"
      : missing > 0 ? "incomplete"
      : "complete";
      return {
        brand: p.brand ?? "(common)",
        path_code: p.code,
        expected,
        actual,
        missing,
        status,
      };
    });

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      by_brand,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
