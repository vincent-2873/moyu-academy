-- ════════════════════════════════════════════════════════════════════════
-- FIX: seed metabase_sources for Metabase Q1381(業務即時數據)
-- ════════════════════════════════════════════════════════════════════════
-- Vincent 指定 Metabase question 1381 = 業務即時數據(每 15 min 同步)
-- 一個 question 內含全 brand 資料,normaliseRow 會用 app_id 分流
-- 但 syncBrand 設計上 per brand 1 row,先只 enable xuemi(主要 brand)
-- 其他 brand 等需要時再加(可在 admin UI 控制)
-- ════════════════════════════════════════════════════════════════════════

-- metabase_sources stub schema 較 narrow,先確保必要 columns 存在
ALTER TABLE public.metabase_sources
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'metabase';

INSERT INTO public.metabase_sources (brand, question_id, enabled, name, description, status, type)
VALUES
  ('xuemi',     1381, true,  'metabase_q1381_xuemi',     '業務即時數據 Q1381(墨宇)',         'active', 'metabase'),
  ('nschool',   1381, false, 'metabase_q1381_nschool',   '業務即時數據 Q1381(N 學苑)',       'active', 'metabase'),
  ('ooschool',  1381, false, 'metabase_q1381_ooschool',  '業務即時數據 Q1381(OO 學苑)',      'active', 'metabase'),
  ('aischool',  1381, false, 'metabase_q1381_aischool',  '業務即時數據 Q1381(AI 未來)',      'active', 'metabase'),
  ('moyuhunt',  1381, false, 'metabase_q1381_moyuhunt',  '業務即時數據 Q1381(墨宇獵頭)',     'active', 'metabase'),
  ('hq',        1381, false, 'metabase_q1381_hq',        '業務即時數據 Q1381(集團 HQ)',      'active', 'metabase')
ON CONFLICT DO NOTHING;

-- verify
SELECT 'metabase_sources_count' AS info, COUNT(*)::TEXT AS val FROM public.metabase_sources
UNION ALL SELECT 'enabled_brands',
  string_agg(brand, ',' ORDER BY brand) FROM public.metabase_sources WHERE enabled = true;
