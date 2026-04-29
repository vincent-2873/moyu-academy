# UI/UX 狀態 — moyu-academy v2.0.0

**更新**:2026-04-29
**位置**:`moyu-academy/UI-UX-STATUS-2026-04-29.md`(repo 根目錄)

---

## TL;DR

整合到 nqegeidvsflkwllnfink Supabase 後,把 huance-copilot-app 的**侘寂風(wabi-sabi)設計系統 port 進來**。
目前 **3 page 完整套了 wabi**(/training, /checkin, admin login + Sidebar),其餘 page 還停在原 SaaS 紫青漸層。

---

## 已套 Wabi 的 page

| Page | 套用程度 | Commit |
|---|---|---|
| `/training` | 100%(米紙底 + 墨黑 serif headline + 金繕線分隔 + 朱紅印章) | `0884735` |
| `/checkin` | 主視覺 wabi(card / button / hero) | `11aae57` |
| `/admin` | Sidebar 完整 wabi + LoginScreen wabi | `29d4eb1` |

## 還沒套 Wabi 的 page(SaaS 漸層仍在)

| Page | 大小 | 重要度 |
|---|---|---|
| `/`(根登入入口) | 1078 行 | 🔴 高(主入口) |
| `/me` | 3678 行 | 🔴 高 |
| `/today` | 533 行 | 🟡 中 |
| `/recruit` | 477 行 | 🟡 中 |
| `/articles` | (大) | 🟢 低 |
| `/legal` | 中等 | 🟡 中 |
| `/recruit/104` | 中等 | 🟢 低 |
| `/recruit/calendar` | 中等 | 🟢 低 |
| `/training/hrbp/*` | 中等 | 🟢 低(已用 iframe) |
| `/account` | 路由不存在 | (待修) |

---

## 設計系統檔案位置

### 1. CSS Tokens(色票 / 字型 / scope)

**檔案**:`src/app/globals.css`

```css
/* :root 全域 token */
--bg-paper:           #f7f1e3;  /* 米色和紙底 */
--ink-deep:           #1a1a1a;  /* 墨黑 headline */
--ink-mid:            #4a4a4a;  /* 內文 */
--accent-red:         #b91c1c;  /* 朱紅印章 */
--gold-thread:        #c9a96e;  /* 金繕線 */
--bg-elev:            rgba(247,241,227,0.85);  /* 卡片懸浮 */
--border-soft:        rgba(26,26,26,0.10);     /* 細線 */

/* SaaS class override(把舊 class 視覺接過來)*/
.auth-card { ... }
.auth-btn-primary { ... }
.glass-card { ... }
.surface-elevated { ... }
.metric-tile { ... }

/* admin scope override */
.admin-light { /* 用 admin 區獨立 token */ }
```

**Commit**:`27dcd2f`

### 2. Wabi 元件(7 個)

**位置**:`src/components/wabi/`

| 元件 | 用途 |
|---|---|
| `Button.tsx` | wabi 風格 btn(墨黑底 / 米紙底 / 朱紅 hover) |
| `Card.tsx` | 米紙紋路 + soft border + 浮水印章 |
| `KintsugiDivider.tsx` | 金繕線分隔(模擬陶器修補的金線) |
| `Stamp.tsx` | 朱紅印章(可放 emoji / 字 / icon) |
| `MoyuLogo.tsx` | 「墨宇」品牌 logo wabi 版 |
| `TopBar.tsx` | 頂欄 wabi 版(menu trigger + brand + actions) |
| `WabiSidebar.tsx` | 側欄 wabi 版(主選單) |

### 3. 字型(5 套,via `next/font/google`)

**檔案**:`src/app/layout.tsx`

| 字型 | 用途 | CSS variable |
|---|---|---|
| Inter | 內文(歐文) | `--font-inter` |
| Noto Sans TC | 內文(中文) | `--font-noto-sans-tc` |
| Source Serif 4 | Headline(歐文) | `--font-source-serif` |
| Noto Serif TC | Headline(中文) | `--font-noto-serif-tc` |
| JetBrains Mono | code / 數字 | `--font-jetbrains-mono` |

字型 family 套在 `<html className={...}>` 上,所有 page 自動繼承。

### 4. Sidebar(動態)

**檔案**:`src/components/Sidebar.tsx`

- 業務 / 招募 / 法務 各自不同 nav 清單
- accent 顏色從 brand config 動態算
- mobile 版(< 768px)會收成漢堡選單

### 5. HRBP 互動測驗 4 集

**位置**:`public/training-quiz/`

| 集數 | 路徑 |
|---|---|
| EP1 | `public/training-quiz/HR-053/index.html` |
| EP2 | `public/training-quiz/HR-054/index.html` |
| EP3 | `public/training-quiz/HR-055/index.html` |
| EP4 | `public/training-quiz/HR-056/index.html` |

測驗用 iframe 嵌入 `/training/hrbp/[unit]` page。

### 6. 訓練素材(原始)

**位置**:`content/training/`

包含 Layer 1-5 訓練系統原始稿、HeyGen 製作 kit、逐字稿、LINE 群組對話備份。

---

## 視覺一致性問題(已知)

| # | 問題 | 影響 page | 優先 |
|---|---|---|---|
| 1 | `/`(根)有 2 套 dashboard 並存(舊 KPI localStorage 版 + 新登入入口) | `/` | 🔴 |
| 2 | `/admin` LoginScreen 用 `linear-gradient` inline style,wabi token override 不到(因為 inline style 優先) | `/admin` login | 🟡 |
| 3 | `/me` 太大(3678 行),只能改 hero,內部無法整體 port | `/me` | 🟡 |
| 4 | 很多 page 用 hardcoded `#7c6cf0`(SaaS 紫)而非 `var(--accent)` | 多個 page | 🟡 |
| 5 | mobile 版斷點不一致,有的 768 / 有的 640 | 全站 | 🟢 |
| 6 | dark mode toggle 在 `<ThemeToggle />` 元件,但 wabi 視覺只設計了 light 模式,dark 切下去會醜 | `/admin` 切 dark 時 | 🟡 |

---

## 你提過的 UX 問題(2026-04-29 對話)

| # | 你的反映 | 我的判斷 | 待修狀態 |
|---|---|---|---|
| 1 | /admin 8 tab 順序怪 | 應該 4 戰線分組(戰況 / 業務 / 招募 / 法務 / 系統) | ❌ 未動 |
| 2 | 角色說明卡片排序怪(超管 / 總經理 / 老師宅 / 武公 ...) | 「老師宅」「武公」可能是混入髒資料 | ❌ 未動 |
| 3 | 候選人 → 求職者(全站文案) | 12 處要改 | ❌ 未動 |
| 4 | 系統時區強制台北 | 大部分 cron 已 hardcode `Asia/Taipei`,但 `/` 根頁面顯示時間沒強制 | ❌ 未動 |
| 5 | 人員管理列表沒顯示所有 9 人 | API 回 9 user(verified),前端可能 brand scope filter 切掉 | ❌ 未動 |
| 6 | 角色命名不要那麼複雜 | 11 角色 + 你要加 6 新 = 17 角色,需簡化 + 階級排序 | ❌ 未動 |
| 7 | 訓練系統實質運作 | 5.1 SOP / 5.5 每日測驗 / 5.6 進度追蹤 全部 stub | ❌ 未動 |
| 8 | 部門日報 + 預測警告 | 6.7 NOOP | ❌ 未動 |
| 9 | 一般人員無前台、主管才能追蹤 | 角色權限分流還沒做 | ❌ 未動 |

---

## 設計參考(原始來源)

我從這個 repo port 過來:
- `huance-copilot-app/src/components/wabi/`(本機 `C:\Users\USER\OneDrive\桌面\Claude code\huance-copilot-app\src\components\wabi\`)

如果有設計圖 / Figma:
- 我目前**沒看到 Figma 連結**,你如果有,給我看可以更貼

---

## 後續動作建議(我提)

**Quick wins(我能直接做)**:
1. 把根頁面 `/` 簡化:把舊 KPI dashboard 拿掉,留乾淨登入入口
2. /me hero + /today hero + /recruit hero 套 wabi(3 個 hero ~30 行修改)
3. `候選人` 全站 search-replace → `求職者`(12 處)
4. /admin tab 順序重排 + 加 group divider

**需要決策(等你)**:
1. wabi 要不要做 dark mode?(目前只 light)
2. 角色簡化清單(11 → 14? 16?)由你定
3. 訓練系統真的要做嗎?哪些子功能必要?

---

**結論**:設計系統 token + 元件齊了,但**只 port 進 3 個 page**,其餘 SaaS 漸層感視覺殘留。Quick wins 大概 1-2 小時可以把主要入口頁全 wabi 化。
