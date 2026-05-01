# CLAUDE.md — moyu-academy(v6,2026-05-01 第六輪 Phase A 清理後)

> **進來先讀這份,再碰 code。**

---

## 🌳 永遠先看 PHASE-ROADMAP.md(Vincent 拍板真理)

8 週完整 roadmap 在 [`PHASE-ROADMAP.md`](./PHASE-ROADMAP.md),**永遠保留到 Phase 6 全做完才能砍**。

每個 Claude **必須先讀** `PHASE-ROADMAP.md` 看完整系統樹狀圖(/sales/* 前台 + /admin/{board, sales, legal, training-ops, claude, human, settings} 後台 + 9 角色權限矩陣 + 17 worker + 視覺氛圍對照)。

**目前進度(2026-05-01 第六輪 Phase A 末)**:
- ✅ Phase 1 大半(D1-D18 schema)
- ✅ Phase 2 W1(`/admin/training-ops` 4 子頁)
- ✅ **Phase A 清理**(HR 全砍 + 架構外舊頁砍 + 訓練體系規範改 + RAG pillar 改)
- ❌ Phase B 起的工作還沒做(`/sales/*` 前台 5 子頁 / admin 17 tab 重組成 8 區 / Phase 3-6)

**最新 handoff:** [`HANDOFF-2026-05-01-v6.md`](../HANDOFF-2026-05-01-v6.md)(在專案上一層)

---

## 🔒 鐵則:基於 Vincent 既有資料延伸,不從零 AI 生成(2026-05-01 拍板)

> Vincent 親口:「**做每一個功能都是要去找 Vincent 提供的資料延伸優化生成,不是透過 AI 從零生成就好。Vincent 資料是有意義的。這個原則直到整個 8 週 roadmap 建置好都不變**。」

### v5 違反鐵則的教訓(已清除)
v5 OpenAI 從零生 28 個 nschool BIZ stub,沒參考 nSchool 真實 source。第六輪 Phase A 已 D19 SQL DELETE 清除。

### Source 完整位置

| 群組 | 路徑 | 用途 |
|---|---|---|
| **nSchool 完整 Notion** | `~/Downloads/訓練資料/_unzipped/nschool_part1/...` | BIZ 體系主要 source(訓練中心 / 課程結構 / 銷售簡報 v4 / 銷售工具 / 銷售方案 / 成交後流程 / 報價金流) |
| **XLAB AI 實驗室** | `~/Downloads/訓練資料/_unzipped/XLAB/` | 172MB,還沒翻內容 |
| **適所 HOWWORK** | `~/Downloads/訓練資料/_unzipped/company_intro_part1/` | 公司介紹(= 墨宇)|
| **3 個 ExportBlock 巨型** | `~/Downloads/訓練資料/_unzipped/block_*/` | 0.4 / 2.5 / 3.2 GB,Vincent 確認後再用 |
| **訓練系統規範** | `content/training/foundation/{TRAINING_MASTER, CLAUDE, UNIT_INPUT_TEMPLATE}.md` | v2(2026-05-01)— BIZ + LEGAL 兩體系 |
| **memory + handoff** | `~/.claude/.../memory/*.md` + `~/huance-copilot-memory/handoff/*.md` | Vincent 過往對話累積 |

### nSchool source 結構(BIZ 核心)

```
nSchool 財經學院
├─ 訓練中心(BIZ 主軸)
│  ├─ 書本/課程(4):GROW / 黃金圈 / OKR / SPIN 實戰
│  ├─ 業務開發 Call 逐字訓練(8 個逐字 + 8 wav)
│  └─ 開發檢核 8 步驟:破冰 → 信任建立 → 需求探索 → 介紹 nSchool → 補充資訊 → 財經架構 → 產品引導與價值說明 → 行動邀請
├─ 課程結構(理財投資核心 + FI-基本面)
└─ 報價 / 金流 / 銷售工具 / 銷售方案 / 成交後流程
```

### 對照表(每功能要找的 source)

- 訓練 module 設計 → nSchool 訓練中心 8 步驟 + 4 本書
- 對練 Persona prompt → nSchool 業務開發 Call 8 個逐字 + wav
- 互動網頁產出 → nSchool 銷售簡報 v4 + 銷售工具
- RAG 業務 pillar → 整套 Notion ingest knowledge_chunks
- 任何角色 / 真實人名 → 通用稱呼,只允許 Vincent / Lynn / Page

---

## 「適所 = 墨宇 = HOWWORK」(別再問了)

2026-04-30 Vincent 親口拍板:

- 業務本體 = **墨宇生態**(墨宇 + 經銷)
- **「適所」=「HOWWORK」=「墨宇」**(三個別名,適所 HOWWORK 是公司公開介紹頁)
- **X Platform 6 品牌**(學米 / 無限 / nSchool / 職能 / XLAB / 未來)= 對外電商,**不在系統範圍**
- **業務線 4 條**:財經 / 職能 / 實體 / 未來
- **5 實體據點 + 主管**:Rita / Terry / Alan / Lance / Vincent

詳見 `huance-copilot-memory/handoff/2026-04-30-moyu-mass-overhaul.md` §3。

---

## 專案定位

**墨宇戰情中樞 MOYU OPS** — 單一 Next.js 16 全棧 Web App,承載:

- **業務戰線**(`/sales/*`)— 業務員 KPI / AI 對練(基於 nSchool 8 個逐字)/ 通話診斷 / 訓練(基於 8 步驟 + 4 本書)/ RAG(整套 nSchool)
- **法務戰線**(`/legal/cases`)— 合規案件系統
- **後台 8 大區**(`/admin/{board, sales, legal, training-ops, claude, human, settings}/*`)
- **跨層服務**:AI 戰情官 / Whisper / RAG / LINE Bot / Metabase 自動 sync / 17 cron worker

目前使用者:**Vincent + 業務員帳號**(Supabase users 表)。低流量單人 daily driver。

---

## 部署與網址

| 項目 | 值 |
|---|---|
| Prod | <https://moyusales.zeabur.app> |
| 後台 | <https://moyusales.zeabur.app/admin> |
| 部署平台 | **Zeabur**(auto-deploy from `main`)— 唯一生產環境 |
| 自訂 domain | **無** |
| 歷史 | Vercel 時代 2026-04-23 結束 |

### 🚨 Supabase project(2026-04-30 重新判斷,別再誤判)

**moyu prod 用 `nqegeidvsflkwllnfink`(寰策合併共用),不是 `luynflhuzbcbajycvuet`**。

- ❌ 絕對不要動 Zeabur env 的 supabase 相關 key
- ❌ 不要因為某些舊 doc 寫 `luynflhuzbcbajycvuet` 就以為設定錯了 — **沒錯**,實際 prod 用 `nqegeidvsflkwllnfink`

OAuth callback URL 設定(P3,Vincent 自選動):進 Supabase dashboard → 加 `https://moyusales.zeabur.app/**` 到 Additional Redirect URLs。

---

## 技術棧

| 層 | 版本 |
|---|---|
| Runtime | Node 20 |
| Framework | Next.js **16.2** App Router(`output: "standalone"`)|
| React | **19.2** |
| TypeScript | **6.0** |
| CSS | Tailwind **4.2** + `@tailwindcss/postcss` |
| DB / Auth | Supabase JS **2.100**(`service_role` bypass RLS)|
| AI | `@anthropic-ai/sdk` **0.80** + OpenAI / Groq |
| Google | `googleapis` **171**(Calendar / Drive / Sheets)|
| PDF | `jspdf` **4.2** |
| 加密 | `bcryptjs` **3.0** + HMAC-SHA256 admin cookie |
| 排程 | `playwright` **1.59** + `pm2` **6.0**(本機 worker only)|

---

## 專案結構(Phase A 後)

```
moyu-academy/
├── src/
│   ├── app/
│   │   ├── api/                  ← 所有伺服端路由
│   │   ├── page.tsx              ← 根登入 + SPA dashboard/sparring/kpi/profile
│   │   ├── account/              ← /account 基礎帳號功能
│   │   ├── admin/                ← /admin 後台 17 tab × 5 group(Phase B-3 重組成 8 區)
│   │   ├── recruit/              ← /recruit 招募(daily driver,留)
│   │   └── legal/cases/          ← /legal/cases(對齊 system-tree)
│   ├── components/
│   ├── data/
│   ├── lib/                      ← rag-pillars 已砍 hr branch
│   └── middleware.ts
├── public/                       ← training-quiz/ 已砍(Phase A)
├── content/training/
│   ├── foundation/
│   │   ├── TRAINING_MASTER.md    ← v2(BIZ + LEGAL 兩體系)
│   │   ├── CLAUDE.md             ← v2(訓練守則)
│   │   └── UNIT_INPUT_TEMPLATE.md
│   └── README.md                 ← v2
├── worker/                       ← 本機 worker
├── supabase-migration-*.sql      ← D1-D19(D19 待 Vincent apply)
├── next.config.ts                ← /me /today /checkin redirect 已砍
├── PHASE-ROADMAP.md              ← Vincent 拍板真理(永不砍)
├── CLAUDE.md                     ← 本檔
└── package.json
```

---

## Phase A 第六輪做了什麼(commit chain)

```
50dc421  fix(links): 修死連結 — /today /legal 砍了 link 改 / 跟 /admin
0c8b4c6  chore(cleanup): 砍 14 個架構外前台 page — 對齊 system-tree
682fcb2  docs(training): 訓練體系規範改成 BIZ + LEGAL 兩體系(v2)
c254acd  refactor(rag,config): RAG pillar 砍 hr branch + next.config 砍 /training/methods
a46be24  chore(cleanup): 砍 HR 散布 + D19 cleanup SQL
800c10a  docs(handoff): PHASE-ROADMAP 永久化 + 鐵則「基於 Vincent 資料延伸」(v5 末)
```

---

## 現有路由(Phase A 後對齊樹狀圖進度)

### ✅ 對齊樹狀圖(留)
- `/` 根登入(SPA)
- `/account` `/account/password` 基礎
- `/admin/training-ops/{students, attention, materials, report}` Phase 2 W1 完整
- `/legal/cases` `/legal/cases/[id]` 對齊 system-tree
- `/recruit` `/recruit/104` `/recruit/calendar` Vincent 104 daily driver(架構沒列但保留)

### ❌ 系統樹狀圖規定但**還沒建**(Phase B)
- `/sales/{dashboard, training, practice, knowledge, module/[id]}` ⭐ Phase B-2
- `/legal/{draft, training, knowledge}`
- `/admin/board/{quarterly, strategy, inquiry, decisions}`
- `/admin/sales/{dashboard, individual}`
- `/admin/claude/{live, log, knowledge, rules, personas}`
- `/admin/human/{sos, sign-off, arbitration}`
- `/admin/settings/{people, cron, health, system}`(既有 admin 重組)

---

## 環境變數需求

23 個 user-configurable env(同 v5):
- Supabase 3
- LINE 6
- Google 4
- AI 3(`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GROQ_API_KEY` — **OPENAI 仍是 Phase B RAG 啟動唯一卡點**)
- Metabase 3
- 應用層 4

生產密鑰存 Zeabur dashboard。本機開發 `.env.local`(已 gitignore)。

---

## Claude agent 注意事項

1. **這是生產環境**,破壞性操作三思
2. **動 webhook / auth / middleware / route 結構前先說**
3. **改 `.sql` / schema 前先問 Vincent**
4. **絕不 commit `.env` / `.env.local`**
5. **多 Claude agent 並行**:每 30 分可能有 auto agent push,動手前 `git pull --ff-only`
6. **Co-Authored-By 誠實**:Claude 寫的加 trailer
7. **UI 一致性**:CSS variables 在 `src/app/globals.css`(`--accent` / `--teal` / `--gold` / `--text` 等),沿用不寫 hard-code 色值
8. **訓練內容視覺**(`/sales/training` 等)走 **深藍 #1E3A5F + 暖橘 #F59E0B**(`foundation/TRAINING_MASTER.md` 規定),跟後台 admin 的墨宇侘寂朱紅老金分流

---

## 紅線(永遠優先)

- 紅線 1:secret 不進 chat / 不 screenshot 顯示頁 / 不 body.innerText.slice
- 紅線 2:可以說「不確定」
- 紅線 3:不可逆破壞性操作要先停
- 紅線 4:願景模式不直接執行(Vincent 主動聲明跨層後可動)

---

## 已知技術債(待整理,排優先)

| 優先 | 項目 |
|---|---|
| 🟠 P1 | 60+ `.sql` 整理進 `supabase/migrations/` 接 Supabase CLI |
| 🟠 P1 | `/api/me/*` 加 caller email 檢查 |
| 🟡 P2 | admin per-user password / OAuth |
| 🟡 P2 | team_leader / brand_manager scope filter(`PERMISSIONS.md`)|
| 🟢 P3 | 17 cron endpoint 接 Zeabur Cron 或 GitHub Actions |
| 🟢 P3 | `PUBLIC_APP_URL` vs `NEXT_PUBLIC_APP_URL` 收斂 |
| 🟢 P3 | 無 staging 環境(push to main = 直接 prod)|

---

## 相關 repo / 服務

| 項目 | 連結 |
|---|---|
| GitHub | <https://github.com/vincent-2873/moyu-academy> |
| Zeabur | dashboard → moyu project → moyu-academy service |
| Supabase | <https://supabase.com/dashboard/project/nqegeidvsflkwllnfink> |
| 姊妹 worker | <https://github.com/vincent-2873/moyu-worker>(104 自動化)|
| 訓練封存(舊) | <https://github.com/vincent-2873/moyu-training-system>(archived)|

---

**本文件最後更新**:2026-05-01(第六輪 Phase A 清理後 v6)
**下次更新時機**:Phase B 啟動 / 重大重構 / 技術棧升版 / 部署平台異動
