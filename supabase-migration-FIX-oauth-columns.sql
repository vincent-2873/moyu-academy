-- ════════════════════════════════════════════════════════════════════════
-- FIX: users 加 OAuth 欄位 + metabase_sources 補實作所需欄位
-- ════════════════════════════════════════════════════════════════════════

-- ── users OAuth columns ──
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS google_id TEXT,
  ADD COLUMN IF NOT EXISTS google_email TEXT,
  ADD COLUMN IF NOT EXISTS discord_id TEXT,
  ADD COLUMN IF NOT EXISTS discord_username TEXT;

CREATE INDEX IF NOT EXISTS users_google_id_idx ON public.users (google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_discord_id_idx ON public.users (discord_id) WHERE discord_id IS NOT NULL;

-- ── metabase_sources columns(實作需要)──
ALTER TABLE public.metabase_sources
  ADD COLUMN IF NOT EXISTS question_id INTEGER,
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_status TEXT,
  ADD COLUMN IF NOT EXISTS last_sync_rows INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

-- metabase_sync_log columns
ALTER TABLE public.metabase_sync_log
  ADD COLUMN IF NOT EXISTS trigger TEXT,
  ADD COLUMN IF NOT EXISTS rows INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS error TEXT;

-- ── 加 6 個新角色 enum-like(只是文字 column 限制,不用建 enum)──
-- 將既有 super_admin / ceo / coo / cfo / director / brand_manager 等保留
-- 新增 sales_manager / recruit_manager / legal_manager / sales_rookie / recruit_rookie / legal_staff
-- 不需要 ALTER schema 因為 role 是 TEXT,只是後續 code 要支援即可

-- ── verify ──
SELECT 'users_oauth_cols' AS info,
  string_agg(column_name, ',' ORDER BY column_name) AS val
FROM information_schema.columns
WHERE table_schema='public' AND table_name='users'
  AND column_name IN ('google_id','google_email','discord_id','discord_username','avatar_url')
UNION ALL SELECT 'metabase_sources_cols',
  string_agg(column_name, ',' ORDER BY column_name)
FROM information_schema.columns
WHERE table_schema='public' AND table_name='metabase_sources'
  AND column_name IN ('question_id','enabled','last_sync_at','last_sync_status');
