import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const brand = searchParams.get("brand");

    let query = supabase
      .from("announcements")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);

    if (role) {
      query = query.contains("target_roles", [role]);
    }

    if (brand) {
      query = query.contains("target_brands", [brand]);
    }

    const { data, error } = await query;

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ data });
  } catch (err) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const {
      title,
      content,
      type,
      priority,
      is_pinned,
      target_roles,
      target_brands,
      expires_at,
      created_by,
    } = body;

    if (!title || !content || !created_by) {
      return Response.json(
        { error: "title, content, and created_by are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("announcements")
      .insert({
        title,
        content,
        type: type ?? "info",
        priority: priority ?? 0,
        is_pinned: is_pinned ?? false,
        target_roles: target_roles ?? [],
        target_brands: target_brands ?? [],
        expires_at,
        created_by,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ data }, { status: 201 });
  } catch (err) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
