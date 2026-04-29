import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

/**
 * /api/admin/sales-rules — 業務 KPI 規則 CRUD
 *
 * Vincent 反映「後台所有 tab 都要 CRUD 編輯器」
 * 這個負責 sales_alert_rules:
 *   - 撥打 < N 觸發告警
 *   - 接通率 < N% 推 LINE 給主管
 *   - 邀約 < N 卡關提醒
 *   - 連續 N 天 0 成交 → 高警報
 */

export const runtime = "nodejs";

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("sales_alert_rules")
    .select("*")
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    // 表可能不存在,fallback 空 list
    return NextResponse.json({ items: [], note: error.message });
  }
  return NextResponse.json({ items: data || [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, metric, threshold, comparator, severity, action, target_role, target_brand, message_template, is_active } = body;
  if (!name || !metric || threshold == null) {
    return NextResponse.json({ error: "missing name/metric/threshold" }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("sales_alert_rules").insert({
    name, metric, threshold, comparator: comparator || "<",
    severity: severity || "warning",
    action: action || "notify_self",
    target_role, target_brand,
    message_template,
    is_active: is_active ?? true,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function PUT(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const body = await req.json();
  const updates: any = {};
  for (const k of ["name", "metric", "threshold", "comparator", "severity", "action", "target_role", "target_brand", "message_template", "is_active"]) {
    if (k in body) updates[k] = body[k];
  }
  updates.updated_at = new Date().toISOString();
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("sales_alert_rules").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("sales_alert_rules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
