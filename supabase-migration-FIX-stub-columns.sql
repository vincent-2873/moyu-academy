-- ════════════════════════════════════════════════════════════════════════
-- FIX: stub tables 補 code 引用的具體 columns
-- ════════════════════════════════════════════════════════════════════════
-- 從 code grep 出 select(...) 引用的 columns,逐 table ADD COLUMN IF NOT EXISTS
-- ════════════════════════════════════════════════════════════════════════

-- system_settings: key+value(work-schedule + cohort 用)
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS key TEXT,
  ADD COLUMN IF NOT EXISTS value TEXT;
UPDATE public.system_settings SET key = 'cohort_start_date', value = '2026-04-29' WHERE key IS NULL;

-- 加 cohort_start_date row(/api/cohort 期待)
INSERT INTO public.system_settings (key, value, type, name)
VALUES ('cohort_start_date', '2026-04-29', 'system', 'cohort start')
ON CONFLICT (id) DO NOTHING;

-- announcements: expires_at + 其他
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS author_email TEXT;

-- videos: drive_file_id + category + brands[] + related_days[]
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS brands TEXT[] DEFAULT ARRAY['xuemi'],
  ADD COLUMN IF NOT EXISTS related_days INTEGER[],
  ADD COLUMN IF NOT EXISTS duration_sec INTEGER,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- kpi_entries
ALTER TABLE public.kpi_entries
  ADD COLUMN IF NOT EXISTS calls INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valid_calls INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS appointments INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closures INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue NUMERIC DEFAULT 0;

-- human_state_checkin
ALTER TABLE public.human_state_checkin
  ADD COLUMN IF NOT EXISTS energy INTEGER,
  ADD COLUMN IF NOT EXISTS mood TEXT,
  ADD COLUMN IF NOT EXISTS comfort_level INTEGER,
  ADD COLUMN IF NOT EXISTS ai_score NUMERIC;

-- breakthrough_log
ALTER TABLE public.breakthrough_log
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN DEFAULT FALSE;

-- legal_contracts(stub created above with wide schema,補幾個具體)
ALTER TABLE public.legal_contracts
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS effective_to TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS amount NUMERIC,
  ADD COLUMN IF NOT EXISTS counterparty TEXT;

-- legal_compliance
ALTER TABLE public.legal_compliance
  ADD COLUMN IF NOT EXISTS task_name TEXT,
  ADD COLUMN IF NOT EXISTS next_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS owner_email TEXT;

-- legal_disputes
ALTER TABLE public.legal_disputes
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS counterparty TEXT;

-- legal_ip
ALTER TABLE public.legal_ip
  ADD COLUMN IF NOT EXISTS renew_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ip_type TEXT,
  ADD COLUMN IF NOT EXISTS registration_no TEXT;

-- module_overrides(brand 已在 wide schema,但確保 module_id)
ALTER TABLE public.module_overrides
  ADD COLUMN IF NOT EXISTS module_id TEXT,
  ADD COLUMN IF NOT EXISTS override_value JSONB;

-- user_activity
ALTER TABLE public.user_activity
  ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_count INTEGER DEFAULT 0;

-- user_progress
ALTER TABLE public.user_progress
  ADD COLUMN IF NOT EXISTS module_id TEXT,
  ADD COLUMN IF NOT EXISTS progress_pct NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT FALSE;

-- sparring_records
ALTER TABLE public.sparring_records
  ADD COLUMN IF NOT EXISTS scores JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS module_key TEXT,
  ADD COLUMN IF NOT EXISTS scenario_key TEXT;

-- quiz_scores + quiz_attempts
ALTER TABLE public.quiz_scores
  ADD COLUMN IF NOT EXISTS quiz_id TEXT,
  ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 1;
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS quiz_id TEXT,
  ADD COLUMN IF NOT EXISTS answers JSONB,
  ADD COLUMN IF NOT EXISTS attempt_no INTEGER DEFAULT 1;

-- weekly_reports
ALTER TABLE public.weekly_reports
  ADD COLUMN IF NOT EXISTS week_start DATE,
  ADD COLUMN IF NOT EXISTS week_end DATE,
  ADD COLUMN IF NOT EXISTS metrics JSONB DEFAULT '{}'::jsonb;

-- video_watch_progress
ALTER TABLE public.video_watch_progress
  ADD COLUMN IF NOT EXISTS video_id UUID,
  ADD COLUMN IF NOT EXISTS watched_sec INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT FALSE;

-- recordings
ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS duration_sec INTEGER,
  ADD COLUMN IF NOT EXISTS storage_url TEXT,
  ADD COLUMN IF NOT EXISTS transcript TEXT;

-- recruit_events
ALTER TABLE public.recruit_events
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS recruit_id UUID;

-- hr_training_days + hr_training_tasks
ALTER TABLE public.hr_training_days
  ADD COLUMN IF NOT EXISTS day_no INTEGER,
  ADD COLUMN IF NOT EXISTS day_label TEXT;
ALTER TABLE public.hr_training_tasks
  ADD COLUMN IF NOT EXISTS day_id UUID,
  ADD COLUMN IF NOT EXISTS task_no INTEGER,
  ADD COLUMN IF NOT EXISTS expected_minutes INTEGER;

-- mentor_messages
ALTER TABLE public.mentor_messages
  ADD COLUMN IF NOT EXISTS pair_id UUID,
  ADD COLUMN IF NOT EXISTS sender_email TEXT,
  ADD COLUMN IF NOT EXISTS recipient_email TEXT;

-- approvals
ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS requester_email TEXT,
  ADD COLUMN IF NOT EXISTS approver_email TEXT,
  ADD COLUMN IF NOT EXISTS approval_type TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';

-- xplatform_brands(extras)
ALTER TABLE public.xplatform_brands
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS theme_color TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- legal_ip extras
ALTER TABLE public.legal_ip
  ADD COLUMN IF NOT EXISTS jurisdiction TEXT;

-- ── seed cohort row 用於 /api/cohort GET ──
DELETE FROM public.system_settings WHERE name = 'moyu-config' AND key IS NULL;
INSERT INTO public.system_settings (key, value, type, name, description)
VALUES
  ('cohort_start_date', '2026-04-29', 'system', 'cohort_start_date', '當期 cohort 起始日'),
  ('app_version',       '2.0.0',      'system', 'app_version',       'App version')
ON CONFLICT (id) DO NOTHING;

-- ── verify ──
SELECT 'stub_columns_done' AS info, NOW()::TEXT AS val
UNION ALL SELECT 'system_settings_rows', COUNT(*)::TEXT FROM public.system_settings
UNION ALL SELECT 'videos_columns_check',
  CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='videos' AND column_name='drive_file_id')
       THEN 'YES' ELSE 'NO' END
UNION ALL SELECT 'announcements_expires_at',
  CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='announcements' AND column_name='expires_at')
       THEN 'YES' ELSE 'NO' END;
