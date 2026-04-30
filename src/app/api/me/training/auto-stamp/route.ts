import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/me/training/auto-stamp
// body: { user_email, trigger_type, context }
// trigger_type: 'whisper_score' | 'module_complete' | 'first_action' | 'streak_days'
// context:
//   whisper_score: { score: 75, module_id?: ... }
//   module_complete: { module_id, day }
//   first_action: { action: 'call' | 'appointment' | 'close' }
//   streak_days: { days: 7 }
//
// 評估 stamp_rules + 寫進 training_stamps (idempotent: skip if 已蓋過)

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { user_email, trigger_type, context = {} } = body;
  if (!user_email || !trigger_type) {
    return NextResponse.json({ error: "missing user_email/trigger_type" }, { status: 400 });
  }
  const sb = getSupabaseAdmin();

  // 找 user
  const { data: user } = await sb.from("users").select("id").eq("email", user_email).single();
  if (!user?.id) return NextResponse.json({ error: "user not found" }, { status: 404 });

  // 撈所有 active rules of this trigger_type
  const { data: rules } = await sb
    .from("stamp_rules")
    .select("code, name, rarity, trigger_config")
    .eq("trigger_type", trigger_type)
    .eq("is_active", true);

  if (!rules || rules.length === 0) {
    return NextResponse.json({ ok: true, stamped: [], note: "no rules" });
  }

  const stamped: { code: string; name: string; rarity: string }[] = [];
  for (const rule of rules) {
    const cfg = rule.trigger_config || {};
    let match = false;

    if (trigger_type === "whisper_score") {
      const minScore = Number(cfg.min_score) || 0;
      match = Number(context.score) >= minScore;
    } else if (trigger_type === "module_complete") {
      match = !cfg.day || cfg.day === context.day;
      if (cfg.module_id) match = cfg.module_id === context.module_id;
    } else if (trigger_type === "first_action") {
      match = cfg.action === context.action;
    } else if (trigger_type === "streak_days") {
      const minDays = Number(cfg.days) || 0;
      match = Number(context.days) >= minDays;
    }

    if (!match) continue;

    // idempotency: same user + stamp_code only once
    const { data: existing } = await sb
      .from("training_stamps")
      .select("id")
      .eq("user_id", user.id)
      .eq("stamp_code", rule.code)
      .limit(1);
    if (existing && existing.length > 0) continue;

    const { error } = await sb.from("training_stamps").insert({
      user_id: user.id,
      stamp_code: rule.code,
      stamp_name: rule.name,
      rarity: rule.rarity,
      source_module_id: context.module_id || null,
      metadata: { trigger_type, context },
    });
    if (!error) {
      stamped.push({ code: rule.code, name: rule.name, rarity: rule.rarity });
    }
  }

  return NextResponse.json({ ok: true, stamped });
}
