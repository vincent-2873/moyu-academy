import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 指揮台:全員推播 / 抽人問話 / 凍結帳號 / 拍板紀錄
export async function GET() {
  const sb = getSupabaseAdmin();

  // 拍板紀錄 = 近 30 條 v3_commands(Vincent 派的)
  const { data: commands } = await sb
    .from("v3_commands")
    .select("id, title, detail, severity, status, owner_email, created_at, deadline")
    .order("created_at", { ascending: false })
    .limit(30);

  // 凍結帳號清單
  const { data: frozenUsers } = await sb
    .from("users")
    .select("id, email, name, brand, is_active, frozen_at, frozen_reason")
    .eq("is_active", false)
    .limit(20);

  // 有 LINE 綁定的人數(可推播)
  const { count: lineBoundCount } = await sb
    .from("line_bindings")
    .select("*", { count: "exact", head: true })
    .eq("is_bound", true);

  return NextResponse.json({
    ok: true,
    commands: commands || [],
    frozen_users: frozenUsers || [],
    line_bound_count: lineBoundCount || 0,
  });
}

// 動作:freeze / unfreeze / push-all / random-ask / decision
export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as string;
  const sb = getSupabaseAdmin();

  if (action === "freeze") {
    const { user_id, reason } = body;
    if (!user_id) return NextResponse.json({ error: "missing user_id" }, { status: 400 });
    const { error } = await sb
      .from("users")
      .update({ is_active: false, frozen_at: new Date().toISOString(), frozen_reason: reason || "管理員凍結" })
      .eq("id", user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "unfreeze") {
    const { user_id } = body;
    if (!user_id) return NextResponse.json({ error: "missing user_id" }, { status: 400 });
    const { error } = await sb
      .from("users")
      .update({ is_active: true, frozen_at: null, frozen_reason: null })
      .eq("id", user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "decision") {
    const { title, detail, severity, owner_email, deadline } = body;
    if (!title) return NextResponse.json({ error: "missing title" }, { status: 400 });
    const { data, error } = await sb
      .from("v3_commands")
      .insert({
        title,
        detail: detail || null,
        severity: severity || "normal",
        owner_email: owner_email || "vincent@xuemi.co",
        status: "pending",
        ai_generated: false,
        deadline: deadline || null,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  }

  if (action === "push-all") {
    const { message } = body;
    if (!message) return NextResponse.json({ error: "missing message" }, { status: 400 });
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) return NextResponse.json({ error: "LINE_CHANNEL_ACCESS_TOKEN not set" }, { status: 500 });
    const { data: bindings } = await sb
      .from("line_bindings")
      .select("line_user_id")
      .eq("is_bound", true);
    const ids = (bindings || []).map((b: any) => b.line_user_id).filter(Boolean);
    if (ids.length === 0) return NextResponse.json({ ok: true, sent: 0, note: "無綁定 LINE 用戶" });
    const results: { id: string; ok: boolean }[] = [];
    for (const id of ids) {
      try {
        const r = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ to: id, messages: [{ type: "text", text: message }] }),
        });
        results.push({ id, ok: r.ok });
      } catch {
        results.push({ id, ok: false });
      }
    }
    const okCount = results.filter((r) => r.ok).length;
    return NextResponse.json({ ok: true, sent: okCount, total: ids.length });
  }

  if (action === "random-ask") {
    const { question, scope } = body;
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) return NextResponse.json({ error: "LINE_CHANNEL_ACCESS_TOKEN not set" }, { status: 500 });
    let q = sb.from("users").select("email, name, brand").eq("is_active", true);
    if (scope) q = q.eq("brand", scope);
    const { data: users } = await q;
    if (!users || users.length === 0) return NextResponse.json({ ok: true, note: "無候選人" });
    const picked = users[Math.floor(Math.random() * users.length)];
    const { data: binding } = await sb.from("line_bindings").select("line_user_id").eq("user_email", picked.email).single();
    if (!binding?.line_user_id) return NextResponse.json({ ok: false, picked, note: "此人未綁定 LINE" });
    const r = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: binding.line_user_id, messages: [{ type: "text", text: `Vincent 抽問:${question || "今天進度?"}` }] }),
    });
    return NextResponse.json({ ok: r.ok, picked });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
