-- D7: kpi_targets 表 + 預設 KPI 標準
-- 員工每月應達 metric 標準, 可隨品牌 / 階段差異化

CREATE TABLE IF NOT EXISTS public.kpi_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  metric text NOT NULL,                         -- calls / call_minutes / connected / raw_appointments / closures / net_revenue_daily
  target_value numeric NOT NULL,
  period text NOT NULL DEFAULT 'daily' CHECK (period IN ('daily', 'weekly', 'monthly')),
  applies_to_role text,                          -- sales_rookie / sales_rep / sales_manager / NULL=all
  applies_to_stage text,                         -- beginner / intermediate / advanced / master / NULL=all
  applies_to_brand text,
  weight int DEFAULT 1,                          -- 加權, 算總分用
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kpi_targets_active ON public.kpi_targets(is_active) WHERE is_active = true;

-- Seed 預設(以 Yu LINE 群「撥多少→通次→通時→邀約→出席→成交」漏斗為準)
INSERT INTO public.kpi_targets (name, metric, target_value, period, applies_to_stage, weight) VALUES
  ('新人 每日撥打',          'calls',              120,     'daily',  'beginner',     2),
  ('新人 每日通時',          'call_minutes',       180,     'daily',  'beginner',     2),
  ('新人 每日邀約',          'raw_appointments',   3,       'daily',  'beginner',     3),
  ('進階 每日成交',          'closures',           1,       'daily',  'intermediate', 5),
  ('進階 每月營收',          'net_revenue_daily',  100000,  'monthly','intermediate', 4),
  ('精熟 每月成交',          'closures',           5,       'monthly','advanced',     5),
  ('精熟 每月營收',          'net_revenue_daily',  300000,  'monthly','advanced',     4),
  ('講師 每月成交',          'closures',           8,       'monthly','master',       3),
  ('講師 每月營收',          'net_revenue_daily',  500000,  'monthly','master',       3)
ON CONFLICT DO NOTHING;

SELECT name, metric, target_value, period, applies_to_stage, weight FROM public.kpi_targets ORDER BY applies_to_stage, period, name;
