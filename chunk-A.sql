-- ============================================================================
-- moyu-academy 17 migrations 整合到 huance-copilot Supabase
-- 目標 project: nqegeidvsflkwllnfink (huance 既有,Sprint 1 §3 中段轉向 Z 路線)
-- 2026-04-29 PHASE 3
-- ============================================================================
-- 策略:
-- 1. CREATE SCHEMA moyu_legacy (隔離,不衝突 huance 7 namespace)
-- 2. SET search_path = moyu_legacy, public (後續 CREATE 自動進 moyu_legacy)
-- 3. Pre-create 7 個 base tables (17 sql 假設存在但沒 create 的)
-- 4. 17 sql 內容 verbatim append (CREATE TABLE / ALTER 全進 moyu_legacy)
-- 5. Final NOTIFY pgrst reload schema
--
-- huance 既有 7 namespace + task_queue + 8 wrapper 不動,完全並存隔離
-- ============================================================================

-- ── 1. moyu_legacy schema ──
CREATE SCHEMA IF NOT EXISTS moyu_legacy;
SET search_path = moyu_legacy, public;

-- ── 2. Pre-create 7 base tables (17 sql 假設存在的 stub) ──
CREATE TABLE IF NOT EXISTS moyu_legacy.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  name TEXT,
  password_hash TEXT,
  role TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE moyu_legacy.users ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "svc" ON moyu_legacy.users FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS moyu_legacy.recruits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT,
  phone TEXT,
  status TEXT DEFAULT 'pending',
  brand TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE moyu_legacy.recruits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "svc" ON moyu_legacy.recruits FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS moyu_legacy.signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT,
  payload JSONB,
  severity TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE moyu_legacy.signals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "svc" ON moyu_legacy.signals FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS moyu_legacy.ai_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT,
  level TEXT DEFAULT 'info',
  recipient_email TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE moyu_legacy.ai_notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "svc" ON moyu_legacy.ai_notifications FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS moyu_legacy.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  content TEXT,
  author_email TEXT,
  category TEXT,
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE moyu_legacy.articles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "svc" ON moyu_legacy.articles FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS moyu_legacy.line_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT,
  recipient_line_user_id TEXT,
  message TEXT,
  result TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE moyu_legacy.line_notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "svc" ON moyu_legacy.line_notifications FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS moyu_legacy.daily_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT,
  options JSONB,
  correct_answer TEXT,
  brand TEXT,
  active_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE moyu_legacy.daily_quizzes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "svc" ON moyu_legacy.daily_quizzes FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS moyu_legacy.hr_training_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_email TEXT,
  task_id TEXT,
  status TEXT DEFAULT 'pending',
  score INT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE moyu_legacy.hr_training_progress ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "svc" ON moyu_legacy.hr_training_progress FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. 17 sql verbatim append (search_path = moyu_legacy 已 set,所有 unprefixed tables 進 moyu_legacy) ──


-- ============================================================
-- BLOCK: claude.sql
-- ============================================================
-- ============================================
-- Claude AI 自動化系統表 (2026-04-09)
-- 用法：複製整段，貼到 Supabase Dashboard > SQL Editor > Run
-- ============================================

-- Claude 指派任務表 (Claude → User 任務佇列)
CREATE TABLE IF NOT EXISTS claude_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('setup', 'data', 'decision', 'fix', 'review')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('critical', 'high', 'normal', 'low')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled', 'blocked')),
  why TEXT,
  expected_input TEXT,
  blocked_features JSONB DEFAULT '[]'::jsonb,
  assigned_to TEXT DEFAULT 'user',
  created_by TEXT DEFAULT 'claude',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  done_at TIMESTAMPTZ,
  user_response TEXT
);

CREATE INDEX IF NOT EXISTS idx_claude_tasks_status ON claude_tasks(status);
CREATE INDEX IF NOT EXISTS idx_claude_tasks_priority ON claude_tasks(priority);

ALTER TABLE claude_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_claude_tasks" ON claude_tasks;
CREATE POLICY "service_role_all_claude_tasks" ON claude_tasks FOR ALL USING (true) WITH CHECK (true);

-- Claude 自動行動日誌
CREATE TABLE IF NOT EXISTS claude_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL,
  target TEXT,
  summary TEXT NOT NULL,
  details JSONB,
  result TEXT CHECK (result IN ('success', 'partial', 'failed', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claude_actions_created ON claude_actions(created_at DESC);

ALTER TABLE claude_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_claude_actions" ON claude_actions;
CREATE POLICY "service_role_all_claude_actions" ON claude_actions FOR ALL USING (true) WITH CHECK (true);

-- 業務健康度警示
CREATE TABLE IF NOT EXISTS health_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_email TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  message TEXT NOT NULL,
  metric_snapshot JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_alerts_user ON health_alerts(user_email);
CREATE INDEX IF NOT EXISTS idx_health_alerts_resolved ON health_alerts(resolved);

ALTER TABLE health_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_health_alerts" ON health_alerts;
CREATE POLICY "service_role_all_health_alerts" ON health_alerts FOR ALL USING (true) WITH CHECK (true);

-- 強制 PostgREST 重新載入 schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- BLOCK: line.sql
-- ============================================================
-- ============================================
-- LINE 通知系統：墨宇小精靈（墨宇戰情中樞專用）
-- 用途：
--   1. 用戶註冊後綁定 LINE userId（emails ↔ line_user_id）
--   2. Claude 推播緊急代辦時可以指名用戶
--   3. 系統卡住時自動推播警報給管理者
-- ============================================

-- 1. users 表加上 line 綁定欄位
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS line_user_id TEXT,
  ADD COLUMN IF NOT EXISTS line_bound_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON users(line_user_id) WHERE line_user_id IS NOT NULL;

-- 2. 待綁定碼表（註冊時產生 6 位代碼，用戶在 LINE 輸入後完成綁定）
CREATE TABLE IF NOT EXISTS line_bindings (
  code TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  used_at TIMESTAMPTZ,
  used_by_line_user_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_line_bindings_email ON line_bindings(email);
CREATE INDEX IF NOT EXISTS idx_line_bindings_expires ON line_bindings(expires_at);

-- 3. LINE 推播紀錄表（每一次推播都留軌跡）
CREATE TABLE IF NOT EXISTS line_push_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT,
  user_email TEXT,
  title TEXT,
  body TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('critical','high','normal','low')),
  reason TEXT,                       -- 為什麼推播（blocked / task / alert / system）
  result TEXT CHECK (result IN ('success','failed','stub')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_push_log_user ON line_push_log(line_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_line_push_log_email ON line_push_log(user_email, created_at DESC);

-- 4. RLS：service_role 全權限
ALTER TABLE line_bindings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON line_bindings;
CREATE POLICY "service_role_all" ON line_bindings FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE line_push_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON line_push_log;
CREATE POLICY "service_role_all" ON line_push_log FOR ALL USING (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- BLOCK: line-ask.sql
-- ============================================================
-- LINE 為唯一介面 — Claude 卡點主動推播 + 從 LINE 回覆 unblock
--
-- 新增兩個欄位 + 擴充 status CHECK 約束，讓 claude_tasks 可以承載
-- 「我正在等 Vincent 從 LINE 回字」這個狀態。
--
-- 安全：IF NOT EXISTS / DROP CONSTRAINT IF EXISTS，可以重跑多次。

-- 1) 新增 channel 欄位 — 'internal' (default) / 'line' / 'dashboard' / 'email'
ALTER TABLE claude_tasks
  ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'internal';

-- 2) 新增 awaiting_reply_at — Claude 發出問題並開始等回覆的時間
ALTER TABLE claude_tasks
  ADD COLUMN IF NOT EXISTS awaiting_reply_at TIMESTAMPTZ;

-- 3) 擴充 status CHECK，加入 'awaiting_line_reply'
ALTER TABLE claude_tasks DROP CONSTRAINT IF EXISTS claude_tasks_status_check;
ALTER TABLE claude_tasks ADD CONSTRAINT claude_tasks_status_check
  CHECK (status IN ('pending','in_progress','done','cancelled','blocked','awaiting_line_reply'));

-- 4) 查詢 index — 只索引 awaiting 任務，讓 webhook match 最新任務很快
CREATE INDEX IF NOT EXISTS idx_claude_tasks_awaiting_line
  ON claude_tasks (awaiting_reply_at DESC)
  WHERE status = 'awaiting_line_reply';

-- ============================================================
-- BLOCK: sales-metrics.sql
-- ============================================================
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

-- ============================================================
-- BLOCK: sales-alert-rules.sql
-- ============================================================
-- ============================================================================
-- 動態 KPI 警報規則：依「今日出席數」決定活動量下限
-- ============================================================================
-- Vincent 的規則結構：
--   0 出席 → 必須打滿 130-160 通、100-150 分鐘、邀約 4-5 個
--   1 出席 → 必須打滿 100-140 通、100-120 分鐘、邀約 3-4 個
--   2+ 出席 → 最低 80 通、60 分鐘、1-2 邀約
-- 條件基礎：appointments_show （今日出席數）
-- ============================================================================

CREATE TABLE IF NOT EXISTS sales_alert_rules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand          TEXT NOT NULL,                     -- 'nschool' / 'xuemi' / 'ooschool' / 'xlab' / 'aischool' / 'all'
  level          TEXT NOT NULL DEFAULT 'default',   -- '新人' / '正式' / 'default'
  name           TEXT NOT NULL,                     -- 規則名稱
  -- 觸發條件（必須所有 condition 都成立才套用此規則的 min 門檻）
  cond_attend_min INT,                              -- 出席數下限（含），null = 不限
  cond_attend_max INT,                              -- 出席數上限（含），null = 不限
  -- 最低門檻（任一項未達標即觸發警報）
  min_calls            INT,
  min_call_minutes     NUMERIC,
  min_appointments     INT,
  -- 預設建議門檻（高於 min，但未達 rec 算 "low"）
  rec_calls            INT,
  rec_call_minutes     NUMERIC,
  rec_appointments     INT,
  severity       TEXT NOT NULL DEFAULT 'high',      -- high / critical / medium
  enabled        BOOLEAN NOT NULL DEFAULT true,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_alert_rules_brand ON sales_alert_rules(brand, enabled);

ALTER TABLE sales_alert_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_sales_alert_rules" ON sales_alert_rules;
CREATE POLICY "service_role_all_sales_alert_rules" ON sales_alert_rules
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 加上 4 個新 brand 進 metabase_sources（question_id 先放 0 = 未設定，enabled=false）
-- ============================================================================
INSERT INTO metabase_sources (brand, question_id, question_name, enabled)
VALUES
  ('xuemi',    0, 'XUEMI 學米 — 待填 question id',      false),
  ('ooschool', 0, 'Ooschool 無限學院 — 待填 question id', false),
  ('xlab',     0, 'XLAB AI 實驗室 — 待填 question id',    false),
  ('aischool', 0, 'AI 未來學院 — 待填 question id',        false)
ON CONFLICT (brand) DO NOTHING;

-- ============================================================================
-- Seed Vincent 的 3 階動態規則（brand='all' 代表 5 個品牌通用）
-- 之後用戶可以在後台為特定 brand 覆蓋
-- ============================================================================

-- Tier 1：今天 0 出席 → 活動量必須爆量彌補
INSERT INTO sales_alert_rules (
  brand, level, name,
  cond_attend_min, cond_attend_max,
  min_calls, min_call_minutes, min_appointments,
  rec_calls, rec_call_minutes, rec_appointments,
  severity, notes
) VALUES (
  'all', 'default', '0 出席 · 爆量補救',
  0, 0,
  130, 100, 4,
  160, 150, 5,
  'critical',
  '今天 0 人出席 → 必須打滿 130 通 / 100 分鐘 / 4 邀約，未達即 critical'
) ON CONFLICT DO NOTHING;

-- Tier 2：今天 1 出席 → 中度活動量
INSERT INTO sales_alert_rules (
  brand, level, name,
  cond_attend_min, cond_attend_max,
  min_calls, min_call_minutes, min_appointments,
  rec_calls, rec_call_minutes, rec_appointments,
  severity, notes
) VALUES (
  'all', 'default', '1 出席 · 中度活動',
  1, 1,
  100, 100, 3,
  140, 120, 4,
  'high',
  '今天 1 人出席 → 必須打滿 100 通 / 100 分鐘 / 3 邀約'
) ON CONFLICT DO NOTHING;

-- Tier 3：今天 2+ 出席 → 維持底線即可
INSERT INTO sales_alert_rules (
  brand, level, name,
  cond_attend_min, cond_attend_max,
  min_calls, min_call_minutes, min_appointments,
  rec_calls, rec_call_minutes, rec_appointments,
  severity, notes
) VALUES (
  'all', 'default', '2+ 出席 · 底線維持',
  2, NULL,
  80, 60, 1,
  120, 100, 2,
  'medium',
  '今天 2+ 人出席 → 即使有成交還是要維持 80 通 / 60 分鐘 / 1 邀約底線'
) ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- BLOCK: sales-brand-alias.sql
-- ============================================================
-- Backfill brand aliases for historical sales_metrics_daily rows
-- sixdigital → ooschool  /  xlab → aischool
-- 之前匯入時這些資料可能還用舊品牌名，造成 brandCompare 重複
UPDATE sales_metrics_daily SET brand = 'ooschool' WHERE brand = 'sixdigital';
UPDATE sales_metrics_daily SET brand = 'aischool' WHERE brand = 'xlab';

