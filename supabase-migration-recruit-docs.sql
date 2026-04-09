-- 招聘候選人原始資料儲存表
-- 用於儲存從各種來源（104 / 1111 / IG / LINE / 電話截圖 / 面試筆記）收集的原始資料
-- 一個 recruit 可以有多筆 documents

CREATE TABLE IF NOT EXISTS recruit_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruit_id UUID NOT NULL REFERENCES recruits(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'resume',         -- 履歷
    'screenshot',     -- 截圖
    'conversation',   -- 對話紀錄（IG/LINE/電話）
    'interview_note', -- 面試筆記
    'reference',      -- 推薦人資料
    'background',     -- 背景調查
    'other'           -- 其他
  )),
  title TEXT NOT NULL,
  content TEXT,                    -- 純文字內容
  file_url TEXT,                   -- 檔案連結（可選，未來上傳功能）
  source TEXT,                     -- 來源（如：104 / IG / LINE / 面對面）
  metadata JSONB DEFAULT '{}'::jsonb,  -- 任意額外資訊
  created_by TEXT,                 -- 建立人（admin email）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruit_documents_recruit ON recruit_documents(recruit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recruit_documents_type ON recruit_documents(doc_type);

-- RLS：service_role 全權限
ALTER TABLE recruit_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON recruit_documents FOR ALL USING (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';
