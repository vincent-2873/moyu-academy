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
      date?: string;
      cols?: string[];
      rows?: unknown[][];
    };
    const { brand, date, cols, rows } = parsed;
    if (!brand || !date || !Array.isArray(cols) || !Array.isArray(rows)) {
      throw new Error("missing brand/date/cols/rows");
    }

    const normalised = rows
      .map((r) => normaliseRow(cols, r, brand, date))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const up = await upsertDaily(normalised);

    await supabase
      .from("metabase_sources")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_rows: up.inserted,
        last_sync_status: up.error ? "partial" : "success",
        last_sync_error: up.error || null,
      })
      .eq("brand", brand);

    await supabase.from("metabase_sync_log").insert({
      brand,
      trigger: "manual",
      rows: up.inserted,
      duration_ms: Date.now() - started,
      status: up.error ? "partial" : "success",
      error: up.error || null,
    });

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
