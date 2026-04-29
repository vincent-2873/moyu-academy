-- C 骨架 #3: Claude 對話 + 主管查看 audit log
-- 政策(Vincent 拍板): 主管可查員工對話, 不告知員工(不加同意條款), 內部 audit 留 log

-- 1. claude_conversations table(員工跟 Claude 的對話歷史)
CREATE TABLE IF NOT EXISTS public.claude_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  context_sources jsonb DEFAULT '[]'::jsonb,  -- 預留 RAG retrieval sources(I 段未來用)
  metadata jsonb DEFAULT '{}'::jsonb,         -- 預留 stage/brand/page 等 context
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claude_conv_user_id ON public.claude_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_claude_conv_session_id ON public.claude_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_claude_conv_created_at ON public.claude_conversations(created_at DESC);

-- 2. claude_conversation_audit_log(主管查員工對話留 log)
CREATE TABLE IF NOT EXISTS public.claude_conversation_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id uuid NOT NULL REFERENCES public.users(id),
  target_user_id uuid NOT NULL REFERENCES public.users(id),
  viewed_session_id uuid,
  viewed_at timestamptz NOT NULL DEFAULT NOW(),
  viewer_capability_scope text,
  reason text  -- 主管自填查看原因(可選)
);

CREATE INDEX IF NOT EXISTS idx_audit_viewer_id ON public.claude_conversation_audit_log(viewer_id);
CREATE INDEX IF NOT EXISTS idx_audit_target_id ON public.claude_conversation_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_viewed_at ON public.claude_conversation_audit_log(viewed_at DESC);

-- 3. 員工 user_memory(預留 I 段 RAG + Memory schema)
CREATE TABLE IF NOT EXISTS public.user_memory (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  observations jsonb DEFAULT '[]'::jsonb,     -- Claude 自動萃取的觀察
  preferences jsonb DEFAULT '{}'::jsonb,      -- 員工說過的偏好
  goals jsonb DEFAULT '[]'::jsonb,            -- 員工的個人目標
  context jsonb DEFAULT '{}'::jsonb,          -- 個人脈絡
  last_synced_at timestamptz,
  embedding_status text DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'embedded', 'stale')),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- 4. Verify
SELECT
  'claude_conversations' AS table_name,
  COUNT(*) AS row_count
FROM public.claude_conversations
UNION ALL SELECT 'claude_conversation_audit_log', COUNT(*) FROM public.claude_conversation_audit_log
UNION ALL SELECT 'user_memory', COUNT(*) FROM public.user_memory;
