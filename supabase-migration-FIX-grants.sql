-- ════════════════════════════════════════════════════════════════════════
-- FIX: GRANT 給 service_role / authenticated / anon
-- ════════════════════════════════════════════════════════════════════════
-- Root cause: ALTER TABLE moyu_legacy.X SET SCHEMA public 後,
--             從 moyu_legacy 移過來的 44 tables 沒有自動繼承 public schema 的 default privileges,
--             因此 service_role 連 SELECT 都會回 'permission denied'
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. schema usage ──
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- ── 2. 全部 tables 給 service_role 完整權限(bypass RLS 仍要先有 SELECT/INSERT/etc grant)──
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- ── 3. sequences(SERIAL / id 預設值)──
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

-- ── 4. functions(if any)──
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role, authenticated, anon;

-- ── 5. 未來新增 tables / sequences / functions 也自動授權(default privileges)──
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO postgres, service_role, authenticated, anon;

-- ── 6. 確保 RLS policy 對 service_role 生效(本來 service_role 預設 bypass RLS,
--    但既有「svc」policy 用 USING (true) 也該允許所有 ops)──
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  LOOP
    -- Drop 既有 svc policy(若有)再重建為明確的 FOR ALL TO public USING (true) WITH CHECK (true)
    EXECUTE format('DROP POLICY IF EXISTS "svc" ON public.%I', r.tablename);
    EXECUTE format('CREATE POLICY "svc" ON public.%I FOR ALL USING (true) WITH CHECK (true)', r.tablename);
  END LOOP;
END $$;

-- ── 7. verify ──
SELECT 'users_select_test' AS info, COUNT(*)::TEXT AS val FROM public.users
UNION ALL SELECT 'users_columns', string_agg(column_name, ',' ORDER BY column_name)
                                  FROM information_schema.columns
                                  WHERE table_schema='public' AND table_name='users';
