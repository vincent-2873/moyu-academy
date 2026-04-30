# 墨宇戰情中樞 MOYU OPS v5.0 — 系統 Demo 文件

> 最後更新:2026-04-30 by Claude(這 session)
> Prod URL:<https://moyusales.zeabur.app>
> 給 Vincent / 內部 Demo / 未來新人 onboarding 用

---

## 🎯 整體定位

一個 Next.js 全棧 Web App,把墨宇集團「業務、招聘、訓練、法務、跨品牌」5 條戰線收進同一個戰情中樞:

- **業務員**只看 `/me` 自己的數據(KPI、晨報、AI 對練、通話診斷)
- **主管 / 招聘員 / HRBP / 法務**進 `/admin` 看 25 個 tab、派任務、推 LINE
- **戰情官** AI 在每頁右下角常駐(SSE + RAG + 音訊轉錄)
- **資料底層**接 Supabase + Metabase + LINE + Discord + Notion + Google Calendar

**為什麼存在**:墨宇有 4 業務線 × 6 品牌 × 50+ 員工。原本散在 LINE 群、Excel、Metabase、Notion、各家 SaaS,主管沒有單一畫面看「現在誰在打、誰沒進、誰需要關心」。這個中樞就是把所有訊號收成一張戰情圖。

---

## 🏛️ 架構樹

```
墨宇戰情中樞 MOYU OPS
│
├─📱 前台 (22 page) ─ 員工自己用 + 主管也可用
│
├─🛠️ 後台 /admin (25 tab × 6 group) ─ 主管 / HR / 法務 / 訓練師專用
│
├─🤖 跨層服務 (16 個)
│   ├─ AI 戰情官 (Claude Sonnet 4.5)
│   ├─ Whisper 轉錄 + 三點評估
│   ├─ RAG 知識庫 (1536 vec)
│   ├─ LINE Bot + 6 種 Webhook
│   ├─ Discord OAuth + LINE OAuth + Google OAuth
│   ├─ Metabase Daily Sync (每 15 分 56 次/天)
│   └─ 17 cron endpoint (待接 trigger)
│
└─🗄️ 資料層
    ├─ Supabase (50+ table, RLS 全開)
    ├─ 8 GitHub Actions workflow (CI / sync / backup / RAG / SQL apply)
    └─ Zeabur 自動部署 (push to main → prod)
```

---

## 📱 前台 22 page

### 入口 / 帳號 (4 page)

```
/                        登入入口 + 舊 dashboard (淘汰中)
  ├─ Email + 密碼登入
  ├─ LINE 一鍵登入 (已綁帳號可 bypass 密碼)
  └─ sales_rep 登入後自動 redirect /me

/account                 個人帳號頁 (改 LINE 綁定 / 顯示資料)
/account/password        改密碼頁 (預設 0000 強制改)
/checkin                 每日上工打卡 (人類狀態 / 心情記錄)
```

**效益**:單一登入,sales_rep 進不了 admin,主管 / HR 走 `/admin` 多一層 HMAC cookie 保護。

---

### 個人戰情 /me (核心 1 page,內含 7 子模組)

```
/me                      個人戰情儀表板 (所有員工)
  ├─ MySalesMetricsCard           今日 KPI(通次 / 邀約 / 出席 / 成交 / 營收)
  ├─ DailyBriefingCard            AI 每日晨報(Claude 寫 5 句:你昨天怎樣 + 今天怎麼追)
  ├─ MyCommandsCard               我的待辦任務(主管派下來的 v3_commands)
  ├─ AchievementsCard             成就 + 印章(common/rare/epic/legendary 4 rarity)
  ├─ CoachChatCard                戰情官對練(SSE streaming + RAG retrieval)
  ├─ RecordingAnalyzeCard         通話錄音上傳 → Whisper 轉錄 → Claude 三點評估
  ├─ paceCheck                    現在幾點 / 應到哪 / 落後幾通(時間感壓迫)
  └─ brandComparison              你的 X% vs 同品牌平均 Y%(diff)
```

**效益**:業務員一眼看到「今天的我」+「該做什麼」+「我跟大家比起來怎樣」+ 主管派的任務一鍵 acknowledge。**避免每天開 5 個 tab(LINE 群、Metabase、Excel、Notion、行事曆)**。

---

### 學習 / 訓練 (4 page)

```
/learn                   學習主頁
/training                新訓區域首頁(輔助入口)
/training/hrbp           HRBP 4 集互動測驗主頁
  ├─ /training/hrbp/HR-053       EP1 招募基礎
  ├─ /training/hrbp/HR-054       EP2 面試判讀
  ├─ /training/hrbp/HR-055       EP3 留任策略
  └─ /training/hrbp/HR-056       EP4 高手帶人
/training/methods        速查手冊(business 14 天 + 招聘 3 天 module)
```

**效益**:訓練影片 + Quiz + 自動印章 + RAG 知識庫,**員工不用問「上次教的東西在哪」— 直接問戰情官就會引用文件回答**。

---

### 招募 (3 page)

```
/recruit                 獵頭工作台 (招聘員 / HR 主用)
  ├─ Day 1-3 SOP 任務(新訓自動派)
  ├─ X Platform 6 品牌切換
  └─ 招聘漏斗 widget
/recruit/104             104 招聘熱名單(熱燙不接、再聯絡分檔)
/recruit/calendar        招聘行事曆(Google Calendar 整合)
```

**效益**:墨宇獵頭 / 各品牌 HR 把候選人從 104 → 邀約 → 面試 → onboarding 全流程 in-app。**配合 moyu-worker 本機 Chrome 自動化發 104 邀約(Zeabur Tokyo IP 被封,本機跑)**。

---

### 法務 (3 page)

```
/legal                   法務戰線首頁(合規概覽)
/legal/cases             法務案件列表
/legal/cases/[id]        案件詳細(合約 / 智財 / 政府申報)
```

**效益**:墨宇之前法務散在 Notion + 律師信 + 紙本,現在收進系統有 audit trail。

---

### 跨部門指揮 (4 page)

```
/today                   今日聚焦 (跨 pillar 任務)
/my-commands             我的全部任務(across pillars)
/articles                文章 / 知識文庫
/work                    工作主頁
/home                    Home (root dashboard)
```

**效益**:跨「業務 / 法務 / 招聘」3 大支柱,任務都收在一個 inbox。

---

## 🛠️ 後台 /admin (25 tab × 6 group)

> 進入需 admin 角色 + HMAC `moyu_admin_session` cookie(24 小時有效)
> ALLOWED_ROLES:super_admin / ceo / coo / cfo / director / brand_manager / sales_manager / recruit_manager / legal_manager / team_leader / trainer / mentor / hr

### 📂 Group 1:戰況(5 tab)— Vincent 開機後第一眼看

```
👁️  指揮中心 (pillars)        — 業務 / 法務 / 招聘 3 支柱現況 + alert
🌟 戰略指標 (strategy)         — 北極星營收 / OKR / LTV-CAC / 月燒錢 / 跑道
🔮 Claude 預測 (predict)       — 本月業績預估 + 招募缺口 + 風險預警 + 3 情境
⚡ 命令中心 (commands)         — v3_commands 派遣中心(派、acknowledge、blocked、done)
🎯 指揮台 (command-center)    — 全員推播 / 抽人問話 / 凍結帳號 / 拍板紀錄 (CEO 緊急工具)
```

**效益**:Vincent 早上開機,第一個 tab 就能 1 分鐘掌握:今天現況 + 預測 + 該派什麼任務 + 戰略指標健康度。

---

### 📂 Group 2:集團(1 tab)

```
🏛️  集團總覽 (group)         — 6 品牌橫向比 + 跨品牌人才流動 + 現金流瀑布
```

**效益**:Vincent 看全集團 dashboard 一張圖,知道哪個品牌賺、哪個虧、人才從哪流到哪。

---

### 📂 Group 3:三大戰線(5 tab)

```
📞 業務戰線 (sales)          — 全業務員今日 KPI 表 + 量多質差偵測 + 派任務
🤖 招募 & 104 (automation)    — 104 自動化 worker 狀態 + 招募漏斗
⚖️  法務戰線 (legal)          — 案件 timeline + alert
📐 業務規則 (rules)            — sales_alert_rules 編輯(動態 KPI 規則 by brand+level)
🎯 KPI 標準 (kpi)              — kpi_targets 編輯(集團/品牌/個人月/季 target)
```

**效益**:主管不必碰 SQL 就能 (a) 改 KPI 標準 (b) 改 alert 規則 (c) 看現況 (d) 一鍵派任務。

---

### 📂 Group 4:養成(6 tab)

```
📚 訓練管理 (training)        — 編輯訓練 module(business 14 天 + 招聘 3 天)
🪶 印章規則 (stamp-rules)      — 4 rarity 印章規則(common/rare/epic/legendary)+ 觸發條件
🎬 資產上傳 (assets)           — 訓練影片 + 講義上傳 (Supabase storage)
👥 人員管理 (people)           — 全員列表 + 進度 + 訓練狀態
✏️  員工編輯 (people-edit)     — 編輯個別員工(改 brand / role / stage)
📥 Metabase 員工同步 (employees-sync) — 從 sales_metrics_daily 撈 distinct email,一鍵建 user
```

**效益**:訓練師 + HR 把人才養成的全週期(學什麼、進度、印章獎勵、員工 CRUD)收進一個 group。

---

### 📂 Group 5:通訊(2 tab)

```
📢 通訊公告 (messaging)       — 集團公告 + 推 LINE
💬 LINE 模板 (line-templates) — D10 LINE Flex Message 模板編輯 + 推送
```

**效益**:推訊息給全員不用 copy paste 進 LINE 群 — 直接走 Bot push 到 individual。

---

### 📂 Group 6:系統(6 tab)

```
🛠️  Setup 設定 (setup)         — 系統初始化 wizard(env / table check)
❤️  系統健康度 (health)         — Supabase / Metabase / LINE / cron 健康狀態
⏰ 排程管理 (cron)              — 17 cron endpoint 開關 + last run 狀態
🧠 知識引擎 (knowledge)         — RAG 知識庫管理(Notion / 訓練 md ingest 狀態)
🏢 組織架構 (org)               — pillar / brand / team 結構編輯
⚙️  系統管控 (system-hub)       — 系統內部工具(Setup status / migrate / approvals)
```

**效益**:不必下 SSH / 改 env / 跑 SQL — 系統自我維運,主管也能查健康度。

---

## 🤖 跨層服務 (16 個)

### AI 戰情官 (Claude Sonnet 4.5 + RAG)
- **入口**:每頁右下角常駐 panel
- **功能**:SSE streaming 對話、引用 RAG 知識庫、查 audit log(主管問「今天 X 業務發生什麼」會把今天 commands + LINE 推送 + recordings 答出來)
- **效益**:主管不必到處查 — 一個 chat 解決。RAG 引用讓答案有出處,不是瞎掰

### Whisper 轉錄 + 三點評估
- **入口**:`/me` RecordingAnalyzeCard 上傳通話錄音
- **流程**:Groq Whisper Large v3 轉錄 → Claude 評三點(順暢 / 邏輯 / 語氣)+ 架構命中率
- **效益**:業務員自己診斷話術。**主管不必聽 30 通,直接看評分跟亮點時點**

### RAG 知識庫
- **內容**:Notion 文件 + 本機 training/ md 檔 + Vincent/Lynn 逐字稿
- **儲存**:knowledge_chunks (1536 vector via OpenAI embedding)
- **效益**:戰情官答問題時引用,有出處可追

### LINE Bot + 6 種 Webhook
- **Channel**:墨宇小精靈 (@494rhwya)
- **Push 場景**:晨報、抽問、attention 警示、命令通知、印章獲得、課程提醒
- **效益**:員工在 LINE 就收到 + 點按鈕回應(不用開 app)

### Metabase Daily Sync
- **時段**:工作時段 09-22 每 15 分,共 56 次/天
- **動作**:從 mb.kolable.com Q1381 撈當日 sales metrics → POST 進 sales_metrics_daily
- **效益**:Vincent 不用每天到 Metabase 手撈 — 系統自動 ingest + 算 paceCheck + alert

### 17 cron endpoint(已 implement,待接 trigger)
- breakthrough-engine / claude-autoscan / daily-briefing-push / daily-todo-push / line-inbound-dispatcher / manager-care-push / metabase-sync / rookie-training-push / sales-metrics-rules / system-health-3h / update-articles / weekly-report 等
- **效益**:全自動營運。Vincent 不必手動 trigger 任何例行任務

---

## 🗄️ 資料層

### Supabase (50+ table)

主要 group:
- **業務 (sales_*)**:sales_metrics_daily / sales_alert_rules / sales_brand_alias
- **使用者 (users)**:含 LINE bind / role / brand / stage
- **訓練 (training_*)**:training_units / training_unit_progress / hr_training_*
- **招募 (recruit_*)**:recruit_documents / outreach_log / recruit_schedule
- **104 自動化 (pending_104_actions)**:phone_call_log / outreach_104_queue
- **V3 指揮 (v3_*)**:pillars / projects / commands / insights
- **LINE (line_*)**:bindings / ask 流程
- **Knowledge (knowledge_chunks)**:1536 vec for RAG
- **Stamp (stamp_*)**:rules + earned 紀錄
- **Metabase (metabase_*)**:sources / sync_log
- **System (system_secrets)**:metabase_session / 其他 secret cache

### Row-Level Security
- **狀態**:所有 public table 已啟用 RLS (2026-04-23 sprint 完成)
- **policy**:多數 table = `service_role ALL`,app 層自己 scope filter
- **TODO**:見 PERMISSIONS.md 待辦,/api/me/* caller-ID + /api/admin scope filter 還沒全做

### GitHub Actions (8 workflow)
```
ci.yml                    每 PR/push tsc + build check
supabase-backup.yml       每天 UTC 16:00 (台北 00:00) dump
cron.yml                  通用 cron trigger
fetch-supabase-auth.yml   拿 Supabase auth state
metabase-backfill.yml     手動 backfill 歷史日期
metabase-daily-sync.yml   每 15 分 sync Q1381 (剛加 saveSession step)
apply-migration.yml       手動 apply SQL migration
rag-bootstrap.yml         RAG 建表 + 初次 ingest
```

---

## 🔧 預計要做(To Do List)

### 🔴 P1 安全(權限收緊)
> 目前 /api/me/* 任何人 know 別人 email 就能查別人資料,/admin scope 過濾沒做

```
1. /api/me/* caller-ID 驗證(session.email ≡ ?email)
   → 加 lib/auth.ts + cookie + 12 個 me/* endpoint 都要呼叫 requireCallerEmail
2. /api/admin/sales-metrics 依 brand/team 過濾
   → brand_manager 只看自己品牌、team_leader 只看自己組
3. /api/v3/commands POST 加 owner scope 檢查
   → brand_manager 不能派任務給其他品牌員工
4. trainer role 只讀模式(目前等同 super_admin)
5. student role 定義(給員工看訓練進度,不開放後台)
```

**效益**:把現在「只要知道 email 就能查任何人」改成「session 必須 own 那個 email」。**這 5 條完成後 sprint 1 安全 baseline 過關**。

---

### 🔴 P1 數據品質(Vincent 6 件 Metabase 反饋)

```
✅ B1 Zeabur 缺 METABASE env → 改 architecture 用 system_secrets cache(workflow 自動寫)
✅ B2 「今天 0/1 天 實資料」→ daysBehind 改用工作日基準(扣週末)
✅ B3 業績趨勢用折線圖 → 改 SVG LineChart(無新依賴)
✅ B4 「打 4936 通 0 成交」→ 加 ratio gate + 500 通 anomaly cap(分:資料異常 / lead 死號 / 真量多質差)
✅ B5 39 筆漏斗違反 → metabase-bulk-upsert 加 funnel sanity cap(成交>出席 自動 cap 為出席)
✅ B6 484 天 100 天 backfill → 寫 verify SQL count 工作日 vs 實際資料
```

**效益**:資料正確 → alert 正確 → 主管決策不被假數據誤導。**這 6 條都做了**(等下會 commit)

---

### 🟡 P2 技術債

```
6. 50+ scattered .sql → supabase/migrations/ 集中
7. 補 README.md(目前靠 CLAUDE.md 頂)+ .env.example
8. admin per-user password / OAuth 取代單一 0000 → ✅ 已做(bcrypt + 強制改)
9. 17 cron endpoint 接 trigger(GitHub Actions Cron 或 Zeabur Cron)
10. 15 個 route 的 Vercel-only `maxDuration` 砍掉(留著沒壞但不乾淨)
11. PUBLIC_APP_URL vs NEXT_PUBLIC_APP_URL 收斂
12. 無 staging 環境(push to main = 直接 prod)
```

**效益**:長期可維護性。**減少未來換 project / restore / 新人 onboard 的痛**

---

### 🟢 P3 補強

```
13. 50% admin tab 的 mobile 響應式 audit
14. 戰情官對話 history 持久化(目前 session 過後沒)
15. 印章獲得時機更多(目前只接 Quiz 全對 + 視訊看完)
16. moyu-worker 104 自動化跑滿 200 封/天 target(目前 ~25 封)
```

**效益**:User experience 更精緻。

---

## 📊 統計

| 項目 | 數量 |
|---|---|
| 前台 page | 22 |
| 後台 admin tab | 25 (6 group) |
| API endpoint(/api/*)| 90+ |
| Cron endpoint | 17 |
| GitHub Actions workflow | 8 |
| Supabase table | 50+ |
| 已實作組件(components/)| 50+ |
| LOC(src/)| ~30k |
| 50+ SQL migration | 50+(待整理) |
| Total commits to date | 300+ |

---

## 🎯 結論(給 Vincent)

**現在系統「有」的:**
- 後台戰情完整(25 tab × 6 group)
- 個人戰情 /me 7 子模組(KPI + AI + paceCheck + brand 比對)
- Whisper / RAG / LINE Bot / Metabase Sync / 跨品牌 dashboard 全部 wired
- prod 6/6 全 200,deploy 自動,沒掛

**現在系統「缺」的:**
- 安全 5 條(/me 任何人查別人 + admin 沒 scope)
- 17 cron endpoint 沒 trigger(已有 endpoint,等接 GitHub Cron 或 Zeabur Cron)
- 數據品質 6 件 已修(待 commit + redeploy verify)

**價值定位:**
墨宇之前散在 5+ SaaS / Excel / Notion 的所有戰線,現在收進一個 Web App。
**主管不用開 5 個 tab,業務員不用問「我該做什麼」,系統自動算 + 推 + 派 + 評估**。

---

下一步:接續 commit B1-B6 + Security 5 條 + 技術債,然後 push。
