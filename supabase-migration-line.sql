-- ============================================
-- LINE 通知系統：墨宇小精靈
-- 用途：
--   1. 用戶註冊後綁定 LINE userId（emails ↔ line_user_id）
--   2. Claude 推播緊急代辦時可以指名用戶
--   3. 系統卡住時自動推播警報給管理者
-- ============================================

-- 1. users 表加上 line 綁定欄位
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS line_user_id TEXT,
  ADD COLUMN IF NOT EXISTS line_bound_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON users(line_user_id) WHERE line_user_id IS NOT NULL;

-- 2. 待綁定碼表（註冊時產生 6 位代碼，用戶在 LINE 輸入後完成綁定）
CREATE TABLE IF NOT EXISTS line_bindings (
  code TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  used_at TIMESTAMPTZ,
  used_by_line_user_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_line_bindings_email ON line_bindings(email);
CREATE INDEX IF NOT EXISTS idx_line_bindings_expires ON line_bindings(expires_at);

-- 3. LINE 推播紀錄表（每一次推播都留軌跡）
CREATE TABLE IF NOT EXISTS line_push_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT,
  user_email TEXT,
  title TEXT,
  body TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('critical','high','normal','low')),
  reason TEXT,                       -- 為什麼推播（blocked / task / alert / system）
  result TEXT CHECK (result IN ('success','failed','stub')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_push_log_user ON line_push_log(line_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_line_push_log_email ON line_push_log(user_email, created_at DESC);

-- 4. RLS：service_role 全權限
ALTER TABLE line_bindings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON line_bindings;
CREATE POLICY "service_role_all" ON line_bindings FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE line_push_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON line_push_log;
CREATE POLICY "service_role_all" ON line_push_log FOR ALL USING (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';
