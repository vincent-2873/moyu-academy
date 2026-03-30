import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialized clients to avoid build-time errors when env vars aren't available

let _client: SupabaseClient | null = null;
let _admin: SupabaseClient | null = null;

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
