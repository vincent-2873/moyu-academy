-- D21: Phase A 補刀 — 人資招募 104 全砍 DB cleanup
-- 對齊 Vincent 拍板(2026-05-01)+ system-tree v2(架構樹砍 hr / 招募 / 104)
--
-- 砍範圍:
--   1. training_modules WHERE path = recruit_default(D2 既有 11 個招募 module)
--   2. training_paths WHERE name = 'recruit_default'
--   3. 衍生表 row(path_completeness / module_effectiveness / training_module_progress
--      / training_stuck_handlings / claude_help_requests / roleplay_sessions)中
--      跟 recruit_default 綁定的
--   4. knowledge_chunks WHERE pillar = 'recruit' → 改 'common'(D19 處理 hr 一樣方式)
--   5. recruits / recruit_pipeline / interview_events / interview_scores
--      / recruit_documents table 內所有 row(table 留結構,row TRUNCATE)
--   6. users 角色 'recruit_manager' / 'recruiter' / 'recruit_rookie' / 'hr' / 'hrbp'
--      / 'mentor' / 'trainer' → 改 'staff'(對齊 system-tree v2 9 角色)
--
-- 執行方式:GitHub Actions workflow_dispatch → Apply Supabase Migration → 選 D21 file
--
-- ⚠️ Rollback:此 SQL 是 IDEMPOTENT(IF EXISTS / 條件 update),但 DELETE 後資料無法恢復。
--     如果要回復,從 D2 / D18 重新 seed(SQL 在 repo 內可重跑)。

-- ─── PART 1: 衍生表 cascade(避免 FK constraint 卡)─────────────────────────

-- 1.1 path_completeness
DELETE FROM path_completeness
WHERE path_id IN (SELECT id FROM training_paths WHERE name = 'recruit_default');

-- 1.2 module_effectiveness
DELETE FROM module_effectiveness
WHERE module_id IN (
  SELECT id FROM training_modules
  WHERE path_id IN (SELECT id FROM training_paths WHERE name = 'recruit_default')
);

-- 1.3 training_module_progress
DELETE FROM training_module_progress
WHERE module_id IN (
  SELECT id FROM training_modules
  WHERE path_id IN (SELECT id FROM training_paths WHERE name = 'recruit_default')
);

-- 1.4 training_stuck_handlings
DELETE FROM training_stuck_handlings
WHERE module_id IN (
  SELECT id FROM training_modules
  WHERE path_id IN (SELECT id FROM training_paths WHERE name = 'recruit_default')
);

-- 1.5 claude_help_requests
DELETE FROM claude_help_requests
WHERE module_id IN (
  SELECT id FROM training_modules
  WHERE path_id IN (SELECT id FROM training_paths WHERE name = 'recruit_default')
);

-- 1.6 roleplay_sessions(persona-related,非 module-bound 但 hr/recruit persona 也清)
-- 暫不動 roleplay_sessions(BIZ persona 有用),只清 module 綁的
-- 已存在 module_id 引用會 cascade 因為已 DELETE 上面

-- ─── PART 2: training_modules + training_paths(主表)──────────────────────

-- 2.1 砍招募 11 個 module
DELETE FROM training_modules
WHERE path_id IN (SELECT id FROM training_paths WHERE name = 'recruit_default');

-- 2.2 砍 recruit_default training path
DELETE FROM training_paths
WHERE name = 'recruit_default';

-- ─── PART 3: knowledge_chunks pillar='recruit' → 'common' ─────────────────

UPDATE knowledge_chunks
SET pillar = 'common'
WHERE pillar = 'recruit';

-- ─── PART 4: 招募業務表 TRUNCATE(留 schema,清 data)──────────────────────
-- 用 PL/pgSQL DO block 包,table 不存在時 skip(避免 fail)

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'recruits',
    'recruit_pipeline',
    'interview_events',
    'interview_scores',
    'recruit_documents',
    'outreach_104_queue',
    'outreach_104_logs'
  ]) LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('TRUNCATE TABLE %I CASCADE', t);
      RAISE NOTICE 'Truncated table: %', t;
    ELSE
      RAISE NOTICE 'Table % does not exist, skipped', t;
    END IF;
  END LOOP;
END $$;

-- ─── PART 5: users 角色 reclassify ─────────────────────────────────────────

-- system-tree v2 後台 9 角色:
--   投資人 / 董事 / 財務長 / Vincent(super_admin/ceo/coo/cfo/director)
--   AI 特助(super_admin) / AI 經營者(claude)
--   部門主管(sales_manager / legal_manager) / 組長(team_leader) / 一般員工(staff) / 新人(rookie)
--
-- 砍除舊角色: recruit_manager / recruiter / recruit_rookie / hr / hrbp / mentor / trainer
-- 全部 reclassify → 'staff'(以後 Vincent 手動再分組)

UPDATE users
SET role = 'staff'
WHERE role IN ('recruit_manager', 'recruiter', 'recruit_rookie', 'hr', 'hrbp', 'mentor', 'trainer');

-- ─── PART 6: verify(在 SQL editor 跑下面 SELECT 確認)───────────────────────

-- 預期值:
--   training_paths.name='recruit_default' → 0 row
--   training_modules path_id in recruit_default → 0 row
--   knowledge_chunks pillar='recruit' → 0 row(全變 common)
--   users role in (recruit_manager/recruiter/...) → 0 row
--
-- SELECT COUNT(*) FROM training_paths WHERE name = 'recruit_default';
-- SELECT COUNT(*) FROM training_modules
--   WHERE path_id IN (SELECT id FROM training_paths WHERE name = 'recruit_default');
-- SELECT COUNT(*) FROM knowledge_chunks WHERE pillar = 'recruit';
-- SELECT COUNT(*) FROM users WHERE role IN ('recruit_manager','recruiter','recruit_rookie','hr','hrbp','mentor','trainer');
