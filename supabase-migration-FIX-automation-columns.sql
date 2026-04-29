-- ════════════════════════════════════════════════════════════════════════
-- FIX: 自動化所需 columns(phone log / outreach / recruits / kpi)
-- ════════════════════════════════════════════════════════════════════════

-- phone_call_log:每日 per-extension aggregate
ALTER TABLE public.phone_call_log
  ADD COLUMN IF NOT EXISTS extension TEXT,
  ADD COLUMN IF NOT EXISTS agent TEXT,
  ADD COLUMN IF NOT EXISTS date DATE,
  ADD COLUMN IF NOT EXISTS calls INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sec INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_min INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS answered INTEGER DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS phone_call_log_ext_date_idx ON public.phone_call_log (extension, date)
  WHERE extension IS NOT NULL AND date IS NOT NULL;

-- outreach_104_queue:104 邀約 queue + AI judgment
ALTER TABLE public.outreach_104_queue
  ADD COLUMN IF NOT EXISTS candidate_name TEXT,
  ADD COLUMN IF NOT EXISTS candidate_phone TEXT,
  ADD COLUMN IF NOT EXISTS candidate_email TEXT,
  ADD COLUMN IF NOT EXISTS account TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS date DATE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_reply_text TEXT,
  ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marked_ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_judgment TEXT,
  ADD COLUMN IF NOT EXISTS ai_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS ai_matched_scenario TEXT,
  ADD COLUMN IF NOT EXISTS ai_judged_at TIMESTAMPTZ;

-- recruits:source / phone / contact_at / interview_at / resume_url / notes
ALTER TABLE public.recruits
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS resume_url TEXT,
  ADD COLUMN IF NOT EXISTS contact_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS interview_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT;
-- Unique by phone for upsert
CREATE UNIQUE INDEX IF NOT EXISTS recruits_phone_idx ON public.recruits (phone)
  WHERE phone IS NOT NULL;

-- recruit_schedule:面試行程(create-interview-event 路由 insert)
ALTER TABLE public.recruit_schedule
  ADD COLUMN IF NOT EXISTS recruit_id UUID,
  ADD COLUMN IF NOT EXISTS candidate_name TEXT,
  ADD COLUMN IF NOT EXISTS candidate_email TEXT,
  ADD COLUMN IF NOT EXISTS interviewer_email TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS round INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meet_url TEXT,
  ADD COLUMN IF NOT EXISTS event_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';

-- legal tables(legal_contracts / legal_compliance / legal_disputes)— deadline 預警需要欄位
-- 已在 FIX-stub-columns.sql 補,確認有沒有
ALTER TABLE public.legal_contracts
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS owner_email TEXT,
  ADD COLUMN IF NOT EXISTS counterparty TEXT;

-- users:manager_email(被 breakthrough-alert 用)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS manager_email TEXT;

-- breakthrough_log:嚴重度與訊息(已在前 SQL,確認)
ALTER TABLE public.breakthrough_log
  ADD COLUMN IF NOT EXISTS user_email TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT;

-- ── verify ──
SELECT 'phone_log_cols' AS info, string_agg(column_name, ',' ORDER BY column_name) AS val
  FROM information_schema.columns WHERE table_schema='public' AND table_name='phone_call_log'
  AND column_name IN ('extension','calls','total_sec','total_min','answered','agent','date');

SELECT 'outreach_cols', string_agg(column_name, ',' ORDER BY column_name)
  FROM information_schema.columns WHERE table_schema='public' AND table_name='outreach_104_queue'
  AND column_name IN ('candidate_name','status','last_reply_text','ai_judgment');
