-- ============================================================
-- D18: 墨宇訓練營運中心 v2 · 整合版 Schema
-- ============================================================
-- 上一份 migration: D17 organizations + tenant_id
-- 整合來源: Downloads/新增資料夾/01_DATABASE_SCHEMA.sql (04 doc 規格)
--
-- 整合策略(2026-05-01 第五輪 Claude 寫,Vincent 拍板):
--   A. 用 prod 既有命名 (code/path_type/day_offset/duration_min/required/stage/stage_path)
--      不 rename 既有欄位,code 端對齊 prod
--   B. training_progress → rename 為 training_module_progress
--      (避免跟既有 training_unit_progress 概念混淆)
--   C. roleplay_sessions 用乾淨新 schema,並存 sparring_records,Phase 5 整併
--   D. 5 brand seed = nschool / xuemi / ooschool / aischool / xlab (不含 legal)
--   E. brand 髒資料 (MOYU/moyu/xplatform/moyuhunt) 這次不動,Phase 5 再清
--
-- 安全性:
--   - 全部 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / ON CONFLICT DO NOTHING
--   - 可重複執行(跑兩次不會炸)
--   - 不刪不改既有欄位
--   - 跑前建議 Supabase Dashboard → Database → Backups → Take Backup
--
-- 範圍:
--   - users: ADD 5 個新欄位
--   - training_paths: ADD total_days
--   - training_modules: ADD completion_criteria
--   - 新建 7 張 table
--   - seed 6 個 path + 2 個 persona
-- ============================================================


-- ============================================================
-- PART 1: users 表新增 5 個欄位
-- ============================================================
-- 跳過(prod 已存在):line_user_id, brand
-- 跳過(prod 命名不同但概念對應):
--   04 doc training_stage  → 用既有 stage      (NOT NULL default 'beginner')
--   04 doc training_path   → 用既有 stage_path (NOT NULL default 'common')

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
  ADD COLUMN IF NOT EXISTS google_oauth_token JSONB,
  ADD COLUMN IF NOT EXISTS training_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS training_current_day INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pillar TEXT;

COMMENT ON COLUMN users.google_calendar_id IS '個人 Google Calendar ID(訓練 module 自動排程用)';
COMMENT ON COLUMN users.google_oauth_token IS '個人 Google OAuth token(寫入 GCal event 需要)';
COMMENT ON COLUMN users.training_started_at IS '訓練開始日期(計算 D 幾用);搭配 stage_path = sales_14d_xxx / legal_3d 等';
COMMENT ON COLUMN users.training_current_day IS '目前是 D 幾(從 0 開始)';
COMMENT ON COLUMN users.pillar IS '所屬支柱:sales / legal / recruit;跟 capability_scope 是不同維度';


-- ============================================================
-- PART 2: training_paths(table 已存在)補 total_days
-- ============================================================
-- prod 既有命名:code (對 04 doc slug), path_type (對 04 doc pillar)
-- 不 rename,code 端對齊 prod

ALTER TABLE training_paths
  ADD COLUMN IF NOT EXISTS total_days INT;

COMMENT ON COLUMN training_paths.total_days IS '此 path 總共幾天(sales_14d=14, legal_3d=3)';


-- ============================================================
-- PART 3: training_modules(table 已存在)補 completion_criteria
-- ============================================================
-- prod 既有命名:day_offset (對 day), duration_min (對 duration_minutes), required (對 is_required)
-- 不 rename,code 端對齊 prod

ALTER TABLE training_modules
  ADD COLUMN IF NOT EXISTS completion_criteria JSONB DEFAULT '{}';

COMMENT ON COLUMN training_modules.completion_criteria IS '完成判定 JSON:video={min_watch_pct:80} / roleplay={min_score:70,min_attempts:3} / reflection={min_words:100}';


-- ============================================================
-- PART 4: roleplay_personas(對練客戶角色)
-- ============================================================
CREATE TABLE IF NOT EXISTS roleplay_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  archetype TEXT,
  description TEXT,
  personality_prompt TEXT NOT NULL,
  voice_style TEXT,
  difficulty INT DEFAULT 3,
  brand TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- PART 5: training_module_progress(rename 自 04 doc training_progress)
-- ============================================================
-- 04 doc 原叫 training_progress,但 prod 既有 training_unit_progress(綁 training_units)
-- 為避免概念混淆,新表 rename 為 training_module_progress(綁 training_modules)

CREATE TABLE IF NOT EXISTS training_module_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,

  scheduled_start_at TIMESTAMPTZ,
  scheduled_end_at TIMESTAMPTZ,
  google_calendar_event_id TEXT,

  status TEXT DEFAULT 'pending',

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completion_data JSONB DEFAULT '{}',

  claude_feedback TEXT,
  claude_score INT,

  stuck_detected_at TIMESTAMPTZ,
  stuck_reason TEXT,
  stuck_handled BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_training_module_progress_user
  ON training_module_progress(user_id, status);
CREATE INDEX IF NOT EXISTS idx_training_module_progress_stuck
  ON training_module_progress(stuck_detected_at)
  WHERE stuck_handled = false;


-- ============================================================
-- PART 6: roleplay_sessions(並存 sparring_records,Phase 5 整併)
-- ============================================================
CREATE TABLE IF NOT EXISTS roleplay_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id UUID REFERENCES training_modules(id),
  persona_id UUID REFERENCES roleplay_personas(id),

  conversation JSONB NOT NULL,
  audio_url TEXT,
  audio_transcript TEXT,

  total_score INT,
  scores JSONB,
  feedback_strengths TEXT[],
  feedback_improvements TEXT[],
  feedback_summary TEXT,
  recommended_next TEXT,

  duration_seconds INT,
  attempt_number INT DEFAULT 1,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_roleplay_sessions_user
  ON roleplay_sessions(user_id, started_at DESC);


-- ============================================================
-- PART 7: training_stuck_handlings(卡關處理紀錄)
-- ============================================================
CREATE TABLE IF NOT EXISTS training_stuck_handlings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  progress_id UUID REFERENCES training_module_progress(id),

  detected_at TIMESTAMPTZ DEFAULT NOW(),
  detection_rule TEXT,

  claude_attempts JSONB DEFAULT '[]',

  user_response TEXT,
  user_responded_at TIMESTAMPTZ,

  resolved_at TIMESTAMPTZ,
  resolution_type TEXT,
  escalated_to_vincent BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- PART 8: module_effectiveness(每個 module 的有效性統計)
-- ============================================================
CREATE TABLE IF NOT EXISTS module_effectiveness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES training_modules(id),
  period TEXT NOT NULL,

  enrolled_count INT DEFAULT 0,
  completed_count INT DEFAULT 0,
  skipped_count INT DEFAULT 0,
  stuck_count INT DEFAULT 0,

  avg_score INT,
  avg_duration_minutes INT,

  post_training_metrics JSONB,

  claude_assessment TEXT,
  claude_suggestion TEXT,

  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(module_id, period)
);


-- ============================================================
-- PART 9: path_completeness(每品牌 × 每 path 的完整度)
-- ============================================================
CREATE TABLE IF NOT EXISTS path_completeness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id UUID NOT NULL REFERENCES training_paths(id),
  brand TEXT,

  total_modules_expected INT,
  total_modules_actual INT,
  missing_modules JSONB,

  claude_drafts JSONB,

  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(path_id, brand)
);


-- ============================================================
-- PART 10: claude_help_requests(Claude 處理不了升給人的工單)
-- ============================================================
CREATE TABLE IF NOT EXISTS claude_help_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  category TEXT NOT NULL,
  source TEXT NOT NULL,

  related_user_id UUID REFERENCES users(id),
  related_progress_id UUID REFERENCES training_module_progress(id),

  title TEXT NOT NULL,
  description TEXT,

  claude_attempts JSONB DEFAULT '[]',
  claude_recommendation TEXT,

  status TEXT DEFAULT 'pending',
  assigned_to UUID REFERENCES users(id),

  resolution_action TEXT,
  resolution_note TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_claude_help_requests_pending
  ON claude_help_requests(category, status, created_at)
  WHERE status = 'pending';


-- ============================================================
-- PART 11: Seed data
-- ============================================================
-- 5 brand × sales_14d + legal_3d 共 6 個 path
-- 用 prod 既有命名:code (04 doc 叫 slug), path_type (04 doc 叫 pillar)
--
-- ⚠️ prod 既有 CHECK constraint:training_paths.path_type IN ('business', 'recruit')
-- 因此 sales pillar / legal pillar 都對應 'business'(prod 既有概念是「業務向 vs 招聘向」二分)
-- pillar 的細粒度區分用 code 欄位(sales_14d_xxx vs legal_3d)
-- 既有 path:business_default / recruit_default(2 個既有 row 不動)

INSERT INTO training_paths (code, path_type, brand, name, total_days)
VALUES
  ('sales_14d_nschool',  'business', 'nschool',  '財經 nSchool 業務 14 天養成',     14),
  ('sales_14d_xuemi',    'business', 'xuemi',    '學米 XUEMI 業務 14 天養成',       14),
  ('sales_14d_ooschool', 'business', 'ooschool', '無限學院 ooschool 業務 14 天養成', 14),
  ('sales_14d_aischool', 'business', 'aischool', '未來學院 aischool 業務 14 天養成', 14),
  ('sales_14d_xlab',     'business', 'xlab',     'X LAB AI 實驗室 業務 14 天養成',  14),
  ('legal_3d',           'business', NULL,        '法務 3 天養成',                   3)
ON CONFLICT (code) DO NOTHING;


-- 對練 Persona seed(2 個基礎 persona,完訓 D7 後解鎖客訴/反悔型)

INSERT INTO roleplay_personas (name, archetype, description, personality_prompt, difficulty)
VALUES
  (
    '楊嘉瑜風格',
    '理性決策型',
    '40 歲女性,科技業中階主管。理性、冷靜、重視數據,在意 ROI、實證、案例。',
    '你扮演「楊嘉瑜」,40 歲女性,科技業中階主管。

你的個性:
- 理性、冷靜、重視數據
- 講話速度中等,不熱絡也不冷漠
- 在意 ROI、實證、案例
- 不容易被熱情或情緒打動
- 但只要對方專業就會給機會

你的對話模式:
- 會問尖銳但禮貌的問題(「真的嗎?」「我不確定」)
- 對方說大話會直接質疑「有什麼證據?」
- 不會立刻答應任何事
- 喜歡聽具體案例 > 抽象概念
- 時間寶貴,廢話會打斷

對練規則:
- 你是潛在客戶,對方是業務員
- 必須拋出 1-2 個異議(例:「價格比競品貴 30%」「我們已經有類似工具了」)
- 異議要堅持,但對方處理得好就軟化
- 不要主動推進,讓業務員引導
- 對話 8-12 輪後可以做 next step 的決定
- 不要立刻說 yes(讓他練習)
- 不要立刻說 no(沒練習機會)
- 不要 break character 解釋你在扮演

語氣特徵:中等語速、口齒清晰、偶爾「嗯...」「我想想」',
    4
  ),
  (
    '鄭繁星風格',
    '衝動感性型',
    '28 歲女性,自媒體創作者。情緒起伏大,容易被故事打動,決策衝動。',
    '你扮演「鄭繁星」,28 歲女性,自媒體創作者。

你的個性:
- 情緒起伏大,容易被故事打動
- 講話速度快,語氣熱情
- 喜歡聊天勝過聊產品
- 會分享自己的生活、煩惱、夢想
- 容易因為一句話突然冷下來
- 決策衝動,但也容易反悔

你的對話模式:
- 會跟著對方情緒走
- 喜歡聽故事、案例、別人的經驗
- 對「數據」「ROI」這種詞不感興趣
- 在意「感覺」「直覺」「氛圍」
- 容易岔題,業務員要拉回主題

對練規則:
- 你是潛在客戶,對方是業務員
- 拋出 1-2 個異議,但異議偏感性(例:「我朋友用了沒效」「總覺得這價錢太敷衍」)
- 對方用「故事」處理會打動你
- 對方用「數據」處理會讓你想結束對話
- 對話 6-10 輪後可以做決定
- 不要表現得太冷
- 不要太快結束對話
- 不要 break character

語氣特徵:快、熱情、起伏明顯,多用感嘆「哇」「真的嗎」「天啊」,偶爾離題講自己的事',
    3
  )
ON CONFLICT DO NOTHING;


-- ============================================================
-- VERIFY queries(跑完整段後執行,確認都到位)
-- ============================================================

-- 1. 確認 7 張新 table 都建好(預期 7 row)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'roleplay_personas', 'training_module_progress',
    'roleplay_sessions', 'training_stuck_handlings',
    'module_effectiveness', 'path_completeness', 'claude_help_requests'
  )
ORDER BY table_name;

-- 2. 確認 users 補 5 個欄位(預期 5 row)
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN (
    'google_calendar_id', 'google_oauth_token',
    'training_started_at', 'training_current_day', 'pillar'
  )
ORDER BY column_name;

-- 3. 確認 training_paths 補 total_days + training_modules 補 completion_criteria(預期 2 row)
SELECT table_name, column_name FROM information_schema.columns
WHERE (table_name = 'training_paths' AND column_name = 'total_days')
   OR (table_name = 'training_modules' AND column_name = 'completion_criteria');

-- 4. 確認 6 個 path seed(預期 6 row)
SELECT code, path_type, brand, total_days FROM training_paths
WHERE code IN ('sales_14d_nschool', 'sales_14d_xuemi', 'sales_14d_ooschool',
               'sales_14d_aischool', 'sales_14d_xlab', 'legal_3d')
ORDER BY code;

-- 5. 確認 2 個 persona seed(預期 2 row)
SELECT name, archetype, difficulty FROM roleplay_personas;

-- 6. BONUS: 看 stage_path distinct 值(校準是否要 update users.stage_path 對齊新 path code)
SELECT stage_path, COUNT(*) FROM users GROUP BY stage_path ORDER BY COUNT(*) DESC;
-- 跑完看,如果都是 'common' 就 OK;有別的值再討論
