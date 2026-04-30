-- D16: RAG upload 三入口 + review queue + visibility ACL
-- 2026-04-30 第三輪 Wave C
--
-- 設計:
--   - 後台上傳(admin) → reviewed=true,直接公開
--   - 前台 /upload(員工)→ reviewed=false,進 review queue 等審
--   - /me 個人(員工)→ reviewed=true 但 visibility='self',只自己看
--
-- knowledge_chunks 新增欄位:
--   - reviewed boolean: 是否已審核(admin 上傳預設 true,員工上傳預設 false)
--   - uploaded_by_email: 上傳者 email(audit + 員工只看自己 visibility=self 用)
--   - uploaded_at: 上傳時間
--   - visibility: 'public'(全員) / 'pillar'(該 pillar 員工) / 'brand'(該 brand) / 'role'(allowed_roles) / 'self'(只本人)
--   - source_file_url: 原始檔 URL(Supabase Storage,選用)
--   - source_mime: 原始檔 mime type
--   - transcript_status: 'ready'(text 直接 / 已轉)/ 'pending'(沒 GROQ key)/ 'failed' / 'not_applicable'
--   - rejection_reason: review reject 時填

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS reviewed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS uploaded_by_email text,
  ADD COLUMN IF NOT EXISTS uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'pillar'
    CHECK (visibility IN ('public', 'pillar', 'brand', 'role', 'self')),
  ADD COLUMN IF NOT EXISTS source_file_url text,
  ADD COLUMN IF NOT EXISTS source_mime text,
  ADD COLUMN IF NOT EXISTS transcript_status text NOT NULL DEFAULT 'ready'
    CHECK (transcript_status IN ('ready', 'pending', 'failed', 'not_applicable')),
  ADD COLUMN IF NOT EXISTS rejection_reason text;

COMMENT ON COLUMN knowledge_chunks.reviewed IS 'false = 進 review queue 等 admin 審;true = 已公開 / 直接上(admin / self)';
COMMENT ON COLUMN knowledge_chunks.visibility IS 'public(全員)/pillar(該 pillar)/brand(該 brand)/role(allowed_roles)/self(只本人)';
COMMENT ON COLUMN knowledge_chunks.transcript_status IS 'pending = 等 Whisper(GROQ_API_KEY 未設) → embedding-refresh cron 拿不到 transcript 不處理';

-- review queue index(只要 unrev 的)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_review_queue
  ON knowledge_chunks(reviewed, created_at DESC) WHERE reviewed = false;

-- self-upload index(/me 看自己上傳)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_uploaded_by
  ON knowledge_chunks(uploaded_by_email, created_at DESC) WHERE uploaded_by_email IS NOT NULL;

-- transcript pending 找待轉錄(daily cron 之後可掃)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_transcript_pending
  ON knowledge_chunks(transcript_status, created_at) WHERE transcript_status = 'pending';

-- search_knowledge RPC 補 visibility filter:reviewed=true + (visibility match user)
DROP FUNCTION IF EXISTS public.search_knowledge(vector(1536), int, text, text, text, text[], text);

CREATE OR REPLACE FUNCTION public.search_knowledge(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter_brand text DEFAULT NULL,
  filter_path_type text DEFAULT NULL,
  filter_stage_tag text DEFAULT NULL,
  filter_pillars text[] DEFAULT NULL,
  filter_user_role text DEFAULT NULL,
  filter_user_email text DEFAULT NULL                  -- D16:visibility=self 用
)
RETURNS TABLE (
  id uuid,
  source_type text,
  source_id text,
  title text,
  content text,
  similarity float,
  pillar text,
  metadata jsonb
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    kc.id, kc.source_type, kc.source_id, kc.title, kc.content,
    1 - (kc.embedding <=> query_embedding) AS similarity,
    kc.pillar, kc.metadata
  FROM public.knowledge_chunks kc
  WHERE
    kc.deprecated_at IS NULL
    AND kc.embedding IS NOT NULL
    AND kc.reviewed = true                                      -- D16:未審不撈
    AND (filter_brand IS NULL OR kc.brand = filter_brand OR kc.brand IS NULL)
    AND (filter_path_type IS NULL OR kc.path_type = filter_path_type OR kc.path_type = 'common' OR kc.path_type IS NULL)
    AND (filter_stage_tag IS NULL OR kc.stage_tag = filter_stage_tag OR kc.stage_tag IS NULL)
    AND (filter_pillars IS NULL OR kc.pillar = ANY(filter_pillars))
    AND (kc.allowed_roles IS NULL OR (filter_user_role IS NOT NULL AND filter_user_role = ANY(kc.allowed_roles)))
    -- D16 visibility filter:
    --   public = all see
    --   pillar = filter_pillars 已涵蓋
    --   brand = filter_brand 已涵蓋
    --   role = allowed_roles 已涵蓋
    --   self = 只本人(uploaded_by_email = filter_user_email)
    AND (kc.visibility != 'self' OR (filter_user_email IS NOT NULL AND kc.uploaded_by_email = filter_user_email))
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Verify
SELECT
  'knowledge_chunks new columns' AS check_,
  COUNT(*) FILTER (WHERE reviewed = true) AS reviewed_true,
  COUNT(*) FILTER (WHERE reviewed = false) AS pending_review,
  COUNT(*) FILTER (WHERE visibility = 'public') AS public_chunks,
  COUNT(*) FILTER (WHERE visibility = 'pillar') AS pillar_chunks
FROM knowledge_chunks;
