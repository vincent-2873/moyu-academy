-- D2: Seed training paths + 14 天業務 + 3 天招聘 module
-- Vincent 拍板:
--   - 業務 14 天(報到 Day 0 → 第二週畢業)
--   - 招聘 3 天(濃縮自原 7 天)
--   - 內容彈性 jsonb 存,後台可改

-- ========================================
-- 1. Seed training_paths (2 條主 path)
-- ========================================
INSERT INTO public.training_paths (code, path_type, brand, name, description) VALUES
  ('business_default', 'business', NULL, '業務 14 天養成', '從報到 Day 0 到第二週畢業 — 逐字稿 → 架構 → 邀約 → Demo → 成交'),
  ('recruit_default',  'recruit',  NULL, '招聘 3 天養成', '濃縮 3 天 — HRBP 6 階段通話 → 一面三段 → 二面五項評估')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ========================================
-- 2. Seed 業務 14 天 module
-- ========================================
WITH biz_path AS (
  SELECT id FROM public.training_paths WHERE code = 'business_default'
)
INSERT INTO public.training_modules (path_id, day_offset, sequence, module_type, title, description, content, duration_min, required, reward)
SELECT bp.id, m.day_offset, m.seq, m.module_type, m.title, m.description, m.content::jsonb, m.duration_min, m.required, m.reward::jsonb
FROM biz_path bp,
(VALUES
  -- Day 0: 報到日
  (0, 1, 'reading',    '合約導讀 + 集團介紹',         '了解墨宇生態、4 業務線、3 據點主管', '{"format":"slides","topic":"合約_集團_業務制度"}', 60,  true,  '{}'),
  (0, 2, 'video',      '聽 5 份開發 CALL',            '依品牌自動派 5 份開發 CALL 範本(財經/職能/實體/未來)', '{"format":"audio_list","auto_brand":true}', 90,  true,  '{}'),
  (0, 3, 'reading',    '產品 + 領域知識',             'Claude 把專業詞轉生活故事',          '{"format":"claude_story","mode":"jargon_to_story"}', 60,  true,  '{}'),
  (0, 4, 'sparring',   '兩兩對練(Day 0 收尾)',       'Claude 演客戶 / 同事互練,初次體驗逐字稿', '{"sparring_type":"verbatim","claude_persona":"curious_student"}', 60, true, '{"stamp":"初登場","rarity":"common"}'),
  -- Day 1: 逐字稿熟練
  (1, 1, 'video',      '顧問式開發說明(Alan)',       '影片:Alan 顧問式開發核心原則',       '{"video_url":""}', 30, true, '{}'),
  (1, 2, 'sparring',   '逐字稿對練 ≥ 3 次',           'Claude 即時三點評(順暢/邏輯/語氣)', '{"sparring_type":"verbatim","min_attempts":3,"eval_dimensions":["順暢","邏輯","語氣"]}', 120, true, '{}'),
  -- Day 2: 架構練熟
  (2, 1, 'sparring',   '自由架構對練',                '無逐字稿,按 8 步框架走',            '{"sparring_type":"framework","framework":["破冰","背景","經驗","動機","價值","教學","定價","行動"]}', 120, true, '{}'),
  (2, 2, 'sparring',   'Step 2/3 延伸話題深度',       'Claude 演 GROW / SPIN 客戶,延伸提問深度練習', '{"sparring_type":"deep_question","models":["GROW","SPIN"]}', 90, true, '{}'),
  -- Day 3: 邀約嘗試
  (3, 1, 'task',       '上機真打 → 第一通邀約',       '邀約 Pass 給學長,Claude 觀察學習',  '{"action":"real_call","handoff":"senior"}', 240, true, '{}'),
  -- Day 4: 邀約獨立
  (4, 1, 'task',       '邀約自己處理',                '異議處理 drill(預算/時間/沒興趣)', '{"action":"real_call","independent":true,"objection_drill":true}', 240, true, '{"stamp":"初試啼聲","rarity":"rare"}'),
  -- Day 5: Demo 教學
  (5, 1, 'video',      '學長帶 Demo 教學',            '觀摩 + 跟練',                       '{"video_url":"","mode":"observe_and_practice"}', 120, true, '{}'),
  -- Day 6: 第一單
  (6, 1, 'task',       '上機 + Demo 自己跑 → 出第一單', '出單系統自動蓋章',                  '{"action":"real_call_with_demo","stamp_on_close":true}', 360, true, '{"stamp":"劍未配妥","rarity":"epic"}'),
  -- Day 7: 一週驗收
  (7, 1, 'reflection', '第一週 KPI 自動結算 + Vincent / Yu 評語', '系統自動拉週 KPI + 訓練官覆核', '{"auto_kpi":true,"reviewer":"trainer"}', 60, true, '{}'),
  -- Day 8-10: 量
  (8,  1, 'task', '量化拼:通次 / 通時 / 邀約', '系統異常告警(撥打不足 / 接通率低)', '{"focus":"quantity","auto_alert":true}', 480, true, '{}'),
  (9,  1, 'task', '觀察學長 Demo 細節',         '上傳觀察 ≥ 3 通',                     '{"focus":"observation","min_uploads":3}', 240, true, '{}'),
  (10, 1, 'reading', '研究品牌差異(財經 / 職能 / 實體 / 未來)', '對比 4 業務線銷售切入差異', '{"compare":["finance","function","physical","future"]}', 90, true, '{}'),
  -- Day 11-13: 質
  (11, 1, 'task', '客單價 / 接通率 / 邀約率提升', 'Claude 戰情官每日診斷 + 處方', '{"focus":"quality","claude_diagnose":true}', 480, true, '{}'),
  (12, 1, 'sparring', '反對庫熟練(複利計算機 / ROI 拆解 / 報價儀式)', 'Claude 演強反對客戶', '{"sparring_type":"hard_objection"}', 120, true, '{}'),
  (13, 1, 'task', '客戶關係建立',                 '長線客戶 follow-up SOP',            '{"focus":"relationship"}', 240, true, '{}'),
  -- Day 14: 出師驗收
  (14, 1, 'reflection', '第二週 KPI 對比 + 三點評估 + 5 項面試評估自評', '系統自動 + Vincent 拍板畢業 / 延訓', '{"auto_kpi_compare":true,"self_eval":true,"final_judge":"vincent"}', 90, true, '{"stamp":"劍未配妥 出門已是江湖","rarity":"legendary"}')
) AS m(day_offset, seq, module_type, title, description, content, duration_min, required, reward)
ON CONFLICT (path_id, day_offset, sequence) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  content = EXCLUDED.content,
  duration_min = EXCLUDED.duration_min,
  reward = EXCLUDED.reward,
  updated_at = NOW();

-- ========================================
-- 3. Seed 招聘 3 天 module(濃縮)
-- ========================================
WITH rec_path AS (
  SELECT id FROM public.training_paths WHERE code = 'recruit_default'
)
INSERT INTO public.training_modules (path_id, day_offset, sequence, module_type, title, description, content, duration_min, required, reward)
SELECT rp.id, m.day_offset, m.seq, m.module_type, m.title, m.description, m.content::jsonb, m.duration_min, m.required, m.reward::jsonb
FROM rec_path rp,
(VALUES
  -- Day 0: HRBP 6 階段
  (0, 1, 'reading',  '合約 + 平台介紹 + HRBP 6 階段架構', '開場 1m / 破冰 2m / 介紹 3m / 工作 2m / 應對 5m / 邀約 2m', '{"stages":[{"name":"開場","duration":60},{"name":"破冰履歷","duration":120},{"name":"介紹職缺","duration":180},{"name":"工作內容","duration":120},{"name":"應對陳述","duration":300},{"name":"鎖定面試","duration":120}]}', 90, true, '{}'),
  (0, 2, 'video',    '聽 4 通 HRBP-CALL(001/002/003/004)', '系統自動標 6 階段時間軸 + 4 種情境(無經驗/金融/車禍/學習)', '{"audio_list":["HRBP-CALL-001","HRBP-CALL-002","HRBP-CALL-003","HRBP-CALL-004"],"auto_segment":true}', 90, true, '{}'),
  (0, 3, 'sparring', '非結構式對練(2 種 persona)',     'Claude 演求職者(楊嘉瑜風格 / 鄭繁星風格)', '{"sparring_type":"unstructured","personas":["生活平衡優先","快速決策"]}', 60, true, '{"stamp":"初登場","rarity":"common"}'),
  -- Day 1: 一面三段架構
  (1, 1, 'reading',  '一面三段架構',                    '自我介紹探索 5m / 制度吸引 5m / 邀約 2-3m', '{"stages":[{"name":"自我介紹探索","duration":300},{"name":"制度吸引","duration":300},{"name":"邀約或婉拒","duration":150}]}', 30, true, '{}'),
  (1, 2, 'sparring', '進階電訪 + 履歷判讀練習',         '上傳履歷 → AI 抽 3 個 talking point + Claude 演履歷主人', '{"action":"upload_resume","ai_analysis":true}', 90, true, '{}'),
  (1, 3, 'sparring', '一面模擬 + 挑戰感測試',           'Claude 演求職者,問「連續幾天沒成交能接受嗎」', '{"sparring_type":"interview","challenge_test":true}', 90, true, '{"stamp":"初試啼聲","rarity":"rare"}'),
  -- Day 2: 二面 + 系統 + 實戰
  (2, 1, 'reading',  '二面 5 項評估矩陣',               '資源投入 / 幹部潛力 / 文化延伸 / 情緒穩定 / 努力意願', '{"matrix":["資源投入","幹部潛力","文化延伸","情緒穩定","努力意願"]}', 30, true, '{}'),
  (2, 2, 'task',     '104 後台 + Lark + 撥 30 通',       '系統自動拉撥打數',                 '{"action":"real_calls","target":30,"systems":["104","Lark"]}', 360, true, '{}'),
  (2, 3, 'sparring', '識人 Checklist 引導表',            '公司角度 / HR 角度 / 主管角度 三層篩選', '{"checklist":["company","hr","manager"]}', 60, true, '{"stamp":"劍未配妥","rarity":"epic"}'),
  -- Day 3: 出師驗收 + 量產
  (3, 1, 'task',     '獨立面試 + 二面帶訓 + Onboarding 自動化', 'Lark / 行事曆 / 系統帳號自動派發', '{"action":"independent_interview","onboarding_auto":true}', 480, true, '{}'),
  (3, 2, 'reflection', '出師驗收 + 蛻變訪談自評',         '主管簽核 + 系統評估',               '{"reviewer":"manager","self_eval":true}', 60, true, '{"stamp":"劍未配妥 出門已是江湖","rarity":"legendary"}')
) AS m(day_offset, seq, module_type, title, description, content, duration_min, required, reward)
ON CONFLICT (path_id, day_offset, sequence) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  content = EXCLUDED.content,
  duration_min = EXCLUDED.duration_min,
  reward = EXCLUDED.reward,
  updated_at = NOW();

-- ========================================
-- 4. Verify
-- ========================================
SELECT
  tp.code AS path_code,
  COUNT(tm.id) AS module_count,
  MIN(tm.day_offset) AS first_day,
  MAX(tm.day_offset) AS last_day
FROM public.training_paths tp
LEFT JOIN public.training_modules tm ON tm.path_id = tp.id
GROUP BY tp.code
ORDER BY tp.code;

SELECT day_offset, sequence, title
FROM public.training_modules tm
JOIN public.training_paths tp ON tp.id = tm.path_id
WHERE tp.code = 'business_default'
ORDER BY day_offset, sequence;

SELECT day_offset, sequence, title
FROM public.training_modules tm
JOIN public.training_paths tp ON tp.id = tm.path_id
WHERE tp.code = 'recruit_default'
ORDER BY day_offset, sequence;
