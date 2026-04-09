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
