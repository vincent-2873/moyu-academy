-- D6: sales_alert_rules 表(若不存在)+ seed 預設規則
-- Vincent 反饋「後台所有 tab 都要 CRUD」

CREATE TABLE IF NOT EXISTS public.sales_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

-- 既有表可能是 stub, ALTER 補欄位
ALTER TABLE public.sales_alert_rules
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS metric text,
  ADD COLUMN IF NOT EXISTS threshold numeric,
  ADD COLUMN IF NOT EXISTS comparator text DEFAULT '<',
  ADD COLUMN IF NOT EXISTS severity text DEFAULT 'warning',
  ADD COLUMN IF NOT EXISTS action text DEFAULT 'notify_self',
  ADD COLUMN IF NOT EXISTS target_role text,
  ADD COLUMN IF NOT EXISTS target_brand text,
  ADD COLUMN IF NOT EXISTS message_template text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_sales_alert_rules_active ON public.sales_alert_rules(is_active) WHERE is_active = true;

-- Seed default rules
INSERT INTO public.sales_alert_rules (name, metric, threshold, comparator, severity, action, message_template) VALUES
  ('業務 撥打不足',       'calls',             100,  '<',  'warning', 'notify_self',    '今日撥打 {value} 通,低於門檻 {threshold} 通,加油!'),
  ('業務 接通率低',       'connected',         20,   '<',  'warning', 'notify_self',    '接通數 {value} 通,可能名單品質或時段問題'),
  ('業務 邀約掛蛋',       'raw_appointments',  1,    '<',  'danger',  'notify_both',    '今日 0 邀約,主管請關心狀況'),
  ('業務 連續 3 天 0 成交', 'closures',          0,    '<=', 'danger',  'notify_manager', '連續 3 天 0 成交,可能需要 1:1 對談')
ON CONFLICT DO NOTHING;

SELECT name, metric, threshold, severity, action FROM public.sales_alert_rules ORDER BY severity DESC, name;
