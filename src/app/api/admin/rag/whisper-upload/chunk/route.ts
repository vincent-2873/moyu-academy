import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/rag/whisper-upload/chunk
 *
 * 第 2 步 chunked upload:接 1 個 chunk(每塊 1MB,sequential POST)
 * 寫進 temp file,等所有 chunks 收齊 finalize 才處理
 *
 * Body(multipart): {
 *   upload_id: string,
 *   chunk_index: number,
 *   chunk: Blob (1MB)
 * }
 */
export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e) {
    return NextResponse.json({ ok: false, error: `formData parse: ${(e as Error).message}` }, { status: 400 });
  }

  const uploadId = String(formData.get("upload_id") ?? "");
  const chunkIndex = Number(formData.get("chunk_index") ?? -1);
  const chunkBlob = formData.get("chunk");

  if (!uploadId || chunkIndex < 0 || !(chunkBlob instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "upload_id / chunk_index / chunk required" }, { status: 400 });
  }

  const tempDir = path.join(os.tmpdir(), "moyu-whisper-uploads", uploadId);
  if (!fs.existsSync(tempDir)) {
    return NextResponse.json({ ok: false, error: "upload_id not found / expired" }, { status: 404 });
  }

  try {
    const buf = Buffer.from(await chunkBlob.arrayBuffer());
    const chunkPath = path.join(tempDir, `chunk_${String(chunkIndex).padStart(6, "0")}`);
    fs.writeFileSync(chunkPath, buf);

    // update manifest
    const manifestPath = path.join(tempDir, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (!manifest.chunks_received.includes(chunkIndex)) {
      manifest.chunks_received.push(chunkIndex);
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }

    return NextResponse.json({
      ok: true,
      upload_id: uploadId,
      chunk_index: chunkIndex,
      received: manifest.chunks_received.length,
      total: manifest.total_chunks,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
