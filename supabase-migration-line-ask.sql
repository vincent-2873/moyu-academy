-- LINE 為唯一介面 — Claude 卡點主動推播 + 從 LINE 回覆 unblock
--
-- 新增兩個欄位 + 擴充 status CHECK 約束，讓 claude_tasks 可以承載
-- 「我正在等 Vincent 從 LINE 回字」這個狀態。
--
-- 安全：IF NOT EXISTS / DROP CONSTRAINT IF EXISTS，可以重跑多次。

-- 1) 新增 channel 欄位 — 'internal' (default) / 'line' / 'dashboard' / 'email'
ALTER TABLE claude_tasks
  ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'internal';

-- 2) 新增 awaiting_reply_at — Claude 發出問題並開始等回覆的時間
ALTER TABLE claude_tasks
  ADD COLUMN IF NOT EXISTS awaiting_reply_at TIMESTAMPTZ;

-- 3) 擴充 status CHECK，加入 'awaiting_line_reply'
ALTER TABLE claude_tasks DROP CONSTRAINT IF EXISTS claude_tasks_status_check;
ALTER TABLE claude_tasks ADD CONSTRAINT claude_tasks_status_check
  CHECK (status IN ('pending','in_progress','done','cancelled','blocked','awaiting_line_reply'));

-- 4) 查詢 index — 只索引 awaiting 任務，讓 webhook match 最新任務很快
CREATE INDEX IF NOT EXISTS idx_claude_tasks_awaiting_line
  ON claude_tasks (awaiting_reply_at DESC)
  WHERE status = 'awaiting_line_reply';
