-- D8: 訓練 module video_url + audio_url placeholder
-- Vincent 之後可從後台 TrainingEditor 點 module → 改 content jsonb 填實際 url
-- 這個只是 placeholder, 讓 UI 有東西可以顯示 + Vincent 看到結構

-- 業務 path Day 1 #1: Alan 顧問式開發說明 (video)
UPDATE public.training_modules
SET content = jsonb_set(content, '{video_url}', to_jsonb(
  'https://www.youtube.com/embed/PLACEHOLDER_alan_consultative_development'::text
), true)
WHERE day_offset = 1 AND sequence = 1
  AND path_id = (SELECT id FROM training_paths WHERE code = 'business_default');

-- Day 5 #1: 學長 Demo 教學 (video)
UPDATE public.training_modules
SET content = jsonb_set(content, '{video_url}', to_jsonb(
  'https://www.youtube.com/embed/PLACEHOLDER_demo_walkthrough'::text
), true)
WHERE day_offset = 5 AND sequence = 1
  AND path_id = (SELECT id FROM training_paths WHERE code = 'business_default');

-- 招聘 Day 0 #2: HRBP CALL 4 通(audio_files 已有 placeholder labels)
UPDATE public.training_modules
SET content = jsonb_set(content, '{audio_files}', '[
  {"label": "HRBP-CALL-001 楊嘉瑜 (生活平衡優先)", "url": "/audio/hrbp-call-001.mp3", "duration_min": 18},
  {"label": "HRBP-CALL-002 鄭繁星 (金融背景快速決策)", "url": "/audio/hrbp-call-002.mp3", "duration_min": 14},
  {"label": "HRBP-CALL-003 游婉瑜 (車禍復原延後報到)", "url": "/audio/hrbp-call-003.mp3", "duration_min": 16},
  {"label": "HRBP-CALL-004 廖明凱 (學習驅動穩定轉職)", "url": "/audio/hrbp-call-004.mp3", "duration_min": 15}
]'::jsonb, true)
WHERE day_offset = 0 AND sequence = 2
  AND path_id = (SELECT id FROM training_paths WHERE code = 'recruit_default');

-- Verify
SELECT
  tp.code AS path,
  tm.day_offset,
  tm.sequence,
  tm.title,
  tm.content->>'video_url' AS video_url,
  jsonb_array_length(COALESCE(tm.content->'audio_files', '[]'::jsonb)) AS audio_files_count
FROM public.training_modules tm
JOIN public.training_paths tp ON tp.id = tm.path_id
WHERE (tm.content ? 'video_url' OR tm.content ? 'audio_files')
ORDER BY tp.code, tm.day_offset, tm.sequence;
