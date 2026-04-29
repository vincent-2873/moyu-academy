-- D3: RAG 知識引擎底層 schema
-- spec I 段「知識引擎」預留 — 訓練資料 / Notion / LINE 群組對話皆可 ingest
-- pgvector extension (Supabase 內建支援)

-- 1. 啟用 pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. knowledge_chunks(I3.A 公司知識庫)
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,                  -- 'notion' / 'training_md' / 'line_chat' / 'recording_transcript' / 'decision' / 'case'
  source_id text NOT NULL,                     -- Notion page id / 檔名 / LINE 群名 + timestamp
  source_url text,
  brand text,                                  -- 'XLAB' / 'nSchool 財經' / '無限學院' / '學米' / '未來學院' / NULL=共通
  business_line text,                          -- 'finance' / 'function' / 'physical' / 'future' / NULL=共通
  stage_tag text,                              -- 'beginner' / 'intermediate' / 'advanced' / 'master' / NULL=共通
  path_type text,                              -- 'business' / 'recruit' / 'common'
  title text,
  content text NOT NULL,
  content_hash text,                           -- SHA256 of content, dedup 用
  embedding vector(1536),                      -- OpenAI text-embedding-3-small / Voyage
  metadata jsonb DEFAULT '{}'::jsonb,
  token_count int,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deprecated_at timestamptz                    -- 軟刪除
);

CREATE INDEX IF NOT EXISTS idx_knowledge_source_type ON public.knowledge_chunks(source_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_brand ON public.knowledge_chunks(brand) WHERE brand IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_path_type ON public.knowledge_chunks(path_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_active ON public.knowledge_chunks(deprecated_at) WHERE deprecated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_hash ON public.knowledge_chunks(content_hash);

-- HNSW index for fast vector search (1536 dim)
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding ON public.knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WHERE deprecated_at IS NULL;

-- 3. knowledge_sources_log(每次 ingest 紀錄,用於增量 sync)
CREATE TABLE IF NOT EXISTS public.knowledge_sources_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_id text NOT NULL,
  last_synced_at timestamptz NOT NULL DEFAULT NOW(),
  chunks_added int DEFAULT 0,
  chunks_updated int DEFAULT 0,
  chunks_deprecated int DEFAULT 0,
  status text DEFAULT 'ok' CHECK (status IN ('ok', 'partial', 'fail')),
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE (source_type, source_id, last_synced_at)
);

CREATE INDEX IF NOT EXISTS idx_ksl_source ON public.knowledge_sources_log(source_type, source_id, last_synced_at DESC);

-- 4. 簡化 search function(cosine similarity top-k)
CREATE OR REPLACE FUNCTION public.search_knowledge(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter_brand text DEFAULT NULL,
  filter_path_type text DEFAULT NULL,
  filter_stage_tag text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  source_type text,
  source_id text,
  title text,
  content text,
  similarity float,
  metadata jsonb
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    kc.id,
    kc.source_type,
    kc.source_id,
    kc.title,
    kc.content,
    1 - (kc.embedding <=> query_embedding) AS similarity,
    kc.metadata
  FROM public.knowledge_chunks kc
  WHERE
    kc.deprecated_at IS NULL
    AND kc.embedding IS NOT NULL
    AND (filter_brand IS NULL OR kc.brand = filter_brand OR kc.brand IS NULL)
    AND (filter_path_type IS NULL OR kc.path_type = filter_path_type OR kc.path_type = 'common' OR kc.path_type IS NULL)
    AND (filter_stage_tag IS NULL OR kc.stage_tag = filter_stage_tag OR kc.stage_tag IS NULL)
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 5. Verify
SELECT 'knowledge_chunks' AS table_name, COUNT(*) AS rows FROM public.knowledge_chunks
UNION ALL SELECT 'knowledge_sources_log', COUNT(*) FROM public.knowledge_sources_log;
