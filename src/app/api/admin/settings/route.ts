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

    return Response.json({ data });
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

    const { data, error } = await supabase
      .from("system_settings")
      .update({
        value,
        updated_by,
        updated_at: new Date().toISOString(),
      })
      .eq("key", key)
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ data });
  } catch (err) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
