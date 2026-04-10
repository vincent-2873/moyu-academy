import { syncAllEnabledBrands, syncBrand } from "@/lib/metabase";
import { NextRequest } from "next/server";

/**
 * 後台「⚡ 立即同步」按鈕 — 管理員手動觸發
 *
 * POST /api/admin/metabase-sync
 *   body: { brand?: string, date?: 'YYYY-MM-DD' }
 *   - brand 省略 → 同步所有啟用的 brand
 *   - date 省略 → 今天（台北）
 */

function todayTaipei(): string {
  const now = new Date();
  const tp = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return tp.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const brand = (body.brand as string | undefined)?.trim();
  const date = (body.date as string | undefined) || todayTaipei();

  const started = Date.now();
  try {
    if (brand) {
      const result = await syncBrand(brand, date, "manual");
      return Response.json({
        ok: result.status !== "failed",
        date,
        result,
        duration_ms: Date.now() - started,
      });
    }
    const results = await syncAllEnabledBrands(date, "manual");
    const totalRows = results.reduce((s, r) => s + r.rows, 0);
    const failed = results.filter((r) => r.status === "failed").length;
    return Response.json({
      ok: failed === 0,
      date,
      results,
      summary: { brands: results.length, totalRows, failed },
      duration_ms: Date.now() - started,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return Response.json(
      { ok: false, error: msg, duration_ms: Date.now() - started },
      { status: 500 }
    );
  }
}
