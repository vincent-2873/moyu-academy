-- ============================================================================
-- 業務即時數據管線 Schema
-- 用途：承接 Metabase question 同步進來的每日業務健康指標
--       給 breakthrough-engine / claude-coach / admin 戰況頁面使用
-- ============================================================================

-- 1) 每日每人業務指標快照（每 15 分 upsert 一次）
CREATE TABLE IF NOT EXISTS sales_metrics_daily (
  date                  DATE NOT NULL,
  salesperson_id        TEXT NOT NULL,
  brand                 TEXT NOT NULL,         -- nschool / xuemi / ooschool / aischool / ...
  team                  TEXT,                  -- 'Alan組台中(財經)' 等
  org                   TEXT,                  -- 台北台中財經 / 職能 / 實體
  name                  TEXT,
  email                 TEXT,
  level                 TEXT,                  -- 新人 / 正式 / 老將 / null
  calls                 INT NOT NULL DEFAULT 0,    -- 通次
  call_minutes          NUMERIC NOT NULL DEFAULT 0,-- 通時（分鐘）
  connected             INT NOT NULL DEFAULT 0,    -- 接通數
  raw_appointments      INT NOT NULL DEFAULT 0,    -- 原始邀約
  appointments_show     INT NOT NULL DEFAULT 0,    -- 邀約出席
  raw_no_show           INT NOT NULL DEFAULT 0,    -- 原始未出席
  raw_demos             INT NOT NULL DEFAULT 0,    -- 原始 DEMO
  demo_failed           INT NOT NULL DEFAULT 0,    -- DEMO 失敗
  closures              INT NOT NULL DEFAULT 0,    -- 分潤成交
  net_closures_daily    INT NOT NULL DEFAULT 0,    -- 按日期分潤淨成交
  net_closures_contract INT NOT NULL DEFAULT 0,    -- 按合約分潤淨成交
  gross_revenue         NUMERIC NOT NULL DEFAULT 0,-- 分潤承攬業績
  net_revenue_daily     NUMERIC NOT NULL DEFAULT 0,-- 按日期分潤淨承攬業績
  net_revenue_contract  NUMERIC NOT NULL DEFAULT 0,-- 按合約分潤淨承攬業績
  raw                   JSONB,                     -- 原始 row 備份（欄位變動時可 fallback）
  last_synced_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date, salesperson_id)
);

CREATE INDEX IF NOT EXISTS idx_sales_metrics_brand_date ON sales_metrics_daily(brand, date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_metrics_team_date ON sales_metrics_daily(team, date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_metrics_email_date ON sales_metrics_daily(email, date DESC);

ALTER TABLE sales_metrics_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_sales_metrics_daily" ON sales_metrics_daily;
CREATE POLICY "service_role_all_sales_metrics_daily" ON sales_metrics_daily
  FOR ALL USING (auth.role() = 'service_role');

-- 2) KPI 目標（每個 brand × level × period × metric）
CREATE TABLE IF NOT EXISTS sales_metrics_targets (
  brand       TEXT NOT NULL,
  level       TEXT NOT NULL DEFAULT 'default',  -- 新人 / 正式 / 老將 / default
  period      TEXT NOT NULL,                    -- daily / weekly / monthly
  metric      TEXT NOT NULL,                    -- calls / connected / raw_appointments / appointments_show / closures / net_revenue_daily
  target      NUMERIC NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (brand, level, period, metric)
);

ALTER TABLE sales_metrics_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_sales_metrics_targets" ON sales_metrics_targets;
CREATE POLICY "service_role_all_sales_metrics_targets" ON sales_metrics_targets
  FOR ALL USING (auth.role() = 'service_role');

-- 3) Metabase 資料來源設定（每個 brand 對應一個 question id）
CREATE TABLE IF NOT EXISTS metabase_sources (
  brand            TEXT PRIMARY KEY,
  question_id      INT NOT NULL,
  question_name    TEXT,
  enabled          BOOLEAN NOT NULL DEFAULT true,
  last_sync_at     TIMESTAMPTZ,
  last_sync_rows   INT,
  last_sync_status TEXT,
  last_sync_error  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE metabase_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_metabase_sources" ON metabase_sources;
CREATE POLICY "service_role_all_metabase_sources" ON metabase_sources
  FOR ALL USING (auth.role() = 'service_role');

-- 4) 同步歷史（每次 cron / 手動 / 出錯都留軌跡）
CREATE TABLE IF NOT EXISTS metabase_sync_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand       TEXT,
  question_id INT,
  trigger     TEXT,   -- 'cron' / 'manual' / 'retry'
  run_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  rows        INT,
  duration_ms INT,
  status      TEXT CHECK (status IN ('success','partial','failed')),
  error       TEXT
);

CREATE INDEX IF NOT EXISTS idx_metabase_sync_log_run_at ON metabase_sync_log(run_at DESC);
CREATE INDEX IF NOT EXISTS idx_metabase_sync_log_brand ON metabase_sync_log(brand, run_at DESC);

ALTER TABLE metabase_sync_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_metabase_sync_log" ON metabase_sync_log;
CREATE POLICY "service_role_all_metabase_sync_log" ON metabase_sync_log
  FOR ALL USING (auth.role() = 'service_role');

-- 5) 系統 key-value（存 metabase session token 之類的長效 secret）
CREATE TABLE IF NOT EXISTS system_secrets (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  expires_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE system_secrets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_system_secrets" ON system_secrets;
CREATE POLICY "service_role_all_system_secrets" ON system_secrets
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 預設資料：從今天抓到的 Metabase question 1381 先塞一筆 source
-- ============================================================================
INSERT INTO metabase_sources (brand, question_id, question_name)
VALUES ('nschool', 1381, '業務健康指標總表 - 延平/民權團隊(財經/職能)')
ON CONFLICT (brand) DO NOTHING;

-- 預設 KPI target — 先給 nschool 一組 baseline，之後用戶可以覆蓋
INSERT INTO sales_metrics_targets (brand, level, period, metric, target) VALUES
  ('nschool', 'default', 'daily', 'calls', 100),
  ('nschool', 'default', 'daily', 'connected', 50),
  ('nschool', 'default', 'daily', 'raw_appointments', 2),
  ('nschool', 'default', 'weekly', 'calls', 500),
  ('nschool', 'default', 'weekly', 'raw_appointments', 10),
  ('nschool', 'default', 'weekly', 'closures', 1),
  ('nschool', 'default', 'monthly', 'calls', 2000),
  ('nschool', 'default', 'monthly', 'closures', 4),
  ('nschool', '新人', 'daily', 'calls', 80),
  ('nschool', '新人', 'weekly', 'calls', 400)
ON CONFLICT (brand, level, period, metric) DO NOTHING;

NOTIFY pgrst, 'reload schema';
