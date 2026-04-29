import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 招聘求職者原始資料儲存 API
 *
 * GET    /api/admin/recruit-documents?recruit_id=xxx   列出該求職者的所有原始資料
 * POST   /api/admin/recruit-documents                  新增一筆原始資料
 * PATCH  /api/admin/recruit-documents                  更新（id 必填）
 * DELETE /api/admin/recruit-documents?id=xxx           刪除
 *
 * doc_type:
 * - resume          履歷
 * - screenshot      截圖（IG/LINE/網站等）
 * - conversation    對話紀錄
 * - interview_note  面試筆記
 * - reference       推薦人
 * - background      背調
 * - other           其他
 */

const VALID_DOC_TYPES = [
  "resume",
  "screenshot",
  "conversation",
  "interview_note",
  "reference",
  "background",
  "other",
];

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const recruitId = url.searchParams.get("recruit_id");
    if (!recruitId) {
      return Response.json({ ok: false, error: "recruit_id 必填" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("recruit_documents")
      .select("*")
      .eq("recruit_id", recruitId)
      .order("created_at", { ascending: false });

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, documents: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const {
      recruit_id,
      doc_type,
      title,
      content,
      file_url,
      source,
      metadata,
      created_by,
    } = body;

    if (!recruit_id || !doc_type || !title) {
      return Response.json(
        { ok: false, error: "recruit_id, doc_type, title 必填" },
        { status: 400 }
      );
    }
    if (!VALID_DOC_TYPES.includes(doc_type)) {
      return Response.json(
        { ok: false, error: `doc_type 必須是 ${VALID_DOC_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("recruit_documents")
      .insert({
        recruit_id,
        doc_type,
        title,
        content: content || null,
        file_url: file_url || null,
        source: source || null,
        metadata: metadata || {},
        created_by: created_by || null,
      })
      .select()
      .single();

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, document: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { id, title, content, doc_type, source } = body;

    if (!id) return Response.json({ ok: false, error: "id 必填" }, { status: 400 });

    const update: Record<string, unknown> = {};
    if (title !== undefined) update.title = title;
    if (content !== undefined) update.content = content;
    if (source !== undefined) update.source = source;
    if (doc_type !== undefined) {
      if (!VALID_DOC_TYPES.includes(doc_type)) {
        return Response.json({ ok: false, error: "invalid doc_type" }, { status: 400 });
      }
      update.doc_type = doc_type;
    }

    const { data, error } = await supabase
      .from("recruit_documents")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, document: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return Response.json({ ok: false, error: "id 必填" }, { status: 400 });

    const { error } = await supabase.from("recruit_documents").delete().eq("id", id);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
