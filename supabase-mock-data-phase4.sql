-- ============================================================================
-- PHASE 4 Mock Data — moyu_legacy schema 假資料 (中段轉向 visual demo)
-- 2026-04-29 PHASE 4
-- ============================================================================
-- 設 search_path 為 moyu_legacy 優先
SET search_path = moyu_legacy, public;

-- ── 1. users (8 名) — Vincent + 7 業務員/招聘員 ──
INSERT INTO moyu_legacy.users (id, email, name, role, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'vincent@xplatform.world', 'Vincent', 'admin', TRUE),
  ('22222222-2222-2222-2222-222222222222', 'lynn@xplatform.world', 'Lynn', 'recruit_manager', TRUE),
  ('33333333-3333-3333-3333-333333333333', 'alan.chen@xplatform.world', '陳家豪 Alan', 'sales_manager', TRUE),
  ('44444444-4444-4444-4444-444444444444', 'ming.huang@xplatform.world', '黃明翰', 'sales_rep', TRUE),
  ('55555555-5555-5555-5555-555555555555', 'irene.lin@xplatform.world', '林依靜', 'sales_rep', TRUE),
  ('66666666-6666-6666-6666-666666666666', 'kevin.wu@xplatform.world', '吳承翰 Kevin', 'sales_rep', TRUE),
  ('77777777-7777-7777-7777-777777777777', 'judy.chang@xplatform.world', '張郁庭', 'recruiter', TRUE),
  ('88888888-8888-8888-8888-888888888888', 'mike.li@xplatform.world', '李建宏 Mike', 'mentor', TRUE)
ON CONFLICT (email) DO NOTHING;

-- ── 2. sales_metrics_daily — 近 7 天 × 5 業務員 = 35 rows (financial brand: nschool) ──
INSERT INTO moyu_legacy.sales_metrics_daily
  (date, salesperson_id, brand, team, org, name, email, level, calls, call_minutes, connected, raw_appointments, appointments_show, raw_demos, closures, gross_revenue, net_revenue_daily, last_synced_at)
VALUES
  -- 黃明翰 (新人)
  (CURRENT_DATE - 6, 'sp001', 'nschool', 'Alan組台中(財經)', '台中財經', '黃明翰', 'ming.huang@xplatform.world', '新人', 95,  82, 38, 2, 1, 0, 0, 0,      0, NOW()),
  (CURRENT_DATE - 5, 'sp001', 'nschool', 'Alan組台中(財經)', '台中財經', '黃明翰', 'ming.huang@xplatform.world', '新人', 110, 95, 45, 3, 2, 1, 0, 0,      0, NOW()),
  (CURRENT_DATE - 4, 'sp001', 'nschool', 'Alan組台中(財經)', '台中財經', '黃明翰', 'ming.huang@xplatform.world', '新人', 122, 105, 52, 4, 2, 1, 1, 130000, 130000, NOW()),
  (CURRENT_DATE - 3, 'sp001', 'nschool', 'Alan組台中(財經)', '台中財經', '黃明翰', 'ming.huang@xplatform.world', '新人', 88,  72, 35, 2, 1, 0, 0, 0,      0, NOW()),
  (CURRENT_DATE - 2, 'sp001', 'nschool', 'Alan組台中(財經)', '台中財經', '黃明翰', 'ming.huang@xplatform.world', '新人', 105, 90, 48, 3, 2, 1, 0, 0,      0, NOW()),
  (CURRENT_DATE - 1, 'sp001', 'nschool', 'Alan組台中(財經)', '台中財經', '黃明翰', 'ming.huang@xplatform.world', '新人', 130, 112, 60, 5, 3, 2, 1, 130000, 130000, NOW()),
  (CURRENT_DATE,     'sp001', 'nschool', 'Alan組台中(財經)', '台中財經', '黃明翰', 'ming.huang@xplatform.world', '新人', 75,  62, 28, 2, 1, 0, 0, 0,      0, NOW()),

  -- 林依靜 (正式)
  (CURRENT_DATE - 6, 'sp002', 'nschool', 'Alan組台中(財經)', '台中財經', '林依靜', 'irene.lin@xplatform.world',  '正式', 105, 95,  50, 4, 2, 1, 1, 130000, 130000, NOW()),
  (CURRENT_DATE - 5, 'sp002', 'nschool', 'Alan組台中(財經)', '台中財經', '林依靜', 'irene.lin@xplatform.world',  '正式', 118, 102, 58, 4, 3, 2, 1, 130000, 130000, NOW()),
  (CURRENT_DATE - 4, 'sp002', 'nschool', 'Alan組台中(財經)', '台中財經', '林依靜', 'irene.lin@xplatform.world',  '正式', 132, 118, 65, 5, 3, 2, 2, 260000, 260000, NOW()),
  (CURRENT_DATE - 3, 'sp002', 'nschool', 'Alan組台中(財經)', '台中財經', '林依靜', 'irene.lin@xplatform.world',  '正式', 92,  78,  42, 3, 2, 1, 0, 0,      0,      NOW()),
  (CURRENT_DATE - 2, 'sp002', 'nschool', 'Alan組台中(財經)', '台中財經', '林依靜', 'irene.lin@xplatform.world',  '正式', 115, 100, 55, 4, 2, 1, 1, 130000, 130000, NOW()),
  (CURRENT_DATE - 1, 'sp002', 'nschool', 'Alan組台中(財經)', '台中財經', '林依靜', 'irene.lin@xplatform.world',  '正式', 122, 105, 60, 4, 3, 2, 1, 130000, 130000, NOW()),
  (CURRENT_DATE,     'sp002', 'nschool', 'Alan組台中(財經)', '台中財經', '林依靜', 'irene.lin@xplatform.world',  '正式', 88,  72,  40, 3, 1, 0, 0, 0,      0,      NOW()),

  -- 吳承翰 Kevin (正式)
  (CURRENT_DATE - 6, 'sp003', 'nschool', '延平組台北(職能)', '台北職能', '吳承翰 Kevin', 'kevin.wu@xplatform.world', '正式', 100, 88, 48, 3, 2, 1, 0, 0,      0,      NOW()),
  (CURRENT_DATE - 5, 'sp003', 'nschool', '延平組台北(職能)', '台北職能', '吳承翰 Kevin', 'kevin.wu@xplatform.world', '正式', 125, 110, 62, 5, 3, 2, 1, 130000, 130000, NOW()),
  (CURRENT_DATE - 4, 'sp003', 'nschool', '延平組台北(職能)', '台北職能', '吳承翰 Kevin', 'kevin.wu@xplatform.world', '正式', 95,  82, 45, 3, 2, 1, 0, 0,      0,      NOW()),
  (CURRENT_DATE - 3, 'sp003', 'nschool', '延平組台北(職能)', '台北職能', '吳承翰 Kevin', 'kevin.wu@xplatform.world', '正式', 130, 115, 65, 5, 4, 3, 2, 260000, 260000, NOW()),
  (CURRENT_DATE - 2, 'sp003', 'nschool', '延平組台北(職能)', '台北職能', '吳承翰 Kevin', 'kevin.wu@xplatform.world', '正式', 108, 95, 52, 4, 2, 1, 1, 130000, 130000, NOW()),
  (CURRENT_DATE - 1, 'sp003', 'nschool', '延平組台北(職能)', '台北職能', '吳承翰 Kevin', 'kevin.wu@xplatform.world', '正式', 118, 102, 58, 4, 3, 2, 1, 130000, 130000, NOW()),
  (CURRENT_DATE,     'sp003', 'nschool', '延平組台北(職能)', '台北職能', '吳承翰 Kevin', 'kevin.wu@xplatform.world', '正式', 82,  68, 35, 2, 1, 0, 0, 0,      0,      NOW()),

  -- 陳家豪 Alan (sales_manager)
  (CURRENT_DATE - 6, 'sp004', 'nschool', 'Alan組台中(財經)', '台中財經', '陳家豪 Alan', 'alan.chen@xplatform.world', '老將', 60, 55, 30, 3, 2, 1, 1, 200000, 200000, NOW()),
  (CURRENT_DATE - 5, 'sp004', 'nschool', 'Alan組台中(財經)', '台中財經', '陳家豪 Alan', 'alan.chen@xplatform.world', '老將', 65, 60, 32, 3, 2, 1, 1, 180000, 180000, NOW()),
  (CURRENT_DATE - 4, 'sp004', 'nschool', 'Alan組台中(財經)', '台中財經', '陳家豪 Alan', 'alan.chen@xplatform.world', '老將', 70, 62, 35, 4, 3, 2, 2, 380000, 380000, NOW()),
  (CURRENT_DATE - 3, 'sp004', 'nschool', 'Alan組台中(財經)', '台中財經', '陳家豪 Alan', 'alan.chen@xplatform.world', '老將', 55, 48, 28, 2, 1, 0, 0, 0,      0,      NOW()),
  (CURRENT_DATE - 2, 'sp004', 'nschool', 'Alan組台中(財經)', '台中財經', '陳家豪 Alan', 'alan.chen@xplatform.world', '老將', 75, 70, 40, 4, 3, 2, 2, 350000, 350000, NOW()),
  (CURRENT_DATE - 1, 'sp004', 'nschool', 'Alan組台中(財經)', '台中財經', '陳家豪 Alan', 'alan.chen@xplatform.world', '老將', 68, 62, 35, 3, 2, 1, 1, 180000, 180000, NOW()),
  (CURRENT_DATE,     'sp004', 'nschool', 'Alan組台中(財經)', '台中財經', '陳家豪 Alan', 'alan.chen@xplatform.world', '老將', 50, 45, 25, 2, 1, 0, 0, 0,      0,      NOW()),

  -- 李建宏 Mike (mentor)
  (CURRENT_DATE - 6, 'sp005', 'nschool', 'Mike組台北(職能)', '台北職能', '李建宏 Mike', 'mike.li@xplatform.world', '老將', 50, 45, 25, 2, 1, 0, 0, 0,      0,      NOW()),
  (CURRENT_DATE - 5, 'sp005', 'nschool', 'Mike組台北(職能)', '台北職能', '李建宏 Mike', 'mike.li@xplatform.world', '老將', 58, 52, 30, 3, 2, 1, 1, 180000, 180000, NOW()),
  (CURRENT_DATE - 4, 'sp005', 'nschool', 'Mike組台北(職能)', '台北職能', '李建宏 Mike', 'mike.li@xplatform.world', '老將', 62, 58, 32, 3, 2, 2, 1, 200000, 200000, NOW()),
  (CURRENT_DATE - 3, 'sp005', 'nschool', 'Mike組台北(職能)', '台北職能', '李建宏 Mike', 'mike.li@xplatform.world', '老將', 70, 65, 38, 4, 3, 2, 2, 380000, 380000, NOW()),
  (CURRENT_DATE - 2, 'sp005', 'nschool', 'Mike組台北(職能)', '台北職能', '李建宏 Mike', 'mike.li@xplatform.world', '老將', 55, 50, 28, 3, 1, 1, 0, 0,      0,      NOW()),
  (CURRENT_DATE - 1, 'sp005', 'nschool', 'Mike組台北(職能)', '台北職能', '李建宏 Mike', 'mike.li@xplatform.world', '老將', 65, 60, 35, 3, 2, 1, 1, 200000, 200000, NOW()),
  (CURRENT_DATE,     'sp005', 'nschool', 'Mike組台北(職能)', '台北職能', '李建宏 Mike', 'mike.li@xplatform.world', '老將', 45, 40, 22, 2, 1, 0, 0, 0,      0,      NOW())
ON CONFLICT (date, salesperson_id) DO NOTHING;

-- ── 3. recruits — 8 候選人 ──
INSERT INTO moyu_legacy.recruits (name, email, phone, status, brand) VALUES
  ('王志強', 'william.wang2026@gmail.com',  '0912-345-678', 'screening',           'nschool'),
  ('陳怡君', 'iris.chen.0312@gmail.com',     '0923-456-789', 'interview_scheduled', 'nschool'),
  ('林俊宏', 'jason.lin.work@gmail.com',     '0934-567-890', 'phone_contacted',     'nschool'),
  ('黃詩涵', 'sara.huang.life@gmail.com',    '0945-678-901', 'offer_pending',       'nschool'),
  ('張柏昇', 'eric.chang.tw@gmail.com',      '0956-789-012', 'rejected',            'nschool'),
  ('蔡欣怡', 'sherry.tsai.work@gmail.com',   '0967-890-123', 'screening',           'xuemi'),
  ('周育霖', 'allen.chou.tw@gmail.com',      '0978-901-234', 'interview_scheduled', 'xuemi'),
  ('簡瑋翔', 'tony.chien.work@gmail.com',    '0989-012-345', 'phone_contacted',     'xuemi')
ON CONFLICT DO NOTHING;

-- ── 4. legal_cases — 3 件 ──
INSERT INTO moyu_legacy.legal_cases
  (kind, brand_code, agency, agency_type, primary_party_name, owner_email, stage, status, severity, filed_date, response_deadline, amount_claimed, title, summary)
VALUES
  ('consumer_dispute', '米', '臺中市政府', '消保',  '張小姐', 'vincent@xplatform.world', 'drafting', 'open', 'normal',
    CURRENT_DATE - 14, CURRENT_DATE + 7,  85000,
    '張小姐 消費爭議(臺中市政府)', '消費者主張課程內容與招生說明不符,要求全額退費。已備齊簽約錄影 + 上課簽到紀錄'),
  ('civil_defense', '科', '臺北地方法院', '法院', '林先生', 'vincent@xplatform.world', 'review', 'open', 'high',
    CURRENT_DATE - 21, CURRENT_DATE + 14, 250000,
    '林先生 民事訴訟(臺北地院)', '原告主張課程效果未達廣告承諾,訴訟標的 250 萬。已委任律師,答辯狀 review 中'),
  ('contract_dispute', '希', '勞動局', '勞動局', '王老師', 'vincent@xplatform.world', 'finalised', 'closed', 'normal',
    CURRENT_DATE - 60, NULL, 30000,
    '王老師 勞動爭議(已和解)', '兼職講師主張延遲付款,經調解和解 3 萬元收回課酬');

-- ── 5. v3_commands — 5 個 Claude 命令 ──
INSERT INTO moyu_legacy.v3_commands
  (pillar_id, owner_email, title, detail, severity, status, deadline, ai_reasoning)
VALUES
  ('sales',   'ming.huang@xplatform.world', '今天 0 出席 → 補通電話 130 通', '目前累計 75 通,缺口 55 通。建議 13:00-18:00 集中打。',
    'high',     'pending',         CURRENT_DATE + INTERVAL '6 hours', '0 出席日活動量補救規則'),
  ('sales',   'irene.lin@xplatform.world',  '張郁庭客戶 14:00 面談確認',  '昨日邀約已 confirm,今天最後 1 個面談機會,務必確認。',
    'high',     'acknowledged',    CURRENT_DATE + INTERVAL '2 hours', '邀約客戶面談前提醒'),
  ('legal',   'vincent@xplatform.world',     '張小姐消保案 答辯狀 review',  '答辯狀 v2 待 review,期限 1 週後。',
    'normal',   'in_progress',     CURRENT_DATE + INTERVAL '7 days',  '消保案件期限管理'),
  ('recruit', 'lynn@xplatform.world',        '本週候選人面試 5 場',         '本週還剩 2 場面試未排,候選人:王志強 + 陳怡君。',
    'normal',   'pending',         CURRENT_DATE + INTERVAL '4 days',  '招聘漏斗 KPI 目標'),
  ('sales',   'vincent@xplatform.world',     'CEO 週會準備 — Alan 組產出檢視', '週五 CEO 週會,需準備 Alan 組本週成交 + 新人通數摘要。',
    'normal',   'pending',         CURRENT_DATE + INTERVAL '3 days',  '週會例行準備');

-- ── 6. line_bindings — Vincent's binding ──
INSERT INTO moyu_legacy.line_bindings (code, email, user_id, expires_at)
VALUES ('VC2026', 'vincent@xplatform.world', '11111111-1111-1111-1111-111111111111', NOW() + INTERVAL '24 hours')
ON CONFLICT (code) DO NOTHING;

-- ── Verification ──
SELECT 'users' AS tbl, COUNT(*) AS cnt FROM moyu_legacy.users
UNION ALL SELECT 'sales_metrics_daily', COUNT(*) FROM moyu_legacy.sales_metrics_daily
UNION ALL SELECT 'recruits', COUNT(*) FROM moyu_legacy.recruits
UNION ALL SELECT 'legal_cases', COUNT(*) FROM moyu_legacy.legal_cases
UNION ALL SELECT 'v3_commands', COUNT(*) FROM moyu_legacy.v3_commands
UNION ALL SELECT 'line_bindings', COUNT(*) FROM moyu_legacy.line_bindings;
