import { NextRequest, NextResponse } from "next/server";
import { getAdminScope } from "@/lib/admin-scope";
import { queryAuditLog } from "@/lib/audit-log";

/**
 * GET /api/admin/audit-log
 *
 * N2 (2026-04-30 第三輪):查 audit log
 *
 * Query params:
 *   actor_email, resource_type, action, from, to, limit (default 200, max 500)
 *
 * Auth:
 *   - super_admin / ceo / coo / cfo / director 可看全部
 *   - 其他 admin 只能看自己 actor_email 的
 *   - read-only role(trainer/mentor)允許看(GET 不寫)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const scope = await getAdminScope(req);
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const opts: any = {
    limit: Number(sp.get("limit") || 200),
  };
  if (sp.get("resource_type")) opts.resource_type = sp.get("resource_type");
  if (sp.get("action")) opts.action = sp.get("action");
  if (sp.get("from")) opts.from = sp.get("from");
  if (sp.get("to")) opts.to = sp.get("to");

  // 非 full-access 強制只看自己
  const requestedActor = sp.get("actor_email");
  if (scope.isFullAccess) {
    if (requestedActor) opts.actor_email = requestedActor;
  } else {
    opts.actor_email = scope.email;
  }

  try {
    const rows = await queryAuditLog(opts);
    return NextResponse.json({ ok: true, rows, count: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
