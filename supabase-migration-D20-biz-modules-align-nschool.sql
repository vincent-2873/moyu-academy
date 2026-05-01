-- ============================================================
-- D20: Phase B-1 BIZ module 對齊 nSchool 真實 8 步驟 + 加 4 本書
-- ============================================================
-- Date: 2026-05-01
-- Author: 第六輪 Claude (Vincent 拍板「Phase B 全部按順序」)
--
-- 範圍(對齊鐵則 — 基於 Vincent 既有 source 延伸):
--   1. UPDATE 既有 sparring module framework 對齊 nSchool 真實 8 步驟
--      (既有 D2 framework 是 OpenAI 從零腦補,跟 nSchool 真實對不上)
--   2. INSERT 4 本書 reading module(GROW / 黃金圈 / OKR / SPIN)
--      (D2 sparring 提到但沒獨立 module,Phase B-1 補)
--   3. 加 source_refs 到 Day 1-2 module(指向 nSchool 8 步驟 .md)
--   4. 加 audio_source_refs 到 Day 0「聽 5 份開發 CALL」(指向 8 個逐字)
--
-- Source path: content/training/sales/nschool/(commit b1cb3f6 已 copy 進 git tree)
-- 對齊 RAG ingest 後 knowledge_chunks 對應 chunks
-- ============================================================


-- ============================================================
-- PART 1: UPDATE 既有 sparring framework 對齊 nSchool 真實 8 步驟
-- ============================================================
-- 既有(D2): ["破冰","背景","經驗","動機","價值","教學","定價","行動"] (OpenAI 腦補)
-- 改成    : ["破冰","信任建立","需求探索","介紹nSchool","補充資訊","財經架構","產品引導與價值說明","行動邀請"] (nSchool 真實)

UPDATE training_modules
SET content = jsonb_set(
  content,
  '{framework}',
  '["破冰","信任建立","需求探索","介紹nSchool","補充資訊","財經架構","產品引導與價值說明","行動邀請"]'::jsonb
),
updated_at = NOW()
WHERE module_type = 'sparring'
  AND content ? 'framework';


-- ============================================================
-- PART 2: INSERT 4 本書 reading module
-- ============================================================
WITH biz_path AS (SELECT id FROM training_paths WHERE code = 'business_default')
INSERT INTO training_modules (path_id, day_offset, sequence, module_type, title, description, content, duration_min, required, reward)
SELECT bp.id, m.day_offset, m.seq, m.module_type, m.title, m.description, m.content::jsonb, m.duration_min, m.required, m.reward::jsonb
FROM biz_path bp,
(VALUES
  -- Day 1 課後補(選修):銷售方法論 4 本書,每本 30 min
  (1, 10, 'reading', '【書 1】銷售 GROW 模型',
   'Goal / Reality / Options / Will — 從單向介紹產品到雙向共創方案',
   '{"book":"GROW","framework":["Goal","Reality","Options","Will"],"source_ref":"sales/nschool/Categories/訓練中心/書本／課程/銷售GROW模型","summary":"找出學員真正的學習動機 → 釐清現況卡關 → 提供 2-3 個學習路徑 → 確認下一步具體行動。讓學員從內在動機出發,自主選擇並願意投入課程"}',
   30, false, '{}'),
  (1, 11, 'reading', '【書 2】黃金圈理論',
   'WHY → HOW → WHAT — 30 秒成交設計骨架(Simon Sinek)',
   '{"book":"黃金圈","framework":["WHY","HOW","WHAT"],"source_ref":"sales/nschool/Categories/訓練中心/書本／課程/黃金圈理論","summary":"成交是從動機開始。WHY 打動人心(不講產品)→ HOW 讓對方說出想改變 → WHAT 帶出產品特色又不被當推銷員"}',
   30, false, '{}'),
  (2, 10, 'reading', '【書 3】OKR 目標管理策略',
   'KPI 漏斗(撥多少通 → 通次 → 通時 → 邀約 → 出席 → 成交)拆解',
   '{"book":"OKR","framework":["Objective","Key Results","Action"],"source_ref":"sales/nschool/Categories/訓練中心/書本／課程/OKR目標管理策略","summary":"從只拼通數進化為數據導向 × 戰略進攻。把抗拒話術變成 KR 並追蹤優化,每天追的數據、做的事情、修正的方向都清楚"}',
   30, false, '{}'),
  (2, 11, 'reading', '【書 4】電話行銷 SPIN 實戰',
   'Situation / Problem / Implication / Need-Payoff — 讓客戶自己說出需求',
   '{"book":"SPIN","framework":["Situation","Problem","Implication","Need-Payoff"],"source_ref":"sales/nschool/Categories/訓練中心/書本／課程/電話行銷 SPIN 實戰","summary":"S 現況定位 / P 問題顯影 / I 影響放大 / N 價值收網。不是套路是引導力,讓客戶自己認同,新手照四個邏輯練習也能用專業方式對話"}',
   30, false, '{}')
) AS m(day_offset, seq, module_type, title, description, content, duration_min, required, reward)
ON CONFLICT (path_id, day_offset, sequence) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  content = EXCLUDED.content,
  duration_min = EXCLUDED.duration_min,
  reward = EXCLUDED.reward,
  updated_at = NOW();


-- ============================================================
-- PART 3: 加 source_refs(8 步驟 .md)到 Day 1-2 module
-- ============================================================
WITH biz_path AS (SELECT id FROM training_paths WHERE code = 'business_default')
UPDATE training_modules
SET content = content || jsonb_build_object(
  'source_refs', jsonb_build_array(
    'sales/nschool/Categories/訓練中心/開發檢核/破冰',
    'sales/nschool/Categories/訓練中心/開發檢核/信任建立',
    'sales/nschool/Categories/訓練中心/開發檢核/需求探索',
    'sales/nschool/Categories/訓練中心/開發檢核/介紹nSchool',
    'sales/nschool/Categories/訓練中心/開發檢核/補充資訊',
    'sales/nschool/Categories/訓練中心/開發檢核/財經架構',
    'sales/nschool/Categories/訓練中心/開發檢核/產品引導與價值說明',
    'sales/nschool/Categories/訓練中心/開發檢核/行動邀請'
  )
),
updated_at = NOW()
WHERE path_id = (SELECT id FROM biz_path)
  AND day_offset BETWEEN 1 AND 2
  AND module_type IN ('sparring', 'reading')
  AND NOT (content ? 'book');


-- ============================================================
-- PART 4: 加 audio_source_refs(8 個業務開發 Call 逐字)到 Day 0
-- ============================================================
WITH biz_path AS (SELECT id FROM training_paths WHERE code = 'business_default')
UPDATE training_modules
SET content = content || jsonb_build_object(
  'audio_source_refs', jsonb_build_array(
    'sales/nschool/Categories/訓練中心/業務開發Call_逐字訓練/NS__dev ver_cinv 1',
    'sales/nschool/Categories/訓練中心/業務開發Call_逐字訓練/NS_jobvexp dev ver_cinv 1-1',
    'sales/nschool/Categories/訓練中心/業務開發Call_逐字訓練/NS_jobvexp dev ver_cinv 1-2',
    'sales/nschool/Categories/訓練中心/業務開發Call_逐字訓練/NS_stvexp dev ver_cinv 1-3',
    'sales/nschool/Categories/訓練中心/業務開發Call_逐字訓練/NS_jobvexp dev ver_cinv 1-4',
    'sales/nschool/Categories/訓練中心/業務開發Call_逐字訓練/NS_jobvexp dev ver_cinv 1-5',
    'sales/nschool/Categories/訓練中心/業務開發Call_逐字訓練/NS_jobvexp dev ver_cinv 1-6',
    'sales/nschool/Categories/訓練中心/業務開發Call_逐字訓練/NS_jobvexp dev ver_cinv 1-7',
    'sales/nschool/Categories/訓練中心/業務開發Call_逐字訓練/NS_jobvexp dev ver_cinv 1-8'
  )
),
updated_at = NOW()
WHERE path_id = (SELECT id FROM biz_path)
  AND day_offset = 0
  AND title LIKE '%開發 CALL%';


-- ============================================================
-- VERIFY
-- ============================================================

-- 1. 預期 4 本書 module 已 INSERT
SELECT day_offset, sequence, title, content->>'book' AS book, content->>'source_ref' AS source_ref
FROM training_modules
WHERE path_id = (SELECT id FROM training_paths WHERE code = 'business_default')
  AND content ? 'book'
ORDER BY day_offset, sequence;

-- 2. 預期 sparring framework 對齊 nSchool 8 步驟
SELECT day_offset, sequence, title, content->'framework' AS framework
FROM training_modules
WHERE module_type = 'sparring'
  AND content ? 'framework'
ORDER BY day_offset, sequence;

-- 3. 預期 Day 1-2 module 有 source_refs
SELECT day_offset, sequence, title, jsonb_array_length(content->'source_refs') AS ref_count
FROM training_modules
WHERE path_id = (SELECT id FROM training_paths WHERE code = 'business_default')
  AND content ? 'source_refs'
ORDER BY day_offset, sequence;

-- 4. 預期 Day 0 module 有 audio_source_refs
SELECT day_offset, sequence, title, jsonb_array_length(content->'audio_source_refs') AS audio_count
FROM training_modules
WHERE path_id = (SELECT id FROM training_paths WHERE code = 'business_default')
  AND content ? 'audio_source_refs';

-- 5. 預期 business_default 21+4 = 25 個 module
SELECT COUNT(*) AS total_modules
FROM training_modules
WHERE path_id = (SELECT id FROM training_paths WHERE code = 'business_default');
