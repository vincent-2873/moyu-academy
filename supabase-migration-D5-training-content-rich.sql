-- D5: 補訓練 module content jsonb 詳細內容
-- 從 4 sub-agent 結果抽:
-- - 8 步銷售 SOP (X-LAB 驗證)
-- - HRBP 6 階段通話結構
-- - GROW / SPIN / 黃金圈
-- - 三點評估 (順暢/邏輯/語氣)
-- - 訓練官 Yu LINE 群實戰節奏
-- - Vincent 8 句口頭禪

-- ─────────────────────────────────────
-- 業務 path module 內容補
-- ─────────────────────────────────────

-- Day 0 #2: 聽 5 份開發 CALL
UPDATE public.training_modules
SET content = jsonb_build_object(
  'format', 'audio_list',
  'auto_brand', true,
  'audio_files', jsonb_build_array(
    jsonb_build_object('label', 'nSchool 財經 開發 CALL #1', 'duration_min', 18, 'focus', '破冰 + 投資痛點挖掘', 'key_points', jsonb_build_array('股市詐騙開場','報牌現象切入','學用落差製造恐懼')),
    jsonb_build_object('label', 'XLab AI 自動化 開發 CALL #2', 'duration_min', 22, 'focus', '6 階段轉折表(完整版)', 'key_points', jsonb_build_array('身份確認','背景探索','動機詢問','價值疊加','分期定價','行動呼籲')),
    jsonb_build_object('label', '無限學院 開發 CALL #3', 'duration_min', 16, 'focus', '案源配對 + 接案 ROI', 'key_points', jsonb_build_array('20+ 案源分類','正式業務晉級路徑','專案配組')),
    jsonb_build_object('label', '學米 XUEMI 開發 CALL #4', 'duration_min', 14, 'focus', 'GROW + OKR + 黃金圈三模型', 'key_points', jsonb_build_array('G 真正職涯目標','R 釐清瓶頸','O 提供 2-3 路徑','W 行動意願')),
    jsonb_build_object('label', '財經學院 拒絕處理 開發 CALL #5', 'duration_min', 19, 'focus', '異議處理 + 三階段回覆法', 'key_points', jsonb_build_array('標準回覆','延伸例子','反問球回'))
  ),
  'instructions', '邊聽邊標記:語氣語調 / 框架 Step2/3 延伸話題 / 你會被打動的瞬間。每通寫 200 字心得在右側 panel。',
  'eval', jsonb_build_array('框架完整度','語氣語調','延伸話題深度')
)
WHERE id IN (SELECT id FROM training_modules WHERE day_offset = 0 AND sequence = 2 AND path_id = (SELECT id FROM training_paths WHERE code = 'business_default'));

-- Day 1 #2: 逐字稿對練
UPDATE public.training_modules
SET content = jsonb_build_object(
  'sparring_type', 'verbatim',
  'min_attempts', 3,
  'eval_dimensions', jsonb_build_array('順暢','邏輯','語氣'),
  'eval_rubric', jsonb_build_object(
    '順暢', '無卡頓 / 過長停頓 / 結巴 (≥ 80 分)',
    '邏輯', '依架構順序走, 不跳步 / 漏步 (≥ 80 分)',
    '語氣', '自然 / 邊講邊笑 / 不急躁 (≥ 80 分)'
  ),
  'partner_rotation', '兩人組,輪流業務/客戶,完成後系統自動調閱 Call 給彼此聽',
  'min_score_to_pass', 60,
  'auto_grader', 'claude-sonnet-4-6',
  'objection_practice', jsonb_build_array('沒興趣','沒時間','沒預算','再看看','要跟家人討論','已經在學別的')
)
WHERE id IN (SELECT id FROM training_modules WHERE day_offset = 1 AND sequence = 2 AND path_id = (SELECT id FROM training_paths WHERE code = 'business_default'));

-- Day 2 #1: 自由架構對練
UPDATE public.training_modules
SET content = jsonb_build_object(
  'sparring_type', 'framework',
  'framework_8_step', jsonb_build_array(
    jsonb_build_object('step', 1, 'name', '破冰', 'duration_sec', 90, 'must_say', jsonb_build_array('身份確認','問候')),
    jsonb_build_object('step', 2, 'name', '背景探索', 'duration_sec', 120, 'must_say', jsonb_build_array('就學/在職','過去經驗','轉職方向')),
    jsonb_build_object('step', 3, 'name', '經驗確認', 'duration_sec', 90, 'must_say', jsonb_build_array('專業背景','學習歷程','瓶頸點')),
    jsonb_build_object('step', 4, 'name', '動機詢問', 'duration_sec', 120, 'must_say', jsonb_build_array('學習目標','應用領域排序','期待產出')),
    jsonb_build_object('step', 5, 'name', '價值疊加', 'duration_sec', 180, 'must_say', jsonb_build_array('案例介紹','市場行情','學用落差')),
    jsonb_build_object('step', 6, 'name', '教學說明', 'duration_sec', 150, 'must_say', jsonb_build_array('PBL 學習','業師制','AI 輔助')),
    jsonb_build_object('step', 7, 'name', '定價分期', 'duration_sec', 120, 'must_say', jsonb_build_array('總價透明','分期方案','投資 vs 學費')),
    jsonb_build_object('step', 8, 'name', '行動呼籲', 'duration_sec', 60, 'must_say', jsonb_build_array('小作業','邀約說明會','時間鎖定'))
  ),
  'rule', '一通練滿 8 步, 不可漏跳 (Yu 說: 按架構照架構才會成功)',
  'min_pass_step_count', 6
)
WHERE id IN (SELECT id FROM training_modules WHERE day_offset = 2 AND sequence = 1 AND path_id = (SELECT id FROM training_paths WHERE code = 'business_default'));

-- Day 2 #2: GROW / SPIN 客戶對練
UPDATE public.training_modules
SET content = jsonb_build_object(
  'sparring_type', 'deep_question',
  'models', jsonb_build_array(
    jsonb_build_object('name', 'GROW', 'stages', jsonb_build_array('Goal 真正職涯目標','Reality 當前瓶頸','Options 2-3 路徑','Will 行動意願')),
    jsonb_build_object('name', 'SPIN', 'stages', jsonb_build_array('Situation 情境','Problem 問題','Implication 暗示','Need-Payoff 需求-效益')),
    jsonb_build_object('name', '黃金圈', 'stages', jsonb_build_array('Why 為何','How 怎麼做','What 是什麼'))
  ),
  'claude_persona', 'curious_skeptical_career_changer',
  'depth_test', '逐字稿對練後問你 3 個延伸問題,看你能不能往深處挖,而不是停在 Step1-2'
)
WHERE id IN (SELECT id FROM training_modules WHERE day_offset = 2 AND sequence = 2 AND path_id = (SELECT id FROM training_paths WHERE code = 'business_default'));

-- Day 4 #1: 異議處理 drill
UPDATE public.training_modules
SET content = jsonb_build_object(
  'action', 'real_call',
  'independent', true,
  'objection_drill', true,
  'objection_library', jsonb_build_object(
    '預算', jsonb_build_array(
      '我沒預算 → 三階段:1) 理解(分期 36 期月 4-6k)2) 投資 vs 學費(投報率)3) 反問(那你為自己留 4-6k 學費 OK 嗎?)',
      '太貴了 → 報高走低 / 強調降價是因你真心想要'
    ),
    '時間', jsonb_build_array(
      '沒時間 → 線上 + 實體 + AI 三層彈性',
      '工作太忙 → 一週 5 小時即可,週末集中'
    ),
    '沒興趣', jsonb_build_array(
      '沒興趣 → 我了解,我不問你『有沒有興趣』,我問你『面試官會怎麼挑你』(顧問式)',
      '再考慮 → OK,但你考慮的是 X 還是 Y?(限縮選項)'
    ),
    '無經驗', jsonb_build_array(
      '我沒經驗會不會做不來?→ 三階段:1) 標準(月內掌握 5-6 成)2) 例子(學長 Y 也是零基礎接 8 萬案)3) 反問(那你最擔心哪一段?)'
    )
  ),
  'three_step_reply_pattern', '標準回覆 → 延伸例子 → 反問球回'
)
WHERE id IN (SELECT id FROM training_modules WHERE day_offset = 4 AND sequence = 1 AND path_id = (SELECT id FROM training_paths WHERE code = 'business_default'));

-- Day 12 #1: 反對庫熟練
UPDATE public.training_modules
SET content = jsonb_build_object(
  'sparring_type', 'hard_objection',
  'difficulty', 'hard',
  'topics', jsonb_build_array(
    '客戶說「我家人反對」 → 反邀家人一起聊',
    '客戶說「我已經在 X 學院了」 → 比較 X / 我們的差異點 + 補強',
    '客戶問「保證找到工作?」 → 不保證但提供資源(回到 PBL + 業師)',
    '客戶說「我有錢但不確定值得」 → 複利計算機 + ROI 拆解(3 年回本/5 年正報)'
  ),
  'claude_persona', 'experienced_skeptical',
  'pricing_ritual', '報高走低 / 降價是因為你真的想要 / 不是促銷'
)
WHERE id IN (SELECT id FROM training_modules WHERE day_offset = 12 AND sequence = 1 AND path_id = (SELECT id FROM training_paths WHERE code = 'business_default'));

-- ─────────────────────────────────────
-- 招聘 path module 內容補
-- ─────────────────────────────────────

-- Day 0 #1: HRBP 6 階段
UPDATE public.training_modules
SET content = jsonb_build_object(
  'stages', jsonb_build_array(
    jsonb_build_object('name', '開場確認', 'duration_sec', 60, 'must_say', jsonb_build_array('確認姓名','自我介紹','詢問是否方便 3-5 分鐘')),
    jsonb_build_object('name', '破冰履歷', 'duration_sec', 120, 'must_say', jsonb_build_array('履歷了解','轉職方向','過往工作領域')),
    jsonb_build_object('name', '介紹職缺', 'duration_sec', 180, 'must_say', jsonb_build_array('薪資結構 30K + 抽成','完整教育訓練','市場機會')),
    jsonb_build_object('name', '工作內容', 'duration_sec', 120, 'must_say', jsonb_build_array('電話諮詢 → 顧問開發','成交後交老師','純內勤')),
    jsonb_build_object('name', '應對陳述', 'duration_sec', 300, 'must_say', jsonb_build_array('無經驗→月內 5-6 成','薪資→透明矩陣','名單→公司提供')),
    jsonb_build_object('name', '鎖定面試', 'duration_sec', 120, 'must_say', jsonb_build_array('給 2 個時段選','發 104 面試通知','報到日期'))
  ),
  'forbidden_phrases', jsonb_build_array('看你想領多少','每個人感受不同','再說','看狀況'),
  'killer_three_lines', '面對業績壓力:有 → 正常 → 我們怎麼幫化解'
)
WHERE id IN (SELECT id FROM training_modules WHERE day_offset = 0 AND sequence = 1 AND path_id = (SELECT id FROM training_paths WHERE code = 'recruit_default'));

-- Day 0 #3: 非結構式對練 personas
UPDATE public.training_modules
SET content = jsonb_build_object(
  'sparring_type', 'unstructured',
  'personas', jsonb_build_array(
    jsonb_build_object('name', '楊嘉瑜風格', 'profile', '生活平衡優先 / 前電銷有經驗 / 對 19:00 下班抗拒', 'difficulty', 'medium'),
    jsonb_build_object('name', '鄭繁星風格', 'profile', '金融背景 / 期望 4-5 萬底薪 / 快速決策型', 'difficulty', 'easy'),
    jsonb_build_object('name', '游婉瑜風格', 'profile', '車禍復原中 / 聲音清晰可說話 / 希望延後報到', 'difficulty', 'medium'),
    jsonb_build_object('name', '廖明凱風格', 'profile', '補習班輪班心累 / 無投資經驗 / 家人鼓勵嘗試', 'difficulty', 'medium')
  ),
  'eval', jsonb_build_array('六階段順序','破冰建立親近感','異議處理流暢度')
)
WHERE id IN (SELECT id FROM training_modules WHERE day_offset = 0 AND sequence = 3 AND path_id = (SELECT id FROM training_paths WHERE code = 'recruit_default'));

-- Day 1 #3: 一面三段架構
UPDATE public.training_modules
SET content = jsonb_build_object(
  'sparring_type', 'interview',
  'three_stages', jsonb_build_array(
    jsonb_build_object('name', '自我介紹探索', 'duration_min', 5, 'topics', jsonb_build_array('基本背景','對 教育 的見解','業務目標具體數字')),
    jsonb_build_object('name', '制度吸引', 'duration_min', 5, 'topics', jsonb_build_array('薪獎結構','學長姊故事','晉升路徑')),
    jsonb_build_object('name', '邀約 / 婉拒', 'duration_min', 3, 'topics', jsonb_build_array('給選擇','確認時間','發二面通知'))
  ),
  'challenge_test', true,
  'challenge_questions', jsonb_build_array('連續幾天沒成交能接受嗎?','你最不能忍受的工作環境是?','你願意花多少時間自主投入?'),
  'evaluate_signals', jsonb_build_array('會試試看 vs 適應力不足','願意 vs 將就','數字敏銳度 / 拒絕承受度 / 學習飢餓感')
)
WHERE id IN (SELECT id FROM training_modules WHERE day_offset = 1 AND sequence = 3 AND path_id = (SELECT id FROM training_paths WHERE code = 'recruit_default'));

-- Day 2 #1: 二面 5 項評估矩陣
UPDATE public.training_modules
SET content = jsonb_build_object(
  'matrix', jsonb_build_array(
    jsonb_build_object('name', '資源投入', 'weight', 25, 'desc', '是否值得我們投入訓練資源'),
    jsonb_build_object('name', '幹部潛力', 'weight', 20, 'desc', '未來 6-12 月帶徒弟 / 主管潛力'),
    jsonb_build_object('name', '文化延伸力', 'weight', 15, 'desc', '對公司價值觀的接受度 / 體現程度'),
    jsonb_build_object('name', '情緒穩定度', 'weight', 20, 'desc', '面對拒絕 / 業績壓力的承受'),
    jsonb_build_object('name', '努力意願', 'weight', 20, 'desc', '主動性 / 學習飢餓感 / 行動力')
  ),
  'rubric', '5 項各 0-100, 加權平均 ≥ 70 才推 onboarding',
  'transcendence_interview_method', '從履歷反推「你卡在哪」→ 痛點經驗 → 成就感記憶 → 故事重建自信'
)
WHERE id IN (SELECT id FROM training_modules WHERE day_offset = 2 AND sequence = 1 AND path_id = (SELECT id FROM training_paths WHERE code = 'recruit_default'));

-- Verify (用 jsonb_object_keys 取代 hstore)
SELECT
  tp.code AS path_code,
  tm.day_offset,
  tm.sequence,
  tm.title,
  (SELECT COUNT(*) FROM jsonb_object_keys(tm.content)) AS content_keys_count
FROM public.training_modules tm
JOIN public.training_paths tp ON tp.id = tm.path_id
WHERE tp.code IN ('business_default', 'recruit_default')
ORDER BY tp.code, tm.day_offset, tm.sequence;
