-- D11 stamp_rules:統一管理印章規則 (從散落 training_modules.reward 抽出)
-- Apply: gh workflow run "Apply Supabase Migration" --ref main -f sql_file=supabase-migration-D11-stamp-rules.sql

CREATE TABLE IF NOT EXISTS public.stamp_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  rarity text DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  trigger_type text NOT NULL CHECK (trigger_type IN ('module_complete','whisper_score','streak_days','first_action','manual')),
  trigger_config jsonb DEFAULT '{}'::jsonb,
  description text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stamp_rules_active ON public.stamp_rules(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_stamp_rules_trigger ON public.stamp_rules(trigger_type, is_active);

ALTER TABLE public.stamp_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON public.stamp_rules;
CREATE POLICY service_role_all ON public.stamp_rules FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.stamp_rules (code, name, rarity, trigger_type, trigger_config, description, display_order) VALUES
  ('day0_complete', '初登場', 'common', 'module_complete', '{"day": 0}'::jsonb, '完成 Day 0 入門 module', 10),
  ('day3_complete', '初試啼聲', 'rare', 'module_complete', '{"day": 3}'::jsonb, '完成 Day 3 對練 module', 20),
  ('first_call', '撥通第一通', 'common', 'first_action', '{"action": "call"}'::jsonb, '第一通電話 push 出去', 30),
  ('first_appointment', '邀約第一單', 'rare', 'first_action', '{"action": "appointment"}'::jsonb, '第一筆邀約成立', 40),
  ('first_close', '劍未配妥', 'epic', 'first_action', '{"action": "close"}'::jsonb, '第一筆成交', 50),
  ('whisper_60', '出門已是江湖', 'epic', 'whisper_score', '{"min_score": 60}'::jsonb, 'Whisper 對練評分 ≥ 60', 60),
  ('whisper_80', '入境問俗', 'legendary', 'whisper_score', '{"min_score": 80}'::jsonb, 'Whisper 對練評分 ≥ 80', 70),
  ('streak_7', '七日不輟', 'rare', 'streak_days', '{"days": 7}'::jsonb, '連續簽到 7 天', 80),
  ('streak_30', '一月精勤', 'epic', 'streak_days', '{"days": 30}'::jsonb, '連續簽到 30 天', 90),
  ('master_xlab', '研墨者', 'legendary', 'manual', '{}'::jsonb, '主管手動授予的師徒印', 100)
ON CONFLICT (code) DO NOTHING;

SELECT 'stamp_rules' AS table_name, COUNT(*)::text AS info FROM public.stamp_rules;
