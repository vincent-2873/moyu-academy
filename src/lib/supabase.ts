import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client-side Supabase client (uses anon key, safe for browser)
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase admin client (uses service role key, server/API routes only)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
