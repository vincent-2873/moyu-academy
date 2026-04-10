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
