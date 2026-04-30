import { NextRequest, NextResponse } from "next/server";

/**
 * Cron: /api/cron/auto-classify-pillar
 *
 * 2026-04-30 末段:每週日 02:00 自動掃 pillar='common' 的 chunks 重分類
 *
 * Wrap 既有 /api/admin/rag/auto-classify-pillar(POST 用 bearer 身分)
 *   → 因為它原本要 admin cookie,我直接從 cron 調 same logic 透過 internal POST + CRON_SECRET 走 middleware bypass
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 內部呼叫 admin endpoint(middleware 認 CRON_SECRET bypass)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || "https://moyusales.zeabur.app";
  try {
    const r = await fetch(`${baseUrl}/api/admin/rag/auto-classify-pillar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${expected}`,
      },
      body: JSON.stringify({ dry_run: false, only_common: true }),
    });
    const data = await r.json();
    return NextResponse.json({ ok: true, classified: data });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ name: "auto-classify-pillar", note: "weekly Sunday 02:00 (UTC 18:00 Sat)" });
}
