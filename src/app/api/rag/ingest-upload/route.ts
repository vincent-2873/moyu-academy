import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseFile, isSupportedMime } from "@/lib/file-parser";
import { anonymize } from "@/lib/anonymize";
import { writeAuditLog } from "@/lib/audit-log";
import { canUploadRag, uploadDeniedReason } from "@/lib/upload-permissions";
import type { Pillar } from "@/lib/rag-pillars";

/**
 * POST /api/rag/ingest-upload
 *
 * RAG 上傳統一入口(後台 admin / 前台員工 / 個人 /me 三方共享)
 *
 * Body (multipart/form-data):
 *   - file?: File(audio/video/text)
 *   - text?: string(直接貼純文字)
 *   - title: string
 *   - source: 'admin' | 'staff' | 'self'   ← 決定 reviewed 預設值
 *   - pillar: 'hr' | 'sales' | 'legal' | 'common'
 *   - visibility?: 'public' | 'pillar' | 'brand' | 'role' | 'self'
 *   - email: string                          ← 上傳者 email(從前端 session)
 *   - anonymize_pii?: 'true' | 'false'      ← 預設 true
 *
 * 規則:
 *   - source=admin → reviewed=true(直接上)
 *   - source=staff → reviewed=false(進審核)
 *   - source=self → reviewed=true,visibility 強制 'self'
 *
 * 回傳:
 *   { ok, chunk_id, transcript_status, pii_found, queued_for_review }
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PILLARS: Pillar[] = ["hr", "legal", "sales", "common"];
const VALID_VISIBILITY = ["public", "pillar", "brand", "role", "self"];

export async function POST(req: NextRequest) {
  const startTs = Date.now();
  const sb = getSupabaseAdmin();

  try {
    const ct = req.headers.get("content-type") || "";
    let title = "";
    let source = "staff";
    let pillar: Pillar = "common";
    let visibility = "pillar";
    let email = "";
    let anonymizePII = true;
    let rawText = "";
    let file: File | null = null;

    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      title = String(fd.get("title") || "");
      source = String(fd.get("source") || "staff");
      const pIn = String(fd.get("pillar") || "common");
      pillar = VALID_PILLARS.includes(pIn as Pillar) ? (pIn as Pillar) : "common";
      const vIn = String(fd.get("visibility") || "pillar");
      visibility = VALID_VISIBILITY.includes(vIn) ? vIn : "pillar";
      email = String(fd.get("email") || "");
      anonymizePII = String(fd.get("anonymize_pii") || "true") !== "false";
      rawText = String(fd.get("text") || "");
      const f = fd.get("file");
      if (f instanceof File) file = f;
    } else {
      const body = await req.json();
      title = String(body.title || "");
      source = String(body.source || "staff");
      pillar = VALID_PILLARS.includes(body.pillar) ? body.pillar : "common";
      visibility = VALID_VISIBILITY.includes(body.visibility) ? body.visibility : "pillar";
      email = String(body.email || "");
      anonymizePII = body.anonymize_pii !== false;
      rawText = String(body.text || "");
    }

    if (!email) return NextResponse.json({ error: "missing email" }, { status: 400 });
    if (!title) return NextResponse.json({ error: "missing title" }, { status: 400 });
    if (!rawText && !file) return NextResponse.json({ error: "missing text or file" }, { status: 400 });

    // 1. 從 user 撈 brand / role / id
    const { data: user } = await sb
      .from("users")
      .select("id, email, brand, role, status")
      .eq("email", email)
      .maybeSingle();
    if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

    // 2026-04-30 末段 Vincent 反饋:RAG 上傳限定 3 role(Wave 8 砍 recruit_manager)
    //   super_admin / sales_manager / legal_manager
    if (!canUploadRag(user.role)) {
      return NextResponse.json({ error: uploadDeniedReason(user.role) }, { status: 403 });
    }

    // 2. 處理 input
    let text = rawText;
    let mime = "text/plain";
    let transcript_status: "ready" | "pending" | "failed" | "not_applicable" = "ready";
    let parsedMeta: Record<string, unknown> = {};

    if (file) {
      if (!isSupportedMime(file.type)) {
        return NextResponse.json({
          error: `unsupported mime: ${file.type}`,
          hint: "支援 text/audio/video,PDF/Word 暫不支援",
        }, { status: 415 });
      }
      const parsed = await parseFile(file);
      text = parsed.text;
      mime = parsed.mime;
      transcript_status = parsed.status;
      parsedMeta = parsed.meta;
    }

    // 3. PII anonymize(預設 on)
    const anonResult = anonymizePII ? anonymize(text) : { text, found: { total: 0, emails: 0, phones: 0, idNumbers: 0, creditCards: 0 }, hasPII: false };
    const cleanText = anonResult.text;

    // 4. visibility rule by source
    let finalVisibility = visibility;
    let finalReviewed = true;
    if (source === "self") { finalVisibility = "self"; finalReviewed = true; }
    else if (source === "staff") { finalReviewed = false; }   // 進審核
    else if (source === "admin") { finalReviewed = true; }

    // brand auto-fill if visibility=brand
    const brand = (finalVisibility === "brand" ? user.brand : null);

    // 5. 寫 knowledge_chunks
    const insert: Record<string, unknown> = {
      source_type: source === "self" ? "self_upload" : (source === "staff" ? "staff_upload" : "admin_upload"),
      source_id: `${source}-${user.id}-${Date.now()}`,
      title: title.slice(0, 200),
      content: cleanText.slice(0, 50000),
      pillar,
      visibility: finalVisibility,
      reviewed: finalReviewed,
      uploaded_by_email: email,
      uploaded_at: new Date().toISOString(),
      brand,
      source_mime: mime,
      transcript_status,
      token_count: Math.ceil(cleanText.length / 4),
      metadata: {
        upload_source: source,
        pii_anonymized: anonymizePII,
        pii_found: anonResult.found,
        parse_meta: parsedMeta,
      },
    };

    const { data: chunk, error } = await sb
      .from("knowledge_chunks")
      .insert(insert)
      .select("id")
      .single();

    if (error) {
      await sb.from("system_run_log").insert({
        source: "api:/api/rag/ingest-upload",
        status: "fail",
        duration_ms: Date.now() - startTs,
        error_message: error.message.slice(0, 500),
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 6. audit log
    await writeAuditLog({
      actor_email: email,
      actor_role: user.role,
      action: "create",
      resource_type: "knowledge_chunk",
      resource_id: chunk.id,
      endpoint: "/api/rag/ingest-upload",
      method: "POST",
      ip_address: req.headers.get("x-forwarded-for") || null,
      after_data: { source, pillar, visibility: finalVisibility, reviewed: finalReviewed, title: title.slice(0, 80) },
      metadata: { upload_source: source, pii_count: anonResult.found.total },
    });

    // 7. log
    await sb.from("system_run_log").insert({
      source: "api:/api/rag/ingest-upload",
      status: "ok",
      rows_in: 1,
      rows_out: 1,
      duration_ms: Date.now() - startTs,
      metadata: {
        source, pillar, visibility: finalVisibility, reviewed: finalReviewed,
        transcript_status, pii_count: anonResult.found.total,
      },
    });

    return NextResponse.json({
      ok: true,
      chunk_id: chunk.id,
      transcript_status,
      pii_found: anonResult.found,
      queued_for_review: !finalReviewed,
      visibility: finalVisibility,
      pillar,
      next_step: !finalReviewed
        ? "等管理員審核(/admin → 知識引擎 → 📥 審核佇列)"
        : transcript_status === "pending"
          ? "等 GROQ_API_KEY 後 cron 自動轉錄"
          : "已進 RAG · embedding-refresh cron 會在 30 min 內補 embedding",
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
