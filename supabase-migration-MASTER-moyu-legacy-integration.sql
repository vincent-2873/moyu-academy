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

-- ============================================================
-- BLOCK: legal-v2.sql
-- ============================================================
-- ============================================================
-- 法務系統 v2: 統一案件管理（根據 OneDrive 行政法務 5 年資料設計）
-- ============================================================
-- 涵蓋 6 大工作流：消費爭議 / 民事訴訟 / 強制執行 / 刑事 / 勞動爭議 / 合約管理
-- 設計原則：
--   1. 一案（case）一 row，多文件/多時間點靠子表
--   2. 品牌代碼固定：米/科/希/無限/言（不用自由文字）
--   3. 承辦人(owner_email)+審閱人(reviewer_email)綁 users 表
--   4. RLS service_role 全開（與 sales_metrics_daily 一致）
-- ============================================================

-- 品牌代碼列舉（5 家公司）
CREATE TABLE IF NOT EXISTS legal_brands (
  code TEXT PRIMARY KEY,                  -- 米/科/希/無限/言
  company_name TEXT NOT NULL,             -- 學米/科技學/希克斯/無限學/匠言
  tax_id TEXT,
  display_order INT DEFAULT 0
);

INSERT INTO legal_brands (code, company_name, display_order) VALUES
  ('米', '學米股份有限公司', 1),
  ('科', '科技學股份有限公司', 2),
  ('希', '希克斯股份有限公司', 3),
  ('無限', '無限學股份有限公司', 4),
  ('言', '匠言股份有限公司', 5)
ON CONFLICT (code) DO NOTHING;

-- 當事人（消費者/員工/原告/被告/債務人/講師/經銷商）
CREATE TABLE IF NOT EXISTS legal_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT,                              -- consumer / staff / plaintiff / defendant / debtor / teacher / dealer
  id_number_hash TEXT,                    -- hash of 身分證字號
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_parties_name ON legal_parties (name);
CREATE INDEX IF NOT EXISTS idx_parties_phone ON legal_parties (phone);

-- 核心案件表（多形態用 kind 區分）
CREATE TABLE IF NOT EXISTS legal_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 案號
  case_no_internal TEXT UNIQUE,           -- 113米法字113040001號
  case_no_external TEXT,                  -- 法院/機關案號 eg. 111年度北簡字第549號
  year_roc INT,                           -- 民國年
  -- 分類
  kind TEXT NOT NULL,                     -- consumer_dispute / civil_defense / civil_enforcement / criminal / labor / contract_dispute / complaint / nda_breach
  brand_code TEXT REFERENCES legal_brands(code),
  -- 機關 / 對造
  agency TEXT,                            -- 臺中市政府 / 臺北地方法院 / 勞動局 ...
  agency_type TEXT,                       -- 消保 / 法院 / 勞動局 / 消保會 / 地檢署 / 市府商業處
  primary_party_id UUID REFERENCES legal_parties(id),
  primary_party_name TEXT,                -- denormalised for fast list view
  opposing_lawyer TEXT,
  our_lawyer TEXT,
  -- 承辦 / 審閱
  owner_email TEXT,                       -- 承辦人
  reviewer_email TEXT,                    -- 主管審閱人
  -- 階段與狀態
  stage TEXT DEFAULT 'intake',            -- intake / drafting / review / sealed / dispatched / hearing / judged / finalised / closed / appealed
  status TEXT DEFAULT 'open',             -- open / closed / archived / withdrawn / settled
  severity TEXT DEFAULT 'normal',         -- normal / high / critical
  -- 關鍵日期
  filed_date DATE,                        -- 收文/起訴日
  response_deadline DATE,                 -- 回函/答辯期限
  hearing_date TIMESTAMPTZ,               -- 開庭日
  closure_date DATE,                      -- 結案日
  -- 金額相關
  amount_claimed NUMERIC,                 -- 訴訟標的金額
  amount_settled NUMERIC,                 -- 和解/判決金額
  currency TEXT DEFAULT 'TWD',
  -- 合約資訊（若有關聯）
  contract_signed_date DATE,
  payment_method TEXT,                    -- 資融 / 信用卡 / 現金
  finance_company TEXT,                   -- 和潤 / 遠信 / 中租
  course_usage_desc TEXT,
  -- 自由欄位
  title TEXT NOT NULL,                    -- 人看的標題（e.g. 「陳姿亘 消費爭議（臺中市政府）」）
  summary TEXT,                           -- 爭點摘要
  tags TEXT[],
  onedrive_path TEXT,                     -- 對應 OneDrive 資料夾
  -- 元資料
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cases_kind ON legal_cases (kind);
CREATE INDEX IF NOT EXISTS idx_cases_status ON legal_cases (status);
CREATE INDEX IF NOT EXISTS idx_cases_owner ON legal_cases (owner_email);
CREATE INDEX IF NOT EXISTS idx_cases_deadline ON legal_cases (response_deadline);
CREATE INDEX IF NOT EXISTS idx_cases_brand ON legal_cases (brand_code);
CREATE INDEX IF NOT EXISTS idx_cases_primary_party ON legal_cases (primary_party_id);

-- 案件時間軸（事件 / 狀態變更）
CREATE TABLE IF NOT EXISTS legal_case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES legal_cases(id) ON DELETE CASCADE,
  event_date TIMESTAMPTZ DEFAULT NOW(),
  event_type TEXT NOT NULL,               -- received / drafted / reviewed / sealed / dispatched / hearing_scheduled / hearing_done / judged / settled / closed / note
  title TEXT NOT NULL,
  detail TEXT,
  actor_email TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_case_events_case ON legal_case_events (case_id, event_date DESC);

-- 案件文件（OneDrive 路徑、版本）
CREATE TABLE IF NOT EXISTS legal_case_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES legal_cases(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,                 -- 答辯狀 / 陳報狀 / 回函 / 委任狀 / 和解書 / 強執狀 / 附件 / 判決書 / 合約 / 其他
  version INT DEFAULT 1,
  filename TEXT,
  onedrive_path TEXT,
  drive_file_id TEXT,
  drive_link TEXT,
  created_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_case_docs_case ON legal_case_documents (case_id);

-- 合約公版（5 品牌 × 4 版本矩陣）
CREATE TABLE IF NOT EXISTS legal_contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_code TEXT REFERENCES legal_brands(code),
  kind TEXT NOT NULL,                     -- 課程約款 / NDA / 師資承攬 / 轉讓同意書 / 授權書 / 代收付金流 / 代銷
  version_type TEXT,                      -- 官網 / 資融 / 信用卡 / 資融現金
  version_no INT DEFAULT 1,
  effective_from DATE,
  effective_to DATE,
  filename TEXT,
  onedrive_path TEXT,
  drive_link TEXT,
  supersedes_id UUID,
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contract_tpl_brand ON legal_contract_templates (brand_code, kind);

-- 合約執行件（誰簽了哪份合約）
CREATE TABLE IF NOT EXISTS legal_contract_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES legal_contract_templates(id),
  case_id UUID REFERENCES legal_cases(id), -- 若發生糾紛可連回
  party_id UUID REFERENCES legal_parties(id),
  signed_date DATE,
  amount NUMERIC,
  currency TEXT DEFAULT 'TWD',
  payment_method TEXT,
  finance_company TEXT,
  finance_term_months INT,
  video_url TEXT,                         -- 簽約錄影
  review_period_days INT DEFAULT 3,       -- 審閱期天數
  status TEXT DEFAULT 'active',           -- active / terminated / refunded / disputed
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contract_inst_party ON legal_contract_instances (party_id);
CREATE INDEX IF NOT EXISTS idx_contract_inst_case ON legal_contract_instances (case_id);

-- ============================================================
-- pillar_managers：業務/法務/招聘 主管 → email + line_user_id
--   每 pillar 可多位管理者，priority 決定 LINE 通知順序
-- ============================================================
CREATE TABLE IF NOT EXISTS pillar_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_id TEXT NOT NULL,                -- sales / legal / recruit
  email TEXT NOT NULL,
  display_name TEXT,
  line_user_id TEXT,                      -- 可選，若空則 fallback 用 email lookup users 表
  role TEXT DEFAULT 'manager',            -- manager / deputy / observer
  priority INT DEFAULT 100,               -- 越小越早收通知
  active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pillar_id, email)
);
CREATE INDEX IF NOT EXISTS idx_pillar_mgr ON pillar_managers (pillar_id, active, priority);

-- 預設 seed（Lynn 招聘、Vincent 法務/業務）
INSERT INTO pillar_managers (pillar_id, email, display_name, role, priority) VALUES
  ('recruit', 'lynn@xplatform.world', 'Lynn', 'manager', 10),
  ('sales', 'vincent@xplatform.world', 'Vincent', 'manager', 10),
  ('legal', 'vincent@xplatform.world', 'Vincent', 'manager', 10)
ON CONFLICT (pillar_id, email) DO NOTHING;

-- ============================================================
-- RLS — service_role 全開
-- ============================================================
ALTER TABLE legal_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_contract_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE pillar_managers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "svc" ON legal_brands FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "svc" ON legal_parties FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "svc" ON legal_cases FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "svc" ON legal_case_events FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "svc" ON legal_case_documents FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "svc" ON legal_contract_templates FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "svc" ON legal_contract_instances FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "svc" ON pillar_managers FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- BLOCK: v3-erp.sql
-- ============================================================
-- ─────────────────────────────────────────────────────────────────────────
-- 墨宇 v3 — ERP / 組織架構層 (2026-04-10)
-- ─────────────────────────────────────────────────────────────────────────
-- 哲學：每個員工註冊後就清楚知道
--   1. 自己屬於哪個部門
--   2. 自己的職位是什麼
--   3. 自己要做什麼事（職責 / KPI）
--   4. 主管是誰
--   5. 自己負責哪些專案（v3_projects）
--   6. 今天該完成的命令（v3_commands）
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 1. 部門 (Departments) ─────────────────────────────────────────────────
create table if not exists v3_departments (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                  -- 'sales' / 'legal' / 'hr' / 'ops' / 'marketing'
  name text not null,                         -- 業務部 / 法務部 / 人資部
  icon text default '🏢',
  color text default '#7c6cf0',
  brand text,                                 -- 屬於哪個品牌（nschool / xuemi / ...），null = 集團共用
  description text,
  lead_email text,                            -- 部門主管 email
  parent_id uuid references v3_departments(id) on delete set null,
  display_order int default 0,
  created_at timestamptz default now()
);

create index if not exists v3_departments_brand_idx on v3_departments(brand);
create index if not exists v3_departments_parent_idx on v3_departments(parent_id);

-- ─── 2. 職位 (Positions) ───────────────────────────────────────────────────
create table if not exists v3_positions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references v3_departments(id) on delete cascade,
  title text not null,                        -- 業務員 / 業務組長 / 法務專員
  level text default 'staff',                 -- staff / lead / manager / director
  description text,
  responsibilities jsonb default '[]'::jsonb, -- ["每日 30 通電話", "每週 5 邀約", ...]
  base_kpi jsonb default '[]'::jsonb,         -- KPI 目標 [{metric:'monthly_calls', target:600}]
  reports_to_position_id uuid references v3_positions(id) on delete set null,
  display_order int default 0,
  created_at timestamptz default now()
);

create index if not exists v3_positions_department_idx on v3_positions(department_id);

-- ─── 3. 擴充 users 表 ──────────────────────────────────────────────────────
alter table users add column if not exists department_id uuid references v3_departments(id) on delete set null;
alter table users add column if not exists position_id uuid references v3_positions(id) on delete set null;
alter table users add column if not exists manager_email text;

-- ─── 4. RLS ────────────────────────────────────────────────────────────────
alter table v3_departments enable row level security;
alter table v3_positions enable row level security;

drop policy if exists "service_role_all_v3_departments" on v3_departments;
drop policy if exists "service_role_all_v3_positions" on v3_positions;
create policy "service_role_all_v3_departments" on v3_departments for all using (true) with check (true);
create policy "service_role_all_v3_positions" on v3_positions for all using (true) with check (true);

-- ─── 5. 種子資料 — 預設部門 ────────────────────────────────────────────────
insert into v3_departments (code, name, icon, color, description, display_order) values
  ('sales',     '業務部',   '💰', '#fb923c', '4 大品牌業務 — 賣課、收單、轉換',           1),
  ('legal',     '法務部',   '⚖️', '#7c6cf0', '合約、合規、智財、糾紛、政府申報',          2),
  ('hr',        '人資招聘部', '🎯', '#10b981', '招聘漏斗、候選人管理、員工留任',           3),
  ('ops',       '營運部',   '⚙️', '#0891b2', '系統、流程、後勤、客服、教練支援',          4),
  ('marketing', '行銷部',   '📣', '#ec4899', '品牌、廣告、內容、社群、SEO',               5)
on conflict (code) do update set
  name = excluded.name,
  icon = excluded.icon,
  color = excluded.color,
  description = excluded.description;

-- ─── 6. 種子資料 — 各部門起始職位 ──────────────────────────────────────────
do $$
declare
  d_sales uuid;
  d_legal uuid;
  d_hr uuid;
  d_ops uuid;
  d_marketing uuid;
begin
  select id into d_sales from v3_departments where code='sales';
  select id into d_legal from v3_departments where code='legal';
  select id into d_hr from v3_departments where code='hr';
  select id into d_ops from v3_departments where code='ops';
  select id into d_marketing from v3_departments where code='marketing';

  -- 業務部
  insert into v3_positions (department_id, title, level, description, responsibilities, base_kpi, display_order)
  select d_sales, '業務員', 'staff',
    '第一線業務 — 開發、邀約、成交',
    '["每日 30 通有效電話", "每週 5 場面談邀約", "每月成交 ≥10 單", "每日填寫 KPI 紀錄", "每週對練影片提交"]'::jsonb,
    '[{"metric":"monthly_calls","target":600},{"metric":"monthly_appointments","target":20},{"metric":"monthly_closures","target":10}]'::jsonb,
    1
  where not exists (select 1 from v3_positions where department_id=d_sales and title='業務員');

  insert into v3_positions (department_id, title, level, description, responsibilities, base_kpi, display_order)
  select d_sales, '業務組長', 'lead',
    '帶 3-5 位業務員 — 戰技傳授、KPI 監控、案件支援',
    '["每週帶組會議 1 次", "每位下屬每日 KPI 追蹤", "每週至少陪同 2 場面談", "每月組整體成交 ≥40 單"]'::jsonb,
    '[{"metric":"team_monthly_closures","target":40}]'::jsonb,
    2
  where not exists (select 1 from v3_positions where department_id=d_sales and title='業務組長');

  insert into v3_positions (department_id, title, level, description, responsibilities, base_kpi, display_order)
  select d_sales, '業務主管', 'manager',
    '掌管整個品牌業務 — 戰略、招募、淘汰、結果',
    '["每月品牌營收目標達成", "每月新人入職 ≥3 人", "每月汰弱留強", "每週與 CEO 對焦戰況"]'::jsonb,
    '[{"metric":"brand_monthly_revenue","target":3000000}]'::jsonb,
    3
  where not exists (select 1 from v3_positions where department_id=d_sales and title='業務主管');

  -- 法務部
  insert into v3_positions (department_id, title, level, description, responsibilities, base_kpi, display_order)
  select d_legal, '法務專員', 'staff',
    '合約審核、糾紛處理、法規追蹤',
    '["每週審核合約 ≥5 份", "每月更新法規 1 次", "客訴 / 糾紛 24h 內回應"]'::jsonb,
    '[]'::jsonb,
    1
  where not exists (select 1 from v3_positions where department_id=d_legal and title='法務專員');

  -- 人資招聘部
  insert into v3_positions (department_id, title, level, description, responsibilities, base_kpi, display_order)
  select d_hr, '招聘專員', 'staff',
    '主動找人、面試安排、入職跟進',
    '["每週聯繫 ≥30 候選人", "每週安排面試 ≥5 場", "每月成功入職 ≥3 人", "離職率 <10%"]'::jsonb,
    '[{"metric":"weekly_outreach","target":30},{"metric":"monthly_hires","target":3}]'::jsonb,
    1
  where not exists (select 1 from v3_positions where department_id=d_hr and title='招聘專員');

  insert into v3_positions (department_id, title, level, description, responsibilities, base_kpi, display_order)
  select d_hr, 'HR 主管', 'manager',
    '統籌全集團招聘、留任、培訓',
    '["每月集團整體入職 ≥10 人", "員工留任率 ≥85%", "建立新人培訓 SOP"]'::jsonb,
    '[]'::jsonb,
    2
  where not exists (select 1 from v3_positions where department_id=d_hr and title='HR 主管');

  -- 營運部
  insert into v3_positions (department_id, title, level, description, responsibilities, base_kpi, display_order)
  select d_ops, '營運專員', 'staff',
    '系統維運、流程改善、後勤支援',
    '["每週流程檢視 1 次", "客服回應 SLA <2h", "系統穩定度 ≥99%"]'::jsonb,
    '[]'::jsonb,
    1
  where not exists (select 1 from v3_positions where department_id=d_ops and title='營運專員');

  -- 行銷部
  insert into v3_positions (department_id, title, level, description, responsibilities, base_kpi, display_order)
  select d_marketing, '行銷專員', 'staff',
    '廣告、內容、社群、品牌維運',
    '["每週發布 3 則內容", "每月廣告 ROAS ≥3", "每月新粉絲 ≥500"]'::jsonb,
    '[]'::jsonb,
    1
  where not exists (select 1 from v3_positions where department_id=d_marketing and title='行銷專員');
end $$;

-- ============================================================
-- BLOCK: v3-pillars.sql
-- ============================================================
-- ─────────────────────────────────────────────────────────────────────────
-- 墨宇 v3 — 3 大支柱觀測系統 (2026-04-10)
-- ─────────────────────────────────────────────────────────────────────────
-- 哲學：Claude 是 CEO，3 大業務支柱（業務 / 法務 / 招聘），每天 Claude
-- 產出命令推送給人類員工，人類在系統內回報，Claude 自動學習迭代。
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 1. 支柱（Pillars） ───────────────────────────────────────────────────
-- 3 大支柱寫死，不開放新增（避免擴散）
create table if not exists v3_pillars (
  id text primary key,                    -- 'sales' / 'legal' / 'recruit'
  name text not null,                     -- 業務 / 法務 / 招聘
  color text not null,                    -- hex
  description text,
  display_order int default 0,
  created_at timestamptz default now()
);

insert into v3_pillars (id, name, color, description, display_order) values
  ('sales',   '業務', '#fb923c', '賣課、收單、轉換率、業務員戰力', 1),
  ('legal',   '法務', '#7c6cf0', '合約、合規、智財、糾紛、政府申報',   2),
  ('recruit', '招聘', '#10b981', '人才漏斗、招聘員、面試、留任',     3)
on conflict (id) do update set name = excluded.name, color = excluded.color, description = excluded.description;

-- ─── 2. 專案（Projects） ──────────────────────────────────────────────────
-- 每個支柱底下若干專案，每個專案有目標 / 負責人 / KPI / deadline
create table if not exists v3_projects (
  id uuid primary key default gen_random_uuid(),
  pillar_id text not null references v3_pillars(id) on delete cascade,
  name text not null,
  goal text not null,                     -- 一句話目標 (北極星 KPI)
  owner_email text,                       -- 主負責人
  status text default 'active',           -- active / paused / done / dropped
  health text default 'unknown',          -- healthy / warning / critical / unknown
  progress int default 0,                 -- 0-100
  deadline date,
  kpi_target jsonb,                       -- {metric:'monthly_revenue', value:3000000}
  kpi_actual jsonb,                       -- 自動計算 / 人類回報
  diagnosis text,                         -- Claude 的診斷
  next_action text,                       -- Claude 規劃的下一步
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists v3_projects_pillar_idx on v3_projects(pillar_id);
create index if not exists v3_projects_health_idx on v3_projects(health);

-- ─── 3. Claude 命令（每天產出的指派） ─────────────────────────────────────
create table if not exists v3_commands (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references v3_projects(id) on delete cascade,
  pillar_id text references v3_pillars(id) on delete cascade,
  owner_email text not null,              -- 接收者
  title text not null,                    -- 一句話命令
  detail text,                            -- 詳細說明 (Claude 解釋為何要做)
  severity text default 'normal',         -- info / normal / high / critical
  deadline timestamptz,                   -- 必須在何時前完成
  status text default 'pending',          -- pending / acknowledged / done / blocked / ignored
  ai_generated boolean default true,
  ai_reasoning text,                      -- Claude 的判斷依據（學習用）
  created_at timestamptz default now(),
  acknowledged_at timestamptz,
  done_at timestamptz,
  blocked_reason text
);

create index if not exists v3_commands_owner_idx on v3_commands(owner_email);
create index if not exists v3_commands_status_idx on v3_commands(status);
create index if not exists v3_commands_project_idx on v3_commands(project_id);

-- ─── 4. LINE 推送紀錄 ─────────────────────────────────────────────────────
create table if not exists v3_line_dispatch (
  id uuid primary key default gen_random_uuid(),
  command_id uuid references v3_commands(id) on delete cascade,
  recipient_email text not null,
  recipient_line_user_id text,
  pushed_at timestamptz default now(),
  push_status text default 'pending',     -- pending / sent / failed
  push_error text,
  line_message_id text
);

create index if not exists v3_line_dispatch_command_idx on v3_line_dispatch(command_id);

-- ─── 5. 人類回應紀錄（學習用） ────────────────────────────────────────────
-- 記錄人類對每個命令的反應，給 Claude 自我迭代用
create table if not exists v3_response_log (
  id uuid primary key default gen_random_uuid(),
  command_id uuid references v3_commands(id) on delete cascade,
  owner_email text not null,
  action text not null,                   -- viewed / acknowledged / done / blocked / ignored
  response_time_seconds int,              -- 從 push 到此 action 的秒數
  note text,
  created_at timestamptz default now()
);

create index if not exists v3_response_log_owner_idx on v3_response_log(owner_email);
create index if not exists v3_response_log_command_idx on v3_response_log(command_id);

-- ─── 6. AI 學習筆記（Claude 自己更新的規則） ──────────────────────────────
-- Claude 自動觀察哪些命令奏效、哪些被忽視，更新自己的判斷規則
create table if not exists v3_ai_insights (
  id uuid primary key default gen_random_uuid(),
  pillar_id text references v3_pillars(id),
  insight_type text not null,             -- pattern / rule / hypothesis
  content text not null,                  -- 觀察結論
  evidence jsonb,                         -- 支持證據（命令 ID 列表 + 結果）
  confidence numeric default 0.5,         -- 0-1
  applied boolean default false,          -- 是否已套用到生產規則
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── 種子資料：每支柱先放 1-2 個 starter project ───────────────────────────
insert into v3_projects (pillar_id, name, goal, status, health, progress, diagnosis, next_action) values
  ('sales',   '業務戰力建立',     '4 個業務品牌每月平均 30 通／人，月成交 10 單', 'active', 'unknown', 0, '尚未開始監測', 'Claude 等待第一週數據'),
  ('sales',   '轉換漏斗優化',     '通數→邀約 30%、邀約→成交 40%',                'active', 'unknown', 0, '尚未開始監測', 'Claude 等待第一週數據'),
  ('legal',   '合約模板建置',     '6 大類合約模板（業務、招聘、合作、保密、講師、智財）完成審核', 'active', 'unknown', 0, '尚未啟動',    '需要用戶提供現有合約版本'),
  ('legal',   '智財申報',         '商標 / 著作權 / 課程內容智財佈局完成',         'active', 'unknown', 0, '尚未啟動',    '需要清點現有 IP'),
  ('recruit', '招聘漏斗建立',     '每月 20 位有效投遞，80% 通過試用期',          'active', 'unknown', 0, '尚未開始監測', '需要確認廣告投放預算與管道'),
  ('recruit', '招聘員培訓',       '招聘員每週聯繫 ≥30 候選人',                    'active', 'unknown', 0, '尚未開始監測', '需要確認招聘員人數');

-- ============================================================
-- BLOCK: training-units.sql
-- ============================================================
-- ================================================================
-- Migration: training_units + training_unit_progress
-- 目的：為「新訓區域」建立統一訓練單元資料層
-- 對應文件：moyu-training-system zip 的 audit report
-- 依賴：hr_training_progress 已存在（不衝突，作為 legacy 並行）
-- 作者：Claude Code
-- 日期：2026-04-23
-- ================================================================

-- ----------------------------------------------------------------
-- 1. training_units：訓練單元主表（對應 moyu-training-system 的 HR-053/054/055/056 等）
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_units (
  id BIGSERIAL PRIMARY KEY,
  unit_code TEXT UNIQUE NOT NULL,                -- 'HR-053', 'HR-054' ...
  system TEXT NOT NULL CHECK (system IN ('HR','BIZ','LEGAL')),
  title TEXT NOT NULL,
  audience TEXT[] NOT NULL,                       -- {'HR-INT'}, {'ALL','NEW'}
  priority TEXT NOT NULL CHECK (priority IN ('P0','P1','P2')),
  series TEXT,                                    -- 'HRBP_RECRUIT_V1'
  series_position INT,                            -- 1..4
  series_total INT,                               -- 4
  video_url TEXT,                                 -- Supabase Storage signed URL
  video_duration_seconds INT,
  interactive_html_url TEXT,                      -- 互動測驗 html 位置
  handbook_md TEXT,                               -- 手冊 Markdown 原文（可 null）
  prerequisite_units TEXT[],                      -- {'HR-051','HR-052'}
  learning_objectives JSONB,                      -- [{audience, behavior, condition, degree}]
  key_points TEXT[],                              -- 關鍵知識點
  source_repo TEXT DEFAULT 'moyu-training-system',
  source_commit TEXT,                             -- GitHub commit sha of input.md
  legacy_task_id BIGINT,                          -- 舊 hr_training_tasks.id 對映（可 null）
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_units_series_position ON training_units(series, series_position);
CREATE INDEX IF NOT EXISTS idx_training_units_system_priority ON training_units(system, priority);
CREATE INDEX IF NOT EXISTS idx_training_units_published ON training_units(published) WHERE published = true;

-- ----------------------------------------------------------------
-- 2. training_unit_progress：個人進度（接 postMessage 寫入）
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_unit_progress (
  id BIGSERIAL PRIMARY KEY,
  trainee_email TEXT NOT NULL,
  unit_code TEXT NOT NULL REFERENCES training_units(unit_code) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('not_started','watching','quiz_pending','passed','failed')),
  score INT,
  total INT,
  passed BOOLEAN,
  series_complete BOOLEAN DEFAULT false,           -- EP4 結尾會帶這個
  first_viewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempt_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trainee_email, unit_code)
);

CREATE INDEX IF NOT EXISTS idx_training_progress_email ON training_unit_progress(trainee_email);
CREATE INDEX IF NOT EXISTS idx_training_progress_status ON training_unit_progress(status);

-- ----------------------------------------------------------------
-- 3. RLS policies（遵循 moyu-academy 4/23 security sprint 後的統一原則）
-- ----------------------------------------------------------------
ALTER TABLE training_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_unit_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all ON training_units
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY published_read ON training_units
  FOR SELECT USING (published = true);

CREATE POLICY service_role_all ON training_unit_progress
  FOR ALL USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------
-- 4. updated_at 自動更新
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at_training()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_training_units_updated
  BEFORE UPDATE ON training_units
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_training();

CREATE TRIGGER trg_training_unit_progress_updated
  BEFORE UPDATE ON training_unit_progress
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_training();

-- ----------------------------------------------------------------
-- 5. Seed：HRBP 招募訓練系列（EP1-4）骨架，實際 URL 由 sync job 回填
-- ----------------------------------------------------------------
INSERT INTO training_units (unit_code, system, title, audience, priority, series, series_position, series_total, video_duration_seconds, prerequisite_units, published)
VALUES
  ('HR-053','HR','業務敘薪制度全解析',    ARRAY['HR-INT'],'P0','HRBP_RECRUIT_V1',1,4,1080, ARRAY['HR-051','HR-052'], false),
  ('HR-054','HR','一面 vs 二面：面試的任務分工', ARRAY['HR-INT'],'P0','HRBP_RECRUIT_V1',2,4, 660, ARRAY['HR-053'], false),
  ('HR-055','HR','電訪心法 · 三階段回覆法', ARRAY['HR-INT'],'P0','HRBP_RECRUIT_V1',3,4, 900, ARRAY['HR-053','HR-054'], false),
  ('HR-056','HR','致命提問應對 · 業績壓力與團隊氛圍', ARRAY['HR-INT'],'P0','HRBP_RECRUIT_V1',4,4, 660, ARRAY['HR-053','HR-054','HR-055'], false)
ON CONFLICT (unit_code) DO NOTHING;

-- ============================================================
-- BLOCK: recruit-pipeline.sql
-- ============================================================
-- 招聘漏斗 + 104 發信追蹤
-- 執行位置: Supabase Dashboard → SQL Editor
-- 安全: IF NOT EXISTS, 可重複執行

-- 1. 候選人追蹤 (recruits 表已存在，這裡補欄位)
ALTER TABLE recruits
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT '104',
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS interview_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reject_reason TEXT,
  ADD COLUMN IF NOT EXISTS salary_expected TEXT,
  ADD COLUMN IF NOT EXISTS resume_url TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. 104 發信追蹤表
CREATE TABLE IF NOT EXISTS outreach_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_email TEXT,
  candidate_name TEXT NOT NULL,
  platform TEXT DEFAULT '104',       -- 104 / LinkedIn / 自招 / referral
  job_title TEXT,                    -- 招聘的職位
  brand TEXT,                        -- 目標品牌 (nschool / xuemi / ooschool / aischool / moyuhunt)
  message_template TEXT,             -- 用的信件模板
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'sent',        -- sent / viewed / replied / interview_scheduled / no_response
  response_at TIMESTAMPTZ,
  response_text TEXT,
  follow_up_count INT DEFAULT 0,
  last_follow_up_at TIMESTAMPTZ,
  owner_email TEXT NOT NULL,         -- 負責這個發信的 recruiter
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_log_status ON outreach_log(status);
CREATE INDEX IF NOT EXISTS idx_outreach_log_owner ON outreach_log(owner_email);
CREATE INDEX IF NOT EXISTS idx_outreach_log_platform ON outreach_log(platform);

-- 3. 招聘排程 (每週要發多少信、目前進度)
CREATE TABLE IF NOT EXISTS recruit_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,          -- 週一
  brand TEXT NOT NULL,
  target_outreach INT DEFAULT 50,    -- 本週目標發信數
  actual_outreach INT DEFAULT 0,     -- 已發信數
  target_interviews INT DEFAULT 5,   -- 目標面試數
  actual_interviews INT DEFAULT 0,   -- 已面試數
  target_hires INT DEFAULT 1,        -- 目標錄取數
  actual_hires INT DEFAULT 0,        -- 已錄取數
  owner_email TEXT,                  -- 負責 recruiter
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recruit_schedule_week ON recruit_schedule(week_start);

-- RLS bypass (service role)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_outreach_log') THEN
    CREATE POLICY "service_role_all_outreach_log" ON outreach_log FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_recruit_schedule') THEN
    CREATE POLICY "service_role_all_recruit_schedule" ON recruit_schedule FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- BLOCK: recruit-docs.sql
-- ============================================================
-- 招聘候選人原始資料儲存表
-- 用於儲存從各種來源（104 / 1111 / IG / LINE / 電話截圖 / 面試筆記）收集的原始資料
-- 一個 recruit 可以有多筆 documents

CREATE TABLE IF NOT EXISTS recruit_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruit_id UUID NOT NULL REFERENCES recruits(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'resume',         -- 履歷
    'screenshot',     -- 截圖
    'conversation',   -- 對話紀錄（IG/LINE/電話）
    'interview_note', -- 面試筆記
    'reference',      -- 推薦人資料
    'background',     -- 背景調查
    'other'           -- 其他
  )),
  title TEXT NOT NULL,
  content TEXT,                    -- 純文字內容
  file_url TEXT,                   -- 檔案連結（可選，未來上傳功能）
  source TEXT,                     -- 來源（如：104 / IG / LINE / 面對面）
  metadata JSONB DEFAULT '{}'::jsonb,  -- 任意額外資訊
  created_by TEXT,                 -- 建立人（admin email）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruit_documents_recruit ON recruit_documents(recruit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recruit_documents_type ON recruit_documents(doc_type);

-- RLS：service_role 全權限
ALTER TABLE recruit_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON recruit_documents FOR ALL USING (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- BLOCK: 104-automation.sql
-- ============================================================
-- 104 自動化系統所需的表
-- 1. pending_104_actions：前台觸發 104 操作的佇列
-- 2. recruit_criteria：主管設定的招募條件
-- 3. phone_call_log：電話系統（智慧客服）拉過來的通話紀錄
-- 4. outreach_log 擴充欄位

-- ═══════════════════════════════════════════════
-- 1. pending_104_actions
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pending_104_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  candidate_name TEXT NOT NULL,
  candidate_104_id TEXT,
  account TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INT DEFAULT 0,
  error_message TEXT,
  recruit_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pending_104_actions_status ON pending_104_actions (status, created_at);

-- ═══════════════════════════════════════════════
-- 2. recruit_criteria
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS recruit_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account TEXT NOT NULL,
  location TEXT,
  job_keywords TEXT[] DEFAULT ARRAY['業務','電銷'],
  exclude_keywords TEXT[] DEFAULT ARRAY['工讀','兼職','實習'],
  min_age INT DEFAULT 22,
  max_age INT DEFAULT 45,
  min_experience_years DECIMAL DEFAULT 0,
  daily_quota INT NOT NULL DEFAULT 100,
  enabled BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO recruit_criteria (account, daily_quota, notes)
VALUES
  ('mofan', 200, '墨凡股份有限公司 104 發信配額'),
  ('ruifu', 300, '睿富文化股份有限公司 104 發信配額')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════
-- 3. phone_call_log
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS phone_call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extension TEXT NOT NULL,
  agent_name TEXT,
  call_direction TEXT,
  peer_number TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  answer_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_seconds INT,
  ring_seconds INT,
  status TEXT,
  recording_url TEXT,
  pbx_call_id TEXT UNIQUE,
  raw_payload JSONB,
  imported_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_phone_call_log_ext_time ON phone_call_log (extension, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_phone_call_log_peer ON phone_call_log (peer_number);

-- ═══════════════════════════════════════════════
-- 4. 104 send queue (for rate limited sending)
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS outreach_104_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account TEXT NOT NULL,
  candidate_104_id TEXT NOT NULL,
  candidate_name TEXT,
  candidate_phone TEXT,
  candidate_email TEXT,
  job_title TEXT,
  job_location TEXT,
  resume_url TEXT,
  resume_meta JSONB,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_104_queue_unique ON outreach_104_queue (account, candidate_104_id);
CREATE INDEX IF NOT EXISTS idx_outreach_104_queue_status ON outreach_104_queue (status, scheduled_at);

-- ═══════════════════════════════════════════════
-- 5. outreach_log 擴充
-- ═══════════════════════════════════════════════
ALTER TABLE outreach_log ADD COLUMN IF NOT EXISTS account TEXT;
ALTER TABLE outreach_log ADD COLUMN IF NOT EXISTS candidate_104_id TEXT;
ALTER TABLE outreach_log ADD COLUMN IF NOT EXISTS reply_status TEXT;
ALTER TABLE outreach_log ADD COLUMN IF NOT EXISTS reply_received_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_outreach_log_104_id ON outreach_log (candidate_104_id);

-- 驗證
SELECT 'pending_104_actions' as tbl, count(*) FROM pending_104_actions
UNION ALL SELECT 'recruit_criteria', count(*) FROM recruit_criteria
UNION ALL SELECT 'phone_call_log', count(*) FROM phone_call_log
UNION ALL SELECT 'outreach_104_queue', count(*) FROM outreach_104_queue;

-- ============================================================
-- BLOCK: recruit-ops.sql
-- ============================================================
-- 招聘營運流程欄位 (2026-04-16)
ALTER TABLE outreach_104_queue
  ADD COLUMN IF NOT EXISTS owner_email TEXT,
  ADD COLUMN IF NOT EXISTS auto_followup_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phone_contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_contacted_by TEXT,
  ADD COLUMN IF NOT EXISTS interview_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS interview_location TEXT,
  ADD COLUMN IF NOT EXISTS interview_notes TEXT,
  ADD COLUMN IF NOT EXISTS candidate_phone TEXT,
  ADD COLUMN IF NOT EXISTS candidate_age INT,
  ADD COLUMN IF NOT EXISTS last_reply_text TEXT;

CREATE INDEX IF NOT EXISTS idx_outreach_owner ON outreach_104_queue (owner_email);
CREATE INDEX IF NOT EXISTS idx_outreach_interested ON outreach_104_queue (reply_status, phone_contacted_at)
  WHERE reply_status = 'interested';

-- ============================================================
-- BLOCK: reply-columns.sql
-- ============================================================
-- outreach_104_queue 加 reply_status + reply_received_at
ALTER TABLE outreach_104_queue
  ADD COLUMN IF NOT EXISTS reply_status TEXT,
  ADD COLUMN IF NOT EXISTS reply_received_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_outreach_104_reply ON outreach_104_queue (reply_received_at DESC) WHERE reply_received_at IS NOT NULL;

-- ============================================================
-- BLOCK: 104-rls.sql
-- ============================================================
-- Fix: Enable RLS on 104 automation tables (no policies = service_role only)
-- These tables are backend-only; anon/authenticated access should be blocked.
-- Service role (moyu-worker, API routes via getSupabaseAdmin) bypasses RLS.

ALTER TABLE pending_104_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruit_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_call_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_104_queue ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- BLOCK: rls-all-tables.sql
-- ============================================================
-- Fix: Enable RLS on ALL public tables missing row-level security
-- Applied directly to DB on 2026-04-23 via Supabase SQL Editor.
-- All routes access these tables via service_role (getSupabaseAdmin / supabaseAdmin)
-- which bypasses RLS, so enabling RLS causes no behavior change.
-- Anon/authenticated access is blocked (no policies = deny all by default).

-- Batch 1: 104 automation tables (from uncommitted supabase-migration-104-rls.sql)
ALTER TABLE pending_104_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruit_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_call_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_104_queue ENABLE ROW LEVEL SECURITY;

-- Batch 2: moyu-academy backend tables
ALTER TABLE v3_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_quizzes ENABLE ROW LEVEL SECURITY;

-- Batch 3: remaining 31 tables (applied via PL/pgSQL loop)
-- announcements, chip_data, daytrade_candidates, hr_training_days,
-- hr_training_progress, hr_training_tasks, legal_compliance, legal_contracts,
-- legal_disputes, legal_ip, line_users, market_data, news, performance,
-- positions, push_logs, quiz_attempts, review_reports, signal_performance,
-- and others detected at time of migration.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END;
$$;

-- Verification: should return 0
-- SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;

-- ── 4. Verification ──
DO $$
DECLARE
  table_count INT;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'moyu_legacy';
  RAISE NOTICE 'moyu_legacy schema 整合完成,total tables: %', table_count;
END $$;

NOTIFY pgrst, 'reload schema';
