# CLAUDE.md — moyu-academy

> **給未來 Claude agent 的導覽書。進來先讀這份，再碰 code。**
> 最後更新：2026-04-24（Vercel 撤退隔天，CLAUDE.md 初次建立）

---

## 專案定位

**墨宇戰情中樞 MOYU OPS v5.0** — 一個 Next.js 16 全棧 Web App，同時承載：

- **業務戰線**（sales）— 業務員 KPI / AI 對練 / 通話診斷 / 晨報
- **獵頭戰線**（recruit / HRBP）— 新訓 SOP（Day 1-3）、104 招聘自動化、候選人漏斗
- **法務顧問事務所**（legal）— 合規案件系統
- **X Platform 跨品牌**（hq / nschool / xuemi / ooschool / aischool / moyuhunt）— 總部高管儀表板

目前使用者：**只有 Vincent 自己在用**（以及多個業務員帳號，實際數量以 Supabase `users` 表為準）。還沒真的開放給全公司，屬於生產環境但低流量的單人 daily driver。

---

## 部署與網址

| 項目 | 值 |
|---|---|
| 生產前台 | <https://moyusales.zeabur.app> |
| 管理後台 | <https://moyusales.zeabur.app/admin> |
| 登入入口 | `/`（根頁面）— email + 密碼 / LINE 一鍵登入 |
| 部署平台 | **Zeabur（auto-deploy from `main`）** — 唯一生產環境 |
| 自訂 domain | **無**（不要假設有 moyu.com、xuemi.co 等） |
| 歷史脈絡 | **Vercel 時代已於 2026-04-23 結束**。死連結已清、`vercel.json` 已刪（commit `85d52b3`）。Zeabur 不讀 `vercel.json` |

---

## 技術棧

| 層 | 版本 |
|---|---|
| Runtime | Node 20（CI）/ 生產看 Zeabur 執行 |
| Framework | Next.js **16.2**（App Router，`output: "standalone"`） |
| React | **19.2** |
| TypeScript | **6.0** |
| CSS | Tailwind **4.2** + `@tailwindcss/postcss` |
| DB / Auth | Supabase JS **2.100**（以 `service_role` bypass RLS 為主） |
| AI | `@anthropic-ai/sdk` **0.80**（主力）+ OpenAI / Groq（選用） |
| Google | `googleapis` **171**（Calendar / Drive / Sheets） |
| PG | `pg` **8.20**（直連 Postgres 備援） |
| PDF | `jspdf` **4.2** |
| 加密 | `bcryptjs` **3.0**；HMAC-SHA256 自製 admin cookie（見 `middleware.ts`） |
| 排程 / worker | `playwright` **1.59** + `pm2` **6.0**（專供本機 worker / 104 自動化；生產 Zeabur 上**沒**用到這兩個） |

---

## 專案結構

```
moyu-academy/
├── src/
│   ├── app/
│   │   ├── api/              ← 所有伺服端路由（見「路由索引」章節）
│   │   ├── page.tsx          ← 根頁面 / 登入 / 狀態機 routing
│   │   ├── admin/            ← /admin 後台（漢堡選單 + tab 切換）
│   │   ├── me/               ← /me 個人戰情儀表板
│   │   ├── recruit/          ← /recruit 獵頭工作台（已整合新訓 SOP Day 1-3）
│   │   ├── training/         ← /training 新訓區域（輔助入口，主 UX 在 /recruit）
│   │   ├── checkin/ today/ account/ my-commands/ articles/ legal/
│   │   ├── layout.tsx globals.css
│   ├── components/           ← Sidebar、ProfilePage、MentorshipPage、ScoreRadar…
│   ├── data/                 ← brands.ts / personas.ts / videos.ts / modules.ts
│   ├── lib/
│   │   ├── supabase.ts       ← getSupabaseAdmin() 用 service_role key
│   │   ├── store.ts          ← localStorage / sessionStorage 前台 auth state
│   │   ├── sync.ts           ← syncRegister / syncKpiEntry 等雲端同步
│   │   ├── scoring.ts        ← scoreConversation 對練評分
│   │   ├── claude-coach.ts   ← Claude 戰情官 prompt
│   │   ├── google-api.ts     ← Drive / Calendar helper
│   │   ├── line-notify.ts    ← LINE push wrapper
│   │   ├── metabase.ts       ← Metabase session / query
│   │   ├── notify-admin.ts   ← 系統事件推 LINE 給 Vincent
│   └── middleware.ts         ← `/api/admin/*` 走 HMAC cookie 驗證
├── public/
│   └── training-quiz/HR-0{53..56}/index.html   ← 4 集 HRBP 互動測驗（iframe 源）
├── content/
│   └── training/             ← Layer 1-5 訓練系統原始素材（`/training/methods` 讀這裡）
│       ├── foundation/ (TRAINING_MASTER, HR_MODULE_SPEC, CLAUDE.md, UNIT_INPUT_TEMPLATE)
│       ├── hrbp_series/ (EP1-4 input/README/script + CORE_METHODS + CHANGELOG)
│       ├── ep1_production/ (HeyGen kit)
│       ├── source_materials/ (Vincent/Lynn 逐字稿 + LINE 群組)
│       └── workflow/ (slash commands / patterns / output rules)
├── worker/                   ← 本機 worker 子資料夾（生產 Zeabur 沒跑）
├── supabase-migration-*.sql  ← 17 份 migration 散落根目錄（技術債）
├── .github/workflows/
│   ├── ci.yml                ← tsc --noEmit + npm run build
│   └── supabase-backup.yml   ← 每天 UTC 16:00（台北 00:00）dump Supabase
├── next.config.ts            ← standalone + `outputFileTracingIncludes` 把 content/training bundle 進去
├── middleware.ts
├── PERMISSIONS.md            ← 權限設計文件：角色矩陣、RLS 狀態、待辦 TODO
└── package.json              ← name: moyu-academy, version: 2.0.0
```

**無 `README.md`**（技術債，見最後）。

---

## 路由索引

### 公開頁面

| 路由 | 用途 |
|---|---|
| `/` | 登入入口 + 舊 dashboard（kpi localStorage 版，淘汰中） |
| `/me` | 個人戰情儀表板（所有已登入者） |
| `/admin` | 後台指揮中心（需 admin role + HMAC cookie） |
| `/recruit` | 獵頭工作台（新訓 SOP Day 1-3、招聘任務、X Platform 品牌） |
| `/recruit/104` | 104 招聘熱名單 |
| `/recruit/calendar` | 招聘行事曆 |
| `/training` | 新訓區域首頁（輔助入口） |
| `/training/hrbp` / `/training/hrbp/[unit]` / `/training/methods` | HRBP 4 集 + 速查手冊 |
| `/checkin` | 每日上工 |
| `/today` | 今日聚焦 |
| `/account` | 個人帳號 |
| `/my-commands` | 個人任務 |
| `/articles` / `/legal` | 文章 / 法務 |

### 用戶 API — `/api/*`

**身份 / 使用者**：`login`, `register`, `user`, `user-id`, `profile`, `account`, `me/*`（achievements / chat / daily-briefing / deep-analytics / prediction / recording-analyze / recording-upload / sales-metrics）

**業務 / KPI**：`kpi`, `sparring`, `cohort`, `daily-quiz`, `quiz-scores`, `sales-metrics-rules`, `progress`, `weekly-report`, `work-schedule`

**獵頭 / HRBP**：`recruit/*`（upload-resume / analyze-candidate / auto-pipeline / schedule-interview / update-status / report / hot-list …）、`recruit-funnel`, `hr-training`, `training-progress`, `training-units`

**學習 / 視頻**：`videos`, `video-progress`, `articles`, `knowledge-bot`, `helpbot`, `mentorship`, `mentor-feedback`, `coaching`

**通知 / 訊息**：`notify`, `notifications`, `announcements`, `feedback`, `human-state`, `activity`

**Claude / AI**：`claude`（Claude 任務系統）、`me/chat`

**跨部門 / 戰情**：`v3/*`（commands / dashboard / departments / dispatch / me / positions / projects / today）、`xplatform`, `legal`

### 後台 API — `/api/admin/*`（都經 `middleware.ts` HMAC 驗證）

`auth`, `approvals`, `boardroom`, `ceo-overview`, `chairman-overview`, `claude-tasks`, `interview-score`, `legal-dashboard`, `line-bind`, `mentorship`, `metabase-sync`, `migrate`, `module-overrides`, `pillar-managers`, `progress`, `recruit-documents`, `recruit-pipeline`, `recruits`, `reset-password`, `sales-metrics`, `settings`, `setup-claude-tables`, `stats`, `team-prediction`, `unified-dashboard`, `upload`, `users`, `videos`, `worker-status`, `104-status`

### Webhook / OAuth API

- `/api/line/webhook` — LINE Messaging API inbound
- `/api/line/oauth/start`, `/api/line/oauth/callback`, `/api/line/binding-status` — LINE Login 綁定
- `/api/register`, `/api/login` — 前台註冊登入

### Cron API — `/api/cron/*`

`auto-attention-push`, `auto-iterate-30min`, `breakthrough-engine`, `claude-autoscan`, `daily-automation`, `daily-briefing-push`, `daily-todo-push`, `line-inbound-dispatcher`, `manager-care-push`, `metabase-sync`, `recruit-auto-outreach`, `recruiter-briefing-push`, `rookie-training-push`, `sales-metrics-rules`, `system-health-3h`, `update-articles`, `weekly-report`

**⚠️ 目前 Zeabur 沒有設任何觸發器**。這 17 個 cron endpoint 仍然存在，但沒有定時呼叫者。原本 Vercel 的 13 個 `vercel.json` 排程已隨 Vercel 撤離失效。需要的話要重設 Zeabur Cron Service / GitHub Actions / 外部排程。

**注意**：多數 cron 路由頂端還留著 `export const maxDuration = 60`（或 30）— 那是 Vercel-only 語法，Zeabur 忽略；留著不壞。

---

## 資料庫設計

- Supabase project ref：**`luynflhuzbcbajycvuet`**
- URL：`https://luynflhuzbcbajycvuet.supabase.co`
- 存取：`getSupabaseAdmin()` 用 `SUPABASE_SERVICE_ROLE_KEY` bypass RLS

### 主要 Tables（從 17 份 migration 推測，非窮舉）

| 主題 | 代表 tables |
|---|---|
| 104 自動化 | `pending_104_actions`, `recruit_criteria`, `phone_call_log`, `outreach_104_queue` |
| 招聘 | `recruit_documents`, `outreach_log`, `recruit_schedule`, `hr_training_days`, `hr_training_tasks`, `hr_training_progress`, `training_units`, `training_unit_progress` |
| 業務 | `users`, `kpi_entries`, `sparring_records`, `sales_metrics_*`, `sales_alert_rules`, `sales_brand_alias` |
| LINE | `line_bindings`, `line_ask_*` |
| 法務 | `legal_*`（legal-v2 migration） |
| V3 指揮中心 | `v3_pillars`, `v3_projects`, `v3_commands`, `v3_insights` |
| 通用 | `announcements`, `chip_data`, `daytrade_candidates`, `system_secrets`（worker heartbeat） |

⚠️ **技術債**：17 個 `.sql` 散落根目錄，**未整理成 `supabase/migrations/`**。執行順序靠檔名字母排序硬猜。遷移 Supabase 專案會很痛。

### Row-Level Security
- 2026-04-23 `rls-all-tables` migration 已啟用所有 public table 的 RLS
- 大多 policy = `service_role ALL`，所以 app 層要自己做 scope filter
- **尚未完成的 scope filter**：見 `PERMISSIONS.md` 待辦清單

---

## 環境變數需求

從 code 反推，共 **23 個** user-configurable env vars（未計 `NODE_ENV`）。

### Supabase（3）
- `NEXT_PUBLIC_SUPABASE_URL`（build-time + runtime）
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`（build-time + runtime）
- `SUPABASE_SERVICE_ROLE_KEY`（server only；bypass RLS）

### LINE（6）
- `LINE_CHANNEL_ACCESS_TOKEN`（Messaging API push / reply）
- `LINE_CHANNEL_SECRET`（webhook signature）
- `LINE_LOGIN_CHANNEL_ID`（LINE Login OAuth）
- `LINE_LOGIN_CHANNEL_SECRET`
- `LINE_ADMIN_USER_ID`（系統事件推這個 UID 給 Vincent）
- `NEXT_PUBLIC_LINE_BASIC_ID`（前端顯示官方帳號連結）

### Google（4）
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_SERVICE_ACCOUNT_JSON_B64`（某些路由用 base64 版，擇一）
- `RECRUIT_SHARED_CALENDAR_ID`（招聘共享行事曆）

### AI（3）
- `ANTHROPIC_API_KEY`（主力，戰情官 / knowledge bot）
- `OPENAI_API_KEY`（選用）
- `GROQ_API_KEY`（選用，低延遲推理）

### Metabase（3）
- `METABASE_HOST`
- `METABASE_USER`
- `METABASE_PASS`

### 應用層（4）
- `CRON_SECRET`（cron 路由驗 header）
- `NEXT_PUBLIC_APP_URL`（build-time）
- `NEXT_PUBLIC_SITE_URL`（build-time）
- `PUBLIC_APP_URL`（伺服端一份，功能似前一個 — 建議未來收斂成單一變數）

生產密鑰都存在 Zeabur dashboard。本機開發請從 Zeabur 下載，存 `.env.local`（**已 gitignore**）。

---

## 本機開發

```bash
npm install
cp .env.example .env.local   # 若無 .env.example，從 Zeabur 的 env 分頁抓
npm run dev                  # localhost:3000
```

CI（GitHub Actions `ci.yml`）只做 `tsc --noEmit` + `next build`。沒有單元測試。

---

## Claude agent 注意事項

1. **這是生產環境**。`moyusales.zeabur.app` 活著，Vincent 每天在用。破壞性操作都要三思。
2. **動 webhook / auth / middleware / route 結構前先說**：影響面大，容易把其他 agent 的 feature 擠掉。
3. **改 `.sql` / schema 前先問 Vincent**：17 個 migration 散落根目錄、沒有版本控制工具，亂改會碰撞。
4. **絕不 commit `.env` / `.env.local`**。`.gitignore` 已擋，但人手也要警覺。
5. **多 Claude agent 並行現象**：每 30 分可能有別的 auto agent push。動手前先：
   ```bash
   git pull --ff-only
   git status
   ```
   不乾淨就先 stash 或 commit。push 前再 pull 一次。
6. **Commit message 格式自由**，但要寫清楚改了什麼。參考最近 commits：`fix(webhook): ...`, `feat(training): ...`, `chore(vercel): ...`。
7. **Co-Authored-By 誠實**：如果是 Claude 寫的，加 trailer。
8. **相關文件**：權限設計見 `PERMISSIONS.md`（含角色矩陣、RLS 狀態、待辦 TODO）；admin 驗證機制見 `middleware.ts`；Supabase client 建構見 `src/lib/supabase.ts`。
9. **UI 一致性**：CSS variables 在 `src/app/globals.css`（`--accent` / `--teal` / `--gold` / `--text` / `--text2` / `--text3` / `--border`），Tailwind + Admin 用 `.admin-light` scope。新 UI 沿用這些 token，不要自己寫 hard-code 色值。

---

## 已知技術債（未來可整理，排優先級）

| 優先 | 項目 | 備註 |
|---|---|---|
| 🟠 P1 | **17 個 `.sql` 整理成 `supabase/migrations/` 並接 Supabase CLI** | 避免未來換 project / restore 時手動跑很痛 |
| 🟠 P1 | **補 `README.md`**（面向新 dev）+ `.env.example` | 目前靠 CLAUDE.md 頂著，但公開新人入門不該讀 CLAUDE.md |
| 🟡 P2 | **`/api/me/*` 加 caller email ≡ session email 檢查** | 見 `PERMISSIONS.md` 待辦清單 |
| 🟡 P2 | **admin per-user password（或 OAuth）取代單一 `moyu2024admin`** | |
| 🟡 P2 | **team_leader / brand_manager / trainer 的 scope filter 實作** | 見 `PERMISSIONS.md` 待辦清單 |
| 🟢 P3 | **15 個 route 裡的 Vercel-only `maxDuration` 砍掉** | Zeabur 忽略，不影響運作；清掉只是乾淨 |
| 🟢 P3 | **17 個 cron endpoint 接 Zeabur Cron 或 GitHub Actions 或 moyu-worker** | 或者確認不需要就從 code 刪掉 |
| 🟢 P3 | **`PUBLIC_APP_URL` 和 `NEXT_PUBLIC_APP_URL` 收斂成單一變數** | |
| 🟢 P3 | **無 staging 環境** | push to main = 直接 production。若要加，Zeabur 新開一個 service + 分支策略 |

---

## 相關 repo / 服務

| 項目 | 連結 |
|---|---|
| GitHub repo | <https://github.com/vincent-2873/moyu-academy> |
| Zeabur 專案 | dashboard → **moyu** project → **moyu-academy** service |
| Supabase | <https://supabase.com/dashboard/project/luynflhuzbcbajycvuet> |
| 姊妹 repo（背景 worker） | <https://github.com/vincent-2873/moyu-worker>（104 自動化 / phone sync） |
| 封存 repo（訓練素材舊家） | <https://github.com/vincent-2873/moyu-training-system>（archived，內容已整合進本 repo `content/training/`） |

---

**本文件最後更新**：2026-04-24（Vercel 撤退後 +1 天）
**下次應更新時機**：新增主要功能 / 重大重構 / 技術棧升版 / 部署平台異動 / auth 系統修復完成
