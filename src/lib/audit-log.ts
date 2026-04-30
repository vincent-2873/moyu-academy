import { getSupabaseAdmin } from "./supabase";

/**
 * N2 (2026-04-30 第三輪):全 admin write 操作留稽核日誌
 *
 * Schema: supabase-migration-D15-audit-embedding-hnsw.sql audit_log table
 *
 * 用法(在 admin endpoint POST/PATCH/DELETE):
 *   import { writeAuditLog } from '@/lib/audit-log';
 *   await writeAuditLog({
 *     actor_email: scope.email,
 *     actor_role: scope.role,
 *     action: 'update',                  // create / update / delete / trigger
 *     resource_type: 'user',
 *     resource_id: userId,
 *     endpoint: '/api/admin/users/update',
 *     method: 'PATCH',
 *     ip_address: req.headers.get('x-forwarded-for'),
 *     before_data: existingUser,         // optional snapshot
 *     after_data: updatedUser,
 *   });
 *
 * 寫入失敗不阻斷主流程(best effort)
 */

export type AuditAction = "create" | "update" | "delete" | "trigger" | "login" | "logout";

export interface AuditLogEntry {
  actor_email: string;
  actor_role?: string | null;
  action: AuditAction | string;
  resource_type: string;
  resource_id?: string | null;
  endpoint?: string | null;
  method?: string | null;
  ip_address?: string | null;
  before_data?: unknown;
  after_data?: unknown;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    await sb.from("audit_log").insert({
      actor_email: entry.actor_email,
      actor_role: entry.actor_role || null,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id ? String(entry.resource_id).slice(0, 200) : null,
      endpoint: entry.endpoint || null,
      method: entry.method || null,
      ip_address: entry.ip_address ? String(entry.ip_address).slice(0, 100) : null,
      before_data: entry.before_data ?? null,
      after_data: entry.after_data ?? null,
      metadata: entry.metadata || {},
    });
  } catch (err) {
    // best effort — audit log 寫入失敗不該擋主流程
    console.error("[audit-log] write failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * 撈 audit log(供 admin UI 使用)
 */
export interface AuditLogQueryOpts {
  actor_email?: string;
  resource_type?: string;
  action?: string;
  from?: string;        // ISO timestamp
  to?: string;
  limit?: number;
}

export async function queryAuditLog(opts: AuditLogQueryOpts = {}) {
  const sb = getSupabaseAdmin();
  let q = sb.from("audit_log")
    .select("id, actor_email, actor_role, action, resource_type, resource_id, endpoint, method, ip_address, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(opts.limit || 200, 500));

  if (opts.actor_email) q = q.eq("actor_email", opts.actor_email);
  if (opts.resource_type) q = q.eq("resource_type", opts.resource_type);
  if (opts.action) q = q.eq("action", opts.action);
  if (opts.from) q = q.gte("created_at", opts.from);
  if (opts.to) q = q.lte("created_at", opts.to);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
