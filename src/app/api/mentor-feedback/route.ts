import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const TABLE = "mentor_feedback";

// GET /api/mentor-feedback?trainee_email=...&mentor_email=...&from=...&to=...
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);

    const traineeEmail = searchParams.get("trainee_email");
    const mentorEmail = searchParams.get("mentor_email");
    const from = searchParams.get("from"); // ISO date string
    const to = searchParams.get("to"); // ISO date string

    let query = supabase
      .from(TABLE)
      .select("*")
      .order("day", { ascending: true });

    if (traineeEmail) {
      query = query.eq("trainee_email", traineeEmail);
    }
    if (mentorEmail) {
      query = query.eq("mentor_email", mentorEmail);
    }
    if (from) {
      query = query.gte("date", from);
    }
    if (to) {
      query = query.lte("date", to);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/mentor-feedback
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json();

    const {
      trainee_email,
      mentor_email,
      day,
      date,
      call_target,
      actual_calls,
      target_rate,
      invites,
      demos,
      strength_1,
      strength_2,
      improvement,
      mood,
      notes,
    } = body;

    // Basic validation — mentor_email can be empty for self-reported feedback
    if (!trainee_email || !day || !date) {
      return NextResponse.json(
        { error: "Missing required fields: trainee_email, day, date" },
        { status: 400 }
      );
    }

    const record: Record<string, unknown> = {
      trainee_email,
      mentor_email: mentor_email || "",
      day: Number(day),
      date,
      call_target: Number(call_target) || 0,
      actual_calls: Number(actual_calls) || 0,
      target_rate: Number(target_rate) || 0,
      invites: Number(invites) || 0,
      demos: Number(demos) || 0,
      strength_1: strength_1 || "",
      strength_2: strength_2 || "",
      improvement: improvement || "",
    };
    // Add mood and notes if provided (these columns may or may not exist in DB)
    if (mood !== undefined) record.mood = Number(mood);
    if (notes !== undefined) record.notes = notes || "";

    const { data, error } = await supabase
      .from(TABLE)
      .insert(record)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/mentor-feedback  (body must include `id`)
export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json();

    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    // Convert numeric fields if present
    const numericFields = ["day", "call_target", "actual_calls", "target_rate", "invites", "demos"] as const;
    for (const field of numericFields) {
      if (updates[field] !== undefined) {
        updates[field] = Number(updates[field]);
      }
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
