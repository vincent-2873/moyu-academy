-- ════════════════════════════════════════════════════════════════════════
-- FIX: public.users 缺欄位 + vincent admin row
-- ════════════════════════════════════════════════════════════════════════
-- Root cause(2026-04-29 後段查 prod /api/login)
--   curl /api/login 回 500 `column users.brand does not exist`
--   master SQL stub `users` table 只 8 欄(id/email/name/password_hash/role/is_active/created_at/updated_at)
--   moyu code 期待 brand / status / line_user_id / line_bound_at / avatar_url / bio / phone /
--                team / department_id / position_id / module_role
--
-- 套用方式:Supabase SQL Editor https://supabase.com/dashboard/project/nqegeidvsflkwllnfink/sql/new
-- 預期結果:auth flow 通,vincent@xuemi.co / 0000 可登 /admin
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. 補缺 columns(idempotent)──
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS line_user_id TEXT,
  ADD COLUMN IF NOT EXISTS line_bound_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS team TEXT,
  ADD COLUMN IF NOT EXISTS department_id UUID,
  ADD COLUMN IF NOT EXISTS position_id UUID,
  ADD COLUMN IF NOT EXISTS module_role TEXT;

-- ── 2. pgcrypto for bcrypt ──
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 3. 既有 admin / vincent rows 補 default value ──
UPDATE public.users
SET status = COALESCE(status, 'active'),
    is_active = COALESCE(is_active, true)
WHERE status IS NULL OR is_active IS NULL;

-- ── 4. UPSERT vincent admin(idempotent)──
INSERT INTO public.users (email, password_hash, role, name, brand, status, is_active, module_role, created_at, updated_at)
VALUES
  ('vincent@xuemi.co',         crypt('0000', gen_salt('bf', 10)), 'super_admin', 'Vincent', 'xuemi',     'active', true, 'super_admin', NOW(), NOW()),
  ('vincent@xplatform.world',  crypt('0000', gen_salt('bf', 10)), 'super_admin', 'Vincent', 'xplatform', 'active', true, 'super_admin', NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role          = EXCLUDED.role,
  name          = EXCLUDED.name,
  brand         = EXCLUDED.brand,
  status        = EXCLUDED.status,
  is_active     = EXCLUDED.is_active,
  module_role   = EXCLUDED.module_role,
  updated_at    = NOW();

-- ── 5. 既有 mock users 補 brand 預設 ──
UPDATE public.users
SET brand = COALESCE(brand, 'xuemi')
WHERE brand IS NULL;

-- ── 6. verify(跑完看 console output)──
SELECT
  'users_count' AS info, COUNT(*)::TEXT AS val FROM public.users
UNION ALL SELECT 'vincent_xuemi_exists',  CASE WHEN EXISTS (SELECT 1 FROM public.users WHERE email='vincent@xuemi.co') THEN 'YES' ELSE 'NO' END
UNION ALL SELECT 'vincent_role',          (SELECT role FROM public.users WHERE email='vincent@xuemi.co')
UNION ALL SELECT 'vincent_pw_len',        (SELECT length(password_hash)::TEXT FROM public.users WHERE email='vincent@xuemi.co')
UNION ALL SELECT 'columns_present',       string_agg(column_name, ',' ORDER BY column_name)
                                          FROM information_schema.columns
                                          WHERE table_schema='public' AND table_name='users'
                                          AND column_name IN ('brand','status','line_user_id','module_role','team','department_id');
