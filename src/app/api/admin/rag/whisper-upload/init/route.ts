import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/rag/whisper-upload/init
 *
 * 第 1 步 chunked upload:接收 metadata,回 upload_id
 * 後續 chunks 全部用此 upload_id 串起
 *
 * Body: { filename, size, mime_type, total_chunks, brand?, speaker? }
 * Resp: { ok, upload_id, temp_path }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const filename = String(body.filename ?? "").trim();
    const size = Number(body.size ?? 0);
    const totalChunks = Number(body.total_chunks ?? 0);
    const mimeType = String(body.mime_type ?? "");
    const brand = String(body.brand ?? "").trim() || null;
    const speaker = String(body.speaker ?? "").trim() || null;
    // pillar 隔離(/admin/legal/knowledge 強制 legal,/admin/claude/knowledge 預設 sales)
    const pillarRaw = String(body.pillar ?? "").trim().toLowerCase();
    const pillar = ["sales", "legal", "common"].includes(pillarRaw) ? pillarRaw : null;

    if (!filename || !size || !totalChunks) {
      return NextResponse.json({ ok: false, error: "filename / size / total_chunks required" }, { status: 400 });
    }
    if (size > 2 * 1024 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "file > 2GB,先壓縮或切片" }, { status: 400 });
    }

    const uploadId = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    const tempDir = path.join(os.tmpdir(), "moyu-whisper-uploads", uploadId);
    fs.mkdirSync(tempDir, { recursive: true });

    // 寫 metadata 進 manifest.json,finalize 時讀
    fs.writeFileSync(
      path.join(tempDir, "manifest.json"),
      JSON.stringify({
        upload_id: uploadId,
        filename,
        size,
        mime_type: mimeType,
        total_chunks: totalChunks,
        brand,
        speaker,
        pillar,                                // null = 由 finalize 自動推斷預設 sales
        created_at: new Date().toISOString(),
        chunks_received: [],
      }, null, 2)
    );

    return NextResponse.json({
      ok: true,
      upload_id: uploadId,
      total_chunks: totalChunks,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
