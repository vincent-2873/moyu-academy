import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get("user_email");
    const unreadOnly = searchParams.get("unread_only");

    if (!userEmail) {
      return Response.json(
        { error: "user_email is required" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false })
      .limit(20);

    if (unreadOnly === "true") {
      query = query.eq("is_read", false);
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

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id)
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
