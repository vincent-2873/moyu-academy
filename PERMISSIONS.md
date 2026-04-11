# 墨宇戰情中樞 · 權限 Matrix

最後更新: 2026-04-11

## 角色總覽

| 角色 | 中文 | 人數 (當下) | 登入入口 | 密碼 |
|---|---|---|---|---|
| `super_admin` | 超級管理員 (CEO) | 2 | `/admin` + `/me` | `moyu2024admin` |
| `ceo / coo / cfo / director` | 總部高管 | 0 | `/admin` + `/me` | `moyu2024admin` |
| `brand_manager` | 品牌總監 | 0 | `/admin` (該品牌) + `/me` | `moyu2024admin` |
| `team_leader` | 團隊長 | 1 | `/admin` (該團隊) + `/me` | `moyu2024admin` |
| `trainer` | 訓練師 | 0 | `/admin` (受限) | `moyu2024admin` |
| `sales_rep` | 業務員 | 52 | **只能** `/me` | passwordless |
| `student` | 學員 | (未定義) | 目前不存在 | — |

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

**✅ 正確**: API `/api/me/*` 都要 `?email=<自己 email>` — 目前沒做 email 跟 session user 對照的 server-side 檢查，理論上可以偽造 email 參數看別人資料。**這是一個已知 gap**。

**🔴 未修的漏洞**: `/api/me/sales-metrics?email=X` 不檢查呼叫者是不是 X → 任何登入者都能看別人資料。下一輪要修。

### `/admin` (後台指揮中心)

**誰能進**: `ALLOWED_ROLES = ['super_admin', 'ceo', 'coo', 'cfo', 'director', 'brand_manager', 'team_leader', 'trainer']`

**登入**: email + 固定密碼 `moyu2024admin` (看 `src/app/api/admin/auth/route.ts:5`)

**⚠️ 安全問題**:
1. **單一密碼**: 所有 admin 角色都用同一個密碼，沒 per-user password / OAuth
2. **沒 scope filter**: `team_leader` 和 `brand_manager` 能看全集團資料，API 沒依 role 過濾
3. **sales_rep 雖擋在密碼外，但若知道密碼就能進** — 只靠 role in 白名單

**看到什麼** (應該的 scope, 目前實際沒 enforce):
| 角色 | 業務數據 | 所有業務 | 指派任務 | 命令中心 | 組織架構 |
|---|---|---|---|---|---|
| `super_admin` | 全集團 ✓ | 全集團 ✓ | 全員 ✓ | 全部 ✓ | 全部 ✓ |
| `ceo/coo/cfo/director` | 全集團 ✓ | 全集團 ✓ | 全員 ✓ | 全部 ✓ | 全部 ✓ |
| `brand_manager` | 該品牌 | 該品牌 | 該品牌 | 該品牌 | 該品牌 |
| `team_leader` | 該團隊 | 該團隊 | 該團隊 | 該團隊 | (只讀) |
| `trainer` | (全部只讀) | (全部只讀) | ❌ 不能派 | ❌ | ❌ |
| `sales_rep` | ❌ | ❌ | ❌ | ❌ | ❌ |

**🔴 目前實際狀況**: 上面的 scope enforcement **沒有做**。`team_leader` 進後台跟 `super_admin` 看到一樣的東西。

---

## API 端點權限

### 前台 (不檢查 role，只要有 email)

| Endpoint | 用途 | Scope |
|---|---|---|
| `/api/login` | 業務登入 | 只拿 users 表的 basic 欄位 |
| `/api/me/sales-metrics` | 個人 KPI | 任何 email 查得到 **🔴 gap** |
| `/api/me/achievements` | 個人成就 | 任何 email 查得到 |
| `/api/me/daily-briefing` | 個人晨報 | 任何 email 查得到 |
| `/api/me/chat` | 戰情官對練 | 任何 email 查得到 |
| `/api/me/recording-analyze` | 通話診斷 | 任何 email 查得到 |
| `/api/v3/commands?owner=<email>` | 個人待辦 | 任何 email 查得到 |
| `/api/line/oauth/start` | LINE 綁定 | 任何 email 發起 |

### 後台 (需要 admin session token)

| Endpoint | 用途 | Scope |
|---|---|---|
| `/api/admin/auth` | 後台登入 | 產生 session token |
| `/api/admin/users` | 使用者列表 | 任何 admin role |
| `/api/admin/sales-metrics` | 全體業務數據 | 任何 admin role 能看全部 **🔴 gap** |
| `/api/admin/claude-tasks` | 任務列表 | 任何 admin role |
| `/api/admin/line-bind` | LINE 綁定管理 | 任何 admin role |
| `/api/v3/commands` (POST/PATCH) | 指派任務 | 任何 admin role **🔴 no role check** |
| `/api/v3/dashboard` | 指揮中心 | 任何 admin role |

---

## 資料表 RLS (Row Level Security)

Supabase 所有表目前都走 `service_role` bypass，沒有啟用 RLS。API 層需要自己做 scope filter，但**目前大多沒做**。

建議：
1. 在 `/api/me/*` 加 `session.email === ?email` 檢查
2. 在 `/api/admin/sales-metrics` 依 session user role 做 brand/team filter
3. 在 `/api/v3/commands` 派任務時檢查 owner 是否在該 admin 的 scope 內

---

## 下一輪要修的 🔴 清單

1. **`/api/me/*` 加 caller verification** (避免 email 偽造)
2. **`/api/admin/sales-metrics` 依 team_leader.team 過濾**
3. **加 per-user admin password** (或走 OAuth)
4. **`trainer` role 實作只讀模式** (目前跟 super_admin 一樣權限)
5. **`/api/v3/commands` POST 檢查 owner 是否在 scope 內**
6. **`student` role 定義** (如果要給員工看自己的訓練進度)

---

## 操作範例

### 如何讓一個業務只能看 `/me` 不能進 `/admin`

已生效 — `sales_rep` role 進 `/admin` 會被 `ALLOWED_ROLES` 擋住。

### 如何讓團隊長只看自己組

**目前未實作**。workaround: 暫時還是讓 `team_leader` 看全集團，等下輪修。

### 如何讓主管指派任務給業務

1. 進 `/admin` 業務數據 tab
2. 頁頂 **🚨 今日要特別關心的 N 人** 區塊自動列出
3. 點「📤 派 N 項任務」一鍵派 3 項建議任務
4. 或手動 POST `/api/v3/commands`
5. 業務 /me 的 **📋 我的今日任務** 卡片會看到
