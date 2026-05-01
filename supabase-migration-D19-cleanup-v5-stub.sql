-- ============================================================
-- D19: Cleanup v5 stub data + HR pillar reclassify (v2)
-- ============================================================
-- Date: 2026-05-01
-- Author: 第六輪 Claude (Vincent 拍板「HR 全砍 + 一次清理」)
--
-- v2 修正: D18 schema 衍生表(path_completeness / module_effectiveness /
--          training_module_progress / roleplay_sessions / training_stuck_handlings /
--          claude_help_requests)有 FK 引用 v5 path/module/persona,要先 cascade 刪
--
-- 範圍:
--   1. 先 DELETE 所有衍生表 row(對 v5 path/module/persona 的引用)
--   2. DELETE v5 28 個假 module
--   3. DELETE v5 6 個假 path
--   4. DELETE v5 2 個 persona seed
--   5. UPDATE knowledge_chunks pillar 'hr' → 'common'
--
-- 不動:
--   - D2 既有 path 'business_default' / 'recruit_default'
--   - D2 既有 21 + 11 個 business / recruit module
--   - D18 schema 7 張新表 schema 全留
--   - users 補 5 欄全留
-- ============================================================


-- ============================================================
-- PART 0: 先 cascade DELETE 衍生表 rows
-- ============================================================

-- 0.1 path_completeness (FK to training_paths)
DELETE FROM path_completeness
WHERE path_id IN (
  SELECT id FROM training_paths
  WHERE code IN (
    'sales_14d_nschool', 'sales_14d_xuemi', 'sales_14d_ooschool',
    'sales_14d_aischool', 'sales_14d_xlab', 'legal_3d'
  )
);

-- 0.2 module_effectiveness (FK to training_modules)
DELETE FROM module_effectiveness
WHERE module_id IN (
  SELECT m.id FROM training_modules m
  JOIN training_paths p ON m.path_id = p.id
  WHERE p.code IN (
    'sales_14d_nschool', 'sales_14d_xuemi', 'sales_14d_ooschool',
    'sales_14d_aischool', 'sales_14d_xlab', 'legal_3d'
  )
);

-- 0.3 training_stuck_handlings (FK to training_module_progress)
-- 先刪 stuck_handlings,因為它 FK 到 module_progress(下面要刪)
DELETE FROM training_stuck_handlings
WHERE progress_id IN (
  SELECT mp.id FROM training_module_progress mp
  JOIN training_modules m ON mp.module_id = m.id
  JOIN training_paths p ON m.path_id = p.id
  WHERE p.code IN (
    'sales_14d_nschool', 'sales_14d_xuemi', 'sales_14d_ooschool',
    'sales_14d_aischool', 'sales_14d_xlab', 'legal_3d'
  )
);

-- 0.4 claude_help_requests (FK to training_module_progress)
DELETE FROM claude_help_requests
WHERE related_progress_id IN (
  SELECT mp.id FROM training_module_progress mp
  JOIN training_modules m ON mp.module_id = m.id
  JOIN training_paths p ON m.path_id = p.id
  WHERE p.code IN (
    'sales_14d_nschool', 'sales_14d_xuemi', 'sales_14d_ooschool',
    'sales_14d_aischool', 'sales_14d_xlab', 'legal_3d'
  )
);

-- 0.5 training_module_progress (FK to training_modules)
DELETE FROM training_module_progress
WHERE module_id IN (
  SELECT m.id FROM training_modules m
  JOIN training_paths p ON m.path_id = p.id
  WHERE p.code IN (
    'sales_14d_nschool', 'sales_14d_xuemi', 'sales_14d_ooschool',
    'sales_14d_aischool', 'sales_14d_xlab', 'legal_3d'
  )
);

-- 0.6 roleplay_sessions (FK to training_modules + roleplay_personas)
DELETE FROM roleplay_sessions
WHERE module_id IN (
  SELECT m.id FROM training_modules m
  JOIN training_paths p ON m.path_id = p.id
  WHERE p.code IN (
    'sales_14d_nschool', 'sales_14d_xuemi', 'sales_14d_ooschool',
    'sales_14d_aischool', 'sales_14d_xlab', 'legal_3d'
  )
)
OR persona_id IN (
  SELECT id FROM roleplay_personas WHERE name IN ('楊嘉瑜風格', '鄭繁星風格')
);


-- ============================================================
-- PART 1: DELETE v5 28 個假 module
-- ============================================================
DELETE FROM training_modules
WHERE path_id IN (
  SELECT id FROM training_paths
  WHERE code IN (
    'sales_14d_nschool', 'sales_14d_xuemi', 'sales_14d_ooschool',
    'sales_14d_aischool', 'sales_14d_xlab', 'legal_3d'
  )
);


-- ============================================================
-- PART 2: DELETE v5 6 個假 path
-- ============================================================
DELETE FROM training_paths
WHERE code IN (
  'sales_14d_nschool', 'sales_14d_xuemi', 'sales_14d_ooschool',
  'sales_14d_aischool', 'sales_14d_xlab', 'legal_3d'
);


-- ============================================================
-- PART 3: DELETE v5 2 個 persona seed
-- ============================================================
DELETE FROM roleplay_personas
WHERE name IN ('楊嘉瑜風格', '鄭繁星風格');


-- ============================================================
-- PART 4: UPDATE knowledge_chunks pillar 'hr' → 'common'
-- ============================================================
UPDATE knowledge_chunks
SET pillar = 'common'
WHERE pillar = 'hr';


-- ============================================================
-- VERIFY
-- ============================================================

-- 1. 預期 0(v5 6 path 都刪了)
SELECT COUNT(*) AS v5_paths_remaining FROM training_paths
WHERE code IN (
  'sales_14d_nschool', 'sales_14d_xuemi', 'sales_14d_ooschool',
  'sales_14d_aischool', 'sales_14d_xlab', 'legal_3d'
);

-- 2. 預期 2(business_default + recruit_default 留)
SELECT code, name FROM training_paths ORDER BY code;

-- 3. 預期 0(v5 personas 都刪了)
SELECT COUNT(*) AS v5_personas_remaining FROM roleplay_personas
WHERE name IN ('楊嘉瑜風格', '鄭繁星風格');

-- 4. 預期 0(hr pillar 全 reclassify)
SELECT COUNT(*) AS hr_chunks_remaining FROM knowledge_chunks WHERE pillar = 'hr';

-- 5. 看 module 殘留(預期 ~32 D2 既有)
SELECT path_id, COUNT(*) AS module_count
FROM training_modules
GROUP BY path_id
ORDER BY module_count DESC;
