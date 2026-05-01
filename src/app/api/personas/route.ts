import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/personas
 * 回 active 對練 persona 列表(對齊 system-tree v2 §對練 Persona 庫)
 * 用於 /sales/practice + /admin/claude/personas
 *
 * D18 既有:楊嘉瑜風格 / 鄭繁星風格
 * D22 加:客訴客戶 / 反悔已成交
 */
export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("roleplay_personas")
    .select("id, name, archetype, description, difficulty, brand, voice_style, is_active")
    .eq("is_active", true)
    .order("difficulty", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message, personas: [] }, { status: 500 });
  }

  return NextResponse.json({ ok: true, personas: data ?? [] });
}
