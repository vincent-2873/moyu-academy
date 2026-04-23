-- Fix: Enable RLS on 104 automation tables (no policies = service_role only)
-- These tables are backend-only; anon/authenticated access should be blocked.
-- Service role (moyu-worker, API routes via getSupabaseAdmin) bypasses RLS.

ALTER TABLE pending_104_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruit_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_call_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_104_queue ENABLE ROW LEVEL SECURITY;
