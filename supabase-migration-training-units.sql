-- ================================================================
-- Migration: training_units + training_unit_progress
-- 目的：為「新訓區域」建立統一訓練單元資料層
-- 對應文件：moyu-training-system zip 的 audit report
-- 依賴：hr_training_progress 已存在（不衝突，作為 legacy 並行）
-- 作者：Claude Code
-- 日期：2026-04-23
-- ================================================================

-- ----------------------------------------------------------------
-- 1. training_units：訓練單元主表（對應 moyu-training-system 的 HR-053/054/055/056 等）
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_units (
  id BIGSERIAL PRIMARY KEY,
  unit_code TEXT UNIQUE NOT NULL,                -- 'HR-053', 'HR-054' ...
  system TEXT NOT NULL CHECK (system IN ('HR','BIZ','LEGAL')),
  title TEXT NOT NULL,
  audience TEXT[] NOT NULL,                       -- {'HR-INT'}, {'ALL','NEW'}
  priority TEXT NOT NULL CHECK (priority IN ('P0','P1','P2')),
  series TEXT,                                    -- 'HRBP_RECRUIT_V1'
  series_position INT,                            -- 1..4
  series_total INT,                               -- 4
  video_url TEXT,                                 -- Supabase Storage signed URL
  video_duration_seconds INT,
  interactive_html_url TEXT,                      -- 互動測驗 html 位置
  handbook_md TEXT,                               -- 手冊 Markdown 原文（可 null）
  prerequisite_units TEXT[],                      -- {'HR-051','HR-052'}
  learning_objectives JSONB,                      -- [{audience, behavior, condition, degree}]
  key_points TEXT[],                              -- 關鍵知識點
  source_repo TEXT DEFAULT 'moyu-training-system',
  source_commit TEXT,                             -- GitHub commit sha of input.md
  legacy_task_id BIGINT,                          -- 舊 hr_training_tasks.id 對映（可 null）
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_units_series_position ON training_units(series, series_position);
CREATE INDEX IF NOT EXISTS idx_training_units_system_priority ON training_units(system, priority);
CREATE INDEX IF NOT EXISTS idx_training_units_published ON training_units(published) WHERE published = true;

-- ----------------------------------------------------------------
-- 2. training_unit_progress：個人進度（接 postMessage 寫入）
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_unit_progress (
  id BIGSERIAL PRIMARY KEY,
  trainee_email TEXT NOT NULL,
  unit_code TEXT NOT NULL REFERENCES training_units(unit_code) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('not_started','watching','quiz_pending','passed','failed')),
  score INT,
  total INT,
  passed BOOLEAN,
  series_complete BOOLEAN DEFAULT false,           -- EP4 結尾會帶這個
  first_viewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempt_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trainee_email, unit_code)
);

CREATE INDEX IF NOT EXISTS idx_training_progress_email ON training_unit_progress(trainee_email);
CREATE INDEX IF NOT EXISTS idx_training_progress_status ON training_unit_progress(status);

-- ----------------------------------------------------------------
-- 3. RLS policies（遵循 moyu-academy 4/23 security sprint 後的統一原則）
-- ----------------------------------------------------------------
ALTER TABLE training_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_unit_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all ON training_units
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY published_read ON training_units
  FOR SELECT USING (published = true);

CREATE POLICY service_role_all ON training_unit_progress
  FOR ALL USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------
-- 4. updated_at 自動更新
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at_training()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_training_units_updated
  BEFORE UPDATE ON training_units
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_training();

CREATE TRIGGER trg_training_unit_progress_updated
  BEFORE UPDATE ON training_unit_progress
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_training();

-- ----------------------------------------------------------------
-- 5. Seed：HRBP 招募訓練系列（EP1-4）骨架，實際 URL 由 sync job 回填
-- ----------------------------------------------------------------
INSERT INTO training_units (unit_code, system, title, audience, priority, series, series_position, series_total, video_duration_seconds, prerequisite_units, published)
VALUES
  ('HR-053','HR','業務敘薪制度全解析',    ARRAY['HR-INT'],'P0','HRBP_RECRUIT_V1',1,4,1080, ARRAY['HR-051','HR-052'], false),
  ('HR-054','HR','一面 vs 二面：面試的任務分工', ARRAY['HR-INT'],'P0','HRBP_RECRUIT_V1',2,4, 660, ARRAY['HR-053'], false),
  ('HR-055','HR','電訪心法 · 三階段回覆法', ARRAY['HR-INT'],'P0','HRBP_RECRUIT_V1',3,4, 900, ARRAY['HR-053','HR-054'], false),
  ('HR-056','HR','致命提問應對 · 業績壓力與團隊氛圍', ARRAY['HR-INT'],'P0','HRBP_RECRUIT_V1',4,4, 660, ARRAY['HR-053','HR-054','HR-055'], false)
ON CONFLICT (unit_code) DO NOTHING;
