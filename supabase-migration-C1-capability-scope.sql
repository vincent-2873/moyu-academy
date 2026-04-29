-- C 骨架 #1: capability_scope 欄位 + 19→5 角色映射
-- 目的: role(19 階級, 顯示用) + capability_scope(5 個, API/RLS scope 用) 並存

-- 1. 加 capability_scope 欄位
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS capability_scope text NOT NULL DEFAULT 'member'
    CHECK (capability_scope IN ('super_admin', 'brand_manager', 'team_leader', 'member', 'trainee'));

CREATE INDEX IF NOT EXISTS idx_users_capability_scope ON public.users(capability_scope);

-- 2. 自動 mapping 既有 role → capability_scope
UPDATE public.users SET capability_scope = CASE
  WHEN role IN ('super_admin', 'admin') OR module_role = 'super_admin' THEN 'super_admin'
  WHEN module_role IN ('ceo', 'coo', 'cfo', 'director') THEN 'super_admin'
  WHEN module_role IN ('brand_manager', 'sales_manager', 'recruit_manager', 'legal_manager') THEN 'brand_manager'
  WHEN module_role IN ('team_leader', 'trainer', 'mentor') THEN 'team_leader'
  WHEN module_role IN ('hr', 'legal_staff', 'sales_rep', 'recruiter') THEN 'member'
  WHEN module_role IN ('sales_rookie', 'recruit_rookie', 'intern') THEN 'trainee'
  ELSE 'member'
END
WHERE capability_scope = 'member';  -- 只更新預設值, 已手動設過的不動

-- 3. 確認 vincent 是 super_admin
UPDATE public.users
  SET capability_scope = 'super_admin'
  WHERE email IN ('vincent@xuemi.co', 'vincent@xplatform.world');

-- 4. Verify
SELECT
  capability_scope,
  COUNT(*) AS user_count
FROM public.users
GROUP BY capability_scope
ORDER BY CASE capability_scope
  WHEN 'super_admin' THEN 1
  WHEN 'brand_manager' THEN 2
  WHEN 'team_leader' THEN 3
  WHEN 'member' THEN 4
  WHEN 'trainee' THEN 5
END;
