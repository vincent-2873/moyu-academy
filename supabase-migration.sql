-- ============================================
-- MOYU ACADEMY - 後台升級資料庫遷移
-- 請在 Supabase Dashboard > SQL Editor 中執行
-- ============================================

-- 1. 學習進度表
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  completed_modules INTEGER[] DEFAULT '{}',
  progress INTEGER DEFAULT 0,
  current_day INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. 測驗成績表
CREATE TABLE IF NOT EXISTS quiz_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quiz_scores_user ON quiz_scores(user_id);

-- 3. 影片觀看進度表
CREATE TABLE IF NOT EXISTS video_watch_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_id TEXT NOT NULL,
  watch_seconds INTEGER DEFAULT 0,
  total_seconds INTEGER,
  completed BOOLEAN DEFAULT false,
  last_watched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, video_id)
);

-- 4. KPI 紀錄表
CREATE TABLE IF NOT EXISTS kpi_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  calls INTEGER DEFAULT 0,
  valid_calls INTEGER DEFAULT 0,
  appointments INTEGER DEFAULT 0,
  closures INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- 5. 訓練內容覆蓋表（後台編輯用）
CREATE TABLE IF NOT EXISTS module_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id INTEGER NOT NULL UNIQUE,
  description_override TEXT,
  content_override JSONB,
  key_points_override JSONB,
  schedule_override JSONB,
  resources_override JSONB,
  trainer_tips_override JSONB,
  practice_task_override TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 啟用 RLS 並允許 service_role 完整存取
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_watch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_user_progress" ON user_progress FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_quiz_scores" ON quiz_scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_video_watch" ON video_watch_progress FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_kpi" ON kpi_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_overrides" ON module_overrides FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 6. Mentor Pairs table (師徒配對)
-- ============================================
CREATE TABLE IF NOT EXISTS mentor_pairs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainee_id UUID NOT NULL,
  mentor_id UUID NOT NULL,
  manager_id UUID,
  brand TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'dissolved', 'pending')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  actual_end_date DATE,
  ceremony_completed BOOLEAN DEFAULT false,
  ceremony_date TIMESTAMPTZ,
  milestones JSONB DEFAULT '[]'::jsonb,
  latest_mentor_message TEXT,
  latest_mentor_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_mentor_pairs_trainee ON mentor_pairs(trainee_id);
CREATE INDEX IF NOT EXISTS idx_mentor_pairs_mentor ON mentor_pairs(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentor_pairs_brand ON mentor_pairs(brand);
CREATE INDEX IF NOT EXISTS idx_mentor_pairs_status ON mentor_pairs(status);

-- 7. Mentor Messages table (師徒訊息)
CREATE TABLE IF NOT EXISTS mentor_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pair_id UUID NOT NULL REFERENCES mentor_pairs(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'daily' CHECK (message_type IN ('daily', 'encouragement', 'milestone', 'ceremony')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentor_messages_pair ON mentor_messages(pair_id);

-- 8. Mentorship Milestones table (師徒里程碑)
CREATE TABLE IF NOT EXISTS mentorship_milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pair_id UUID NOT NULL REFERENCES mentor_pairs(id) ON DELETE CASCADE,
  milestone_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  achieved_at TIMESTAMPTZ DEFAULT now(),
  celebrated BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_milestones_pair ON mentorship_milestones(pair_id);

ALTER TABLE mentor_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorship_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON mentor_pairs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON mentor_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON mentorship_milestones FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 9. User Profile Columns (個人檔案欄位)
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
