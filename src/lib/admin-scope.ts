/**
 * 後台 admin scope helper —— 從 cookie 解出 caller email,查 users 表拿 role/brand/team,
 * 給 admin endpoint 用來判斷 (a) 全集團存取 (b) 限該品牌 (c) 限該組
 *
 * 修復:Vincent 2026-04-30 安全反饋 #2 #3 (PERMISSIONS.md TODO):
 *   - /api/admin/sales-metrics 依 brand_manager.brand / team_leader.team 過濾
 *   - /api/v3/commands POST 檢查 owner_email 是否在該 admin 的 scope 內
 *
 * Cookie 格式跟 admin/auth/route.ts 同(email|expiry|hex_hmac_sha256, 用 SUPABASE_SERVICE_ROLE_KEY 簽)
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { getSupabaseAdmin } from "./supabase";

const COOKIE_NAME = "moyu_admin_session";

const FULL_ACCESS_ROLES = new Set([
  "super_admin",
  "ceo",
  "coo",
  "cfo",
  "director",
]);

const BRAND_SCOPED_ROLES = new Set([
  "brand_manager",
  "sales_manager",
  "recruit_manager",
  "legal_manager",
]);

const TEAM_SCOPED_ROLES = new Set(["team_leader"]);

const READ_ONLY_ROLES = new Set(["trainer", "mentor"]);

export interface AdminScope {
  email: string;
  role: string;
  brand: string | null;
  team: string | null;
  /** true → 看全集團 / 任意指派 */
  isFullAccess: boolean;
  /** true → 只能讀,不能寫(trainer / mentor) */
  isReadOnly: boolean;
  /** caller 限定的 brand(brand_manager) — null 表示無限制 */
  scopedBrand: string | null;
  /** caller 限定的 team(team_leader)— null 表示無限制 */
  scopedTeam: string | null;
}

function decodeAdminCookie(req: NextRequest): string | null {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return null;
  const parts = cookie.split("|");
  if (parts.length !== 3) return null;
  const [email, expiry, sig] = parts;
  if (!email || !expiry || !sig) return null;
  if (Date.now() > Number(expiry)) return null;
  if (!/^[0-9a-f]{64}$/.test(sig)) return null;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!secret) return null;
  const expected = createHmac("sha256", secret).update(`${email}|${expiry}`).digest("hex");
  if (sig !== expected) return null;
  return email;
}

/**
 * 取出 caller 的 admin scope。
 *
 * 用法:
 *   const scope = await getAdminScope(req);
 *   if (!scope) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   if (scope.isReadOnly && req.method !== 'GET') return NextResponse.json({ error: 'Read-only role' }, { status: 403 });
 *
 * 注意:middleware 已經擋了沒 cookie / 過期 / signature 不對的情境,但保留 null check
 * 因為 cron secret bypass middleware 不會 set cookie → handler 端還是要驗。
 */
export async function getAdminScope(req: NextRequest): Promise<AdminScope | null> {
  const email = decodeAdminCookie(req);
  if (!email) return null;
  const sb = getSupabaseAdmin();
  const { data: user } = await sb
    .from("users")
    .select("email, role, brand, team")
    .eq("email", email)
    .maybeSingle();
  if (!user) return null;
  const role = (user.role as string) || "";
  const isFullAccess = FULL_ACCESS_ROLES.has(role);
  const isBrandScoped = BRAND_SCOPED_ROLES.has(role);
  const isTeamScoped = TEAM_SCOPED_ROLES.has(role);
  const isReadOnly = READ_ONLY_ROLES.has(role);
  return {
    email: user.email as string,
    role,
    brand: (user.brand as string) || null,
    team: (user.team as string) || null,
    isFullAccess,
    isReadOnly,
    scopedBrand: isBrandScoped ? ((user.brand as string) || null) : null,
    scopedTeam: isTeamScoped ? ((user.team as string) || null) : null,
  };
}

/**
 * 對 supabase query 加上 scope filter(brand/team)。
 * 完整存取 / 沒 brand 設定 → 不加 filter。
 *
 * Returns:回傳已加 filter 的 query(可繼續 chain)
 */
export function applyScopeFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  scope: AdminScope,
  opts: { brandColumn?: string; teamColumn?: string } = {}
): T {
  const brandCol = opts.brandColumn || "brand";
  const teamCol = opts.teamColumn || "team";
  if (scope.isFullAccess) return query;
  if (scope.scopedBrand) query = query.eq(brandCol, scope.scopedBrand);
  if (scope.scopedTeam) query = query.eq(teamCol, scope.scopedTeam);
  return query;
}

/**
 * 對任何寫操作(POST/PATCH/DELETE)做 read-only role 檢查
 *
 * - trainer / mentor → 403
 * - 其他 → 通過
 *
 * 用法:
 *   const scope = await getAdminScope(req);
 *   if (!scope) return NextResponse.json({error:'Unauthorized'}, { status: 401 });
 *   const ro = enforceWriteAccess(scope, request.method);
 *   if (ro) return ro;
 */
export function enforceWriteAccess(scope: AdminScope, method: string): NextResponse | null {
  const isWrite = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  if (isWrite && scope.isReadOnly) {
    return NextResponse.json(
      { error: `${scope.role} 是只讀角色,不能執行寫操作 (${method})` },
      { status: 403 }
    );
  }
  return null;
}

/**
 * 檢查 owner_email 是否在 caller 的 scope 內(用於 POST /api/v3/commands)
 *
 * - 完整存取 → 隨意指派
 * - brand_manager → owner 必須是同 brand 員工
 * - team_leader → owner 必須是同 team 員工
 * - read-only role → 不能指派(寫操作)
 *
 * Returns null 表 OK,否則回 NextResponse with 403
 */
export async function ensureOwnerInScope(scope: AdminScope, ownerEmail: string): Promise<NextResponse | null> {
  if (scope.isReadOnly) {
    return NextResponse.json({ error: `${scope.role} role 不能派任務` }, { status: 403 });
  }
  if (scope.isFullAccess) return null;
  if (!scope.scopedBrand && !scope.scopedTeam) {
    // brand_manager 但帳號沒 brand → 視為錯誤設定,拒絕(保守)
    return NextResponse.json({ error: "你的帳號沒設定 brand/team scope,無法指派" }, { status: 403 });
  }
  const sb = getSupabaseAdmin();
  const { data: target } = await sb
    .from("users")
    .select("email, brand, team")
    .eq("email", ownerEmail)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "owner_email 對應的 user 不存在" }, { status: 404 });
  }
  if (scope.scopedBrand && target.brand !== scope.scopedBrand) {
    return NextResponse.json(
      { error: `跨 brand 派任務被擋(你=${scope.scopedBrand}, target=${target.brand})` },
      { status: 403 }
    );
  }
  if (scope.scopedTeam && target.team !== scope.scopedTeam) {
    return NextResponse.json(
      { error: `跨 team 派任務被擋(你=${scope.scopedTeam}, target=${target.team})` },
      { status: 403 }
    );
  }
  return null;
}
