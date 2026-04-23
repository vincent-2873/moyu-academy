# 墨宇戰情中樞 · 權限 Matrix

最後更新: 2026-04-11
Sanitize 日期: 2026-04-24（移除明文密碼與具體漏洞路徑，改為描述現況）

## 角色總覽

| 角色 | 中文 | 人數 (當下) | 登入入口 | 密碼方式 |
|---|---|---|---|---|
| `super_admin` | 超級管理員 (CEO) | 2 | `/admin` + `/me` | bcrypt 個人密碼（Supabase `users.password_hash`） |
| `ceo / coo / cfo / director` | 總部高管 | 0 | `/admin` + `/me` | bcrypt 個人密碼 |
| `brand_manager` | 品牌總監 | 0 | `/admin` (該品牌) + `/me` | bcrypt 個人密碼 |
| `team_leader` | 團隊長 | 1 | `/admin` (該團隊) + `/me` | bcrypt 個人密碼 |
| `trainer` | 訓練師 | 0 | `/admin` (受限) | bcrypt 個人密碼 |
| `recruiter / hr` | 招聘員 / HR | — | `/admin` (獵頭 scope) | bcrypt 個人密碼 |
| `sales_rep` | 業務員 | 52 | **只能** `/me` | passwordless（或 LINE 一鍵登入） |
| `student` | 學員 | (未定義) | 目前不存在 | — |

> 新帳號預設密碼為 `0000`，首次登入會回 `mustChangePassword: true` 強制改。
> LINE Login 一鍵登入在 `users.line_user_id` 綁好後可直接 bypass 密碼。

---

## 頁面存取 Matrix

### `/` (根頁面 · 登入入口)

所有人都能看，登入後依角色分流：
- `sales_rep` → 自動 redirect `/me`
- 其他角色 → 看舊 dashboard (kpi localStorage 版，已淘汰)

### `/me` (個人戰情儀表板)

**誰能進**: 所有已登入的人（包括 `sales_rep` / `team_leader` / `super_admin`）

**看到什麼**: 只看自己 email 的資料
- 自己的即時業務 KPI (MySalesMetricsCard)
- 自己的每日晨報 (DailyBriefingCard)
- 自己的待辦任務 (MyCommandsCard, from `v3_commands`)
- 自己的成就里程碑 (AchievementsCard)
- 戰情官對練 (CoachChatCard) — 吃自己資料
- 通話逐字稿診斷 (RecordingAnalyzeCard)
- `paceCheck` / `rates` / `brandComparison` 都 scoped to 自己 email

**設計約定**: `/api/me/*` 都以 `?email=<自己 email>` 傳參。server-side caller-ID 驗證（確保 email 參數 ≡ session user）為待辦項目，見文末 TODO 清單。

### `/admin` (後台指揮中心)

**誰能進**: `ALLOWED_ROLES = ['super_admin', 'ceo', 'coo', 'cfo', 'director', 'brand_manager', 'team_leader', 'trainer']`

**登入機制**（見 `src/app/api/admin/auth/route.ts`）：
1. `bcrypt.compare(password, users.password_hash)` 驗 per-user 密碼
2. `role in ALLOWED_ROLES` 白名單過濾（目前 10 種：super_admin / ceo / coo / cfo / director / brand_manager / team_leader / trainer / recruiter / hr）
3. 成功後發 HMAC-SHA256 簽章的 `moyu_admin_session` cookie（24 小時有效，`httpOnly` + `secure` in production）
4. `middleware.ts` 在每個 `/api/admin/*` 呼叫都驗章

**架構約定**:
- 多 role 的後台資料 scope（brand_manager 該品牌 / team_leader 該團隊 / trainer 只讀）目前**尚未全面 enforce**，API 層多數回全集團資料，依 role 過濾尚為待辦（見文末 TODO）
- `sales_rep` 被 ALLOWED_ROLES 白名單擋在後台外，進 `/admin` 會回 403

**預期 scope（設計目標；scope enforcement 實作進行中）**:
| 角色 | 業務數據 | 所有業務 | 指派任務 | 命令中心 | 組織架構 |
|---|---|---|---|---|---|
| `super_admin` | 全集團 ✓ | 全集團 ✓ | 全員 ✓ | 全部 ✓ | 全部 ✓ |
| `ceo/coo/cfo/director` | 全集團 ✓ | 全集團 ✓ | 全員 ✓ | 全部 ✓ | 全部 ✓ |
| `brand_manager` | 該品牌 | 該品牌 | 該品牌 | 該品牌 | 該品牌 |
| `team_leader` | 該團隊 | 該團隊 | 該團隊 | 該團隊 | (只讀) |
| `trainer` | (全部只讀) | (全部只讀) | ❌ 不能派 | ❌ | ❌ |
| `sales_rep` | ❌ | ❌ | ❌ | ❌ | ❌ |

目前 `ALLOWED_ROLES` gate 擋掉 `sales_rep`；更細的 brand/team 層級過濾為後續工作（見文末 TODO）。

---

## API 端點權限

### 前台（設計為「自己查自己」，caller-ID 驗證待辦）

| Endpoint | 用途 | 目前 scope |
|---|---|---|
| `/api/login` | 業務登入 | 只回 `users` 表的 basic 欄位 |
| `/api/me/sales-metrics` | 個人 KPI | 以 `?email=` 傳入目標，caller 驗證待辦 |
| `/api/me/achievements` | 個人成就 | 同上 |
| `/api/me/daily-briefing` | 個人晨報 | 同上 |
| `/api/me/chat` | 戰情官對練 | 同上 |
| `/api/me/recording-analyze` | 通話診斷 | 同上 |
| `/api/v3/commands?owner=<email>` | 個人待辦 | 同上 |
| `/api/line/oauth/start` | LINE 綁定 | 由呼叫者發起 |

### 後台（需 admin HMAC session cookie）

| Endpoint | 用途 | 目前 scope |
|---|---|---|
| `/api/admin/auth` | 後台登入 | 驗 bcrypt 密碼 + 發 HMAC session cookie |
| `/api/admin/users` | 使用者列表 | 任何 admin role |
| `/api/admin/sales-metrics` | 全體業務數據 | 任何 admin role；brand/team 過濾待辦 |
| `/api/admin/claude-tasks` | 任務列表 | 任何 admin role |
| `/api/admin/line-bind` | LINE 綁定管理 | 任何 admin role |
| `/api/v3/commands` (POST/PATCH) | 指派任務 | 任何 admin role；owner scope 檢查待辦 |
| `/api/v3/dashboard` | 指揮中心 | 任何 admin role |

---

## 資料表 RLS (Row Level Security)

2026-04-23 security sprint 後，所有 public schema table **已啟用 RLS**（見 `supabase-migration-rls-all-tables.sql`）。多數 table 的 policy 為 `service_role ALL`，意味 app 仍以 service role 存取 → API 層仍需自行做 role / scope filter。

仍需補的 app-layer 檢查：
1. `/api/me/*` 的 caller-ID 驗證（確保 `?email=` ≡ session user）
2. `/api/admin/*` 依 session user role 做 brand / team filter
3. `/api/v3/commands` POST 時檢查 owner 是否在該 admin 的 scope 內

---

## 待辦清單（含歷史完成項目）

| 狀態 | 項目 | 備註 |
|---|---|---|
| ⏸️ TODO | `/api/me/*` 加 caller-ID 驗證（`session.email === ?email`） | 避免 email 參數被換 |
| ⏸️ TODO | `/api/admin/sales-metrics` 依 `team_leader.team` / `brand_manager.brand` 過濾 | |
| ✅ Done | ~~加 per-user admin password（或走 OAuth）~~ | 已於 bcrypt + `users.password_hash` migration 完成；預設 `0000` 首次登入強制改 |
| ⏸️ TODO | `trainer` role 實作只讀模式 | 目前權限等同 super_admin |
| ⏸️ TODO | `/api/v3/commands` POST 檢查 owner 是否在 scope 內 | |
| ⏸️ TODO | `student` role 定義 | 若要給員工看訓練進度 |
| ✅ Done | ~~Supabase 所有 public table 啟用 RLS~~ | 2026-04-23 security sprint 完成 |
| ✅ Done | ~~`/api/admin/*` HMAC cookie auth~~ | 2026-04-23 security sprint 完成 |

---

## 操作範例

### 如何讓一個業務只能看 `/me` 不能進 `/admin`

已生效 — `sales_rep` role 進 `/admin` 會被 `ALLOWED_ROLES` 擋住。

### 如何讓團隊長只看自己組

尚未完成 brand / team 層級過濾，`team_leader` 目前仍見全集團。排程在「待辦清單」第 2 項。

### 如何讓主管指派任務給業務

1. 進 `/admin` 業務數據 tab
2. 頁頂 **🚨 今日要特別關心的 N 人** 區塊自動列出
3. 點「📤 派 N 項任務」一鍵派 3 項建議任務
4. 或手動 POST `/api/v3/commands`
5. 業務 /me 的 **📋 我的今日任務** 卡片會看到
