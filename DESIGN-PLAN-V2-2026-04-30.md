# 設計重構規劃 v2 — Phase B

**對象**:Vincent
**日期**:2026-04-30
**緣由**:Vincent 反映「不夠直觀 / 一個功能一頁 / 不符合網頁設計 / 太簡單暴力 / 功能不齊全」

reference 設計:**kzero / cuberto / nvg8 / erikasenftmiller / kaizen makemepulse**
共通特徵:互動式、scroll-driven、master-detail layout、留白、物理感、字級對比拉大

---

## 1. 整站 Sitemap 重整(從「9 tab 平鋪」→ 樹狀組織)

```
/                     登入入口(乾淨,只有登入卡片 + LINE/Google/Discord button)
│
└─ 登入後 → 依 capability_scope routing
   │
   ├─ /home              個人主場 ── 早晨儀式 + 今日狀態
   ├─ /work              個人主場 ── 數據鏡 + 趨勢 + 目標
   ├─ /learn             個人主場 ── 養成捲軸 + 印章牆 + 知識速查
   ├─ /account           個人主場 ── 帳號 / 綁定 / 通知偏好
   │
   ├─ /admin             後台入口(只 super_admin / brand_manager / team_leader)
   │   │
   │   └─ 樹狀 dashboard(取代 9 tab 平鋪)
   │       │
   │       ├─ 戰況俯瞰 ─┬─ 指揮中心(L1 健康度 + 三句摘要 + 紅燈)
   │       │           ├─ 命令中心(Vincent 派任務)
   │       │           └─ 跑馬燈管理
   │       │
   │       ├─ 三大戰線 ─┬─ 業務 ─┬─ 業績儀表板
   │       │           │       ├─ 業績規則 / KPI 編輯
   │       │           │       └─ 對話風險警報
   │       │           ├─ 招募 ─┬─ 漏斗大圖
   │       │           │       ├─ 104 自動化
   │       │           │       └─ 候選人池
   │       │           └─ 法務 ─┬─ 案件現況
   │       │                   ├─ deadline 紅燈
   │       │                   └─ 合規任務
   │       │
   │       ├─ 養成系統 ─┬─ 訓練教材編輯(現有 TrainingEditor)
   │       │           ├─ 全員養成進度地圖
   │       │           ├─ 階段定義 / 升降規則
   │       │           ├─ 印章規則
   │       │           └─ AI 教練在做什麼(token / 處方 / 高頻錯誤)
   │       │
   │       ├─ 知識引擎 ─┬─ 知識庫管理(knowledge_chunks 列表)
   │       │           ├─ Notion sync 觸發 + 紀錄
   │       │           ├─ 本機資料 ingest 觸發
   │       │           ├─ Embedding 進度
   │       │           └─ Search 測試介面
   │       │
   │       ├─ 集團經營 ─┬─ 6 品牌橫向比
   │       │           ├─ 跨品牌人才流動
   │       │           ├─ LTV / CAC
   │       │           └─ 北極星指標
   │       │
   │       ├─ 人員管理 ─┬─ 員工列表
   │       │           ├─ 角色 / capability 編輯
   │       │           ├─ 階段手動設
   │       │           └─ 主管帶人成效
   │       │
   │       ├─ 系統管控 ─┬─ 資料新鮮度看板(每張表更新時間)
   │       │           ├─ Cron 健康度(17 個排程哪壞哪 noop)
   │       │           ├─ AI 失誤紀錄公開頁
   │       │           ├─ 指標可信度標籤(🟢真 🟡半 🔴未通)
   │       │           └─ Env / Secret 管理(name + length 不顯值)
   │       │
   │       └─ 訊息對外 ─┬─ 公告 / 跑馬燈編輯
   │                   ├─ LINE Bot 模板管理
   │                   ├─ 通知偏好(誰會收什麼)
   │                   └─ 對外網站 / SEO
   │
   └─ 戰情官對話側欄(全頁面常駐,右下朱紅墨字)
       └─ RAG retrieval + 主管 audit log
```

---

## 2. 後台「樹狀 dashboard」入口頁設計

取代現在 9 tab 平鋪 horizontal nav,改為:

### Layout
```
┌──────────────────────────────────────────────────┐
│ [墨] 墨宇戰情中樞             vincent@xuemi.co   │
├────────────┬─────────────────────────────────────┤
│            │                                     │
│  樹狀 nav  │  內容區(切換 panel)                │
│  collap-   │                                     │
│  sible     │  - card + chart                     │
│  侘寂風    │  - master-detail                    │
│            │  - 不開 modal,在 right pane 直接編 │
│            │                                     │
└────────────┴─────────────────────────────────────┘
```

### 互動細節(framer-motion + GSAP)
- nav 點 parent → 子節點 expand(慢 0.3s spring)
- 切換 main panel → fade-out + slide-in(300ms)
- card hover → 浮起 2px + shadow 擴散 + 字級 98% → 100%
- 數字呼吸:KPI 數字 1.0 ↔ 1.02 scale,2 秒一循環
- 完成 milestone:朱紅印章從天而降「啪」蓋下 + 微震動

---

## 3. 前台 4 主場改進(Phase B)

### /home(早晨儀式)
- **Hero**:大字 "早安,Vincent" 100pt + 黑色漸 ink + 米紙底
- 進場:scroll-driven 字漸顯 + blur 4px → 0
- 簽到 button:click → 朱紅印章蓋下動畫 + 「啪」聲(可關)
- 今日任務:卡片 stagger 進場(下方 fade up)
- **跨時段路由**:09:00 前進 /home;之後依條件可跳 /work

### /work(數據鏡)
- Hero:大字 "鏡" 200pt
- 數字從 0 跳到目標,easeOut 像股票看板
- 6 月趨勢:互動 sparkline,hover 點顯該日 detail
- Claude 診斷預留:側欄推 3 大發現 + 可一鍵接受處方

### /learn(養成捲軸)
- **水墨橫向捲軸**(取代 vertical 列表):D0 → D14 像古地圖
- 每站 hover:浮現 station detail(印章 + 任務 + 完成度)
- 已完成站變朱紅,未走灰墨
- 點站 → 進該天詳細 page(不跳頁,在原地展開)

### /account
- 個人檔案 + LINE / Google / Discord 綁定狀態 + audit log
- 通知偏好(LINE / 系統 / mail)

---

## 4. 全頁互動元件(全站套)

| 元件 | 行為 |
|---|---|
| 滑鼠尾跡 | 移動留下淡墨筆觸,300ms 消散 |
| Hover 卡片 | 浮起 2-3px + shadow + 字級 98%→100% |
| Click button | scale(0.95) + spring 回彈 |
| Scroll 進入 | 從下方 fade up + blur 4→0,1.2s stagger |
| Tab 切換 | 舊內容 fade out + slide left,300ms |
| 載入完成 | 數字從 0 跳到目標,easeOut 股票感 |
| 完成里程碑 | 朱紅印章從天蓋下 + 微震 + 金繕線延伸 |
| 連 7 天簽到 | 紙張捲起來「捲軸動畫」 |
| Hover Logo | 「墨宇」字像水墨化開重組 |
| KPI 呼吸 | scale 1.0↔1.02,2s 循環 |
| 空狀態 | 不放空白,放小水墨動物游 |

---

## 5. 後台「所有 tab CRUD」(Vincent 反覆要求)

每個 tab 都要可:新增 / 改 / 刪 / 排序。

| Tab | 編輯內容 | 狀態 |
|---|---|---|
| 訓練教材 | path / module / content jsonb | ✅ 已做(TrainingEditor),改 master-detail |
| 公告 / 跑馬燈 | announcements 表 CRUD | ❌ 補 |
| 業績規則 | sales_alert_rules CRUD | ❌ 補 |
| KPI 標準 | kpi_targets CRUD | ❌ 補 |
| Cron schedule | enable / disable / 調 schedule | ❌ 補 |
| 角色 / capability | users.role / capability_scope 改 | ❌ 補 |
| 印章規則 | training_stamps 自動觸發條件 | ❌ 補 |
| Env(name + length) | system_secrets meta(不顯值) | ❌ 補 |
| LINE 模板 | line_templates CRUD | ❌ 補 |
| 知識來源 | knowledge_sources_log + 觸發 ingest button | ❌ 補 |

---

## 6. 工期估計(以實際投產設計水準)

| 階段 | 內容 | 工期 |
|---|---|---|
| Phase B1 | 樹狀後台 dashboard + master-detail TrainingEditor + framer-motion 基礎 | 1-2 天 |
| Phase B2 | /home /work /learn hero scroll animation + 滑鼠尾跡 + 印章蓋下動畫 | 2-3 天 |
| Phase B3 | 後台 8 個 CRUD 編輯器(公告 / 規則 / KPI / cron / 角色 / 印章 / LINE / 知識) | 3-5 天 |
| Phase B4 | 水墨橫向捲軸 /learn(GSAP)+ 數字股票感 + 卡片浮起一致化 | 2-3 天 |
| Phase B5 | 跨時段路由 + 數字呼吸 + Logo 水墨化 + 連 7 天捲軸 | 1-2 天 |

**合計 9-15 天**(我自己跑,不依賴 Vincent)

---

## 7. 立刻動的(這個 turn)

1. ✅ 安裝 framer-motion
2. 🔄 重設計 TrainingEditor 為 master-detail two-pane(取消 modal)
3. 🔄 後台從 9 tab 平鋪 → 左側樹狀 nav + 右 main panel
4. 🔄 卡片 hover 浮起一致化 + scroll fade
5. 🔄 Demo 8 user 測試走完一遍 verify 體感

---

## 8. 紅線守(中間做事仍守)

- 紅線 1 v4:secret 不主動 print 進 chat
- 紅線 3:不可逆 schema 動作前先講
- 紅線 4:Vincent 已主動跨層授權,可直動

下個 commit 開始實作 Phase B1。
