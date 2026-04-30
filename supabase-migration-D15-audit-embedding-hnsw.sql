-- D15: F1 + O3 + N2(2026-04-30 接手第三輪)
--
-- F1: knowledge_chunks 加 embedded_at column → embedding refresh cron 用 (updated_at > embedded_at) 判 stale
-- O3: pgvector hnsw index → RAG retrieval O(n) → O(log n)
-- N2: audit_log table → 全 admin write 操作留痕

-- ====== F1: embedded_at column for stale detection ======
ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN knowledge_chunks.embedded_at IS
  'embedding 生成時的 timestamp。NULL=從未 embed;updated_at > embedded_at = content 已改但 embedding 未刷新';

-- backfill 既有 row 的 embedded_at(已有 embedding 的視為當下時刻 embedded)
UPDATE knowledge_chunks
SET embedded_at = COALESCE(updated_at, created_at, NOW())
WHERE embedding IS NOT NULL AND embedded_at IS NULL;

-- partial index 加速「stale chunk」查詢
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_stale
  ON knowledge_chunks(embedded_at, updated_at)
  WHERE deprecated_at IS NULL;

-- ====== O3: pgvector hnsw index for fast retrieval ======
-- 注意:hnsw 需 pgvector >= 0.5.0,Supabase 已內建
-- m=16, ef_construction=64 是 pgvector 推薦 default
DROP INDEX IF EXISTS idx_knowledge_chunks_embedding_hnsw;
CREATE INDEX idx_knowledge_chunks_embedding_hnsw
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMENT ON INDEX idx_knowledge_chunks_embedding_hnsw IS
  'HNSW index for cosine similarity search on 1536-dim embedding';

-- ====== N2: audit_log table ======
CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigserial PRIMARY KEY,
  actor_email text NOT NULL,                      -- 誰做的(admin email)
  actor_role text,                                 -- 當下角色(super_admin / brand_manager …)
  action text NOT NULL,                            -- 'create' / 'update' / 'delete' / 'trigger' …
  resource_type text NOT NULL,                    -- 'user' / 'kpi_target' / 'knowledge_chunk' / 'cron' …
  resource_id text,                                -- 被改對象的 PK(可選)
  endpoint text,                                   -- 觸發的 API path
  method text,                                     -- HTTP method
  ip_address text,                                 -- client IP(從 x-forwarded-for)
  before_data jsonb,                               -- 改之前的快照(可選)
  after_data jsonb,                                -- 改之後的快照
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_created
  ON public.audit_log(actor_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_created
  ON public.audit_log(resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_created
  ON public.audit_log(action, created_at DESC);

COMMENT ON TABLE public.audit_log IS
  '所有 admin write 操作的稽核日誌(N2 — 規範 baseline)';

-- ====== Verify ======
SELECT
  'knowledge_chunks.embedded_at' AS check_,
  COUNT(*) FILTER (WHERE embedded_at IS NOT NULL) AS embedded_count,
  COUNT(*) FILTER (WHERE embedded_at IS NULL AND embedding IS NOT NULL) AS legacy_no_ts,
  COUNT(*) FILTER (WHERE embedding IS NULL) AS no_embedding
FROM knowledge_chunks;

SELECT 'hnsw index' AS check_, indexname FROM pg_indexes
WHERE tablename = 'knowledge_chunks' AND indexname = 'idx_knowledge_chunks_embedding_hnsw';

SELECT 'audit_log' AS check_, COUNT(*) FROM public.audit_log;
