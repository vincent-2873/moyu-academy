-- C 骨架 #5: 訓練系統彈性 schema (Day 0 自動派發 + 業務/招募分流 + 遊戲化預留)
-- 設計原則: 兩條獨立路徑(business / recruit), 互不可見, 內容用 jsonb 彈性存

-- 1. training_paths(訓練路徑: business / recruit, 每品牌可獨立)
CREATE TABLE IF NOT EXISTS public.training_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,                  -- 'business_default' / 'recruit_default' / 'business_xlab' / etc
  path_type text NOT NULL CHECK (path_type IN ('business', 'recruit')),
  brand text,                                  -- NULL = 全品牌共用; 'xlab' / 'finance' / 'function' / 'kaohsiung' / etc
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_paths_type_brand ON public.training_paths(path_type, brand);

-- 2. training_modules(訓練單元 — 一個 module = 一個學習任務)
CREATE TABLE IF NOT EXISTS public.training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id uuid NOT NULL REFERENCES public.training_paths(id) ON DELETE CASCADE,
  day_offset int NOT NULL,                    -- Day 0 / Day 1 / Day 2... 從加入算
  sequence int NOT NULL,                       -- 同 day 內順序
  module_type text NOT NULL CHECK (module_type IN ('video', 'reading', 'quiz', 'sparring', 'task', 'reflection', 'live_session')),
  title text NOT NULL,
  description text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,  -- 彈性: video_url / quiz_questions / sparring_persona / task_instructions
  duration_min int,                            -- 預估完成時間(分鐘)
  required boolean DEFAULT true,
  unlock_condition jsonb DEFAULT '{}'::jsonb,  -- 解鎖條件(如必須先完成某 module)
  reward jsonb DEFAULT '{}'::jsonb,            -- 完成獎勵 (印章 stamp / 經驗值 / 階段升級)
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (path_id, day_offset, sequence)
);

CREATE INDEX IF NOT EXISTS idx_training_modules_path ON public.training_modules(path_id, day_offset, sequence);

-- 3. training_user_progress(每個 user 在每個 module 的進度)
CREATE TABLE IF NOT EXISTS public.training_user_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'failed')),
  score int,                                   -- 0-100 (測驗 / 對練)
  attempts int DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_training_progress_user ON public.training_user_progress(user_id, status);

-- 4. training_assignments(Day 0 自動派發紀錄)
CREATE TABLE IF NOT EXISTS public.training_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  path_id uuid NOT NULL REFERENCES public.training_paths(id),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  current_day int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'dropped')),
  assigned_by uuid REFERENCES public.users(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, path_id)
);

CREATE INDEX IF NOT EXISTS idx_training_assignments_user ON public.training_assignments(user_id, status);

-- 5. training_stamps(遊戲化: 完成 module 自動蓋印章)
CREATE TABLE IF NOT EXISTS public.training_stamps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stamp_code text NOT NULL,                    -- 'day0_complete' / 'first_call' / 'first_close' / 'master_xlab' / etc
  stamp_name text NOT NULL,
  rarity text DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  earned_at timestamptz NOT NULL DEFAULT NOW(),
  source_module_id uuid REFERENCES public.training_modules(id),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_training_stamps_user ON public.training_stamps(user_id, earned_at DESC);

-- 6. RLS: user 只看自己的 path_type (business/recruit), 互不可見
-- 政策: 業務員 (stage_path='business') 不可看招募 path/module/progress; 反之亦然
-- super_admin / brand_manager / team_leader 可看全部

-- (RLS policy 之後 F1 補, 現在 service_role 是 bypass)

-- 7. Verify
SELECT 'training_paths' AS table_name, COUNT(*)::text AS info FROM public.training_paths
UNION ALL SELECT 'training_modules', COUNT(*)::text FROM public.training_modules
UNION ALL SELECT 'training_user_progress', COUNT(*)::text FROM public.training_user_progress
UNION ALL SELECT 'training_assignments', COUNT(*)::text FROM public.training_assignments
UNION ALL SELECT 'training_stamps', COUNT(*)::text FROM public.training_stamps;
