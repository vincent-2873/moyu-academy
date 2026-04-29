-- Chunk B (legal/v3/training) - search_path 重 set
SET search_path = moyu_legacy, public;

-- ============================================================
-- BLOCK: legal-v2.sql
-- ============================================================
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

-- ============================================================
-- BLOCK: v3-erp.sql
-- ============================================================
-- ─────────────────────────────────────────────────────────────────────────
-- 墨宇 v3 — ERP / 組織架構層 (2026-04-10)
-- ─────────────────────────────────────────────────────────────────────────
-- 哲學：每個員工註冊後就清楚知道
--   1. 自己屬於哪個部門
--   2. 自己的職位是什麼
--   3. 自己要做什麼事（職責 / KPI）
--   4. 主管是誰
--   5. 自己負責哪些專案（v3_projects）
--   6. 今天該完成的命令（v3_commands）
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 1. 部門 (Departments) ─────────────────────────────────────────────────
create table if not exists v3_departments (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                  -- 'sales' / 'legal' / 'hr' / 'ops' / 'marketing'
  name text not null,                         -- 業務部 / 法務部 / 人資部
  icon text default '🏢',
  color text default '#7c6cf0',
  brand text,                                 -- 屬於哪個品牌（nschool / xuemi / ...），null = 集團共用
  description text,
  lead_email text,                            -- 部門主管 email
  parent_id uuid references v3_departments(id) on delete set null,
  display_order int default 0,
  created_at timestamptz default now()
);

create index if not exists v3_departments_brand_idx on v3_departments(brand);
create index if not exists v3_departments_parent_idx on v3_departments(parent_id);

-- ─── 2. 職位 (Positions) ───────────────────────────────────────────────────
create table if not exists v3_positions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references v3_departments(id) on delete cascade,
  title text not null,                        -- 業務員 / 業務組長 / 法務專員
  level text default 'staff',                 -- staff / lead / manager / director
  description text,
  responsibilities jsonb default '[]'::jsonb, -- ["每日 30 通電話", "每週 5 邀約", ...]
  base_kpi jsonb default '[]'::jsonb,         -- KPI 目標 [{metric:'monthly_calls', target:600}]
  reports_to_position_id uuid references v3_positions(id) on delete set null,
  display_order int default 0,
  created_at timestamptz default now()
);

create index if not exists v3_positions_department_idx on v3_positions(department_id);

-- ─── 3. 擴充 users 表 ──────────────────────────────────────────────────────
alter table users add column if not exists department_id uuid references v3_departments(id) on delete set null;
alter table users add column if not exists position_id uuid references v3_positions(id) on delete set null;
alter table users add column if not exists manager_email text;

-- ─── 4. RLS ────────────────────────────────────────────────────────────────
alter table v3_departments enable row level security;
alter table v3_positions enable row level security;

drop policy if exists "service_role_all_v3_departments" on v3_departments;
drop policy if exists "service_role_all_v3_positions" on v3_positions;
create policy "service_role_all_v3_departments" on v3_departments for all using (true) with check (true);
create policy "service_role_all_v3_positions" on v3_positions for all using (true) with check (true);

-- ─── 5. 種子資料 — 預設部門 ────────────────────────────────────────────────
insert into v3_departments (code, name, icon, color, description, display_order) values
  ('sales',     '業務部',   '💰', '#fb923c', '4 大品牌業務 — 賣課、收單、轉換',           1),
  ('legal',     '法務部',   '⚖️', '#7c6cf0', '合約、合規、智財、糾紛、政府申報',          2),
  ('hr',        '人資招聘部', '🎯', '#10b981', '招聘漏斗、候選人管理、員工留任',           3),
  ('ops',       '營運部',   '⚙️', '#0891b2', '系統、流程、後勤、客服、教練支援',          4),
  ('marketing', '行銷部',   '📣', '#ec4899', '品牌、廣告、內容、社群、SEO',               5)
on conflict (code) do update set
  name = excluded.name,
  icon = excluded.icon,
  color = excluded.color,
  description = excluded.description;

-- ─── 6. 種子資料 — 各部門起始職位 ──────────────────────────────────────────
do $$
declare
  d_sales uuid;
  d_legal uuid;
  d_hr uuid;
  d_ops uuid;
  d_marketing uuid;
begin
  select id into d_sales from v3_departments where code='sales';
  select id into d_legal from v3_departments where code='legal';
  select id into d_hr from v3_departments where code='hr';
  select id into d_ops from v3_departments where code='ops';
  select id into d_marketing from v3_departments where code='marketing';

  -- 業務部
  insert into v3_positions (department_id, title, level, description, responsibilities, base_kpi, display_order)
  select d_sales, '業務員', 'staff',
    '第一線業務 — 開發、邀約、成交',
    '["每日 30 通有效電話", "每週 5 場面談邀約", "每月成交 ≥10 單", "每日填寫 KPI 紀錄", "每週對練影片提交"]'::jsonb,
    '[{"metric":"monthly_calls","target":600},{"metric":"monthly_appointments","target":20},{"metric":"monthly_closures","target":10}]'::jsonb,
    1
  where not exists (select 1 from v3_positions where department_id=d_sales and title='業務員');

  insert into v3_positions (department_id, title, level, description, responsibilities, base_kpi, display_order)
  select d_sales, '業務組長', 'lead',
    '帶 3-5 位業務員 — 戰技傳授、KPI 監控、案件支援',
    '["每週帶組會議 1 次", "每位下屬每日 KPI 追蹤", "每週至少陪同 2 場面談", "每月組整體成交 ≥40 單"]'::jsonb,
    '[{"metric":"team_monthly_closures","target":40}]'::jsonb,
    2
  where not exists (select 1 from v3_positions where department_id=d_sales and title='業務組長');

  insert into v3_positions (department_id, title, level, description, responsibilities, base_kpi, display_order)
  select d_sales, '業務主管', 'manager',
    '掌管整個品牌業務 — 戰略、招募、淘汰、結果',
    '["每月品牌營收目標達成", "每月新人入職 ≥3 人", "每月汰弱留強", "每週與 CEO 對焦戰況"]'::jsonb,
    '[{"metric":"brand_monthly_revenue","target":3000000}]'::jsonb,
    3
  where not exists (select 1 from v3_positions where department_id=d_sales and title='業務主管');

  -- 法務部
  insert into v3_positions (department_id, title, level, description, responsibilities, base_kpi, display_order)
  select d_legal, '法務專員', 'staff',
    '合約審核、糾紛處理、法規追蹤',
    '["每週審核合約 ≥5 份", "每月更新法規 1 次", "客訴 / 糾紛 24h 內回應"]'::jsonb,
    '[]'::jsonb,
    1
  where not exists (select 1 from v3_positions where department_id=d_legal and title='法務專員');

  -- 人資招聘部
  insert into v3_positions (department_id, title, level, description, responsibilities, base_kpi, display_order)
  select d_hr, '招聘專員', 'staff',
    '主動找人、面試安排、入職跟進',
    '["每週聯繫 ≥30 候選人", "每週安排面試 ≥5 場", "每月成功入職 ≥3 人", "離職率 <10%"]'::jsonb,
    '[{"metric":"weekly_outreach","target":30},{"metric":"monthly_hires","target":3}]'::jsonb,
    1
  where not exists (select 1 from v3_positions where department_id=d_hr and title='招聘專員');

  insert into v3_positions (department_id, title, level, description, responsibilities, base_kpi, display_order)
  select d_hr, 'HR 主管', 'manager',
    '統籌全集團招聘、留任、培訓',
    '["每月集團整體入職 ≥10 人", "員工留任率 ≥85%", "建立新人培訓 SOP"]'::jsonb,
    '[]'::jsonb,
    2
  where not exists (select 1 from v3_positions where department_id=d_hr and title='HR 主管');

  -- 營運部
  insert into v3_positions (department_id, title, level, description, responsibilities, base_kpi, display_order)
  select d_ops, '營運專員', 'staff',
    '系統維運、流程改善、後勤支援',
    '["每週流程檢視 1 次", "客服回應 SLA <2h", "系統穩定度 ≥99%"]'::jsonb,
    '[]'::jsonb,
    1
  where not exists (select 1 from v3_positions where department_id=d_ops and title='營運專員');

  -- 行銷部
  insert into v3_positions (department_id, title, level, description, responsibilities, base_kpi, display_order)
  select d_marketing, '行銷專員', 'staff',
    '廣告、內容、社群、品牌維運',
    '["每週發布 3 則內容", "每月廣告 ROAS ≥3", "每月新粉絲 ≥500"]'::jsonb,
    '[]'::jsonb,
    1
  where not exists (select 1 from v3_positions where department_id=d_marketing and title='行銷專員');
end $$;

-- ============================================================
-- BLOCK: v3-pillars.sql
-- ============================================================
-- ─────────────────────────────────────────────────────────────────────────
-- 墨宇 v3 — 3 大支柱觀測系統 (2026-04-10)
-- ─────────────────────────────────────────────────────────────────────────
-- 哲學：Claude 是 CEO，3 大業務支柱（業務 / 法務 / 招聘），每天 Claude
-- 產出命令推送給人類員工，人類在系統內回報，Claude 自動學習迭代。
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 1. 支柱（Pillars） ───────────────────────────────────────────────────
-- 3 大支柱寫死，不開放新增（避免擴散）
create table if not exists v3_pillars (
  id text primary key,                    -- 'sales' / 'legal' / 'recruit'
  name text not null,                     -- 業務 / 法務 / 招聘
  color text not null,                    -- hex
  description text,
  display_order int default 0,
  created_at timestamptz default now()
);

insert into v3_pillars (id, name, color, description, display_order) values
  ('sales',   '業務', '#fb923c', '賣課、收單、轉換率、業務員戰力', 1),
  ('legal',   '法務', '#7c6cf0', '合約、合規、智財、糾紛、政府申報',   2),
  ('recruit', '招聘', '#10b981', '人才漏斗、招聘員、面試、留任',     3)
on conflict (id) do update set name = excluded.name, color = excluded.color, description = excluded.description;

-- ─── 2. 專案（Projects） ──────────────────────────────────────────────────
-- 每個支柱底下若干專案，每個專案有目標 / 負責人 / KPI / deadline
create table if not exists v3_projects (
  id uuid primary key default gen_random_uuid(),
  pillar_id text not null references v3_pillars(id) on delete cascade,
  name text not null,
  goal text not null,                     -- 一句話目標 (北極星 KPI)
  owner_email text,                       -- 主負責人
  status text default 'active',           -- active / paused / done / dropped
  health text default 'unknown',          -- healthy / warning / critical / unknown
  progress int default 0,                 -- 0-100
  deadline date,
  kpi_target jsonb,                       -- {metric:'monthly_revenue', value:3000000}
  kpi_actual jsonb,                       -- 自動計算 / 人類回報
  diagnosis text,                         -- Claude 的診斷
  next_action text,                       -- Claude 規劃的下一步
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists v3_projects_pillar_idx on v3_projects(pillar_id);
create index if not exists v3_projects_health_idx on v3_projects(health);

-- ─── 3. Claude 命令（每天產出的指派） ─────────────────────────────────────
create table if not exists v3_commands (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references v3_projects(id) on delete cascade,
  pillar_id text references v3_pillars(id) on delete cascade,
  owner_email text not null,              -- 接收者
  title text not null,                    -- 一句話命令
  detail text,                            -- 詳細說明 (Claude 解釋為何要做)
  severity text default 'normal',         -- info / normal / high / critical
  deadline timestamptz,                   -- 必須在何時前完成
  status text default 'pending',          -- pending / acknowledged / done / blocked / ignored
  ai_generated boolean default true,
  ai_reasoning text,                      -- Claude 的判斷依據（學習用）
  created_at timestamptz default now(),
  acknowledged_at timestamptz,
  done_at timestamptz,
  blocked_reason text
);

create index if not exists v3_commands_owner_idx on v3_commands(owner_email);
create index if not exists v3_commands_status_idx on v3_commands(status);
create index if not exists v3_commands_project_idx on v3_commands(project_id);

-- ─── 4. LINE 推送紀錄 ─────────────────────────────────────────────────────
create table if not exists v3_line_dispatch (
  id uuid primary key default gen_random_uuid(),
  command_id uuid references v3_commands(id) on delete cascade,
  recipient_email text not null,
  recipient_line_user_id text,
  pushed_at timestamptz default now(),
  push_status text default 'pending',     -- pending / sent / failed
  push_error text,
  line_message_id text
);

create index if not exists v3_line_dispatch_command_idx on v3_line_dispatch(command_id);

-- ─── 5. 人類回應紀錄（學習用） ────────────────────────────────────────────
-- 記錄人類對每個命令的反應，給 Claude 自我迭代用
create table if not exists v3_response_log (
  id uuid primary key default gen_random_uuid(),
  command_id uuid references v3_commands(id) on delete cascade,
  owner_email text not null,
  action text not null,                   -- viewed / acknowledged / done / blocked / ignored
  response_time_seconds int,              -- 從 push 到此 action 的秒數
  note text,
  created_at timestamptz default now()
);

create index if not exists v3_response_log_owner_idx on v3_response_log(owner_email);
create index if not exists v3_response_log_command_idx on v3_response_log(command_id);

-- ─── 6. AI 學習筆記（Claude 自己更新的規則） ──────────────────────────────
-- Claude 自動觀察哪些命令奏效、哪些被忽視，更新自己的判斷規則
create table if not exists v3_ai_insights (
  id uuid primary key default gen_random_uuid(),
  pillar_id text references v3_pillars(id),
  insight_type text not null,             -- pattern / rule / hypothesis
  content text not null,                  -- 觀察結論
  evidence jsonb,                         -- 支持證據（命令 ID 列表 + 結果）
  confidence numeric default 0.5,         -- 0-1
  applied boolean default false,          -- 是否已套用到生產規則
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── 種子資料：每支柱先放 1-2 個 starter project ───────────────────────────
insert into v3_projects (pillar_id, name, goal, status, health, progress, diagnosis, next_action) values
  ('sales',   '業務戰力建立',     '4 個業務品牌每月平均 30 通／人，月成交 10 單', 'active', 'unknown', 0, '尚未開始監測', 'Claude 等待第一週數據'),
  ('sales',   '轉換漏斗優化',     '通數→邀約 30%、邀約→成交 40%',                'active', 'unknown', 0, '尚未開始監測', 'Claude 等待第一週數據'),
  ('legal',   '合約模板建置',     '6 大類合約模板（業務、招聘、合作、保密、講師、智財）完成審核', 'active', 'unknown', 0, '尚未啟動',    '需要用戶提供現有合約版本'),
  ('legal',   '智財申報',         '商標 / 著作權 / 課程內容智財佈局完成',         'active', 'unknown', 0, '尚未啟動',    '需要清點現有 IP'),
  ('recruit', '招聘漏斗建立',     '每月 20 位有效投遞，80% 通過試用期',          'active', 'unknown', 0, '尚未開始監測', '需要確認廣告投放預算與管道'),
  ('recruit', '招聘員培訓',       '招聘員每週聯繫 ≥30 候選人',                    'active', 'unknown', 0, '尚未開始監測', '需要確認招聘員人數');

-- ============================================================
-- BLOCK: training-units.sql
-- ============================================================
-- ================================================================
-- Migration: training_units + training_unit_progress
-- 目的：為「新訓區域」建立統一訓練單元資料層
-- 對應文件：moyu-training-system zip 的 audit report
-- 依賴：hr_training_progress 已存在（不衝突，作為 legacy 並行）
-- 作者：Claude Code
-- 日期：2026-04-23
-- ================================================================

-- ----------------------------------------------------------------
-- 1. training_units：訓練單元主表（對應 moyu-training-system 的 HR-053/054/055/056 等）
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_units (
  id BIGSERIAL PRIMARY KEY,
  unit_code TEXT UNIQUE NOT NULL,                -- 'HR-053', 'HR-054' ...
  system TEXT NOT NULL CHECK (system IN ('HR','BIZ','LEGAL')),
  title TEXT NOT NULL,
  audience TEXT[] NOT NULL,                       -- {'HR-INT'}, {'ALL','NEW'}
  priority TEXT NOT NULL CHECK (priority IN ('P0','P1','P2')),
  series TEXT,                                    -- 'HRBP_RECRUIT_V1'
  series_position INT,                            -- 1..4
  series_total INT,                               -- 4
  video_url TEXT,                                 -- Supabase Storage signed URL
  video_duration_seconds INT,
  interactive_html_url TEXT,                      -- 互動測驗 html 位置
  handbook_md TEXT,                               -- 手冊 Markdown 原文（可 null）
  prerequisite_units TEXT[],                      -- {'HR-051','HR-052'}
  learning_objectives JSONB,                      -- [{audience, behavior, condition, degree}]
  key_points TEXT[],                              -- 關鍵知識點
  source_repo TEXT DEFAULT 'moyu-training-system',
  source_commit TEXT,                             -- GitHub commit sha of input.md
  legacy_task_id BIGINT,                          -- 舊 hr_training_tasks.id 對映（可 null）
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_units_series_position ON training_units(series, series_position);
CREATE INDEX IF NOT EXISTS idx_training_units_system_priority ON training_units(system, priority);
CREATE INDEX IF NOT EXISTS idx_training_units_published ON training_units(published) WHERE published = true;

-- ----------------------------------------------------------------
-- 2. training_unit_progress：個人進度（接 postMessage 寫入）
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_unit_progress (
  id BIGSERIAL PRIMARY KEY,
  trainee_email TEXT NOT NULL,
  unit_code TEXT NOT NULL REFERENCES training_units(unit_code) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('not_started','watching','quiz_pending','passed','failed')),
  score INT,
  total INT,
  passed BOOLEAN,
  series_complete BOOLEAN DEFAULT false,           -- EP4 結尾會帶這個
  first_viewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempt_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trainee_email, unit_code)
);

CREATE INDEX IF NOT EXISTS idx_training_progress_email ON training_unit_progress(trainee_email);
CREATE INDEX IF NOT EXISTS idx_training_progress_status ON training_unit_progress(status);

-- ----------------------------------------------------------------
-- 3. RLS policies（遵循 moyu-academy 4/23 security sprint 後的統一原則）
-- ----------------------------------------------------------------
ALTER TABLE training_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_unit_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all ON training_units
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY published_read ON training_units
  FOR SELECT USING (published = true);

CREATE POLICY service_role_all ON training_unit_progress
  FOR ALL USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------
-- 4. updated_at 自動更新
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at_training()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_training_units_updated
  BEFORE UPDATE ON training_units
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_training();

CREATE TRIGGER trg_training_unit_progress_updated
  BEFORE UPDATE ON training_unit_progress
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_training();

-- ----------------------------------------------------------------
-- 5. Seed：HRBP 招募訓練系列（EP1-4）骨架，實際 URL 由 sync job 回填
-- ----------------------------------------------------------------
INSERT INTO training_units (unit_code, system, title, audience, priority, series, series_position, series_total, video_duration_seconds, prerequisite_units, published)
VALUES
  ('HR-053','HR','業務敘薪制度全解析',    ARRAY['HR-INT'],'P0','HRBP_RECRUIT_V1',1,4,1080, ARRAY['HR-051','HR-052'], false),
  ('HR-054','HR','一面 vs 二面：面試的任務分工', ARRAY['HR-INT'],'P0','HRBP_RECRUIT_V1',2,4, 660, ARRAY['HR-053'], false),
  ('HR-055','HR','電訪心法 · 三階段回覆法', ARRAY['HR-INT'],'P0','HRBP_RECRUIT_V1',3,4, 900, ARRAY['HR-053','HR-054'], false),
  ('HR-056','HR','致命提問應對 · 業績壓力與團隊氛圍', ARRAY['HR-INT'],'P0','HRBP_RECRUIT_V1',4,4, 660, ARRAY['HR-053','HR-054','HR-055'], false)
ON CONFLICT (unit_code) DO NOTHING;

-- ============================================================
