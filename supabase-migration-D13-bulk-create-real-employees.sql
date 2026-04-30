-- D13 一次性 bulk 建立 真實員工 user account
-- 來源:sales_metrics_daily (Metabase 同步進來的)
-- 過濾:name LIKE '新訓-' / '新訓 ' / '新訓:' 不算
-- 預設:password = 0000 (取 vincent@xuemi.co 同 bcrypt hash) / role=staff / stage=intermediate / stage_path=business
--
-- ⚠️ 員工首次登入後,請通知改密碼 (CLAUDE.md 紅線 1 安全建議)

-- 預先看會建多少
SELECT COUNT(DISTINCT smd.email) AS will_insert
FROM public.sales_metrics_daily smd
LEFT JOIN public.users u ON LOWER(u.email) = LOWER(smd.email)
WHERE u.email IS NULL
  AND smd.email IS NOT NULL
  AND TRIM(smd.email) <> ''
  AND smd.name IS NOT NULL
  AND smd.name NOT LIKE '新訓-%'
  AND smd.name NOT LIKE '新訓 %'
  AND smd.name NOT LIKE '新訓:%';

-- 真正 INSERT
WITH default_hash AS (
  SELECT password_hash FROM public.users WHERE email = 'vincent@xuemi.co' LIMIT 1
),
candidates AS (
  SELECT DISTINCT ON (LOWER(smd.email))
    LOWER(smd.email) AS email,
    smd.name,
    smd.brand,
    smd.date
  FROM public.sales_metrics_daily smd
  WHERE smd.email IS NOT NULL
    AND TRIM(smd.email) <> ''
    AND smd.name IS NOT NULL
    AND smd.name NOT LIKE '新訓-%'
    AND smd.name NOT LIKE '新訓 %'
    AND smd.name NOT LIKE '新訓:%'
  ORDER BY LOWER(smd.email), smd.date DESC
)
INSERT INTO public.users (email, name, brand, role, stage, stage_path, password_hash, is_active, created_at)
SELECT
  c.email,
  c.name,
  c.brand,
  'staff',
  'intermediate',
  'business',
  (SELECT password_hash FROM default_hash),
  true,
  NOW()
FROM candidates c
LEFT JOIN public.users u ON LOWER(u.email) = c.email
WHERE u.email IS NULL
ON CONFLICT (email) DO NOTHING;

-- 結果確認
SELECT
  (SELECT COUNT(*) FROM public.users)::int AS users_total_after,
  (SELECT COUNT(*) FROM public.users WHERE created_at >= NOW() - INTERVAL '5 minutes')::int AS just_inserted,
  (SELECT COUNT(*) FROM public.users WHERE is_active = true)::int AS users_active_after;
