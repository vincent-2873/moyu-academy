import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialized clients to avoid build-time errors when env vars aren't available

let _client: SupabaseClient | null = null;
let _admin: SupabaseClient | null = null;

/**
 * 分頁 fetch all rows — 繞過 Supabase Postgrest db-max-rows=1000 hard cap
 *
 * Vincent 2026-04-30 反饋 root cause:
 *   - Strategy / ceo-overview 用 .gte('date', monthStart) 想拉幾千 row
 *   - 但 server-side hard cap 1000 row,連 .range(0, 99999) 都擋不了
 *   - 必須 client-side loop pagination
 *
 * 用法 (注意 thunk):
 *   const rows = await fetchAllRows(() => sb.from('sales_metrics_daily')
 *     .select('date, calls, closures').gte('date', monthStart));
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  buildQuery: () => any,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  const MAX_PAGES = 100; // 100 × 1000 = 100k row 上限保護
  for (let page = 0; page < MAX_PAGES; page++) {
    const q = buildQuery().range(from, from + pageSize - 1);
    const { data, error } = await q;
    if (error) {
      console.error('[fetchAllRows] page=' + page + ' error:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// Client-side Supabase client (uses anon key, safe for browser)
export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}

// Server-side Supabase admin client (uses service role key, server/API routes only)
export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _admin;
}

// Backwards-compatible exports
export const supabaseClient = typeof window !== 'undefined' ? getSupabaseClient() : (null as unknown as SupabaseClient);
export const supabaseAdmin = null as unknown as SupabaseClient; // Use getSupabaseAdmin() in API routes
