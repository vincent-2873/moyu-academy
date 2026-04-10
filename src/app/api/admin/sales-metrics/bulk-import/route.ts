import { normaliseRow, upsertDaily } from "@/lib/metabase";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * 手動匯入 Metabase query 結果
 *
 * POST /api/admin/sales-metrics/bulk-import
 *   body: {
 *     brand: string,
 *     date: 'YYYY-MM-DD',
 *     cols: string[],      // ['salesperson_id', 'app_id', ..., '按合約分潤淨承攬業績']
 *     rows: unknown[][],   // raw query result rows
 *   }
 *
 * 用途：當 Metabase server-side auth 還沒設好前，直接從瀏覽器抓到的
 *       即時 JSON 丟進來，讓 pipeline 可以先跑起來測試整條鏈路。
 *
 * 安全：service role only — 放在 admin 名下，正式 prod 建議加 token 驗證
 */
/** 支援 3 種 body format：
 *  1. application/json — 直接 { brand, date, cols, rows }
 *  2. text/plain — raw body 就是 JSON 字串（給 sendBeacon / form POST 用）
 *  3. application/x-www-form-urlencoded — body 是 "jsondata=<urlencoded-json>" (form POST from cross-origin)
 */
async function parseBody(req: NextRequest): Promise<{
  brand?: string;
  date?: string;
  cols?: string[];
  rows?: unknown[][];
} | null> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  try {
    if (ct.includes("application/json")) {
      return await req.json();
    }
    const text = await req.text();
    if (!text) return null;

    // form-urlencoded: jsondata=...
    if (ct.includes("application/x-www-form-urlencoded") || text.startsWith("jsondata=")) {
      const params = new URLSearchParams(text);
      const jsondata = params.get("jsondata");
      if (jsondata) return JSON.parse(jsondata);
    }

    // text/plain or no content-type — try plain JSON first
    try {
      return JSON.parse(text);
    } catch {
      // last resort: maybe it's "key=value\njson" from text/plain form enctype
      const eqIdx = text.indexOf("=");
      if (eqIdx > 0) {
        const rest = text.slice(eqIdx + 1).trim();
        return JSON.parse(rest);
      }
      throw new Error("unparseable body");
    }
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = await parseBody(req);
  if (!body) {
    return Response.json(
      { ok: false, error: "invalid body (expect json/text/form with brand,date,cols,rows)" },
      { status: 400, headers: CORS_HEADERS }
    );
  }
  const { brand, date, cols, rows } = body;

  if (!brand || !date || !Array.isArray(cols) || !Array.isArray(rows)) {
    return Response.json(
      { ok: false, error: "require brand, date, cols, rows" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const started = Date.now();
  const normalised = rows
    .map((r) => normaliseRow(cols, r, brand, date))
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const up = await upsertDaily(normalised);

  const supabase = getSupabaseAdmin();
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

  return Response.json(
    {
      ok: !up.error,
      brand,
      date,
      rowsReceived: rows.length,
      rowsNormalised: normalised.length,
      rowsInserted: up.inserted,
      error: up.error,
      duration_ms: Date.now() - started,
    },
    { headers: CORS_HEADERS }
  );
}
