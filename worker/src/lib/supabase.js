const { createClient } = require('@supabase/supabase-js');

let client = null;

function getSupabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  // SERVICE_ROLE_KEY 優先(bypass RLS),沒設則 fallback 用 anon key
  // (svc RLS policy 允許 anon ALL ops via USING(true) WITH CHECK(true) — 已 deploy)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL + (SERVICE_ROLE_KEY 或 ANON_KEY) required');
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

module.exports = { getSupabase };
