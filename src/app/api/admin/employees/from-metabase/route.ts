import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: 撈 sales_metrics_daily distinct (email, name, brand) + 對比 users 表 + 標 new/existing
// 過濾 name LIKE '新訓-%' (Vincent 規則: 新訓 名字呈現但不進系統)
export async function GET() {
  const sb = getSupabaseAdmin();

  // 從 metabase 同步進來的 sales_metrics_daily (fetchAllRows 繞 1000 cap)
  const rows = await fetchAllRows<{ email: string; name: string; brand: string; date: string }>(() =>
    sb.from("sales_metrics_daily")
      .select("email, name, brand, date")
      .not("email", "is", null)
  );

  // 用 map dedup,保留最新出現的 name + brand
  const map = new Map<string, { email: string; name: string; brand: string | null; latest_date: string; record_count: number; filtered_reason?: string }>();
  for (const r of rows || []) {
    const email = (r.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) continue;
    const name = (r.name || "").trim();
    const brand = r.brand || null;
    const date = r.date || "";

    const filtered = name.startsWith("新訓-") || name.startsWith("新訓 ") || name.startsWith("新訓:");
    const reason = filtered ? "新訓-前綴" : undefined;

    const cur = map.get(email);
    if (!cur) {
      map.set(email, { email, name, brand, latest_date: date, record_count: 1, filtered_reason: reason });
    } else {
      cur.record_count += 1;
      if (date > cur.latest_date) {
        cur.latest_date = date;
        cur.name = name;
        cur.brand = brand;
        cur.filtered_reason = reason;
      }
    }
  }

  const all = Array.from(map.values()).sort((a, b) => b.latest_date.localeCompare(a.latest_date));
  const filtered = all.filter((u) => !u.filtered_reason);
  const skipped = all.filter((u) => u.filtered_reason);

  // 對比現有 users 表
  const emails = filtered.map((u) => u.email);
  const { data: existingUsers } = await sb.from("users").select("email").in("email", emails);
  const existingSet = new Set((existingUsers || []).map((u: any) => u.email.toLowerCase()));

  const candidates = filtered.map((u) => ({
    ...u,
    exists: existingSet.has(u.email),
  }));

  return NextResponse.json({
    ok: true,
    total_distinct: all.length,
    candidates,
    skipped,
    summary: {
      already_exists: candidates.filter((c) => c.exists).length,
      new_to_create: candidates.filter((c) => !c.exists).length,
      filtered_count: skipped.length,
      filter_reason: "name 開頭 '新訓-' 過濾掉 (Vincent 規則)",
    },
  });
}

// POST { emails: string[] } → 為這些 email 建 user account (預設密碼 0000 / role 'staff')
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { emails, default_password = "0000" } = body;
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "missing emails[]" }, { status: 400 });
  }
  const sb = getSupabaseAdmin();

  // 先撈當下 sales_metrics_daily 的 name + brand 對應 (fetchAllRows 繞 1000 cap)
  const rows2 = await fetchAllRows<{ email: string; name: string; brand: string | null; date: string }>(() =>
    sb.from("sales_metrics_daily")
      .select("email, name, brand, date")
      .in("email", emails)
      .order("date", { ascending: false })
  );
  const meta = new Map<string, { name: string; brand: string | null }>();
  for (const r of rows2) {
    const email = (r.email || "").toLowerCase();
    if (!meta.has(email)) {
      meta.set(email, { name: r.name || email.split("@")[0], brand: r.brand || null });
    }
  }

  // 撈現存 emails 排除
  const { data: existing } = await sb.from("users").select("email").in("email", emails);
  const existingSet = new Set((existing || []).map((u: any) => u.email.toLowerCase()));

  const passwordHash = await bcrypt.hash(default_password, 10);

  const toInsert: any[] = [];
  const skipped: { email: string; reason: string }[] = [];

  for (const e of emails) {
    const email = String(e).trim().toLowerCase();
    if (!email || !email.includes("@")) { skipped.push({ email, reason: "invalid email" }); continue; }
    if (existingSet.has(email)) { skipped.push({ email, reason: "already exists" }); continue; }
    const m = meta.get(email);
    const name = m?.name || email.split("@")[0];
    if (name.startsWith("新訓-") || name.startsWith("新訓 ") || name.startsWith("新訓:")) {
      skipped.push({ email, reason: "name 是 新訓- 前綴" });
      continue;
    }
    toInsert.push({
      email,
      name,
      brand: m?.brand || null,
      role: "staff",
      stage: "intermediate",
      stage_path: "business",
      password_hash: passwordHash,
      is_active: true,
      created_at: new Date().toISOString(),
    });
  }

  let inserted = 0;
  let insertError: string | null = null;
  if (toInsert.length > 0) {
    const { data, error } = await sb.from("users").insert(toInsert).select("id, email");
    if (error) {
      insertError = error.message;
    } else {
      inserted = (data || []).length;
    }
  }

  return NextResponse.json({
    ok: !insertError,
    requested: emails.length,
    inserted,
    skipped,
    error: insertError,
    note: `預設密碼: ${default_password} / role: staff / stage: intermediate / stage_path: business`,
  });
}
