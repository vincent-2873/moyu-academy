/**
 * Metabase Bridge — 把 kolable Metabase 的 question 拉進墨宇戰情中樞
 *
 * 認證流程：
 *   1. 優先用 Supabase system_secrets.metabase_session (如果還沒過期)
 *   2. 過期則用 env METABASE_USER / METABASE_PASS 重登入拿新 token
 *   3. 拿到新 token 寫回 system_secrets，14 天有效
 *
 * 查詢流程：
 *   POST {host}/api/card/{id}/query
 *   body: { parameters: [...], ignore_cache: true }
 *   header: X-Metabase-Session: <token>
 *
 * 正規化：把原始 row 依照 question 1381 的欄位順序轉成 sales_metrics_daily 的 shape
 * 其他 question 如果欄位名稱跟 1381 一致，會自動對應；不一致就 fallback 把整個 row 塞進 raw JSONB。
 */

import { getSupabaseAdmin } from "./supabase";

const METABASE_HOST =
  process.env.METABASE_HOST || "https://mb.kolable.com";

// ───────────────────────────── Auth ─────────────────────────────

interface SessionToken {
  token: string;
  expiresAt: Date;
}

async function loadSessionFromSupabase(): Promise<SessionToken | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("system_secrets")
    .select("value, expires_at")
    .eq("key", "metabase_session")
    .maybeSingle();
  if (!data) return null;
  const expiresAt = data.expires_at ? new Date(data.expires_at) : new Date(0);
  if (expiresAt.getTime() < Date.now() + 60_000) return null; // 1 分鐘緩衝
  return { token: data.value, expiresAt };
}

async function saveSessionToSupabase(token: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const expiresAt = new Date(Date.now() + 13 * 24 * 3600 * 1000); // 13 天（留 1 天緩衝）
  await supabase
    .from("system_secrets")
    .upsert(
      {
        key: "metabase_session",
        value: token,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
}

async function loginWithPassword(): Promise<string> {
  const username = process.env.METABASE_USER;
  const password = process.env.METABASE_PASS;
  if (!username || !password) {
    throw new Error(
      "METABASE_BLOCK: 缺 METABASE_USER / METABASE_PASS env vars。請在 Zeabur 環境變數加入 metabase 帳密，或用 admin 後台手動貼 session token 到 system_secrets.metabase_session。"
    );
  }
  const res = await fetch(`${METABASE_HOST}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`METABASE_LOGIN_FAILED: HTTP ${res.status} ${err.slice(0, 200)}`);
  }
  const json = (await res.json()) as { id: string };
  if (!json.id) throw new Error("METABASE_LOGIN_FAILED: no session id in response");
  return json.id;
}

/** 取得可用 session token（自動處理過期 & cache） */
export async function getMetabaseToken(): Promise<string> {
  const cached = await loadSessionFromSupabase();
  if (cached) return cached.token;
  const fresh = await loginWithPassword();
  await saveSessionToSupabase(fresh);
  return fresh;
}

// ─────────────────────── Query Card ───────────────────────

export interface MetabaseQueryResult {
  cols: string[];
  rows: unknown[][];
  rowCount: number;
}

export async function queryCard(
  questionId: number,
  params: { startDate: string; endDate: string }
): Promise<MetabaseQueryResult> {
  const token = await getMetabaseToken();
  const body = {
    parameters: [
      {
        type: "date/single",
        target: ["variable", ["template-tag", "startDate"]],
        value: params.startDate,
      },
      {
        type: "date/single",
        target: ["variable", ["template-tag", "endDate"]],
        value: params.endDate,
      },
    ],
    ignore_cache: true,
  };

  // Retry 3 次，handle postgres replica recovery conflict
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${METABASE_HOST}/api/card/${questionId}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Metabase-Session": token,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401 || res.status === 403) {
      // Token 掛了，清 cache 重登
      await getSupabaseAdmin().from("system_secrets").delete().eq("key", "metabase_session");
      throw new Error("METABASE_TOKEN_EXPIRED: next call will re-login");
    }
    if (!res.ok) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      const err = await res.text().catch(() => "");
      throw new Error(`METABASE_QUERY_FAILED: HTTP ${res.status} ${err.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      data?: {
        cols?: Array<{ name: string; display_name?: string }>;
        rows?: unknown[][];
      };
      error?: string;
    };
    if (json.error) {
      if (attempt < 3 && json.error.includes("recovery")) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw new Error(`METABASE_QUERY_ERROR: ${json.error.slice(0, 300)}`);
    }
    const cols = (json.data?.cols || []).map((c) => c.display_name || c.name);
    const rows = json.data?.rows || [];
    return { cols, rows, rowCount: rows.length };
  }
  throw new Error("METABASE_QUERY_FAILED: exhausted retries");
}

// ─────────────────── Normalise & Upsert ───────────────────

interface NormalisedRow {
  date: string;
  salesperson_id: string;
  brand: string;
  team: string | null;
  org: string | null;
  name: string | null;
  email: string | null;
  level: string | null;
  calls: number;
  call_minutes: number;
  connected: number;
  raw_appointments: number;
  appointments_show: number;
  raw_no_show: number;
  raw_demos: number;
  demo_failed: number;
  closures: number;
  net_closures_daily: number;
  net_closures_contract: number;
  gross_revenue: number;
  net_revenue_daily: number;
  net_revenue_contract: number;
  raw: Record<string, unknown>;
  last_synced_at: string;
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/**
 * 把 Metabase row array → NormalisedRow。
 * 基於 question 1381 的欄位順序，其他 question 若 cols 名稱一致會自動對應。
 *
 * 重要：`app_id` 欄位才是真正的品牌識別（Metabase 原生欄位），如果 row 裡有
 * app_id 就優先用它，沒有才 fallback 到參數的 brand。這讓「一個 question 含
 * 多 brand 混在一起」的情境能正確分流到對應 brand。
 */
export function normaliseRow(
  cols: string[],
  row: unknown[],
  brand: string,
  date: string
): NormalisedRow | null {
  const idx = (name: string) => cols.indexOf(name);
  const get = (name: string): unknown => {
    const i = idx(name);
    return i >= 0 ? row[i] : null;
  };

  const salesperson_id = str(get("salesperson_id"));
  if (!salesperson_id) return null; // 沒 id 跳過

  const rawObj: Record<string, unknown> = {};
  cols.forEach((c, i) => (rawObj[c] = row[i]));

  // 優先用 row 裡的 app_id，沒有才 fallback
  const app_id = str(get("app_id"));
  const actualBrand = app_id || brand;

  return {
    date,
    salesperson_id,
    brand: actualBrand,
    team: str(get("組別")),
    org: str(get("機構")),
    name: str(get("name")),
    email: str(get("email")),
    level: str(get("等級")),
    calls: num(get("通次")),
    call_minutes: num(get("通時")),
    connected: num(get("接通數")),
    raw_appointments: num(get("原始邀約數")),
    appointments_show: num(get("邀約出席數")),
    raw_no_show: num(get("原始未出席數")),
    raw_demos: num(get("原始DEMO數")),
    demo_failed: num(get("DEMO失敗數")),
    closures: num(get("分潤成交數")),
    net_closures_daily: num(get("按日期分潤淨成交數")),
    net_closures_contract: num(get("按合約分潤淨成交數")),
    gross_revenue: num(get("分潤承攬業績")),
    net_revenue_daily: num(get("按日期分潤淨承攬業績")),
    net_revenue_contract: num(get("按合約分潤淨承攬業績")),
    raw: rawObj,
    last_synced_at: new Date().toISOString(),
  };
}

export async function upsertDaily(rows: NormalisedRow[]): Promise<{
  inserted: number;
  error?: string;
}> {
  if (rows.length === 0) return { inserted: 0 };
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("sales_metrics_daily")
    .upsert(rows, { onConflict: "date,salesperson_id" });
  if (error) return { inserted: 0, error: error.message };
  return { inserted: rows.length };
}

// ───────────────────── High-level sync ─────────────────────

export interface SyncResult {
  brand: string;
  questionId: number;
  date: string;
  rows: number;
  durationMs: number;
  status: "success" | "partial" | "failed";
  error?: string;
}

/** 同步單一 brand 的 question，更新 metabase_sources.last_sync_* 並寫 sync_log */
export async function syncBrand(
  brand: string,
  date: string,
  trigger: "cron" | "manual" = "cron"
): Promise<SyncResult> {
  const supabase = getSupabaseAdmin();
  const started = Date.now();

  // 讀 source 設定
  const { data: source, error: srcErr } = await supabase
    .from("metabase_sources")
    .select("*")
    .eq("brand", brand)
    .eq("enabled", true)
    .maybeSingle();

  if (srcErr || !source) {
    const result: SyncResult = {
      brand,
      questionId: 0,
      date,
      rows: 0,
      durationMs: Date.now() - started,
      status: "failed",
      error: srcErr?.message || `找不到 enabled 的 metabase source for brand=${brand}`,
    };
    await supabase.from("metabase_sync_log").insert({
      brand,
      trigger,
      rows: 0,
      duration_ms: result.durationMs,
      status: "failed",
      error: result.error,
    });
    return result;
  }

  try {
    const query = await queryCard(source.question_id, {
      startDate: date,
      endDate: date,
    });
    const normalised = query.rows
      .map((r) => normaliseRow(query.cols, r, brand, date))
      .filter((r): r is NormalisedRow => r !== null);
    const up = await upsertDaily(normalised);

    const result: SyncResult = {
      brand,
      questionId: source.question_id,
      date,
      rows: up.inserted,
      durationMs: Date.now() - started,
      status: up.error ? "partial" : "success",
      error: up.error,
    };

    await supabase
      .from("metabase_sources")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_rows: up.inserted,
        last_sync_status: result.status,
        last_sync_error: result.error || null,
      })
      .eq("brand", brand);

    await supabase.from("metabase_sync_log").insert({
      brand,
      question_id: source.question_id,
      trigger,
      rows: up.inserted,
      duration_ms: result.durationMs,
      status: result.status,
      error: result.error || null,
    });

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    const result: SyncResult = {
      brand,
      questionId: source.question_id,
      date,
      rows: 0,
      durationMs: Date.now() - started,
      status: "failed",
      error: msg,
    };
    await supabase
      .from("metabase_sources")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_rows: 0, // 失敗時重置，避免 UI 顯示過期的成功筆數
        last_sync_status: "failed",
        last_sync_error: msg,
      })
      .eq("brand", brand);
    await supabase.from("metabase_sync_log").insert({
      brand,
      question_id: source.question_id,
      trigger,
      rows: 0,
      duration_ms: result.durationMs,
      status: "failed",
      error: msg,
    });
    return result;
  }
}

export async function syncAllEnabledBrands(
  date: string,
  trigger: "cron" | "manual" = "cron"
): Promise<SyncResult[]> {
  const supabase = getSupabaseAdmin();
  const { data: sources } = await supabase
    .from("metabase_sources")
    .select("brand")
    .eq("enabled", true);
  const brands = (sources || []).map((s: { brand: string }) => s.brand);
  const results: SyncResult[] = [];
  for (const brand of brands) {
    results.push(await syncBrand(brand, date, trigger));
  }
  return results;
}
