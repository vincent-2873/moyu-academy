-- D17: Multi-tenant 準備(2026-04-30 第三輪 Wave E)
--
-- Vincent 反饋:此系統未來 SaaS 化,別人公司會用
-- → 必須準備 tenant isolation
--
-- 策略:**漸進式遷移**
--   1. 加 organizations table(每家公司一筆)
--   2. 預設一筆 'moyu' = 現有資料
--   3. users / knowledge_chunks / 重要 tables 加 organization_id default='moyu'
--   4. 不動其他次要 tables(等真有第二家公司時再 migrate)
--   5. 程式 query 時 default 撈 'moyu',直到 SaaS 上線
--
-- 完整 SaaS-readiness 計畫見 SAAS-READINESS.md

-- ====== 1. organizations table ======
CREATE TABLE IF NOT EXISTS public.organizations (
  id text PRIMARY KEY,                      -- 'moyu' / 'huance' / 等(slug,human-readable)
  name text NOT NULL,                       -- '墨宇集團' / '寰策業訓'
  display_name text,
  industry text,
  plan text DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'churned')),
  -- 配額(quota)— 防 abuse
  max_users int DEFAULT 50,
  max_chunks int DEFAULT 10000,
  max_monthly_cron_runs int DEFAULT 10000,
  -- billing
  billing_email text,
  trial_ends_at timestamptz,
  -- 客製化
  brand_color text,
  logo_url text,
  custom_domain text,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

COMMENT ON TABLE public.organizations IS 'SaaS multi-tenant root table — 每家公司一筆';

-- 預設 'moyu' tenant(現有資料的 owner)
INSERT INTO public.organizations (id, name, display_name, plan, status)
VALUES ('moyu', 'moyu', '墨宇集團', 'enterprise', 'active')
ON CONFLICT (id) DO NOTHING;

-- ====== 2. users 加 organization_id ======
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS organization_id text NOT NULL DEFAULT 'moyu' REFERENCES public.organizations(id);

CREATE INDEX IF NOT EXISTS idx_users_organization
  ON users(organization_id);

-- ====== 3. knowledge_chunks 加 organization_id(RAG 隔離核心) ======
ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS organization_id text NOT NULL DEFAULT 'moyu' REFERENCES public.organizations(id);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_organization
  ON knowledge_chunks(organization_id);

-- search_knowledge() 加 organization filter(預設 moyu,SaaS 之後 caller 必填)
DROP FUNCTION IF EXISTS public.search_knowledge(vector(1536), int, text, text, text, text[], text, text);

CREATE OR REPLACE FUNCTION public.search_knowledge(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter_brand text DEFAULT NULL,
  filter_path_type text DEFAULT NULL,
  filter_stage_tag text DEFAULT NULL,
  filter_pillars text[] DEFAULT NULL,
  filter_user_role text DEFAULT NULL,
  filter_user_email text DEFAULT NULL,
  filter_organization_id text DEFAULT 'moyu'      -- D17 multi-tenant
)
RETURNS TABLE (
  id uuid, source_type text, source_id text, title text, content text,
  similarity float, pillar text, metadata jsonb
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
    AND kc.reviewed = true
    AND kc.organization_id = filter_organization_id          -- D17:tenant 隔離
    AND (filter_brand IS NULL OR kc.brand = filter_brand OR kc.brand IS NULL)
    AND (filter_path_type IS NULL OR kc.path_type = filter_path_type OR kc.path_type = 'common' OR kc.path_type IS NULL)
    AND (filter_stage_tag IS NULL OR kc.stage_tag = filter_stage_tag OR kc.stage_tag IS NULL)
    AND (filter_pillars IS NULL OR kc.pillar = ANY(filter_pillars))
    AND (kc.allowed_roles IS NULL OR (filter_user_role IS NOT NULL AND filter_user_role = ANY(kc.allowed_roles)))
    AND (kc.visibility != 'self' OR (filter_user_email IS NOT NULL AND kc.uploaded_by_email = filter_user_email))
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ====== 4. audit_log 加 organization_id ======
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS organization_id text DEFAULT 'moyu' REFERENCES public.organizations(id);

CREATE INDEX IF NOT EXISTS idx_audit_log_organization
  ON public.audit_log(organization_id, created_at DESC);

-- ====== 5. system_run_log 加 organization_id(noop, 暫不強制) ======
ALTER TABLE public.system_run_log
  ADD COLUMN IF NOT EXISTS organization_id text DEFAULT 'moyu';

-- ====== 6. Verify ======
SELECT
  'organizations' AS check_, COUNT(*) AS rows FROM public.organizations
UNION ALL
SELECT 'users with org', COUNT(*) FROM users WHERE organization_id IS NOT NULL
UNION ALL
SELECT 'chunks with org', COUNT(*) FROM knowledge_chunks WHERE organization_id IS NOT NULL;
