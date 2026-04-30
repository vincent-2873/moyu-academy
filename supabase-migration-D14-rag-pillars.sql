-- D14: RAG 三池(HR / 法務 / 業務)— pillar column + allowed_roles ACL
-- Vincent 2026-04-30 反饋:RAG 要分 3 個 namespace 給不同團隊
-- 設計:Plan A(pillar column)+ Plan C(allowed_roles[] 細粒度 ACL)

-- 1. ALTER knowledge_chunks 加 pillar + allowed_roles
ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS pillar text NOT NULL DEFAULT 'common'
    CHECK (pillar IN ('hr', 'legal', 'sales', 'common')),
  ADD COLUMN IF NOT EXISTS allowed_roles text[] DEFAULT NULL;
  -- allowed_roles=NULL 表示「pillar 內所有人可看」
  -- 不為 NULL 表示「額外 ACL,只有列出的 role 可看」

COMMENT ON COLUMN knowledge_chunks.pillar IS 'RAG 池:hr/legal/sales/common(common 全員可見)';
COMMENT ON COLUMN knowledge_chunks.allowed_roles IS '額外 ACL — NULL=pillar 內全員可見;非 NULL=只限這些 role';

-- 2. Index for retrieval performance
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_pillar
  ON knowledge_chunks(pillar);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_pillar_embedding
  ON knowledge_chunks(pillar) WHERE embedding IS NOT NULL;

-- 3. Backfill 既有 chunks 全 mark 'common'(safe default — 不破壞現有 chat 行為)
-- 既有 34 chunks 是訓練 md(content/training/),屬通用教材
UPDATE knowledge_chunks SET pillar = 'common' WHERE pillar IS NULL OR pillar = '';

-- 4. system_settings 新增 Notion DB id config(等 Vincent 給後填)
CREATE TABLE IF NOT EXISTS rag_notion_config (
  id text PRIMARY KEY,                    -- pillar (hr / legal / sales)
  notion_database_id text,                -- Notion database id
  enabled boolean DEFAULT false,
  last_synced_at timestamptz,
  last_synced_count int DEFAULT 0,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

INSERT INTO rag_notion_config (id, enabled) VALUES
  ('hr', false),
  ('legal', false),
  ('sales', false)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE rag_notion_config IS 'Vincent 填 3 個 Notion db_id 後 enabled=true,ingest 自動分 pillar';

-- 5. Drop & re-create search_knowledge RPC 加 pillar + user_role filter
DROP FUNCTION IF EXISTS public.search_knowledge(vector(1536), int, text, text, text);

CREATE OR REPLACE FUNCTION public.search_knowledge(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter_brand text DEFAULT NULL,
  filter_path_type text DEFAULT NULL,
  filter_stage_tag text DEFAULT NULL,
  filter_pillars text[] DEFAULT NULL,    -- RAG 三池 (2026-04-30)
  filter_user_role text DEFAULT NULL     -- allowed_roles[] ACL
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
    kc.id,
    kc.source_type,
    kc.source_id,
    kc.title,
    kc.content,
    1 - (kc.embedding <=> query_embedding) AS similarity,
    kc.pillar,
    kc.metadata
  FROM public.knowledge_chunks kc
  WHERE
    kc.deprecated_at IS NULL
    AND kc.embedding IS NOT NULL
    AND (filter_brand IS NULL OR kc.brand = filter_brand OR kc.brand IS NULL)
    AND (filter_path_type IS NULL OR kc.path_type = filter_path_type OR kc.path_type = 'common' OR kc.path_type IS NULL)
    AND (filter_stage_tag IS NULL OR kc.stage_tag = filter_stage_tag OR kc.stage_tag IS NULL)
    -- pillar filter:caller 指定 user 可見 pillar 清單(common 必含)
    AND (filter_pillars IS NULL OR kc.pillar = ANY(filter_pillars))
    -- allowed_roles ACL:NULL 表 pillar 內全員;非 NULL 必須 user_role 在 array 內
    AND (kc.allowed_roles IS NULL OR (filter_user_role IS NOT NULL AND filter_user_role = ANY(kc.allowed_roles)))
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 6. Verify
SELECT
  pillar,
  COUNT(*) AS chunks,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS embedded
FROM knowledge_chunks
GROUP BY pillar
ORDER BY pillar;
