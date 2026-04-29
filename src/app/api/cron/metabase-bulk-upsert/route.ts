import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * Metabase bulk upsert — 從 browser(Vincent's logged-in Metabase session)pre-fetch 後 POST 進來
 *
 * Body: { date: string, cols: string[], rows: unknown[][] }
 *
 * 路由本身只負責 normalise + upsert。query 動作在 browser side(Vincent 自家 cookie)
 *
 * Auth: Bearer CRON_SECRET 或 x-zeabur-cron(避免外人觸發)
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const BRAND_ALIASES: Record<string, string> = {
  sixdigital: "ooschool",
  xlab: "aischool",
};

// Metabase 中文 display_name → DB col 對映
// 從 browser fetch 看到 cols: salesperson_id / app_id / email / 機構 / 組別 / name / 等級 / 分機號碼 / 積分 / 通次 / ...
const COL_MAP: Record<string, string> = {
  salesperson_id: "salesperson_id",
  app_id: "app_id",
  email: "email",
  name: "name",
  "機構": "org",
  "組別": "team",
  "等級": "level",
  "通次": "calls",
  "通話分鐘": "call_minutes",
  "通話時長": "call_minutes",
  "接通": "connected",
  "約見": "raw_appointments",
  "出席": "appointments_show",
  "未出席": "raw_no_show",
  "示範": "raw_demos",
  "示範失敗": "demo_failed",
  "成交": "closures",
  "今日成交": "net_closures_daily",
  "合約成交": "net_closures_contract",
  "毛營收": "gross_revenue",
  "今日營收": "net_revenue_daily",
  "合約營收": "net_revenue_contract",
};

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const c = v.replace(/,/g, "").trim();
    if (c === "") return 0;
    const n = Number(c);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function numInt(v: unknown): number { return Math.round(num(v)); }
function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

// CORS headers for browser-side calls from Metabase origin
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-zeabur-cron, Authorization",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const bypassed = req.headers.get("x-zeabur-cron") || req.headers.get("x-cron-bypass");
  if (cronSecret && !bypassed && auth !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  const body = await req.json() as { date: string; cols: string[]; rows: unknown[][] };
  const { date, cols, rows } = body;
  if (!date || !cols || !rows) {
    return Response.json({ error: "missing date/cols/rows" }, { status: 400, headers: CORS_HEADERS });
  }

  const supabase = getSupabaseAdmin();
  const colIdx: Record<string, number> = {};
  for (let i = 0; i < cols.length; i++) {
    const dbField = COL_MAP[cols[i]] || cols[i].toLowerCase().replace(/\s+/g, "_");
    colIdx[dbField] = i;
  }

  const get = (row: unknown[], field: string): unknown => {
    const i = colIdx[field];
    return i !== undefined ? row[i] : null;
  };

  const normalised = rows
    .map((row) => {
      const salesperson_id = str(get(row, "salesperson_id"));
      if (!salesperson_id) return null;

      const rawObj: Record<string, unknown> = {};
      cols.forEach((c, i) => (rawObj[c] = row[i]));

      const app_id = str(get(row, "app_id"));
      const rawBrand = app_id || "xuemi";
      const brand = BRAND_ALIASES[rawBrand] || rawBrand;

      return {
        date,
        salesperson_id,
        brand,
        team: str(get(row, "team")),
        org: str(get(row, "org")),
        name: str(get(row, "name")),
        email: str(get(row, "email")),
        level: str(get(row, "level")),
        calls: numInt(get(row, "calls")),
        call_minutes: numInt(get(row, "call_minutes")),
        connected: numInt(get(row, "connected")),
        raw_appointments: numInt(get(row, "raw_appointments")),
        appointments_show: numInt(get(row, "appointments_show")),
        raw_no_show: numInt(get(row, "raw_no_show")),
        raw_demos: numInt(get(row, "raw_demos")),
        demo_failed: numInt(get(row, "demo_failed")),
        closures: numInt(get(row, "closures")),
        net_closures_daily: num(get(row, "net_closures_daily")),
        net_closures_contract: num(get(row, "net_closures_contract")),
        gross_revenue: num(get(row, "gross_revenue")),
        net_revenue_daily: num(get(row, "net_revenue_daily")),
        net_revenue_contract: num(get(row, "net_revenue_contract")),
        raw: rawObj,
        last_synced_at: new Date().toISOString(),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (normalised.length === 0) {
    return Response.json({ ok: true, date, rows_received: rows.length, rows_normalised: 0, upserted: 0 }, { headers: CORS_HEADERS });
  }

  const { error } = await supabase
    .from("sales_metrics_daily")
    .upsert(normalised, { onConflict: "date,salesperson_id,brand" });

  if (error) {
    return Response.json({ ok: false, error: error.message, date, attempted: normalised.length }, { status: 500, headers: CORS_HEADERS });
  }

  return Response.json({ ok: true, date, rows_received: rows.length, rows_normalised: normalised.length, upserted: normalised.length }, { headers: CORS_HEADERS });
}
