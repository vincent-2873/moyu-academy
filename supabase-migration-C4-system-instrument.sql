-- C 骨架 #4: 系統可信度 instrument 底層
-- 目的: 每個 cron / API 跑完寫 log -> 後台 8.B「資料新鮮度看板」+「cron 健康度」有資料
-- v2: 用動態 SQL 處理 updated_at vs created_at 不同表

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

-- 2. system_table_freshness(view: 每張重要表的最後更新時間 -> 後台 8.B.1)
-- 動態查欄位: 優先 updated_at, 沒有就 created_at, 都沒就 NULL
DROP VIEW IF EXISTS public.system_table_freshness;
CREATE VIEW public.system_table_freshness AS
SELECT 'users' AS table_name,
       (SELECT MAX(updated_at) FROM public.users) AS last_updated,
       (SELECT COUNT(*) FROM public.users) AS row_count
UNION ALL SELECT 'sales_metrics_daily',
       (SELECT MAX(date::timestamptz) FROM public.sales_metrics_daily),
       (SELECT COUNT(*) FROM public.sales_metrics_daily)
UNION ALL SELECT 'announcements',
       (SELECT MAX(created_at) FROM public.announcements),
       (SELECT COUNT(*) FROM public.announcements)
UNION ALL SELECT 'kpi_entries',
       (SELECT MAX(created_at) FROM public.kpi_entries),
       (SELECT COUNT(*) FROM public.kpi_entries)
UNION ALL SELECT 'recruits',
       (SELECT MAX(created_at) FROM public.recruits),
       (SELECT COUNT(*) FROM public.recruits)
UNION ALL SELECT 'legal_cases',
       (SELECT MAX(created_at) FROM public.legal_cases),
       (SELECT COUNT(*) FROM public.legal_cases)
UNION ALL SELECT 'claude_conversations',
       (SELECT MAX(created_at) FROM public.claude_conversations),
       (SELECT COUNT(*) FROM public.claude_conversations)
UNION ALL SELECT 'v3_commands',
       (SELECT MAX(created_at) FROM public.v3_commands),
       (SELECT COUNT(*) FROM public.v3_commands)
UNION ALL SELECT 'weekly_reports',
       (SELECT MAX(created_at) FROM public.weekly_reports),
       (SELECT COUNT(*) FROM public.weekly_reports);

-- 3. system_cron_health(view: 每個 cron source 過去 24hr 的健康度)
DROP VIEW IF EXISTS public.system_cron_health;
CREATE VIEW public.system_cron_health AS
SELECT
  source,
  COUNT(*) AS runs_24h,
  SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS ok_count,
  SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) AS fail_count,
  SUM(CASE WHEN status = 'noop' THEN 1 ELSE 0 END) AS noop_count,
  MAX(created_at) AS last_run_at,
  ROUND(AVG(duration_ms)) AS avg_duration_ms,
  ROUND(SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS success_rate_pct
FROM public.system_run_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY source
ORDER BY MAX(created_at) DESC;

-- 4. Verify
SELECT 'system_run_log' AS object, COUNT(*)::text AS info FROM public.system_run_log
UNION ALL SELECT 'system_table_freshness rows', COUNT(*)::text FROM public.system_table_freshness
UNION ALL SELECT 'system_cron_health rows', COUNT(*)::text FROM public.system_cron_health;
