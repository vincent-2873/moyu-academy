import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("system_settings")
      .select("*")
      .order("key", { ascending: true });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ settings: data, data });
  } catch (err) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { key, value, updated_by } = body;

    if (!key || value === undefined || !updated_by) {
      return Response.json(
        { error: "key, value, and updated_by are required" },
        { status: 400 }
      );
    }

    const payload = {
      key,
      value,
      updated_by,
      updated_at: new Date().toISOString(),
    };

    // Try upsert first (works if table has unique constraint on key)
    const { data: upsertData, error: upsertError } = await supabase
      .from("system_settings")
      .upsert(payload, { onConflict: "key" })
      .select()
      .single();

    if (!upsertError) {
      return Response.json({ data: upsertData });
    }

    // Fallback: check if row exists, then update or insert
    const { data: existing } = await supabase
      .from("system_settings")
      .select("id")
      .eq("key", key)
      .maybeSingle();

    if (existing) {
      // Row exists - update it
      const { data, error } = await supabase
        .from("system_settings")
        .update({ value, updated_by, updated_at: new Date().toISOString() })
        .eq("key", key)
        .select()
        .single();

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      return Response.json({ data });
    } else {
      // Row doesn't exist - insert it
      const { data, error } = await supabase
        .from("system_settings")
        .insert(payload)
        .select()
        .single();

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      return Response.json({ data });
    }
  } catch (err) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
