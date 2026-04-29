-- C 骨架 #4: 系統可信度 instrument 底層
-- 目的: 每個 cron / API 跑完寫 log -> 後台 8.B「資料新鮮度看板」+「cron 健康度」有資料

-- 1. system_run_log(每個 cron / 重要 API 跑完寫一行)
CREATE TABLE IF NOT EXISTS public.system_run_log (
  id bigserial PRIMARY KEY,
  source text NOT NULL,                       -- 'cron:metabase-sync' / 'api:/api/admin/auth' / 'worker:metabase-sync'
  status text NOT NULL CHECK (status IN ('ok', 'partial', 'fail', 'noop')),
  rows_in int DEFAULT 0,                       -- 進來幾筆
  rows_out int DEFAULT 0,                      -- 寫出去幾筆
  duration_ms int,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_run_log_source_created ON public.system_run_log(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_run_log_status_created ON public.system_run_log(status, created_at DESC);

-- 2. system_table_freshness(每張重要表的最後更新時間 -> 後台 8.B.1)
-- 注意: 用 view 動態算, 不用 cron 維護
CREATE OR REPLACE VIEW public.system_table_freshness AS
SELECT 'users' AS table_name, MAX(updated_at) AS last_updated, COUNT(*) AS row_count FROM public.users
UNION ALL SELECT 'sales_metrics_daily', MAX(updated_at), COUNT(*) FROM public.sales_metrics_daily
UNION ALL SELECT 'announcements', MAX(updated_at), COUNT(*) FROM public.announcements
UNION ALL SELECT 'kpi_entries', MAX(updated_at), COUNT(*) FROM public.kpi_entries
UNION ALL SELECT 'recruits', MAX(updated_at), COUNT(*) FROM public.recruits
UNION ALL SELECT 'legal_cases', MAX(updated_at), COUNT(*) FROM public.legal_cases
UNION ALL SELECT 'claude_conversations', MAX(created_at), COUNT(*) FROM public.claude_conversations
UNION ALL SELECT 'v3_commands', MAX(updated_at), COUNT(*) FROM public.v3_commands
UNION ALL SELECT 'weekly_reports', MAX(updated_at), COUNT(*) FROM public.weekly_reports;

-- 3. system_cron_health(view: 每個 cron source 過去 24hr 的健康度)
CREATE OR REPLACE VIEW public.system_cron_health AS
SELECT
  source,
  COUNT(*) AS runs_24h,
  SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS ok_count,
  SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) AS fail_count,
  SUM(CASE WHEN status = 'noop' THEN 1 ELSE 0 END) AS noop_count,
  MAX(created_at) AS last_run_at,
  ROUND(AVG(duration_ms)) AS avg_duration_ms,
  ROUND(SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100, 1) AS success_rate_pct
FROM public.system_run_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY source
ORDER BY MAX(created_at) DESC;

-- 4. Verify schema
SELECT
  'system_run_log' AS object,
  COUNT(*) AS rows
FROM public.system_run_log
UNION ALL
SELECT 'system_table_freshness (view)', COUNT(*) FROM public.system_table_freshness
UNION ALL
SELECT 'system_cron_health (view)', COUNT(*) FROM public.system_cron_health;
