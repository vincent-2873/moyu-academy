-- C 骨架 #2: user_stages 簡化版(主管手動設, 不自動 metric 觸發)
-- 稱號: 研墨者 / 執筆者 / 點墨者 / 執印者
-- 路徑: business / recruit / legal / common

-- 1. 加 stage 相關欄位到 users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'beginner'
    CHECK (stage IN ('beginner', 'intermediate', 'advanced', 'master')),
  ADD COLUMN IF NOT EXISTS stage_path text NOT NULL DEFAULT 'common'
    CHECK (stage_path IN ('business', 'recruit', 'legal', 'common')),
  ADD COLUMN IF NOT EXISTS stage_set_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS stage_set_at timestamptz DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS stage_note text;

CREATE INDEX IF NOT EXISTS idx_users_stage ON public.users(stage, stage_path);

-- 2. stage_history table(留變更紀錄, 之後可分析「平均畢業時間」spec L1.2.3)
CREATE TABLE IF NOT EXISTS public.user_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  stage_path text NOT NULL,
  changed_by uuid REFERENCES public.users(id),
  changed_at timestamptz NOT NULL DEFAULT NOW(),
  note text
);

CREATE INDEX IF NOT EXISTS idx_user_stage_history_user_id ON public.user_stage_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stage_history_changed_at ON public.user_stage_history(changed_at DESC);

-- 3. Trigger: 改 stage 自動寫 history
CREATE OR REPLACE FUNCTION log_user_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage OR OLD.stage_path IS DISTINCT FROM NEW.stage_path THEN
    INSERT INTO public.user_stage_history (user_id, from_stage, to_stage, stage_path, changed_by, note)
    VALUES (NEW.id, OLD.stage, NEW.stage, NEW.stage_path, NEW.stage_set_by, NEW.stage_note);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_user_stage_change ON public.users;
CREATE TRIGGER trg_log_user_stage_change
  AFTER UPDATE OF stage, stage_path ON public.users
  FOR EACH ROW EXECUTE FUNCTION log_user_stage_change();

-- 4. Seed: 自動依 role 給每個既有 user 預設 stage
UPDATE public.users SET
  stage = CASE
    WHEN module_role IN ('super_admin', 'ceo', 'coo', 'cfo', 'director') THEN 'master'
    WHEN module_role IN ('brand_manager', 'sales_manager', 'recruit_manager', 'legal_manager', 'trainer', 'mentor') THEN 'master'
    WHEN module_role IN ('team_leader') THEN 'advanced'
    WHEN module_role IN ('sales_rep', 'recruiter', 'hr', 'legal_staff') THEN 'intermediate'
    WHEN module_role IN ('sales_rookie', 'recruit_rookie', 'intern') THEN 'beginner'
    ELSE 'beginner'
  END,
  stage_path = CASE
    WHEN module_role IN ('sales_rep', 'sales_rookie', 'sales_manager') THEN 'business'
    WHEN module_role IN ('recruiter', 'recruit_rookie', 'recruit_manager', 'hr') THEN 'recruit'
    WHEN module_role IN ('legal_staff', 'legal_manager') THEN 'legal'
    ELSE 'common'
  END,
  stage_set_at = NOW()
WHERE stage_set_at IS NULL OR stage = 'beginner';

-- 5. Verify
SELECT stage, stage_path, COUNT(*) AS cnt
FROM public.users
GROUP BY stage, stage_path
ORDER BY stage_path,
  CASE stage WHEN 'beginner' THEN 1 WHEN 'intermediate' THEN 2 WHEN 'advanced' THEN 3 WHEN 'master' THEN 4 END;
