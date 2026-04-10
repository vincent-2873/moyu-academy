-- ============================================================================
-- 動態 KPI 警報規則：依「今日出席數」決定活動量下限
-- ============================================================================
-- Vincent 的規則結構：
--   0 出席 → 必須打滿 130-160 通、100-150 分鐘、邀約 4-5 個
--   1 出席 → 必須打滿 100-140 通、100-120 分鐘、邀約 3-4 個
--   2+ 出席 → 最低 80 通、60 分鐘、1-2 邀約
-- 條件基礎：appointments_show （今日出席數）
-- ============================================================================

CREATE TABLE IF NOT EXISTS sales_alert_rules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand          TEXT NOT NULL,                     -- 'nschool' / 'xuemi' / 'ooschool' / 'xlab' / 'aischool' / 'all'
  level          TEXT NOT NULL DEFAULT 'default',   -- '新人' / '正式' / 'default'
  name           TEXT NOT NULL,                     -- 規則名稱
  -- 觸發條件（必須所有 condition 都成立才套用此規則的 min 門檻）
  cond_attend_min INT,                              -- 出席數下限（含），null = 不限
  cond_attend_max INT,                              -- 出席數上限（含），null = 不限
  -- 最低門檻（任一項未達標即觸發警報）
  min_calls            INT,
  min_call_minutes     NUMERIC,
  min_appointments     INT,
  -- 預設建議門檻（高於 min，但未達 rec 算 "low"）
  rec_calls            INT,
  rec_call_minutes     NUMERIC,
  rec_appointments     INT,
  severity       TEXT NOT NULL DEFAULT 'high',      -- high / critical / medium
  enabled        BOOLEAN NOT NULL DEFAULT true,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_alert_rules_brand ON sales_alert_rules(brand, enabled);

ALTER TABLE sales_alert_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_sales_alert_rules" ON sales_alert_rules;
CREATE POLICY "service_role_all_sales_alert_rules" ON sales_alert_rules
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 加上 4 個新 brand 進 metabase_sources（question_id 先放 0 = 未設定，enabled=false）
-- ============================================================================
INSERT INTO metabase_sources (brand, question_id, question_name, enabled)
VALUES
  ('xuemi',    0, 'XUEMI 學米 — 待填 question id',      false),
  ('ooschool', 0, 'Ooschool 無限學院 — 待填 question id', false),
  ('xlab',     0, 'XLAB AI 實驗室 — 待填 question id',    false),
  ('aischool', 0, 'AI 未來學院 — 待填 question id',        false)
ON CONFLICT (brand) DO NOTHING;

-- ============================================================================
-- Seed Vincent 的 3 階動態規則（brand='all' 代表 5 個品牌通用）
-- 之後用戶可以在後台為特定 brand 覆蓋
-- ============================================================================

-- Tier 1：今天 0 出席 → 活動量必須爆量彌補
INSERT INTO sales_alert_rules (
  brand, level, name,
  cond_attend_min, cond_attend_max,
  min_calls, min_call_minutes, min_appointments,
  rec_calls, rec_call_minutes, rec_appointments,
  severity, notes
) VALUES (
  'all', 'default', '0 出席 · 爆量補救',
  0, 0,
  130, 100, 4,
  160, 150, 5,
  'critical',
  '今天 0 人出席 → 必須打滿 130 通 / 100 分鐘 / 4 邀約，未達即 critical'
) ON CONFLICT DO NOTHING;

-- Tier 2：今天 1 出席 → 中度活動量
INSERT INTO sales_alert_rules (
  brand, level, name,
  cond_attend_min, cond_attend_max,
  min_calls, min_call_minutes, min_appointments,
  rec_calls, rec_call_minutes, rec_appointments,
  severity, notes
) VALUES (
  'all', 'default', '1 出席 · 中度活動',
  1, 1,
  100, 100, 3,
  140, 120, 4,
  'high',
  '今天 1 人出席 → 必須打滿 100 通 / 100 分鐘 / 3 邀約'
) ON CONFLICT DO NOTHING;

-- Tier 3：今天 2+ 出席 → 維持底線即可
INSERT INTO sales_alert_rules (
  brand, level, name,
  cond_attend_min, cond_attend_max,
  min_calls, min_call_minutes, min_appointments,
  rec_calls, rec_call_minutes, rec_appointments,
  severity, notes
) VALUES (
  'all', 'default', '2+ 出席 · 底線維持',
  2, NULL,
  80, 60, 1,
  120, 100, 2,
  'medium',
  '今天 2+ 人出席 → 即使有成交還是要維持 80 通 / 60 分鐘 / 1 邀約底線'
) ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
