import { normaliseRow, upsertDaily } from "@/lib/metabase";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * Image-based bulk import — 用來繞過 Metabase CSP 的 transport
 *
 * 原因：Metabase 的 CSP default-src 'none' + connect-src 'self' 擋掉所有
 *       fetch / sendBeacon / form / iframe 的跨域呼叫。唯一開放的是
 *       img-src *，所以我們用一張 image GET 當訊號通道。
 *
 * GET /api/admin/sales-metrics/bulk-import-img?d=<base64-json>
 *   d = base64 encoded JSON { brand, date, cols, rows }
 *
 * 永遠回 1x1 透明 PNG（就算失敗也是），讓瀏覽器的 img 元件不會 retry / 噴錯
 * 錯誤會寫進 metabase_sync_log
 */

// 1x1 transparent PNG
const TRANSPARENT_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Zy3nSkAAAAASUVORK5CYII=",
  "base64"
);

function pixelResponse(status = 200): Response {
  return new Response(TRANSPARENT_PIXEL, {
    status,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function GET(req: NextRequest) {
  const d = req.nextUrl.searchParams.get("d");
  const started = Date.now();
  const supabase = getSupabaseAdmin();

  if (!d) {
    await supabase.from("metabase_sync_log").insert({
      brand: null,
      trigger: "manual",
      rows: 0,
      duration_ms: Date.now() - started,
      status: "failed",
      error: "bulk-import-img: missing d param",
    });
    return pixelResponse(400);
  }

  try {
    // base64url decode
    const padded = d.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json) as {
      brand?: string;
      questionId?: number;
      date?: string;
      cols?: string[];
      rows?: unknown[][];
    };
    const { brand: brandFallback, date, cols, rows } = parsed;
    if (!date || !Array.isArray(cols) || !Array.isArray(rows)) {
      throw new Error("missing date/cols/rows");
    }

    // normaliseRow 內部會優先用 row.app_id 做為 brand，fallback 才用這裡的 brandFallback
    const normalised = rows
      .map((r) => normaliseRow(cols, r, brandFallback || "unknown", date))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (normalised.length === 0) {
      throw new Error("no valid rows after normalisation");
    }

    // 按 brand 分群做統計
    const byBrand = new Map<string, number>();
    for (const r of normalised) {
      byBrand.set(r.brand, (byBrand.get(r.brand) || 0) + 1);
    }

    // 自動建立 metabase_sources 若該 brand 還沒登記
    for (const b of byBrand.keys()) {
      const { data: existing } = await supabase
        .from("metabase_sources")
        .select("brand")
        .eq("brand", b)
        .maybeSingle();
      if (!existing) {
        await supabase.from("metabase_sources").insert({
          brand: b,
          question_id: parsed.questionId || 0,
          question_name: `auto-detected from app_id=${b}`,
          enabled: true,
        });
      }
    }

    const up = await upsertDaily(normalised);

    // 每個 brand 更新 last_sync_*
    const now = new Date().toISOString();
    for (const [b, rowCount] of byBrand.entries()) {
      await supabase
        .from("metabase_sources")
        .update({
          last_sync_at: now,
          last_sync_rows: rowCount,
          last_sync_status: up.error ? "partial" : "success",
          last_sync_error: up.error || null,
        })
        .eq("brand", b);
      await supabase.from("metabase_sync_log").insert({
        brand: b,
        question_id: parsed.questionId,
        trigger: "manual",
        rows: rowCount,
        duration_ms: Date.now() - started,
        status: up.error ? "partial" : "success",
        error: up.error || null,
      });
    }

    return pixelResponse(200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    await supabase.from("metabase_sync_log").insert({
      brand: null,
      trigger: "manual",
      rows: 0,
      duration_ms: Date.now() - started,
      status: "failed",
      error: `bulk-import-img: ${msg}`,
    });
    return pixelResponse(500);
  }
}
