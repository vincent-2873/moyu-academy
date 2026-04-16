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
