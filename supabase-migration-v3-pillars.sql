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
