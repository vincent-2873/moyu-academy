import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import type { Pillar } from "@/lib/rag-pillars";

/**
 * POST /api/admin/rag/ingest-notion
 *
 * 同步 Notion workspace 進 knowledge_chunks (RAG 知識庫)
 *
 * 需 env: NOTION_INTEGRATION_TOKEN
 *
 * 流程:
 *   1. 列 Notion workspace 所有 page (search API)
 *   2. 對每個 page 撈 blocks → 拼 markdown
 *   3. upsert knowledge_chunks (用 content_hash dedup)
 *
 * Body:
 *   { brand?, business_line?, max_pages?, pillar? } - filter + RAG 池分類
 *   pillar 可選 hr/legal/sales/common(default common)— Vincent 2026-04-30 RAG 三池
 *
 * 注意: 這個 endpoint 跑 1-5 分鐘 (大 workspace),建議從 admin UI 觸發
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export async function POST(req: NextRequest) {
  const startTs = Date.now();
  const sb = getSupabaseAdmin();

  const token = process.env.NOTION_INTEGRATION_TOKEN;
  if (!token) {
    return NextResponse.json({
      error: "NOTION_INTEGRATION_TOKEN not set",
      hint: "1. https://www.notion.so/profile/integrations/internal 開 internal integration; 2. 在 Notion 各 page 右上 ... → 加連線給此 integration; 3. paste token 進 Zeabur env NOTION_INTEGRATION_TOKEN",
    }, { status: 503 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const maxPages = body.max_pages || 100;
    const brandFilter = body.brand;
    const businessLineFilter = body.business_line;
    // RAG 三池 (2026-04-30):caller 帶 pillar 進來分類
    const validPillars: Pillar[] = ["hr", "legal", "sales", "common"];
    const pillar: Pillar = validPillars.includes(body.pillar) ? body.pillar : "common";

    // 1. Search 所有可訪問的 pages
    const searchRes = await fetch(`${NOTION_API_BASE}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: { property: "object", value: "page" },
        page_size: maxPages,
      }),
    });

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      await sb.from("system_run_log").insert({
        source: "api:/api/admin/rag/ingest-notion",
        status: "fail",
        duration_ms: Date.now() - startTs,
        error_message: `Notion search ${searchRes.status}: ${errText.slice(0, 200)}`,
      });
      return NextResponse.json({ error: `Notion API ${searchRes.status}`, detail: errText.slice(0, 300) }, { status: 502 });
    }

    const searchData = await searchRes.json();
    const pages = searchData.results || [];

    let chunksAdded = 0;
    let chunksUpdated = 0;
    const errors: string[] = [];

    for (const page of pages.slice(0, maxPages)) {
      try {
        // 2. 撈 page blocks (簡化: 第一層 children + 不遞迴)
        const blocksRes = await fetch(`${NOTION_API_BASE}/blocks/${page.id}/children?page_size=100`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Notion-Version": NOTION_VERSION,
          },
        });
        if (!blocksRes.ok) continue;
        const blocksData = await blocksRes.json();
        const blocks = blocksData.results || [];

        const title = (page.properties?.title?.title?.[0]?.plain_text)
          || (page.properties?.Name?.title?.[0]?.plain_text)
          || "Untitled";

        // 3. 拼 markdown
        const md = blocksToMarkdown(blocks);
        if (md.length < 50) continue; // 太短跳過

        // 4. content hash dedup
        const hash = await sha256(md);

        const { data: existing } = await sb
          .from("knowledge_chunks")
          .select("id")
          .eq("source_type", "notion")
          .eq("source_id", page.id)
          .eq("content_hash", hash)
          .maybeSingle();

        if (existing) continue; // 內容沒變,跳過

        // 5. Upsert (沒 embedding 先空,之後 embedding cron 補)
        const { error } = await sb
          .from("knowledge_chunks")
          .upsert({
            source_type: "notion",
            source_id: page.id,
            source_url: page.url,
            brand: brandFilter || null,
            business_line: businessLineFilter || null,
            pillar,                                // RAG 三池
            title,
            content: md.slice(0, 50000),
            content_hash: hash,
            metadata: {
              notion_page_id: page.id,
              last_edited: page.last_edited_time,
              created: page.created_time,
            },
            token_count: Math.ceil(md.length / 4),
          }, {
            onConflict: "source_type,source_id",
          });

        if (error) {
          errors.push(`page ${page.id}: ${error.message}`);
        } else {
          if (existing) chunksUpdated++; else chunksAdded++;
        }
      } catch (e: any) {
        errors.push(`page ${page.id}: ${e.message}`);
      }
    }

    // log
    await sb.from("knowledge_sources_log").insert({
      source_type: "notion",
      source_id: "workspace_sync",
      chunks_added: chunksAdded,
      chunks_updated: chunksUpdated,
      status: errors.length === 0 ? "ok" : "partial",
      error_message: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
      metadata: { pages_scanned: pages.length },
    });

    await sb.from("system_run_log").insert({
      source: "api:/api/admin/rag/ingest-notion",
      status: errors.length === 0 ? "ok" : "partial",
      rows_in: pages.length,
      rows_out: chunksAdded + chunksUpdated,
      duration_ms: Date.now() - startTs,
      metadata: { errors: errors.slice(0, 3) },
    });

    return NextResponse.json({
      pages_scanned: pages.length,
      chunks_added: chunksAdded,
      chunks_updated: chunksUpdated,
      errors: errors.slice(0, 5),
      duration_ms: Date.now() - startTs,
      next_step: "embedding cron 會自動補 embedding (POST /api/admin/rag/embed-pending)",
    });
  } catch (err: any) {
    await sb.from("system_run_log").insert({
      source: "api:/api/admin/rag/ingest-notion",
      status: "fail",
      duration_ms: Date.now() - startTs,
      error_message: String(err?.message || err).slice(0, 500),
    });
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

function blocksToMarkdown(blocks: any[]): string {
  return blocks.map((b) => {
    const t = b.type;
    const richText = (b[t]?.rich_text || []).map((rt: any) => rt.plain_text).join("");
    switch (t) {
      case "heading_1": return `\n# ${richText}\n`;
      case "heading_2": return `\n## ${richText}\n`;
      case "heading_3": return `\n### ${richText}\n`;
      case "paragraph": return richText ? `\n${richText}\n` : "";
      case "bulleted_list_item": return `\n- ${richText}`;
      case "numbered_list_item": return `\n1. ${richText}`;
      case "to_do": return `\n- [${b.to_do.checked ? "x" : " "}] ${richText}`;
      case "quote": return `\n> ${richText}\n`;
      case "code": return `\n\`\`\`\n${richText}\n\`\`\`\n`;
      case "callout": return `\n💡 ${richText}\n`;
      default: return "";
    }
  }).join("");
}

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
