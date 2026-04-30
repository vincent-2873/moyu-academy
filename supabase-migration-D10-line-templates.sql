-- D10: line_templates 表 (LINE Bot 訊息模板 CRUD)
CREATE TABLE IF NOT EXISTS public.line_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,                  -- 'morning_briefing' / 'kpi_alert' / 'training_reminder' / etc
  name text NOT NULL,
  category text DEFAULT 'general',            -- 'briefing' / 'alert' / 'reminder' / 'celebration'
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'flex', 'image', 'sticker')),
  content text NOT NULL,                       -- 純文字 / Flex JSON / 圖片 url
  variables jsonb DEFAULT '[]'::jsonb,         -- ["user_name", "today_calls", "stage"] 可用變數
  example_payload jsonb,                       -- 範例值
  target_role text,                            -- 哪些角色收(NULL=全)
  target_brand text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_templates_code ON public.line_templates(code);
CREATE INDEX IF NOT EXISTS idx_line_templates_active ON public.line_templates(is_active) WHERE is_active = true;

-- Seed 預設模板
INSERT INTO public.line_templates (code, name, category, message_type, content, variables, example_payload) VALUES
  ('morning_briefing', '每日早安簡報', 'briefing', 'text',
   '☀ {user_name} 早安!{stage}你今日:撥打目標 {target_calls} 通,目前進度 {current_calls} 通。{cheer_msg}',
   '["user_name","stage","target_calls","current_calls","cheer_msg"]'::jsonb,
   '{"user_name":"Yian","stage":"執筆者","target_calls":120,"current_calls":0,"cheer_msg":"加油!"}'::jsonb),
  ('kpi_alert_low_calls', '撥打不足警示', 'alert', 'text',
   '⚠ {user_name} 今日撥打 {current_calls} 通,低於門檻 {threshold} 通。\n建議:打開系統 → 點戰情官問「卡關原因」',
   '["user_name","current_calls","threshold"]'::jsonb,
   '{"user_name":"Yian","current_calls":50,"threshold":100}'::jsonb),
  ('training_reminder', '訓練任務提醒', 'reminder', 'text',
   '🎙 {user_name},第 {day} 天還有 {pending_count} 個任務沒完成:\n{tasks}\n\n進 https://moyusales.zeabur.app/learn',
   '["user_name","day","pending_count","tasks"]'::jsonb,
   '{"user_name":"Yian","day":3,"pending_count":2,"tasks":"- 逐字稿對練\\n- 邀約嘗試"}'::jsonb),
  ('first_close_celebration', '首單慶賀', 'celebration', 'text',
   '🎉 {user_name} 出第一單!{stamp_label}印章已蓋!\n第 {day} 天就破單,給自己鼓掌👏',
   '["user_name","stamp_label","day"]'::jsonb,
   '{"user_name":"Yian","stamp_label":"劍未配妥","day":6}'::jsonb),
  ('manager_care_3day_zero', '主管關心(連3天0成交)', 'alert', 'text',
   '主管 {manager_name},您團隊 {member_name} 連續 {days} 天 0 成交。\n建議 1:1 對談,系統建議聊「{topic}」',
   '["manager_name","member_name","days","topic"]'::jsonb,
   '{"manager_name":"Vincent","member_name":"Yian","days":3,"topic":"客戶異議處理"}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  content = EXCLUDED.content,
  variables = EXCLUDED.variables,
  example_payload = EXCLUDED.example_payload,
  updated_at = NOW();

SELECT code, name, category FROM public.line_templates ORDER BY category, code;
