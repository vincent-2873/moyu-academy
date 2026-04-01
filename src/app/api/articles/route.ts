import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

export interface Article {
  id: string;
  title: string;
  category:
    | "financial_news"
    | "sales_technique"
    | "mindset"
    | "industry_trend"
    | "success_story";
  summary: string;
  content: string;
  source: string;
  key_takeaways: string[];
  tags: string[];
  created_at: string;
  is_ai_generated: boolean;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("articles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      // Table may not exist yet — return empty array gracefully
      if (
        error.message.includes("does not exist") ||
        error.code === "42P01"
      ) {
        return Response.json({ articles: [] });
      }
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ articles: data ?? [] });
  } catch {
    // Supabase client may fail if env vars are missing
    return Response.json({ articles: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, category, summary, content, source, keyTakeaways, tags } =
      body;

    if (!title || !category || !content) {
      return Response.json(
        { error: "title, category, and content are required" },
        { status: 400 }
      );
    }

    const validCategories = [
      "financial_news",
      "sales_technique",
      "mindset",
      "industry_trend",
      "success_story",
    ];
    if (!validCategories.includes(category)) {
      return Response.json(
        { error: `category must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("articles")
      .insert({
        title,
        category,
        summary: summary ?? "",
        content,
        source: source ?? "",
        key_takeaways: keyTakeaways ?? [],
        tags: tags ?? [],
        is_ai_generated: body.is_ai_generated ?? false,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ article: data }, { status: 201 });
  } catch {
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
