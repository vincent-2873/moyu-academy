# 墨宇系統 v2 · 完整功能樹狀圖

> 整合自我們所有討論的最終版本
> 最後更新:2026-05-01

---

## 🎯 Progress(2026-05-01 第六輪 Phase A 末)

```
Phase 1 (基建)         ████████████  完整 (D1-D18 schema applied)
Phase 2 W1 (訓練營運)  ████████████  完整 (admin/training-ops 4 子頁)
Phase A (清理)         ████████████  完整 (HR 全砍 + 架構外舊頁砍 + 訓練規範改 + RAG 改)
Phase 2 W2+ Phase 3-6  ░░░░░░░░░░░░  待 Phase B 啟動
```

**Phase A 做的**(5 commit pushed):
- HR 體系全砍(43 file)+ D19 SQL(待 Vincent apply)
- 架構外舊前台 page 砍 14 個(/me /home /work /learn /today /articles /my-commands /checkin /upload + /legal 主頁)
- RAG pillar enum 砍 hr / next.config 砍 /training/methods
- 訓練體系規範改成 BIZ + LEGAL 兩體系(TRAINING_MASTER v2 + foundation/CLAUDE v2)
- 修死連結

**Phase B 待 Vincent 點頭啟動**(完整脈絡見 [HANDOFF v6](../HANDOFF-2026-05-01-v6.md)):
- B-1: 基於 nSchool 真實 source 重做 BIZ module 內容
- B-2: /sales/* 前台 5 子頁建
- B-3: admin 17 tab 重組成樹狀圖 8 大區
- B-4: claude-panel chat prompt 對齊 nSchool 8 步驟
- B-5: 寫 BIZ_MODULE_SPEC + LEGAL_MODULE_SPEC

🔒 **鐵則**(2026-05-01 拍板,Phase 6 前不變):做每個功能要先看 `~/Downloads/訓練資料/_unzipped/` 既有 source 延伸,不從零生成。

---


## 🌐 系統總覽

```
墨宇集團系統
│
├─ moyusales.zeabur.app          (前台,給員工)
└─ moyusales.zeabur.app/admin    (後台,給管理 + AI)
```

技術:單一 Next.js 16 app · 角色分流 · 視覺差異化(A 架構偽裝成 B)

---

## 🎭 9 種角色

```
監督方                決策方                執行方
─────────             ─────────             ─────────
1. 投資人              4. AI 特助 (Vincent)  6. 部門主管
2. 董事                5. AI 經營者 (Claude) 7. 組長
3. 財務長                                    8. 一般員工
                                             9. 新人
```

---

## 📂 完整功能樹

### ═══════════════════════════════════════════
###  前台:moyusales.zeabur.app
### ═══════════════════════════════════════════

```
🌐 前台(向外延伸的工作前台)
│
├─ 📊 /sales                      業務戰場
│   │  給:業務員 / 業務主管 / 業務組長
│   │  視覺:深炭+米白,熱血競技 HUD
│   │
│   ├─ /dashboard                個人戰績
│   │   ├─ 今日撥打/邀約/成交
│   │   ├─ 排名(本組/本品牌)
│   │   ├─ Claude 觀察區(AI 建議)
│   │   └─ 連勝/連敗追蹤
│   │
│   ├─ /training                  我的訓練 ⭐⭐⭐
│   │   ├─ 今日訓練時間軸
│   │   │   ├─ 09:00-09:15 看影片
│   │   │   ├─ 09:15-09:45 對練
│   │   │   └─ 09:45-10:00 反思
│   │   ├─ Claude 個人觀察
│   │   ├─ 對練分數趨勢圖
│   │   ├─ 升等進度條
│   │   ├─ 升等條件清單
│   │   ├─ 成就印章區
│   │   └─ 卡關自動處理 + LINE 通知
│   │
│   ├─ /practice                  AI 對練 ⭐⭐⭐
│   │   ├─ 階段 1:選 Persona
│   │   │   ├─ 楊嘉瑜風格(理性決策型)
│   │   │   ├─ 鄭繁星風格(衝動感性型)
│   │   │   └─ 進階 Persona(完訓 D7 解鎖)
│   │   ├─ 階段 2:語音對話
│   │   │   ├─ 麥克風錄音
│   │   │   ├─ Whisper 即時轉錄
│   │   │   └─ Claude 扮演 Persona 回應
│   │   └─ 階段 3:Claude 評分
│   │       ├─ 總分(0-100)
│   │       ├─ 4 維度細項
│   │       │   ├─ 開場白 20%
│   │       │   ├─ 探詢需求 30%
│   │       │   ├─ 異議處理 30% ⭐ 權重最高
│   │       │   └─ 收尾 20%
│   │       ├─ 做得好的點
│   │       ├─ 還可以更好的點
│   │       └─ 下次練什麼建議
│   │
│   ├─ /knowledge                 問 Claude
│   │   ├─ 對話介面(類 ChatGPT)
│   │   ├─ RAG 知識庫(業務 pillar)
│   │   └─ 對話歷史
│   │
│   └─ /module/[id]               Module 詳細頁
│       ├─ 影片類:嵌入播放器 + 反思框
│       ├─ 閱讀類:Markdown 渲染
│       ├─ 反思類:文字輸入框
│       └─ 任務類:任務說明 + 上傳
│
├─ ⚖️ /legal                      法務工作台
│   │  給:法務員 / 法務主管
│   │  視覺:純米白,法律事務所感
│   │
│   ├─ /cases                     我的案件
│   │   ├─ 案件列表(分類型/分品牌)
│   │   ├─ 未來 30 天回函熱力圖
│   │   ├─ 案件 Aging 分佈
│   │   ├─ 承辦人負荷
│   │   └─ 即將逾期警示
│   │
│   ├─ /draft                     Claude 起草助手 ⭐⭐
│   │   ├─ 文件類型選擇
│   │   │   ├─ 答辯狀
│   │   │   ├─ 回函
│   │   │   └─ 律師函
│   │   ├─ 案件選擇器
│   │   ├─ Claude 自動讀取
│   │   │   ├─ 案件描述
│   │   │   ├─ 相關判例(RAG 法務 pillar)
│   │   │   └─ 過去類似案件
│   │   ├─ 雙欄編輯
│   │   │   ├─ 左:Claude 草稿
│   │   │   └─ 右:法務修改
│   │   └─ 簽核鏈(法務 → 主管 → 寄出)
│   │
│   ├─ /training                  法務訓練
│   │   ├─ 法務 N 天養成路徑
│   │   ├─ 法律邏輯練習
│   │   ├─ 跟 Claude 對練法律推論
│   │   └─ 過去判例研讀
│   │
│   └─ /knowledge                 法律知識庫
│       └─ 法務 pillar RAG 對話
```

---

### ═══════════════════════════════════════════
###  後台:moyusales.zeabur.app/admin
### ═══════════════════════════════════════════

```
🏛️ 後台(中樞管理中心)
│
├─ 🏛️ /admin/board                 投資人中心
│   │  給:投資人 / 董事 / 財務長 / Vincent
│   │  視覺:米白+米黃,年報莊重感
│   │
│   ├─ /quarterly                 季度成績單
│   │   ├─ Claude 自評分數(0-100)
│   │   ├─ 4 大 KPI
│   │   │   ├─ 季營收達成率
│   │   │   ├─ 預測準度
│   │   │   ├─ 決策成功率
│   │   │   └─ ROI
│   │   ├─ Claude 給董事會的話(AI 訊息)
│   │   ├─ 主動揭露的風險清單
│   │   ├─ 對標基準(vs 上季/去年)
│   │   └─ PDF 下載 + 分享連結
│   │
│   ├─ /strategy                  Claude 戰略報告
│   │   ├─ 三情境模擬(保守/中性/樂觀)
│   │   ├─ Claude 推薦策略(3-5 個)
│   │   │   ├─ 策略名稱
│   │   │   ├─ 數據依據
│   │   │   ├─ 預期成效
│   │   │   ├─ 預算需求
│   │   │   └─ 簽核按鈕
│   │   └─ 執行時間軸(甘特圖)
│   │
│   ├─ /inquiry                   質詢 Claude ⭐⭐⭐
│   │   ├─ 對話介面(投資人問,Claude 答)
│   │   ├─ 推薦問題(常見問)
│   │   ├─ 對話歷史
│   │   └─ 匯出 PDF
│   │
│   └─ /decisions                 拍板紀錄
│       ├─ 篩選器
│       ├─ 時間軸列表
│       ├─ 詳細查看(類訴訟卷宗)
│       └─ 簽核鏈追蹤
│
├─ 📊 /admin/sales                 業務管理
│   │  給:Vincent / 業務主管 / 組長(看自己組)
│   │
│   ├─ /dashboard                 業務戰況
│   │   ├─ 集團整體漏斗
│   │   ├─ Claude 自動偵測:今日要關心 N 人
│   │   ├─ 資料完整性警告(漏斗違規)
│   │   ├─ 5 個品牌橫向對比
│   │   ├─ 排行榜(業績/成交/通次/成交率)
│   │   └─ 據點 → 組別 → 業務 三層下鑽
│   │
│   └─ /individual                個人戰況
│       └─ 主管視角:看下屬個人狀況
│
├─ ⚖️ /admin/legal                 法務管理
│   │  給:Vincent / 法務主管 / 董事會
│   │
│   └─ /cases                     案件中心
│       ├─ 全集團案件總覽
│       ├─ 按類型/品牌分類
│       ├─ 逾期警示
│       ├─ 案件 Aging 分佈
│       ├─ 承辦人負荷
│       └─ LINE 通知綁定設定
│
├─ 📚 /admin/training-ops          訓練營運中心 ⭐⭐⭐
│   │  給:Vincent / 部門主管
│   │  視覺:米白+暖光,訓練營有溫度
│   │  解決:Vincent 每月訓 20+ 新人很煩
│   │
│   ├─ /students                  訓練生戰況板
│   │   ├─ 4 KPI 卡片
│   │   │   ├─ 訓練中 N 人
│   │   │   ├─ 今日上線
│   │   │   ├─ 卡關中
│   │   │   └─ 需介入
│   │   ├─ 進度分布圖(D0-D14)
│   │   ├─ 緊急介入清單(預覽)
│   │   ├─ Claude 自動處理中(分品牌)
│   │   └─ 本月成效快覽
│   │
│   ├─ /attention                 需介入清單 ⭐
│   │   ├─ 緊急(紅色)
│   │   │   ├─ 學員資訊
│   │   │   ├─ Claude 嘗試清單
│   │   │   ├─ Claude 判斷
│   │   │   └─ 動作按鈕
│   │   │       ├─ 我來談
│   │   │       ├─ 派組長
│   │   │       ├─ 留 voice memo
│   │   │       ├─ 暫不處理
│   │   │       └─ 我已私下處理
│   │   ├─ 一般(黃色)
│   │   └─ 今日已處理(綠色)
│   │
│   ├─ /materials                 教材管理 ⭐
│   │   ├─ 品牌切換
│   │   ├─ 每品牌 path 完整度
│   │   ├─ 缺哪個 module(Claude 偵測)
│   │   ├─ Claude 自動生成草稿
│   │   │   ├─ 從同 path 其他品牌改寫
│   │   │   └─ 從零生成(新品牌用)
│   │   └─ 一鍵採用 / 個別檢視
│   │
│   └─ /report                    成效報告
│       ├─ 整體 KPI
│       │   ├─ 入訓 / 完訓 / 完訓率 / 淘汰
│       ├─ 完訓 30 天後表現
│       ├─ 最有效 Module Top 5
│       ├─ 最無效 Module + Claude 改寫建議
│       └─ Claude 整體評估
│
├─ 🤖 /admin/claude                AI 工作台
│   │  給:所有人(透明可看)
│   │  視覺:深炭+紫光,終端機科技感
│   │
│   ├─ /live                      Claude 即時狀態 ⭐⭐⭐
│   │   ├─ Claude 虛擬形象(會呼吸)
│   │   ├─ 17 個 Worker 即時狀態
│   │   │   ├─ auto-attention-push
│   │   │   ├─ auto-iterate-30min
│   │   │   ├─ breakthrough-engine
│   │   │   ├─ claude-autoscan
│   │   │   ├─ daily-automation
│   │   │   ├─ daily-briefing-push
│   │   │   ├─ daily-todo-push
│   │   │   ├─ line-inbound-dispatcher
│   │   │   ├─ manager-care-push
│   │   │   ├─ metabase-sync
│   │   │   ├─ recruit-auto-outreach
│   │   │   ├─ recruiter-briefing-push
│   │   │   ├─ rookie-training-push
│   │   │   ├─ sales-metrics-rules
│   │   │   ├─ system-health-3h
│   │   │   ├─ update-articles
│   │   │   └─ weekly-report
│   │   ├─ 即時 log 串流(SSE)
│   │   ├─ 過去 24h 統計
│   │   └─ Claude 自我健康度
│   │
│   ├─ /log                       工作日誌
│   │   ├─ Tab 1: 命令日誌
│   │   │   ├─ 待辦 / 進行中 / 已完成
│   │   │   ├─ 卡住 / 被忽略
│   │   │   └─ Claude 派的所有命令
│   │   ├─ Tab 2: 運行紀錄
│   │   │   └─ 17 worker 歷史 log
│   │   └─ Tab 3: LINE 派令模板
│   │
│   ├─ /knowledge                 知識庫管理
│   │   ├─ Tab 1: 知識總覽
│   │   │   ├─ 34 chunks 分類
│   │   │   ├─ HR 招聘 22
│   │   │   ├─ 業務 1
│   │   │   ├─ 法務 0(待補)
│   │   │   └─ 通用 11
│   │   ├─ Tab 2: 上傳新知識
│   │   │   ├─ 管理員直送
│   │   │   └─ 員工提交審核
│   │   ├─ Tab 3: 審核佇列
│   │   └─ Tab 4: Notion 同步(分 Pillar)
│   │
│   ├─ /rules                     規則中心
│   │   ├─ Tab 1: 偵測規則(原業務規則 10 條)
│   │   ├─ Tab 2: KPI 目標(原 KPI 標準 9 條)
│   │   └─ Tab 3: 規則執行紀錄
│   │
│   └─ /personas                  對練 Persona 庫 ⭐
│       ├─ 楊嘉瑜風格
│       ├─ 鄭繁星風格
│       ├─ 客訴客戶
│       ├─ 反悔已成交
│       └─ 新增/編輯 Persona
│
├─ 🤝 /admin/human                 人類工作區
│   │  給:Vincent(only)
│   │  視覺:米白+紙感,便利貼即時感
│   │  哲學:Claude 是常態,人類介入是例外
│   │
│   ├─ /sos                       Claude 求救清單 ⭐
│   │   ├─ 緊急(紅色)
│   │   │   ├─ Claude 嘗試紀錄
│   │   │   ├─ Claude 判斷說明
│   │   │   └─ 動作按鈕
│   │   ├─ 一般(黃色)
│   │   └─ 已處理(綠色)
│   │
│   ├─ /sign-off                  我必須拍板
│   │   ├─ 今天必拍板(紅色)
│   │   │   ├─ Claude 寫好的草稿
│   │   │   ├─ 等簽核合約
│   │   │   ├─ 人事異動
│   │   │   └─ 報告 sign-off
│   │   ├─ 本週必拍板
│   │   └─ 已拍板歷史
│   │
│   └─ /arbitration               仲裁紀錄
│       ├─ 仲裁列表
│       │   ├─ 原始衝突
│       │   ├─ 處理過程
│       │   └─ 結論
│       └─ Claude 從中學習什麼
│
└─ ⚙️ /admin/settings              系統設定
    │  給:Vincent
    │
    ├─ /people                    人員管理
    │   ├─ Tab 1: 員工列表
    │   ├─ Tab 2: 編輯員工
    │   ├─ Tab 3: Metabase 同步
    │   └─ Tab 4: 權限矩陣(可視化)
    │
    ├─ /cron                      排程管理(17 cron)
    │
    ├─ /health                    系統健康度
    │
    └─ /system                    系統參數
        ├─ Setup 完成度
        ├─ env 設定
        └─ 系統管控
```

---

## 🤖 AI 後端:17 個 Worker(背景 24h 運作)

```
worker 名稱                     頻率           做什麼
─────────────────────────────────────────────────────────
auto-attention-push            每 2h          自動關注推送
auto-iterate-30min             每 30m         自我迭代學習 ⭐
breakthrough-engine            每 2h          突破引擎(找洞察)
claude-autoscan                每 4h          Claude 自動掃描
daily-automation               每天 01:00     每日自動化
daily-briefing-push            每天 01:00     每日簡報推送
daily-todo-push                工作日 01:00   每日待辦推送
line-inbound-dispatcher        每 5m          LINE 入站派發 ⭐
manager-care-push              每天 10:00     主管關心推送
metabase-sync                  每天 01,09     Metabase 同步
recruit-auto-outreach          每 3h          招募自動觸達
recruiter-briefing-push        每天 01:00     招募簡報推送
rookie-training-push           每天 01:00     新人訓練推送 ⭐
sales-metrics-rules            每小時          業務指標規則
system-health-3h               每 3h          系統健康度
update-articles                每天 04:00     更新文章
weekly-report                  週一 01:00     週報
```

---

## 🗄️ 資料庫架構

```
現有 Tables(舊系統 + 部分待整合)
├─ users(待加 9 欄位)
├─ sales_metrics_daily ✓
├─ knowledge_chunks(pgvector)✓
├─ system_secrets ✓
├─ system_run_log ✓
├─ metabase_sync_log ✓
├─ training_units(舊,待評估)
├─ training_unit_progress(舊)
├─ hr_training_days / tasks / progress(舊招聘 SOP)
└─ ...其他

新增 Tables(訓練系統,9 張)
├─ training_paths              訓練路徑
├─ training_modules            訓練模組
├─ roleplay_personas           對練角色
├─ training_progress           個人進度 ⚠ 撞名待 rename
├─ roleplay_sessions           對練紀錄
├─ training_stuck_handlings    卡關處理
├─ module_effectiveness        成效追蹤
├─ path_completeness           教材完整度
└─ claude_help_requests        Claude 求救工單

未來新增(後續 Phase)
├─ claude_self_assessments     Claude 自評
├─ board_inquiries             投資人質詢
├─ decision_records            拍板紀錄
├─ legal_drafts                法務起草
└─ arbitration_records         仲裁紀錄
```

---

## 🔌 外部整合

```
┌─────────────────────────────────────────────────┐
│  資料來源                                         │
│  ├─ Metabase(業務數據,每 15 分自動同步)        │
│  ├─ Pixell PBX(電話通話紀錄)                    │
│  └─ Notion DB(分 Pillar 同步知識庫)             │
│                                                   │
│  AI / LLM                                         │
│  ├─ Anthropic Claude(主力 LLM)                  │
│  ├─ OpenAI GPT-4o-mini(備用)                    │
│  ├─ Groq Whisper Large v3(語音轉錄)            │
│  └─ OpenAI text-embedding-3-small(RAG)          │
│                                                   │
│  推播 / 通訊                                       │
│  ├─ LINE Messaging API(全員推播 + 派令)         │
│  ├─ LINE Login(一鍵登入)                        │
│  └─ Google Calendar API(訓練綁日曆)⭐           │
│                                                   │
│  其他                                              │
│  ├─ Google Drive / Sheets(招聘文件)             │
│  ├─ Cloudflare R2(訓練影音 bucket)              │
│  └─ Supabase(主資料庫 + Auth + pgvector)        │
└─────────────────────────────────────────────────┘
```

---

## 🔐 權限矩陣總覽

```
頁面                   投 董 財 V  AI 業 法 業 法 業 法
                      資 事 務 人  AI 主 主 員 員 組 組
                      人 會 長 工  經 管 管         長 長
                              作  營
                              區  者
─────────────────────────────────────────────────
前台
/sales/*              -  -  -  -  -  ✓  -  ✓  -  ✓  -
/legal/*              -  -  -  -  -  -  ✓  -  ✓  -  ✓

後台
/admin/board/*        ✓  ✓  ✓  ✓  -  -  -  -  -  -  -
/admin/sales/*        -  ✓  ✓  ✓  -  ✓  -  -  -  ✓品 -
/admin/legal/*        -  ✓  ✓  ✓  -  -  ✓  -  ✓  -  -
/admin/training-ops/* -  -  -  ✓  -  ✓  ✓  -  -  -  -
/admin/claude/live    ✓  ✓  ✓  ✓  -  ✓  ✓  ✓  ✓  ✓  ✓ ←公開
/admin/claude/log     -  ✓  ✓  ✓  -  ✓  ✓  -  -  -  -
/admin/claude/...     -  -  -  ✓  -  ✓  ✓  -  -  -  -
/admin/human/*        -  -  -  ✓  -  -  -  -  -  -  -
/admin/settings/*     -  -  -  ✓  -  -  -  -  -  -  -

✓品 = 只看自己品牌
✓組 = 只看自己組
```

---

## 🎨 視覺氛圍對照

```
工作區             主底色            氛圍關鍵字            產品感
──────────────────────────────────────────────────────────────
前台 /sales        深炭+米白         熱血競技 HUD          競技 App
前台 /legal        純米白            法律事務所            專業工具
後台 /board        米白+米黃         年報莊重              投資人報告
後台 /sales        純米白            BI 報表清晰           數據儀表板
後台 /legal        純米白            專業條理              法律工作台
後台 /training-ops 米白+暖光         訓練營有溫度          教育平台
後台 /claude       深炭+紫光         終端機科技感          AI 控制台
後台 /human        米白+紙感         便利貼即時感          任務清單
後台 /settings     純米白            工具                  設定面板
```

---

## 📅 開發 Roadmap

```
Phase 1:打通基建(2 週)— 不寫新功能
  ├─ users 表加欄位
  ├─ Metabase 員工同步補齊
  ├─ LINE userId 綁定
  ├─ R2 bucket 建立
  └─ 6 個新 table 建立

Phase 2:訓練系統升級(2 週)⭐⭐⭐ ← 現在做的
  Week 1: /admin/training-ops 後台 4 子頁
  Week 2: /sales/training + /sales/practice 前台

Phase 3:AI 工作台 + 透明化(1 週)
  /admin/claude/* 全部 5 子頁

Phase 4:董事會 + 人類工作區(2 週)
  Week 1: /admin/board/* 4 子頁
  Week 2: /admin/human/* 3 子頁

Phase 5:現有頁面整併 + 風格統一(1 週)
  套用新 Design System
  改路由、整併重複頁面

Phase 6:Polish + 上線(1 週)
  動效、Empty State、E2E 測試

總計 8 週(2 個月)
```

---

## 🎯 核心理念

```
1. AI 是常態,人類介入是例外
   "Claude 是唯一判斷的人,Vincent 補 Claude 做不到的"

2. 訓練系統是這個產品的真正價值
   "讓 AI 訓練官替 Vincent 帶 100+ 新人"

3. 4W 設計原則(每個訓練頁面必須答)
   What  我現在要做什麼?
   When  幾點?多久?
   Why   做這個有什麼好處?
   Next  做完之後是什麼?

4. 不是科技 dashboard,是文房裡的訓練營
   "東方水墨 + 紙感 + 文房意象"
```

---

## 📂 檔案結構(Claude Code 開發包)

```
moyu-training-ops-v2/
├─ 00_README.md                 主導引 + 設計系統
├─ 01_DATABASE_SCHEMA.sql       資料庫 9 張新 table
├─ 02_UI_WIREFRAMES.md          完整排版(桌面+手機)
├─ 03_CLAUDE_GRADING_LOGIC.md   對練評分系統
├─ 04_DEVELOPMENT_PROMPT.md     Phase 2 任務清單
└─ 05_NEW_TRAINEE_PRIORITIES.md 新人最在意的 5 件事
```

---

## 一句話總結

> **集團 AI 經營系統:Claude 自動運作 24h,
> 人類只在 AI 卡住時介入,
> 真正的核心是「自動訓練 100 個新人」。**
