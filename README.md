# 墨宇戰情中樞 MOYU OPS v5.0

> Moyu Academy — full-stack 戰情中樞 for 墨宇集團(業務、招募、訓練、法務、跨品牌)。

[![CI](https://github.com/vincent-2873/moyu-academy/actions/workflows/ci.yml/badge.svg)](https://github.com/vincent-2873/moyu-academy/actions/workflows/ci.yml)

**Production**:<https://moyusales.zeabur.app>(`/admin` 後台 / `/me` 個人戰情)

---

## 快速開始

```bash
# 1. 安裝
pnpm install        # 或 npm install / yarn install

# 2. 設環境變數
cp .env.example .env.local
# 編輯 .env.local 填入實際值(從 Zeabur dashboard 拿生產值,本機可用 staging 值)

# 3. 開 dev server
pnpm dev            # http://localhost:3000

# 4. 跑型別檢查 + build
pnpm tsc --noEmit
pnpm build
```

---

## 文件入口

| 文件 | 用途 |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | 系統架構 / 路由 / env / 技術棧 / Claude agent 注意事項 |
| [SYSTEM-OVERVIEW.md](./SYSTEM-OVERVIEW.md) | Vincent demo 用功能樹 + 預計做(2026-04-30 added) |
| [PERMISSIONS.md](./PERMISSIONS.md) | 角色 matrix / API endpoint scope / 已完成 vs 待辦 |
| [supabase/INDEX.md](./supabase/INDEX.md) | 50+ SQL migration 索引 |
| [.env.example](./.env.example) | env vars 清單(23 個 user-configurable) |

---

## 技術棧速覽

- **Framework**:Next.js 16.2(App Router, standalone output)
- **React**:19.2 + TypeScript 6.0 + Tailwind 4.2
- **DB / Auth**:Supabase(`service_role` key bypass RLS)
- **AI**:Anthropic SDK(主力)+ OpenAI(embeddings)+ Groq(Whisper)
- **整合**:LINE Messaging API、Google Calendar / Drive、Discord OAuth、Notion(RAG)
- **部署**:Zeabur(auto-deploy from `main`)
- **CI**:GitHub Actions(`tsc --noEmit` + `next build`)

---

## 架構

```
墨宇戰情中樞
├─ 📱 前台 22 page(/me 個人戰情、/learn 訓練、/recruit 招募、/legal 法務 …)
├─ 🛠️  後台 /admin(25 tab × 6 group)
├─ 🤖 跨層服務(AI 戰情官、Whisper、RAG、LINE Bot、Metabase Sync)
└─ 🗄️  Supabase 50+ table + 8 GitHub Actions workflow
```

完整功能樹見 [SYSTEM-OVERVIEW.md](./SYSTEM-OVERVIEW.md)。

---

## 安全 / 權限

- 所有 `/api/admin/*` 走 HMAC `moyu_admin_session` cookie(`middleware.ts`)
- 所有 `/api/me/*` 走 HMAC `moyu_user_session` cookie + caller-ID 驗證(`lib/auth.ts`)
- Admin scope filter:brand_manager 限該 brand,team_leader 限該 team(`lib/admin-scope.ts`)
- 寫操作 enforceWriteAccess(trainer / mentor 只讀)
- Supabase RLS 全 table 啟用

---

## 部署

```bash
git push origin main    # → Zeabur auto-deploy
```

GitHub Actions:
- `ci.yml`:每 PR/push 跑 tsc + build
- `metabase-daily-sync.yml`:每 15 分撈 Q1381 進 sales_metrics_daily(同時 cache session 進 system_secrets)
- `supabase-backup.yml`:每天 UTC 16:00 dump Supabase
- `apply-migration.yml`:手動 trigger 跑 SQL file
- `rag-bootstrap.yml`:RAG 建表 + 初次 ingest

---

## 開發注意

- **prod 跟 dev 共用同一個 Supabase project**(尚未拆 staging,規劃中)
- **每次改 schema 前先看 [supabase/INDEX.md](./supabase/INDEX.md)** 避免衝撞
- **不要 commit `.env.local`** — `.gitignore` 已擋
- 動 webhook / auth / middleware / route 結構前先說(影響面大)

---

## License

Internal — 墨宇集團專用,不對外開源。
