import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * /api/admin/q1381-trigger — admin-cookie auth wrapper for q1381-backfill
 *
 * 第十三輪 final:Vincent 要逐日 backfill + 0 誤差 verify
 *
 * Body: { from, to, do_truncate?, dry_run? }
 *  - dry_run=true:跑 query 不寫(verify 用)
 *  - do_truncate=true:先刪除 [from..to] 範圍 → 重 insert(0 誤差最強)
 */

export async function POST(req: NextRequest) {
  const sessionCookie = req.cookies.get("moyu_admin_session")?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: "no session" }, { status: 401 });
  }

  let body: { from?: string; to?: string; do_truncate?: boolean; dry_run?: boolean };
  try { body = await req.json(); } catch { body = {}; }

  if (!body.from || !body.to) {
    return NextResponse.json({ error: "from + to required" }, { status: 400 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host");
  const url = `${proto}://${host}/api/cron/metabase-q1381-backfill`;

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cronSecret}`,
    },
    body: JSON.stringify({
      from: body.from,
      to: body.to,
      do_truncate: body.do_truncate ?? false,
      dry_run: body.dry_run ?? false,
    }),
  });

  const j = await r.json();
  return NextResponse.json(j);
}
