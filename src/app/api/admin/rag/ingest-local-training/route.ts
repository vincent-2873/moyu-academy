import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * POST /api/admin/rag/ingest-local-training
 *
 * 把本機 content/training/ 資料夾的 .md 全部 ingest 進 knowledge_chunks
 *
 * 預期內容:
 *   content/training/foundation/
 *   content/training/hrbp_series/
 *   content/training/source_materials/
 *
 * 不需要 NOTION token, 純讀本機檔案
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRAINING_ROOT = path.join(process.cwd(), "content", "training");

export async function POST(req: NextRequest) {
  const startTs = Date.now();
  const sb = getSupabaseAdmin();

  try {
    if (!fs.existsSync(TRAINING_ROOT)) {
      return NextResponse.json({
        error: "content/training/ not found",
        cwd: process.cwd(),
      }, { status: 404 });
    }

    const files = walkDir(TRAINING_ROOT, [".md", ".txt"]);

    let chunksAdded = 0;
    let chunksUpdated = 0;
    const errors: string[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf8");
        if (content.length < 50) continue;

        const relPath = path.relative(TRAINING_ROOT, file).replace(/\\/g, "/");
        const sourceId = `training/${relPath}`;
        const title = path.basename(file, path.extname(file));

        // 推斷 path_type / brand from path
        const pathType = relPath.includes("hrbp") ? "recruit"
          : relPath.includes("sales") || relPath.includes("foundation") ? "business"
          : "common";

        const hash = await sha256(content);

        const { data: existing } = await sb
          .from("knowledge_chunks")
          .select("id, content_hash")
          .eq("source_type", "training_md")
          .eq("source_id", sourceId)
          .maybeSingle();

        if (existing && existing.content_hash === hash) continue;

        const op = existing ? "update" : "insert";
        const payload = {
          source_type: "training_md" as const,
          source_id: sourceId,
          title,
          path_type: pathType,
          content: content.slice(0, 50000),
          content_hash: hash,
          metadata: {
            file_path: relPath,
            file_size: content.length,
          },
          token_count: Math.ceil(content.length / 4),
        };

        if (existing) {
          const { error } = await sb.from("knowledge_chunks").update(payload).eq("id", existing.id);
          if (error) errors.push(`${relPath}: ${error.message}`);
          else chunksUpdated++;
        } else {
          const { error } = await sb.from("knowledge_chunks").insert(payload);
          if (error) errors.push(`${relPath}: ${error.message}`);
          else chunksAdded++;
        }
      } catch (e: any) {
        errors.push(`${file}: ${e.message}`);
      }
    }

    await sb.from("knowledge_sources_log").insert({
      source_type: "training_md",
      source_id: "local_sync",
      chunks_added: chunksAdded,
      chunks_updated: chunksUpdated,
      status: errors.length === 0 ? "ok" : "partial",
      error_message: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
      metadata: { files_scanned: files.length },
    });

    return NextResponse.json({
      files_scanned: files.length,
      chunks_added: chunksAdded,
      chunks_updated: chunksUpdated,
      errors: errors.slice(0, 5),
      duration_ms: Date.now() - startTs,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

function walkDir(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...walkDir(full, exts));
    } else if (exts.some(e => item.name.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
