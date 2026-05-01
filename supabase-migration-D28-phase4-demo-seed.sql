-- D28: Phase 4 demo data seed (2026-05-02)
-- Vincent 拍板:不要看「尚未有」空白頁,需要 demo data 看頁面長相
-- 4 張 Phase 4 表分別 seed 1-3 筆代表性資料

-- ─── claude_self_assessments (季度成績單) ────────────
INSERT INTO claude_self_assessments
  (id, period, score, kpi_revenue, kpi_revenue_target, kpi_prediction_accuracy, kpi_decision_success_rate, kpi_roi, message_to_board, risks_disclosed, benchmark)
VALUES
  (
    gen_random_uuid(),
    'Q1-2026',
    78,
    24500000,
    30000000,
    0.72,
    0.81,
    3.4,
    '本季 Q1 集團達成原訂目標 82%。nSchool 財經學院為主要動能(營收佔 47%),但 OOschool 進入瓶頸需重新檢視銷售節奏。AI 訓練系統已導入,2 月後新人完訓率提升 15 個百分點。下一季建議:1) 強化 OOschool 顧問式銷售訓練;2) 法務介入專案數倍增,需擴編 1 人;3) Whisper 對練閉環已建,目標 Q2 全員週對練 ≥ 3 次。',
    '[
      {"risk":"OOschool 銷售動能下滑(連 2 個月低於目標 70%),Q2 預期會拖整體營收","severity":"high"},
      {"risk":"104 招募管道被封鎖後,新人 pipeline 補給速度減半","severity":"medium"},
      {"risk":"Metabase Q1381 sync 偶有延遲,業務看不到即時資料會影響當日撥打決策","severity":"low"}
    ]'::jsonb,
    '{"last_quarter": 71, "last_year": 65}'::jsonb
  )
ON CONFLICT DO NOTHING;

-- ─── board_inquiries (投資人質詢)────────────
INSERT INTO board_inquiries
  (id, asker_email, asker_role, question, claude_answer, asked_at, answered_at)
VALUES
  (
    gen_random_uuid(),
    'investor.demo@moyu.invest',
    'investor',
    'Q1 為什麼沒達成原訂 30M 目標?差距在哪個品牌?',
    'Q1 達成 24.5M / 30M(82%)。差距 5.5M 主要來自:OOschool 連續 2 個月低於 KPI(差 3.2M),原因是無限學院的傳統銷售腳本對新一波 ESG 主題客群效果衰退;XLAB 因為實驗性方案上市晚 2 週,Q1 只跑滿 70% 的時程(差 1.8M)。其餘小差距來自 1 月份新人 pipeline 不足。已啟動 OOschool 重訓計畫,2 月起完訓率 +15pp,預期 Q2 反彈。',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days' + INTERVAL '3 minutes'
  ),
  (
    gen_random_uuid(),
    'cfo.demo@moyu.invest',
    'cfo',
    'AI 訓練系統的 ROI 算法是怎麼算的?3.4x 是合理的嗎?',
    '3.4x = (本季因訓練改善而來的營收增量 ÷ 訓練成本)。具體:1) Q1 完訓率提升 15pp,新人轉正後 8 週內人均產值 +28% → 換算營收增量約 2.1M;2) 對練系統避免 23 次潛在客訴失約(每次平均成本 8K)→ 184K;3) Whisper 通話評分讓資深業務修正 3 個品牌共通問題 → 約 980K 增量。總增量 3.26M ÷ 訓練成本(AI API + 人力)約 960K = 3.4x。算法保守(沒算長尾),Q2 起會穩定在 3-4x。',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days' + INTERVAL '5 minutes'
  )
ON CONFLICT DO NOTHING;

-- ─── decision_records (拍板紀錄)────────────
INSERT INTO decision_records
  (id, category, title, context, claude_recommendation, vincent_decision, status, urgency, due_date, created_at)
VALUES
  (
    gen_random_uuid(),
    'strategy',
    'OOschool 重啟顧問式銷售訓練(Q2)',
    '無限學院連 2 月低於 KPI,Sara/Terry 反映「新主題客戶不吃舊腳本」',
    '建議:1) 暫停 4/15-4/30 部分量,導向集中訓練;2) 用 nSchool GROW 模板改寫 OOschool 5 個主題;3) 4/30 後重新開打,目標 6 月恢復 90% KPI',
    NULL,
    'pending',
    'high',
    CURRENT_DATE + INTERVAL '3 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    gen_random_uuid(),
    'hr',
    '法務組擴編 1 人(承接案件量倍增)',
    'Q1 法務 case 從 12 → 27 件,2 名法務員加班嚴重,有離職風險',
    '建議擴編 1 名 legal_staff,優先從現有資深業務中轉任(熟悉商品 + 客戶心理),預算月 60K',
    NULL,
    'pending',
    'critical',
    CURRENT_DATE,
    NOW() - INTERVAL '2 hours'
  ),
  (
    gen_random_uuid(),
    'operations',
    '更新 Metabase Q1381 SQL — 加入「is_monthly_rollup」欄位防 sum 翻倍',
    '4 月底 Vincent 發現某員工營收顯示 1.1M 但實際 ~550K,是 daily rollup 加月底 rollup 造成翻倍',
    '建議由 Lance 在 Metabase Q1381 加 is_monthly_rollup boolean,Sync 後系統 filter 掉 rollup row',
    NULL,
    'approved',
    'normal',
    NULL,
    NOW() - INTERVAL '7 days'
  )
ON CONFLICT DO NOTHING;

UPDATE decision_records
   SET vincent_decision = '同意,executive owner: Vincent,執行 deadline 5/15',
       approved_at      = NOW() - INTERVAL '6 days',
       approved_by_email= 'vincent@xuemi.co'
 WHERE status = 'approved'
   AND vincent_decision IS NULL;

-- ─── arbitration_records (仲裁紀錄)────────────
INSERT INTO arbitration_records
  (id, conflict_summary, parties, process_log, conclusion, claude_learnings, ingested_to_rag, arbitrated_by_email, arbitrated_at)
VALUES
  (
    gen_random_uuid(),
    '業務員 A 與 B 同時聲稱客戶「林先生」是自己的 lead,系統紀錄顯示 4/3 由 A 開發 + 4/9 由 B 跟進,該成交歸屬誰?',
    '[
      {"name":"業務員 A","role":"開發者(原始 lead)"},
      {"name":"業務員 B","role":"成交者(實際 close)"},
      {"name":"林先生","role":"客戶"}
    ]'::jsonb,
    '[
      {"step":"Claude 嘗試 1","detail":"檢查 CRM:A 在 4/3 記錄首次撥打 + 通話 12 分鐘;B 在 4/9 出席 demo 並成交","outcome":"資料齊全"},
      {"step":"Claude 嘗試 2","detail":"應用「lead-handoff 規則 v1」:首次有效通話 + 7 天內未進度 = 釋出","outcome":"A 在 4/3-4/9 期間沒推進,符合釋出條件,所以歸 B"},
      {"step":"A 不接受","detail":"A 認為 4/3 之後 LINE 群組有持續溝通(無撥打但有訊息)","outcome":"轉 Vincent 仲裁"}
    ]'::jsonb,
    'Vincent 仲裁:本案歸屬 50/50 拆分,主因 lead-handoff 規則 v1 沒考慮 LINE 訊息互動。A 拿 50% 開發奬 + B 拿 50% 成交奬,雙方均同意。',
    '更新 lead-handoff 規則 v2:加入「LINE / Email / 系統訊息互動」也算 lead 維持。Claude 在執行歸屬判斷前,應先撈 LINE 訊息紀錄交叉驗證。',
    false,
    'vincent@xuemi.co',
    NOW() - INTERVAL '4 days'
  )
ON CONFLICT DO NOTHING;

-- ─── help_requests (人類工作區 SOS)────────────
-- D18 已建 claude_help_requests 表
INSERT INTO claude_help_requests
  (id, requester, urgency, category, title, body, status, created_at)
VALUES
  (
    gen_random_uuid(),
    'system_claude',
    'urgent',
    'data_anomaly',
    'Metabase 5/2 同步落後 — 需人工確認',
    '今天(2026-05-02 週六)Metabase Q1381 預期應同步到 5/1 或 5/2,實際 latest=2026-05-01。可能原因:1) 週六不在 cron 觸發範圍(目前設定 Mon-Sat 09-22);2) Q1381 對「今天」未 finalize;3) GitHub Actions 配額。請確認是否需要 manual trigger。',
    'pending',
    NOW() - INTERVAL '15 minutes'
  ),
  (
    gen_random_uuid(),
    'system_claude',
    'normal',
    'training_stuck',
    '新訓-林裕峰 Steven 連續 3 天 0 邀約',
    '本月 5/1 通話 30 通但 0 邀約。Claude 觀察:1) 開場白完整但話術過於 SOP;2) 不太處理客戶反問;3) 可能需要 1on1 角色扮演。建議:派 Terry(Steven 的組長)留 voice memo 或 30 分鐘 sparring。',
    'pending',
    NOW() - INTERVAL '2 hours'
  )
ON CONFLICT DO NOTHING;

-- 驗證
SELECT 'claude_self_assessments' as tbl, COUNT(*) as rows FROM claude_self_assessments
UNION ALL
SELECT 'board_inquiries', COUNT(*) FROM board_inquiries
UNION ALL
SELECT 'decision_records', COUNT(*) FROM decision_records
UNION ALL
SELECT 'arbitration_records', COUNT(*) FROM arbitration_records
UNION ALL
SELECT 'claude_help_requests', COUNT(*) FROM claude_help_requests
ORDER BY tbl;
