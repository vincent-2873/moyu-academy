-- D26: Phase 4 schema(投資人中心 + 人類工作區)
-- 2026-05-01
-- 對齊 system-tree v2 §投資人中心 + §人類工作區
-- 4 張新 table:claude_self_assessments / board_inquiries / decision_records / arbitration_records

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── PART 1: claude_self_assessments(/admin/board/quarterly 用) ────────────

CREATE TABLE IF NOT EXISTS claude_self_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL,                  -- 'Q1-2026' / 'Q2-2026'
  score INT,                              -- 0-100
  kpi_revenue NUMERIC,
  kpi_revenue_target NUMERIC,
  kpi_prediction_accuracy NUMERIC,        -- 0-1
  kpi_decision_success_rate NUMERIC,      -- 0-1
  kpi_roi NUMERIC,
  message_to_board TEXT,                  -- Claude 給董事會的話
  risks_disclosed JSONB,                  -- 主動揭露風險清單
  benchmark JSONB,                        -- vs 上季 / 去年
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claude_self_assessments_period
  ON claude_self_assessments(period DESC);

-- ─── PART 2: board_inquiries(/admin/board/inquiry 用) ──────────────────────

CREATE TABLE IF NOT EXISTS board_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asker_email TEXT,                       -- 投資人 / 董事 email(可空)
  asker_role TEXT,                        -- 'investor' / 'director' / 'cfo'
  question TEXT NOT NULL,
  claude_answer TEXT,
  context JSONB,                          -- 對話上下文 + reference
  exported_pdf_url TEXT,
  asked_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_board_inquiries_asked_at
  ON board_inquiries(asked_at DESC);

-- ─── PART 3: decision_records(/admin/board/decisions + /admin/human/sign-off) ─

CREATE TABLE IF NOT EXISTS decision_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,                 -- 'contract' / 'hr' / 'strategy' / 'legal' / 'operations'
  title TEXT NOT NULL,
  context TEXT,                            -- 原始衝突 / 背景
  claude_recommendation TEXT,              -- Claude 寫好的建議
  vincent_decision TEXT,                   -- Vincent 拍板
  approved_by_email TEXT,
  approved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',           -- 'pending' / 'approved' / 'rejected' / 'deferred'
  urgency TEXT DEFAULT 'normal',           -- 'critical' (今天必拍板) / 'high' (本週) / 'normal'
  due_date DATE,
  signoff_chain JSONB,                     -- 簽核鏈
  result_verification TEXT,                -- 結果驗證
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_records_status
  ON decision_records(status, urgency);
CREATE INDEX IF NOT EXISTS idx_decision_records_due
  ON decision_records(due_date) WHERE status = 'pending';

-- ─── PART 4: arbitration_records(/admin/human/arbitration 用) ──────────────

CREATE TABLE IF NOT EXISTS arbitration_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conflict_summary TEXT NOT NULL,          -- 原始衝突
  parties JSONB,                           -- 涉事方 [{ name, role }]
  process_log JSONB,                       -- 處理過程(Claude 嘗試 + 人類介入)
  conclusion TEXT,                          -- 結論
  claude_learnings TEXT,                   -- Claude 從中學什麼(寫進 RAG common pillar)
  ingested_to_rag BOOLEAN DEFAULT false,   -- 是否已 ingest 進 knowledge_chunks
  arbitrated_by_email TEXT,
  arbitrated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arbitration_records_arbitrated_at
  ON arbitration_records(arbitrated_at DESC);

-- ─── verify ──────────────────────────────────────────────────────────────────
-- 預期 4 個 table 都建好:
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('claude_self_assessments', 'board_inquiries', 'decision_records', 'arbitration_records')
--   ORDER BY table_name;
