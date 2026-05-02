-- D30 v2: 徹底砍 HR / 招募殘留 (2026-05-02 Wave 7)
-- Vincent 拍板:HR 砍了 == 還沒砍乾淨給我砍掉
-- v2:每個 statement 用 DO $$ EXCEPTION 包,任一 table/column 不存在不擋整個 migration

-- ─── 1. demo HR 帳號徹底砍 ────────────────────────────────────────────
DO $$
BEGIN
  DELETE FROM training_assignments
   WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'hr_%@demo.moyu');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'training_assignments cleanup skipped: %', SQLERRM;
END $$;

DELETE FROM users WHERE email LIKE 'hr_%@demo.moyu';

-- ─── 2. brand 規範化 ──────────────────────────────────────────────────
UPDATE users SET brand = NULL
 WHERE brand IN ('moyuhunt', 'MOYU', 'moyu', 'xplatform');

-- ─── 3. recruits / recruit_funnel 殘留 table 砍(若存在)────────────
DROP TABLE IF EXISTS recruit_funnel_stages CASCADE;
DROP TABLE IF EXISTS recruit_actions CASCADE;
DROP TABLE IF EXISTS recruit_pipeline CASCADE;
DROP TABLE IF EXISTS recruits CASCADE;

-- ─── 4. training_paths recruit 砍(若 table + column 存在)─────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='training_paths' AND column_name='stage_path'
  ) THEN
    DELETE FROM training_assignments
     WHERE path_id IN (SELECT id FROM training_paths WHERE code LIKE '%recruit%' OR stage_path = 'recruit');
    DELETE FROM training_modules
     WHERE path_id IN (SELECT id FROM training_paths WHERE code LIKE '%recruit%' OR stage_path = 'recruit');
    DELETE FROM training_paths WHERE code LIKE '%recruit%' OR stage_path = 'recruit';
  ELSE
    -- 沒 stage_path column,只用 code 過濾
    DELETE FROM training_assignments
     WHERE path_id IN (SELECT id FROM training_paths WHERE code LIKE '%recruit%');
    DELETE FROM training_modules
     WHERE path_id IN (SELECT id FROM training_paths WHERE code LIKE '%recruit%');
    DELETE FROM training_paths WHERE code LIKE '%recruit%';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'training_paths recruit cleanup skipped: %', SQLERRM;
END $$;

-- ─── 5. users.stage_path = 'recruit' ──────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='users' AND column_name='stage_path'
  ) THEN
    UPDATE users SET stage_path = NULL WHERE stage_path = 'recruit';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'users.stage_path cleanup skipped: %', SQLERRM;
END $$;

-- ─── 6. module_overrides.brand=moyuhunt ──────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='module_overrides' AND column_name='brand'
  ) THEN
    DELETE FROM module_overrides WHERE brand = 'moyuhunt';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'module_overrides cleanup skipped: %', SQLERRM;
END $$;

-- ─── 驗證 ────────────────────────────────────────────────────────────
SELECT brand, COUNT(*) AS users
FROM users
GROUP BY brand
ORDER BY users DESC NULLS LAST;
