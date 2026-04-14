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
