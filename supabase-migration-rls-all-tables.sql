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
