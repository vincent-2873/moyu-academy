-- ============================================================
-- D19: Cleanup v5 stub data + HR pillar reclassify
-- ============================================================
-- Date: 2026-05-01
-- Author: 第六輪 Claude (Vincent 拍板「HR 全砍 + 一次清理」)
--
-- 範圍:
--   1. DELETE v5 (D18) 加的 6 個 stub path + 對應 28 個假 module
--   2. DELETE v5 (D18) 加的 2 個 persona seed(楊嘉瑜 / 鄭繁星)
--   3. UPDATE knowledge_chunks pillar 'hr' → 'common'(資料保留,只重新分類)
--
-- 不動:
--   - D2 既有 path 'business_default' / 'recruit_default' 兩 row
--   - D2 既有 21 + 11 個 business / recruit module(內容對齊 nSchool 真實架構)
--   - D18 schema 7 張新表 schema 全留
--   - users 補 5 欄全留
--   - knowledge_chunks 22 個 HR chunks 內容全留(只 pillar 改 'common')
--
-- 安全性:
--   - 全部走 DELETE/UPDATE,可逆
--   - 跑前建議 Take Backup
-- ============================================================


-- ============================================================
-- PART 1: DELETE v5 28 個假 module(先刪子,後刪父)
-- ============================================================
DELETE FROM training_modules
WHERE path_id IN (
  SELECT id FROM training_paths
  WHERE code IN (
    'sales_14d_nschool',
    'sales_14d_xuemi',
    'sales_14d_ooschool',
    'sales_14d_aischool',
    'sales_14d_xlab',
    'legal_3d'
  )
);


-- ============================================================
-- PART 2: DELETE v5 6 個假 path
-- ============================================================
DELETE FROM training_paths
WHERE code IN (
  'sales_14d_nschool',
  'sales_14d_xuemi',
  'sales_14d_ooschool',
  'sales_14d_aischool',
  'sales_14d_xlab',
  'legal_3d'
);


-- ============================================================
-- PART 3: DELETE v5 2 個 persona seed
-- ============================================================
DELETE FROM roleplay_personas
WHERE name IN ('楊嘉瑜風格', '鄭繁星風格');


-- ============================================================
-- PART 4: UPDATE knowledge_chunks pillar 'hr' → 'common'
-- ============================================================
-- HR pillar 已從架構移除,既有 22 chunks 改分類為 common(全員可見)
-- (實際 chunks 內容是業務開發 / 招聘 SOP / 公司介紹混合,common 比較合理)
UPDATE knowledge_chunks
SET pillar = 'common'
WHERE pillar = 'hr';


-- ============================================================
-- VERIFY
-- ============================================================

-- 1. 預期 0 row(v5 6 path 都刪了)
SELECT COUNT(*) AS v5_paths_remaining FROM training_paths
WHERE code IN (
  'sales_14d_nschool', 'sales_14d_xuemi', 'sales_14d_ooschool',
  'sales_14d_aischool', 'sales_14d_xlab', 'legal_3d'
);

-- 2. 預期 2 row(business_default + recruit_default 留著)
SELECT code, name FROM training_paths ORDER BY code;

-- 3. 預期 0 row(v5 2 persona 都刪了)
SELECT COUNT(*) AS v5_personas_remaining FROM roleplay_personas
WHERE name IN ('楊嘉瑜風格', '鄭繁星風格');

-- 4. 預期 0 row(hr pillar 全 reclassify)
SELECT COUNT(*) AS hr_chunks_remaining FROM knowledge_chunks WHERE pillar = 'hr';

-- 5. 看 module 殘留(預期 21 + 11 = 32 左右,D2 既有)
SELECT path_id, COUNT(*) AS module_count
FROM training_modules
GROUP BY path_id
ORDER BY module_count DESC;
