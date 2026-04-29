-- D4: 8 demo user (人資 / 業務 / 法務 × 主管 / 人員 / 新人) for Vincent 驗收登入畫面
-- 統一密碼: 0000 (demo, mustChangePassword = true)
-- email 用 demo.moyu domain (不送真實 email)

DO $$
DECLARE
  v_pwd_hash text;
BEGIN
  -- bcrypt hash of '0000'
  v_pwd_hash := crypt('0000', gen_salt('bf', 10));

  -- 8 demo user
  INSERT INTO public.users (email, password_hash, name, role, module_role, capability_scope, brand, stage, stage_path, is_active, must_change_password)
  VALUES
    -- 業務戰線 (3)
    ('sales_rookie@demo.moyu',  v_pwd_hash, '業務新人 Demo',  'sales_rookie',   'sales_rookie',   'trainee',       'nschool', 'beginner',     'business', true, true),
    ('sales_staff@demo.moyu',   v_pwd_hash, '業務人員 Demo',  'sales_rep',      'sales_rep',      'member',        'nschool', 'intermediate', 'business', true, true),
    ('sales_manager@demo.moyu', v_pwd_hash, '業務主管 Demo',  'sales_manager',  'sales_manager',  'brand_manager', 'nschool', 'master',       'business', true, true),
    -- 招募/人資戰線 (3)
    ('hr_rookie@demo.moyu',     v_pwd_hash, '人資新人 Demo',  'recruit_rookie', 'recruit_rookie', 'trainee',       'moyuhunt', 'beginner',     'recruit',  true, true),
    ('hr_staff@demo.moyu',      v_pwd_hash, '人資人員 Demo',  'recruiter',      'recruiter',      'member',        'moyuhunt', 'intermediate', 'recruit',  true, true),
    ('hr_manager@demo.moyu',    v_pwd_hash, '人資主管 Demo',  'recruit_manager','recruit_manager','brand_manager', 'moyuhunt', 'master',       'recruit',  true, true),
    -- 法務戰線 (2)
    ('legal_staff@demo.moyu',   v_pwd_hash, '法務人員 Demo',  'legal_staff',    'legal_staff',    'member',        'legal',   'intermediate', 'legal',    true, true),
    ('legal_manager@demo.moyu', v_pwd_hash, '法務主管 Demo',  'legal_manager',  'legal_manager',  'brand_manager', 'legal',   'master',       'legal',    true, true)
  ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    name          = EXCLUDED.name,
    role          = EXCLUDED.role,
    module_role   = EXCLUDED.module_role,
    capability_scope = EXCLUDED.capability_scope,
    brand         = EXCLUDED.brand,
    stage         = EXCLUDED.stage,
    stage_path    = EXCLUDED.stage_path,
    is_active     = true,
    must_change_password = true,
    updated_at    = NOW();
END $$;

-- 自動派 training assignment (Day 0 從今天起)
INSERT INTO public.training_assignments (user_id, path_id, start_date, current_day, status)
SELECT
  u.id,
  tp.id,
  CURRENT_DATE,
  0,
  'active'
FROM public.users u
JOIN public.training_paths tp ON
  (u.stage_path = 'business' AND tp.code = 'business_default')
  OR (u.stage_path = 'recruit' AND tp.code = 'recruit_default')
WHERE u.email LIKE '%@demo.moyu'
ON CONFLICT (user_id, path_id) DO NOTHING;

-- Verify
SELECT email, name, role, capability_scope, stage_path, stage
FROM public.users
WHERE email LIKE '%@demo.moyu'
ORDER BY
  CASE stage_path WHEN 'business' THEN 1 WHEN 'recruit' THEN 2 WHEN 'legal' THEN 3 ELSE 4 END,
  CASE stage WHEN 'beginner' THEN 1 WHEN 'intermediate' THEN 2 WHEN 'master' THEN 3 ELSE 4 END;

SELECT
  u.email,
  tp.code AS path,
  ta.start_date,
  ta.current_day
FROM public.training_assignments ta
JOIN public.users u ON u.id = ta.user_id
JOIN public.training_paths tp ON tp.id = ta.path_id
WHERE u.email LIKE '%@demo.moyu';
