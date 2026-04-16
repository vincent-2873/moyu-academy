-- ============================================================
-- 法務系統 v2: 統一案件管理（根據 OneDrive 行政法務 5 年資料設計）
-- ============================================================
-- 涵蓋 6 大工作流：消費爭議 / 民事訴訟 / 強制執行 / 刑事 / 勞動爭議 / 合約管理
-- 設計原則：
--   1. 一案（case）一 row，多文件/多時間點靠子表
--   2. 品牌代碼固定：米/科/希/無限/言（不用自由文字）
--   3. 承辦人(owner_email)+審閱人(reviewer_email)綁 users 表
--   4. RLS service_role 全開（與 sales_metrics_daily 一致）
-- ============================================================

-- 品牌代碼列舉（5 家公司）
CREATE TABLE IF NOT EXISTS legal_brands (
  code TEXT PRIMARY KEY,                  -- 米/科/希/無限/言
  company_name TEXT NOT NULL,             -- 學米/科技學/希克斯/無限學/匠言
  tax_id TEXT,
  display_order INT DEFAULT 0
);

INSERT INTO legal_brands (code, company_name, display_order) VALUES
  ('米', '學米股份有限公司', 1),
  ('科', '科技學股份有限公司', 2),
  ('希', '希克斯股份有限公司', 3),
  ('無限', '無限學股份有限公司', 4),
  ('言', '匠言股份有限公司', 5)
ON CONFLICT (code) DO NOTHING;

-- 當事人（消費者/員工/原告/被告/債務人/講師/經銷商）
CREATE TABLE IF NOT EXISTS legal_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT,                              -- consumer / staff / plaintiff / defendant / debtor / teacher / dealer
  id_number_hash TEXT,                    -- hash of 身分證字號
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_parties_name ON legal_parties (name);
CREATE INDEX IF NOT EXISTS idx_parties_phone ON legal_parties (phone);

-- 核心案件表（多形態用 kind 區分）
CREATE TABLE IF NOT EXISTS legal_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 案號
  case_no_internal TEXT UNIQUE,           -- 113米法字113040001號
  case_no_external TEXT,                  -- 法院/機關案號 eg. 111年度北簡字第549號
  year_roc INT,                           -- 民國年
  -- 分類
  kind TEXT NOT NULL,                     -- consumer_dispute / civil_defense / civil_enforcement / criminal / labor / contract_dispute / complaint / nda_breach
  brand_code TEXT REFERENCES legal_brands(code),
  -- 機關 / 對造
  agency TEXT,                            -- 臺中市政府 / 臺北地方法院 / 勞動局 ...
  agency_type TEXT,                       -- 消保 / 法院 / 勞動局 / 消保會 / 地檢署 / 市府商業處
  primary_party_id UUID REFERENCES legal_parties(id),
  primary_party_name TEXT,                -- denormalised for fast list view
  opposing_lawyer TEXT,
  our_lawyer TEXT,
  -- 承辦 / 審閱
  owner_email TEXT,                       -- 承辦人
  reviewer_email TEXT,                    -- 主管審閱人
  -- 階段與狀態
  stage TEXT DEFAULT 'intake',            -- intake / drafting / review / sealed / dispatched / hearing / judged / finalised / closed / appealed
  status TEXT DEFAULT 'open',             -- open / closed / archived / withdrawn / settled
  severity TEXT DEFAULT 'normal',         -- normal / high / critical
  -- 關鍵日期
  filed_date DATE,                        -- 收文/起訴日
  response_deadline DATE,                 -- 回函/答辯期限
  hearing_date TIMESTAMPTZ,               -- 開庭日
  closure_date DATE,                      -- 結案日
  -- 金額相關
  amount_claimed NUMERIC,                 -- 訴訟標的金額
  amount_settled NUMERIC,                 -- 和解/判決金額
  currency TEXT DEFAULT 'TWD',
  -- 合約資訊（若有關聯）
  contract_signed_date DATE,
  payment_method TEXT,                    -- 資融 / 信用卡 / 現金
  finance_company TEXT,                   -- 和潤 / 遠信 / 中租
  course_usage_desc TEXT,
  -- 自由欄位
  title TEXT NOT NULL,                    -- 人看的標題（e.g. 「陳姿亘 消費爭議（臺中市政府）」）
  summary TEXT,                           -- 爭點摘要
  tags TEXT[],
  onedrive_path TEXT,                     -- 對應 OneDrive 資料夾
  -- 元資料
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cases_kind ON legal_cases (kind);
CREATE INDEX IF NOT EXISTS idx_cases_status ON legal_cases (status);
CREATE INDEX IF NOT EXISTS idx_cases_owner ON legal_cases (owner_email);
CREATE INDEX IF NOT EXISTS idx_cases_deadline ON legal_cases (response_deadline);
CREATE INDEX IF NOT EXISTS idx_cases_brand ON legal_cases (brand_code);
CREATE INDEX IF NOT EXISTS idx_cases_primary_party ON legal_cases (primary_party_id);

-- 案件時間軸（事件 / 狀態變更）
CREATE TABLE IF NOT EXISTS legal_case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES legal_cases(id) ON DELETE CASCADE,
  event_date TIMESTAMPTZ DEFAULT NOW(),
  event_type TEXT NOT NULL,               -- received / drafted / reviewed / sealed / dispatched / hearing_scheduled / hearing_done / judged / settled / closed / note
  title TEXT NOT NULL,
  detail TEXT,
  actor_email TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_case_events_case ON legal_case_events (case_id, event_date DESC);

-- 案件文件（OneDrive 路徑、版本）
CREATE TABLE IF NOT EXISTS legal_case_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES legal_cases(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,                 -- 答辯狀 / 陳報狀 / 回函 / 委任狀 / 和解書 / 強執狀 / 附件 / 判決書 / 合約 / 其他
  version INT DEFAULT 1,
  filename TEXT,
  onedrive_path TEXT,
  drive_file_id TEXT,
  drive_link TEXT,
  created_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_case_docs_case ON legal_case_documents (case_id);

-- 合約公版（5 品牌 × 4 版本矩陣）
CREATE TABLE IF NOT EXISTS legal_contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_code TEXT REFERENCES legal_brands(code),
  kind TEXT NOT NULL,                     -- 課程約款 / NDA / 師資承攬 / 轉讓同意書 / 授權書 / 代收付金流 / 代銷
  version_type TEXT,                      -- 官網 / 資融 / 信用卡 / 資融現金
  version_no INT DEFAULT 1,
  effective_from DATE,
  effective_to DATE,
  filename TEXT,
  onedrive_path TEXT,
  drive_link TEXT,
  supersedes_id UUID,
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contract_tpl_brand ON legal_contract_templates (brand_code, kind);

-- 合約執行件（誰簽了哪份合約）
CREATE TABLE IF NOT EXISTS legal_contract_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES legal_contract_templates(id),
  case_id UUID REFERENCES legal_cases(id), -- 若發生糾紛可連回
  party_id UUID REFERENCES legal_parties(id),
  signed_date DATE,
  amount NUMERIC,
  currency TEXT DEFAULT 'TWD',
  payment_method TEXT,
  finance_company TEXT,
  finance_term_months INT,
  video_url TEXT,                         -- 簽約錄影
  review_period_days INT DEFAULT 3,       -- 審閱期天數
  status TEXT DEFAULT 'active',           -- active / terminated / refunded / disputed
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contract_inst_party ON legal_contract_instances (party_id);
CREATE INDEX IF NOT EXISTS idx_contract_inst_case ON legal_contract_instances (case_id);

-- ============================================================
-- pillar_managers：業務/法務/招聘 主管 → email + line_user_id
--   每 pillar 可多位管理者，priority 決定 LINE 通知順序
-- ============================================================
CREATE TABLE IF NOT EXISTS pillar_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_id TEXT NOT NULL,                -- sales / legal / recruit
  email TEXT NOT NULL,
  display_name TEXT,
  line_user_id TEXT,                      -- 可選，若空則 fallback 用 email lookup users 表
  role TEXT DEFAULT 'manager',            -- manager / deputy / observer
  priority INT DEFAULT 100,               -- 越小越早收通知
  active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pillar_id, email)
);
CREATE INDEX IF NOT EXISTS idx_pillar_mgr ON pillar_managers (pillar_id, active, priority);

-- 預設 seed（Lynn 招聘、Vincent 法務/業務）
INSERT INTO pillar_managers (pillar_id, email, display_name, role, priority) VALUES
  ('recruit', 'lynn@xplatform.world', 'Lynn', 'manager', 10),
  ('sales', 'vincent@xplatform.world', 'Vincent', 'manager', 10),
  ('legal', 'vincent@xplatform.world', 'Vincent', 'manager', 10)
ON CONFLICT (pillar_id, email) DO NOTHING;

-- ============================================================
-- RLS — service_role 全開
-- ============================================================
ALTER TABLE legal_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_contract_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE pillar_managers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "svc" ON legal_brands FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "svc" ON legal_parties FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "svc" ON legal_cases FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "svc" ON legal_case_events FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "svc" ON legal_case_documents FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "svc" ON legal_contract_templates FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "svc" ON legal_contract_instances FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "svc" ON pillar_managers FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
