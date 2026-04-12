-- 招聘漏斗 + 104 發信追蹤
-- 執行位置: Supabase Dashboard → SQL Editor
-- 安全: IF NOT EXISTS, 可重複執行

-- 1. 候選人追蹤 (recruits 表已存在，這裡補欄位)
ALTER TABLE recruits
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT '104',
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS interview_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reject_reason TEXT,
  ADD COLUMN IF NOT EXISTS salary_expected TEXT,
  ADD COLUMN IF NOT EXISTS resume_url TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. 104 發信追蹤表
CREATE TABLE IF NOT EXISTS outreach_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_email TEXT,
  candidate_name TEXT NOT NULL,
  platform TEXT DEFAULT '104',       -- 104 / LinkedIn / 自招 / referral
  job_title TEXT,                    -- 招聘的職位
  brand TEXT,                        -- 目標品牌 (nschool / xuemi / ooschool / aischool / moyuhunt)
  message_template TEXT,             -- 用的信件模板
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'sent',        -- sent / viewed / replied / interview_scheduled / no_response
  response_at TIMESTAMPTZ,
  response_text TEXT,
  follow_up_count INT DEFAULT 0,
  last_follow_up_at TIMESTAMPTZ,
  owner_email TEXT NOT NULL,         -- 負責這個發信的 recruiter
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_log_status ON outreach_log(status);
CREATE INDEX IF NOT EXISTS idx_outreach_log_owner ON outreach_log(owner_email);
CREATE INDEX IF NOT EXISTS idx_outreach_log_platform ON outreach_log(platform);

-- 3. 招聘排程 (每週要發多少信、目前進度)
CREATE TABLE IF NOT EXISTS recruit_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,          -- 週一
  brand TEXT NOT NULL,
  target_outreach INT DEFAULT 50,    -- 本週目標發信數
  actual_outreach INT DEFAULT 0,     -- 已發信數
  target_interviews INT DEFAULT 5,   -- 目標面試數
  actual_interviews INT DEFAULT 0,   -- 已面試數
  target_hires INT DEFAULT 1,        -- 目標錄取數
  actual_hires INT DEFAULT 0,        -- 已錄取數
  owner_email TEXT,                  -- 負責 recruiter
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recruit_schedule_week ON recruit_schedule(week_start);

-- RLS bypass (service role)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_outreach_log') THEN
    CREATE POLICY "service_role_all_outreach_log" ON outreach_log FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_recruit_schedule') THEN
    CREATE POLICY "service_role_all_recruit_schedule" ON recruit_schedule FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
