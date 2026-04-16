-- outreach_104_queue 加 reply_status + reply_received_at
ALTER TABLE outreach_104_queue
  ADD COLUMN IF NOT EXISTS reply_status TEXT,
  ADD COLUMN IF NOT EXISTS reply_received_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_outreach_104_reply ON outreach_104_queue (reply_received_at DESC) WHERE reply_received_at IS NOT NULL;
