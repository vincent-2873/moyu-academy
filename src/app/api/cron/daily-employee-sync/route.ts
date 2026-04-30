import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

/**
 * 每日自動 sync — 把 Metabase 有但 users 表沒的 email 自動建立
 *
 * 觸發:cron.yml 排程每日 08:30 TPE (UTC 00:30)
 * 也支援 manual trigger via Authorization: Bearer CRON_SECRET / x-zeabur-cron
 *
 * 邏輯:
 *   1. 從 sales_metrics_daily 撈 distinct email
 *   2. 對比 users 表
 *   3. 排除「新訓-」前綴的 name(Vincent 規則)
 *   4. 排除無效 email(沒 @ 等)
 *   5. 對缺的 email 一次 insert(預設 password 0000 / role staff / stage intermediate / stage_path business)
 *
 * Vincent 2026-04-30 反饋 #5 修:現要 admin 進 Metabase 員工同步 tab 一鍵,
 * 改成自動跑避免累積
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function todayTaipei(): string {
  const tp = new Date(Date.now() + 8 * 3600 * 1000);
  return tp.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const bypassed = req.headers.get("x-zeabur-cron") || req.headers.get("x-cron-bypass");
  if (cronSecret && !bypassed && auth !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const started = Date.now();

  // 1. 撈 sales_metrics_daily distinct email + name + brand(fetchAllRows 繞 1000 cap)
  const rows = await fetchAllRows<{ email: string | null; name: string | null; brand: string | null; date: string }>(() =>
    sb.from("sales_metrics_daily").select("email, name, brand, date").not("email", "is", null)
  );

  // dedupe by email,保留 latest_date 的 name + brand
  const map = new Map<string, { email: string; name: string; brand: string | null; latest_date: string }>();
  for (const r of rows) {
    const email = (r.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) continue;
    const name = (r.name || "").trim();
    const date = r.date || "";
    const cur = map.get(email);
    if (!cur || date > cur.latest_date) {
      map.set(email, { email, name, brand: r.brand, latest_date: date });
    }
  }
  const allCandidates = Array.from(map.values());

  // 2. 排除「新訓-」name
  const filtered = allCandidates.filter((c) => !(c.name.startsWith("新訓-") || c.name.startsWith("新訓 ") || c.name.startsWith("新訓:")));
  const skippedXunlian = allCandidates.length - filtered.length;

  // 3. 對比現有 users
  const emails = filtered.map((c) => c.email);
  const { data: existing } = await sb.from("users").select("email").in("email", emails);
  const existingSet = new Set((existing || []).map((u: { email: string }) => u.email.toLowerCase()));
  const toInsert = filtered.filter((c) => !existingSet.has(c.email));

  if (toInsert.length === 0) {
    return Response.json({
      ok: true,
      date: todayTaipei(),
      candidates_total: allCandidates.length,
      skipped_xunlian: skippedXunlian,
      already_exists: existingSet.size,
      inserted: 0,
      duration_ms: Date.now() - started,
      note: "無需新增,所有 metabase email 都已在 users 表",
    });
  }

  // 4. Bulk insert (預設密碼 0000 + role staff + stage intermediate + stage_path business)
  const passwordHash = await bcrypt.hash("0000", 10);
  const records = toInsert.map((c) => ({
    email: c.email,
    name: c.name || c.email.split("@")[0],
    brand: c.brand || null,
    role: "staff",
    stage: "intermediate",
    stage_path: "business",
    password_hash: passwordHash,
    is_active: true,
    created_at: new Date().toISOString(),
  }));

  const { data: inserted, error } = await sb.from("users").insert(records).select("id, email");
  if (error) {
    return Response.json({
      ok: false,
      error: error.message,
      attempted: records.length,
      duration_ms: Date.now() - started,
    }, { status: 500 });
  }

  // 5. Log
  await sb.from("claude_actions").insert({
    action_type: "auto_employee_sync",
    target: "system",
    summary: `自動同步 ${(inserted || []).length} 個新 metabase email 進 users 表`,
    details: { inserted_count: (inserted || []).length, sample_emails: (inserted || []).slice(0, 5).map((u: { email: string }) => u.email) },
    result: "success",
  });

  return Response.json({
    ok: true,
    date: todayTaipei(),
    candidates_total: allCandidates.length,
    skipped_xunlian: skippedXunlian,
    already_exists: existingSet.size,
    inserted: (inserted || []).length,
    inserted_sample: (inserted || []).slice(0, 10).map((u: { email: string }) => u.email),
    duration_ms: Date.now() - started,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
