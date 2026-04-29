-- Chunk C (recruit/104/rls/verify) - search_path 重 set
SET search_path = moyu_legacy, public;

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
