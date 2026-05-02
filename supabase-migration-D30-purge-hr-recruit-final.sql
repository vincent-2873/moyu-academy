-- D30: 徹底砍 HR / 招募殘留 (2026-05-02 Wave 7)
-- Vincent 拍板:HR 砍了 == 還沒砍乾淨給我砍掉
-- D21 砍了部分,但 D4 demo seed 跟 brand=moyuhunt 還在

-- ─── 1. demo HR 帳號徹底砍(hr_rookie / hr_staff / hr_manager)──────────────
DELETE FROM training_assignments
 WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'hr_%@demo.moyu');

DELETE FROM users WHERE email LIKE 'hr_%@demo.moyu';

-- ─── 2. brand 規範化:只留 5 大 + null ─────────────────────────────────────
-- moyuhunt / MOYU / moyu / xplatform → null(這些都是非業務或舊命名)
UPDATE users
   SET brand = NULL
 WHERE brand IN ('moyuhunt', 'MOYU', 'moyu', 'xplatform');

-- ─── 3. recruits / recruit_funnel 殘留 table 砍 ────────────────────────────
DROP TABLE IF EXISTS recruit_funnel_stages CASCADE;
DROP TABLE IF EXISTS recruit_actions CASCADE;
DROP TABLE IF EXISTS recruit_pipeline CASCADE;
DROP TABLE IF EXISTS recruits CASCADE;

-- ─── 4. training_paths recruit 系列砍 ─────────────────────────────────────
DELETE FROM training_assignments
 WHERE path_id IN (SELECT id FROM training_paths WHERE code LIKE '%recruit%' OR stage_path = 'recruit');

DELETE FROM training_modules
 WHERE path_id IN (SELECT id FROM training_paths WHERE code LIKE '%recruit%' OR stage_path = 'recruit');

DELETE FROM training_paths WHERE code LIKE '%recruit%' OR stage_path = 'recruit';

-- ─── 5. users.stage_path = 'recruit' → null ──────────────────────────────
UPDATE users SET stage_path = NULL WHERE stage_path = 'recruit';

-- ─── 6. 砍 module_overrides recruit brand 殘留 ──────────────────────────
DELETE FROM module_overrides WHERE brand = 'moyuhunt';

-- ─── 7. 驗證 ──────────────────────────────────────────────────────────────
SELECT 'users with hr_ email' AS check_name, COUNT(*)::text AS value FROM users WHERE email LIKE 'hr_%@%'
UNION ALL
SELECT 'users brand=moyuhunt', COUNT(*)::text FROM users WHERE brand = 'moyuhunt'
UNION ALL
SELECT 'recruits table exists', CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='recruits') THEN '是' ELSE '已砍' END
UNION ALL
SELECT 'training_paths recruit', COUNT(*)::text FROM training_paths WHERE code LIKE '%recruit%' OR stage_path = 'recruit'
UNION ALL
SELECT 'users brand dist', STRING_AGG(brand || ':' || c::text, ' / ' ORDER BY c DESC)
  FROM (SELECT brand, COUNT(*) AS c FROM users GROUP BY brand) x
ORDER BY check_name;
