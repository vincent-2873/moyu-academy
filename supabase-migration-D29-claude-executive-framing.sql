-- D29: Claude as Executive framing (2026-05-02)
-- Vincent 拍板:Claude = CEO+COO+CTO,Vincent / 接班人 = human_ops 補連結斷點,
-- 投資人 / 董事 / CFO = board_audience read-only + 質詢
-- 員工 = employee scope 看自己

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── PART 1: users 角色 enum 統一 ─────────────────────────────────────
-- 不破壞舊的(舊 role 可繼續存),只加新的「規範化」欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='users' AND column_name='persona_role'
  ) THEN
    ALTER TABLE users ADD COLUMN persona_role TEXT;
    -- 'human_ops'        — Claude 的人類副手(Vincent / 接班人) FULL CONTROL
    -- 'board_audience'   — 董事 / 投資人 / CFO READ ONLY + 質詢
    -- 'employee_sales'   — 業務員 自己的數字 + 訓練
    -- 'employee_legal'   — 法務員 自己的案件
    -- 'employee_rookie'  — 新訓 受監管
    -- 'claude_executive' — 預留給未來「Claude 自己」 system 帳號
  END IF;
END $$;

-- 把現有 super_admin 升級成 human_ops
UPDATE users SET persona_role = 'human_ops'
 WHERE role IN ('super_admin', 'admin') AND persona_role IS NULL;

-- 業務 sales_rep / sales_manager / sales_rookie → employee_sales
UPDATE users SET persona_role = 'employee_sales'
 WHERE role IN ('sales_rep', 'sales_manager', 'sales_rookie') AND persona_role IS NULL;

-- 法務
UPDATE users SET persona_role = 'employee_legal'
 WHERE role IN ('legal_staff', 'legal_manager') AND persona_role IS NULL;

-- 其他預設 employee_sales(後台 staff 也歸這)
UPDATE users SET persona_role = 'employee_sales'
 WHERE persona_role IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_persona_role ON users(persona_role);

-- ─── PART 2: claude_daily_narrative ────────────────────────────────────
-- Claude 每天 06:00 cron 自己寫一份「執行長日報」
-- 給董事會 / 投資人 / Vincent 看「Claude 今天做了什麼想了什麼」

CREATE TABLE IF NOT EXISTS claude_daily_narrative (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  -- 北極星數字(自動算)
  ns_revenue_quarter NUMERIC,        -- 本季累積營收
  ns_revenue_target NUMERIC,         -- 本季目標
  ns_revenue_forecast NUMERIC,       -- Claude 預測終值
  ns_prediction_accuracy NUMERIC,    -- Claude 過去預測準度 (0-1)
  -- Claude 自寫(LLM 產出)
  headline TEXT,                     -- 一句話總結
  narrative TEXT,                    -- 完整 memo (markdown,含 inline citation)
  highlights JSONB,                  -- [{"text":"...","cite":"...","metric":...}]
  warnings JSONB,                    -- [{"text":"...","cite":"...","severity":"high|critical"}]
  decisions_made JSONB,              -- Claude 自己拍板的 [{"title":"...","detail":"..."}]
  decisions_pending JSONB,           -- 等 human_ops 拍板 [{"id":"uuid",...}]
  -- 統計
  worker_runs_24h INT,
  metabase_sync_status TEXT,
  generated_by TEXT DEFAULT 'claude-sonnet-4-6',
  generated_ms INT,                  -- LLM 生成耗時
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cdn_date ON claude_daily_narrative(date DESC);

-- ─── PART 3: claude_predictions ─────────────────────────────────────────
-- 每週 Claude 預測 → 月底自動 fill actual → 投資人質詢「Claude 預測多準?」

CREATE TABLE IF NOT EXISTS claude_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  target_period TEXT NOT NULL,        -- 'week-2026-W18' / 'month-2026-05' / 'quarter-Q2-2026'
  metric TEXT NOT NULL,                -- 'revenue' / 'closures' / 'calls' / 'conversion_rate'
  predicted_value NUMERIC NOT NULL,
  predicted_low NUMERIC,               -- 區間下界(置信度)
  predicted_high NUMERIC,              -- 區間上界
  reasoning TEXT,                       -- Claude 為什麼預測這個
  rag_evidence JSONB,                   -- 引用的 SMD row / Notion chunk / 過去 decision
  actual_value NUMERIC,                 -- 月底自動 fill
  actual_filled_at TIMESTAMPTZ,
  accuracy_pct NUMERIC,                 -- |actual - predicted| / actual
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cp_target ON claude_predictions(target_period, metric);
CREATE INDEX IF NOT EXISTS idx_cp_predicted ON claude_predictions(predicted_at DESC);

-- ─── PART 4: decision_records 加 outcome 欄位 ────────────────────────────
-- 投資人會問「上次拍板的事執行到哪?結果?」

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='decision_records' AND column_name='outcome') THEN
    ALTER TABLE decision_records ADD COLUMN outcome TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='decision_records' AND column_name='outcome_verified_at') THEN
    ALTER TABLE decision_records ADD COLUMN outcome_verified_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='decision_records' AND column_name='outcome_claude_assessment') THEN
    ALTER TABLE decision_records ADD COLUMN outcome_claude_assessment TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='decision_records' AND column_name='evidence_refs') THEN
    ALTER TABLE decision_records ADD COLUMN evidence_refs JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- ─── PART 5: board_inquiries 加 rate-limit 用欄位 ────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='board_inquiries' AND column_name='answered_with_evidence') THEN
    ALTER TABLE board_inquiries ADD COLUMN answered_with_evidence JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bi_asker_date ON board_inquiries(asker_email, asked_at DESC);

-- ─── PART 6: 投資人 demo 帳號預留(seed 1 個示範)────────────────────────
-- Vincent 之後加真實投資人,只要改 persona_role + email
INSERT INTO users (email, password_hash, name, role, persona_role, brand, status, is_active)
VALUES (
  'investor.demo@board.moyu',
  crypt('0000', gen_salt('bf', 10)),
  '示範投資人',
  'staff',
  'board_audience',
  NULL,
  'active',
  true
)
ON CONFLICT (email) DO UPDATE SET
  persona_role = 'board_audience',
  is_active = true;

-- ─── verify ──────────────────────────────────────────────────────────────
SELECT 'users.persona_role distribution' AS check_name,
       persona_role, COUNT(*)::text AS value
FROM users GROUP BY persona_role
UNION ALL
SELECT 'tables_created', 'claude_daily_narrative', COUNT(*)::text FROM claude_daily_narrative
UNION ALL
SELECT 'tables_created', 'claude_predictions', COUNT(*)::text FROM claude_predictions
ORDER BY check_name, persona_role;
