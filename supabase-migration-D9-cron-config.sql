-- D9: cron_config 表 (17 個 cron 啟用/排程 toggle)
CREATE TABLE IF NOT EXISTS public.cron_config (
  code text PRIMARY KEY,
  is_enabled boolean DEFAULT true,
  schedule text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Verify
SELECT 'cron_config' AS info, COUNT(*)::text AS val FROM public.cron_config;
