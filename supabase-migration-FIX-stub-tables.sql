-- ════════════════════════════════════════════════════════════════════════
-- FIX: 補 27 個 code 引用但 DB 沒有的 stub tables
-- ════════════════════════════════════════════════════════════════════════
-- 寬欄位設計,避免 'column X does not exist' 錯。等 Wave 2 接真資料時 ALTER 加欄位即可。
-- 全部 ENABLE RLS + svc policy,確保 service_role bypass。
-- ════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── helper: stub creator(寬 schema)──
DO $$
DECLARE
  t_name TEXT;
  tables TEXT[] := ARRAY[
    'announcements',
    'approvals',
    'breakthrough_log',
    'hr_training_days',
    'hr_training_tasks',
    'human_state_checkin',
    'kpi_entries',
    'legal_compliance',
    'legal_contracts',
    'legal_disputes',
    'legal_ip',
    'mentor_messages',
    'mentor_pairs',
    'module_overrides',
    'notifications',
    'quiz_attempts',
    'quiz_scores',
    'recordings',
    'recruit_events',
    'sparring_records',
    'system_settings',
    'user_activity',
    'user_progress',
    'video_watch_progress',
    'videos',
    'weekly_reports',
    'xplatform_brands'
  ];
BEGIN
  FOREACH t_name IN ARRAY tables
  LOOP
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS public.%I (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        user_email TEXT,
        email TEXT,
        brand TEXT,
        name TEXT,
        title TEXT,
        description TEXT,
        content TEXT,
        message TEXT,
        status TEXT DEFAULT ''active'',
        type TEXT,
        category TEXT,
        score NUMERIC,
        score_pct NUMERIC,
        score_breakdown JSONB,
        feedback TEXT,
        priority TEXT DEFAULT ''normal'',
        is_active BOOLEAN DEFAULT TRUE,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMPTZ,
        scheduled_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        date DATE,
        period_start DATE,
        period_end DATE,
        target NUMERIC,
        actual NUMERIC,
        notes TEXT,
        tags TEXT[],
        created_by TEXT,
        owner TEXT,
        recipient_email TEXT,
        manager_email TEXT,
        team TEXT,
        role TEXT,
        meta JSONB DEFAULT ''{}''::jsonb,
        data JSONB DEFAULT ''{}''::jsonb,
        config JSONB DEFAULT ''{}''::jsonb,
        payload JSONB DEFAULT ''{}''::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )', t_name);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t_name);
    EXECUTE format('DROP POLICY IF EXISTS "svc" ON public.%I', t_name);
    EXECUTE format('CREATE POLICY "svc" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t_name);
  END LOOP;
END $$;

-- ── grants ──
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- ── seed minimal data 給 mock(避免空陣列頁面崩)──

-- announcements: 1 row 用於頁首跑馬燈
INSERT INTO public.announcements (title, content, type, status, is_active, created_at)
VALUES ('🎉 新版整合上線', '墨宇戰情中樞 Z 路線整合 Day 1 — 新訓 / 業務 / 招聘 / 法務 4 戰線同步運作', 'system', 'active', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- system_settings: 1 row(generic settings table)
INSERT INTO public.system_settings (name, type, status, data, is_active)
VALUES ('moyu-config', 'system', 'active', '{"app_name":"墨宇戰情中樞","version":"2.0.0"}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

-- xplatform_brands: 6 brands (hq / nschool / xuemi / ooschool / aischool / moyuhunt)
INSERT INTO public.xplatform_brands (name, title, description, type, status, is_active)
VALUES
  ('hq',       '總部 HQ',          'X Platform 集團總部',                    'brand', 'active', true),
  ('nschool',  'N 學院',           '創業 / 業務 訓練品牌',                   'brand', 'active', true),
  ('xuemi',    '墨宇',             '招募 / 訓練 / 業務 主品牌',             'brand', 'active', true),
  ('ooschool', 'OO 學苑',          '營銷 / 內容 訓練品牌',                   'brand', 'active', true),
  ('aischool', 'AI 學苑',          'AI 訓練 / Prompt 工程',                  'brand', 'active', true),
  ('moyuhunt', '墨宇獵頭',         '獵頭 / 招聘服務',                         'brand', 'active', true)
ON CONFLICT (id) DO NOTHING;

-- mentor_pairs: 1 row(vincent self-mentor)
INSERT INTO public.mentor_pairs (user_email, name, type, status, meta, is_active)
VALUES ('vincent@xuemi.co', 'Vincent self-mentor', 'self', 'active',
        '{"mentor_email":"vincent@xuemi.co","mentee_email":"vincent@xuemi.co"}'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

-- videos: 3 stub video entries
INSERT INTO public.videos (title, description, brand, status, is_active, type, data)
VALUES
  ('歡迎影片', '新人加入第一支必看影片', 'xuemi', 'active', true, 'onboarding', '{"duration_sec":180,"url":"#"}'::jsonb),
  ('業務基本心法',     '業務員 SOP 速通', 'xuemi', 'active', true, 'training', '{"duration_sec":420,"url":"#"}'::jsonb),
  ('客戶疑難雜症 FAQ', '常見客戶提問解答', 'xuemi', 'active', true, 'training', '{"duration_sec":600,"url":"#"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- approvals: 0 rows(空 list 即可)
-- module_overrides: 0 rows
-- notifications: 0 rows(每使用者用 user_email scope)
-- 其他 stub tables 留空(ON DEMAND 才 INSERT)

-- ── verify ──
SELECT 'tables_count' AS info, COUNT(*)::TEXT AS val FROM information_schema.tables WHERE table_schema='public'
UNION ALL SELECT 'announcements', COUNT(*)::TEXT FROM public.announcements
UNION ALL SELECT 'xplatform_brands', COUNT(*)::TEXT FROM public.xplatform_brands
UNION ALL SELECT 'videos', COUNT(*)::TEXT FROM public.videos
UNION ALL SELECT 'system_settings', COUNT(*)::TEXT FROM public.system_settings
UNION ALL SELECT 'mentor_pairs', COUNT(*)::TEXT FROM public.mentor_pairs;
