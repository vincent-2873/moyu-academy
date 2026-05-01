-- D27: whisper_jobs 表(非同步 Whisper 處理 job 狀態追蹤)
-- 對齊 Vincent 鐵則:Whisper 大檔 / 錄影自動處理,bypass Zeabur proxy timeout
-- 2026-05-01

CREATE TABLE IF NOT EXISTS whisper_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id TEXT UNIQUE NOT NULL,           -- 對應 chunked upload temp dir
  filename TEXT NOT NULL,
  file_size BIGINT,
  brand TEXT,                                -- nschool / xuemi / ooschool / aischool / xlab / sales-deck-v2
  pillar TEXT NOT NULL DEFAULT 'sales',     -- sales / legal / common
  speaker TEXT,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending / processing / done / failed
  stage TEXT,                                -- 'ffmpeg_split' / 'whisper_transcribe' / 'db_insert'
  segments_total INT,
  segments_done INT DEFAULT 0,
  transcript_chars INT,
  chunk_id UUID,                             -- 完成後對應的 knowledge_chunks.id
  error TEXT,                                -- 失敗原因
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_whisper_jobs_upload_id ON whisper_jobs(upload_id);
CREATE INDEX IF NOT EXISTS idx_whisper_jobs_status ON whisper_jobs(status, created_at DESC);

-- verify
-- SELECT count(*) FROM whisper_jobs;
