# 📋 專案整合評估報告

**評估日期**：2026/04/23
**評估範圍**：全系統 + 與 moyu-academy 整合可行性
**評估人**：Claude Code
**評估依據**：`00_START_HERE/INTEGRATION_CHECKLIST.md` 六大面向

---

## 🎯 總體健康度

**🟡 良好但有 2 個 🔴 漏洞 + 1 個整合性決策必須做**

**一句話總結**：文件架構完整、內容品質紮實、Claude Code 工作流齊全，但 EP2/EP4 script 漏寫了真實人名（違反自訂禁用規則），且和既有 `moyu-academy` 的 DB schema 未對齊，不解決的話「新訓區域」會有兩套真理。

---

## 📊 各面向評分

| 面向 | 評分 | 備註 |
|------|------|------|
| Foundation 層 | 🟡 | 4 份齊；HeyGen Avatar ID 3 個角色全空；小美/Ray 定義了未使用 |
| HRBP 系列 | 🟡 | 16 檔齊、配色一致、剪輯對照表全有；EP2/EP4 真實人名外洩 |
| EP1 實作包 | 🟢 | 6 份齊、流程清晰、時間估算務實 |
| 原始素材 | 🟡 | 4 份齊；缺 Day 1 上午素材；真實人名集中在這裡（但屬原始檔 OK） |
| Claude Code 工作流 | 🟢 | SLASH_COMMANDS / WORKFLOW_PATTERNS / OUTPUT_RULES 三件套完整 |
| 未來擴充性 | 🟡 | 命名規則清楚；handbook.md 規範了但 0 實做；無 changelog |

---

## 🟢 已完成且品質良好

- **Layer 1-2 Foundation**：TRAINING_MASTER / HR_MODULE_SPEC / UNIT_INPUT_TEMPLATE / CLAUDE.md 四件套完整，層級關係清楚
- **HRBP 系列 EP1-4 產出**：每集都有 input / README / script / interactive.html，共 16 個檔案
- **剪輯資源對照表**：4 集都有（EP1 用 `V-01` 格式、EP2-4 用 `V2-01/V3-01/V4-01` 加集數前綴，時間碼都對得到 `04_source_materials/`）
- **視覺一致性**：4 集 interactive.html 都用 `#1E3A5F` + `#F59E0B` 主色
- **postMessage 語意一致**：`{ type: 'unit_complete', unit, score, total, passed }`（EP4 多 `series_complete`）
- **EP1 實作包**：HeyGen 申辦指南 + 角色書 + 12 段 avatar_script + 12 張圖卡 HTML + 剪輯工作單，可直接動工
- **核心方法論速查手冊**：HRBP_CORE_METHODS 跨四集心法、話術、判讀、速查表完整，黃金三句/三階段法/曖昧不清等金句都能回溯到 Vincent 原話

---

## 🔴 漏洞或錯誤（需立即修復）

### 🔴 漏洞 1：EP2 / EP4 script.md 違反真實姓名禁用規則

**位置**：
- `02_hrbp_series/EP2_HR-054/script.md` 第 15 行（剪輯對照表）、第 133 行、第 136 行：**芸蓁**
- `02_hrbp_series/EP4_HR-056/script.md` 第 14 行、第 36 行、第 94 行、第 95 行、第 98 行：**育卉** 與 **Harper**

**問題**：`05_claude_code_workflow/OUTPUT_RULES.md` 第 354-358 行明確列入禁用清單，且 `01_foundation/CLAUDE.md` 第 39 條「不可使用真實員工姓名（情境案例必須虛構）」。

**衝擊**：
1. 這些是 script.md = 影片產出的底稿，會被阿凱念出來或直接顯示在字幕
2. 員工隱私爭議（特別是「育卉拐彎回答」被當反面教材錄製）
3. 跨集風格不一致（EP1/EP3 完全沒有真名，EP2/EP4 卻放著）

**修復建議**：
- `芸蓁` → `新人 A` 或 `某位新 HRBP`
- `育卉` / `Harper` → `新人 B` / `某位受訓 HRBP`
- `Vincent` 可保留（核心人物清單允許）

### 🔴 漏洞 2：與 moyu-academy 的 DB Schema 未對齊

**位置**：整合層面，非 zip 內部檔案

**問題**：
- zip 用**檔案系統真理**：`units/HR/HR-053/input.md` + `script.md` + `interactive.html`
- `moyu-academy` 已有 DB 真理：`hr_training_days` / `hr_training_tasks` / `hr_training_progress` / `videos` 四張表、`/api/hr-training` / `/api/videos` / `/api/video-progress` 路由已存在
- **兩者沒定義對應關係** → 上線後就是兩套真理

**衝擊**：
- 新訓區域（`/training/hrbp`）要呈現內容時不知道讀哪邊
- Page 改 input.md 重跑 Claude Code → DB 不會自動同步
- 新人進度寫 DB，但 interactive.html 的 postMessage 目前是 `origin: '*'`，platform 沒接 receiver

**修復建議**（見下方「🚀 整合路徑建議」章節）

---

## 🟡 可改進但不急

### 🟡 改進 1：HeyGen Avatar ID 三個角色全空
**現況**：`TRAINING_MASTER.md` 第 92、98、104 行：阿凱 / 小美 / 主管 Ray 都是 `（待建立後填入）`
**建議**：申辦 HeyGen 後第一步就回填 MASTER；再做 `/check-consistency` 驗所有下游文件
**優先級**：P0（阻擋實作）

### 🟡 改進 2：小美 / Ray 角色 dead code
**現況**：MASTER 第 95-106 行定義了，但 HRBP 全系列（EP1-4）0 個單元使用，未來情境劇會不一致
**建議**：兩個方向擇一：
- (A) 從 MASTER 移除這兩個角色，等真的要情境劇時再加
- (B) 指定一個「必含小美/Ray」的候補單元（例如 HR-058）落實角色體系
**優先級**：P2

### 🟡 改進 3：HR_MODULE_SPEC.md 和 HR_MODULE_SPEC_UPDATED.md 分裂
**現況**：主 spec 含 HR-001~043，UPDATED 補 HR-053~056，兩份沒合併
**建議**：合併回主 spec，把 UPDATED 改名 `CHANGELOG.md` 保留 diff 紀錄
**優先級**：P1

### 🟡 改進 4：04_source_materials 缺 Day 1 上午素材
**現況**：有 `day1_afternoon_salary.md`、`day2_morning_interview.md`、`day2_morning_feedback.md`、`line_group_log.md`，但 Day 1 上午缺
**衝擊**：未來補 HR-051（公司品牌故事）/ HR-052（電訪話術基礎）時可能沒素材可引
**建議**：Page 回去翻錄音/LINE 群組補上，命名 `day1_morning_overview.md`
**優先級**：P2

### 🟡 改進 5：handbook.md 規範了但 EP1-4 全 0 實做
**現況**：`HR_MODULE_SPEC.md` 第 110-112 行要求「規章制度類單元必做手冊」，HR-053（敘薪制度）明顯屬此類卻沒 handbook
**建議**：EP1 實作階段順手產 `HR-053/handbook.md`（薪資速查表 + 三星制度表 + 階級條件），量不大
**優先級**：P1

### 🟡 改進 6：postMessage 格式 style drift
**現況**：
- EP1：多行 formatted（7 行）
- EP2、EP3：單行（一行搞定）
- EP4：單行且多 `series_complete` 欄位
**衝擊**：功能相容，但未來上平台 style 不一致，接收端可能漏接 EP4 的 `series_complete`
**建議**：4 集統一成 EP1 的多行格式，EP4 加 `series_complete` 成為選填欄位
**優先級**：P2

### 🟡 改進 7：無 changelog、無版本 bump 機制
**現況**：各檔案有 `Last Updated`，但沒有集中的 CHANGELOG.md；重大變更無紀錄
**建議**：在 `00_START_HERE/` 放 `CHANGELOG.md`，每次 `/audit` 或 `/produce-unit` 後 append
**優先級**：P2

---

## 🚀 整合路徑建議（「新訓區域」實作方案）

**前提**：新訓區域要放在 `moyu-academy`（Next.js webapp，Vercel 部署），使用者入職 14 天內看 HRBP 系列。

### 三層對齊策略

| 層 | 住哪 | 角色 |
|---|---|---|
| **內容層** | GitHub `moyu-training-system` repo（新建，放現在 zip 的內容） | 原始真理；Page 編 input.md、Claude Code 重產 script/html |
| **資料層** | Supabase 新表 `training_units` | 平台讀取真理；每次 GitHub push 觸發 sync job 更新 |
| **前端層** | `moyu-academy` 新增 `/training` 路由 | 呈現層；iframe 嵌 interactive.html、postMessage 寫回 progress |

### 新訓區域路由規劃

```
/training              ← 首頁（列 HR-053~056 + 前置 HR-051/052）
/training/hrbp         ← HRBP 系列 landing
/training/hrbp/ep1     ← EP1 播放（video + iframe interactive）
/training/hrbp/ep2     ← EP2
/training/hrbp/ep3     ← EP3
/training/hrbp/ep4     ← EP4
/training/methods      ← HRBP_CORE_METHODS.md 渲染為速查頁
/training/progress     ← 個人進度（已接 hr_training_progress）
```

### 資料層 migration

需要新 Supabase migration `supabase-migration-training-units.sql`：

```sql
CREATE TABLE IF NOT EXISTS training_units (
  id BIGSERIAL PRIMARY KEY,
  unit_code TEXT UNIQUE NOT NULL,         -- HR-053
  system TEXT NOT NULL,                    -- HR / BIZ / LEGAL
  title TEXT NOT NULL,
  audience TEXT[] NOT NULL,                -- ['HR-INT']
  priority TEXT NOT NULL,                  -- P0 / P1 / P2
  series TEXT,                             -- HRBP_RECRUIT_V1
  series_position INT,                     -- 1..4
  video_url TEXT,                          -- GCS / Drive URL
  video_duration_seconds INT,
  interactive_html_url TEXT,               -- signed URL of hosted html
  handbook_md TEXT,                        -- Markdown 原文
  prerequisite_units TEXT[],               -- ['HR-051','HR-052']
  source_hash TEXT,                        -- GitHub commit sha of input.md
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE training_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_all ON training_units FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY published_read ON training_units FOR SELECT USING (published = true);

-- Bridge to existing hr_training_progress
CREATE TABLE IF NOT EXISTS training_unit_progress (
  id BIGSERIAL PRIMARY KEY,
  trainee_email TEXT NOT NULL,
  unit_code TEXT NOT NULL REFERENCES training_units(unit_code),
  status TEXT NOT NULL CHECK (status IN ('not_started','watching','quiz_pending','passed','failed')),
  score INT,
  total INT,
  passed BOOLEAN,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trainee_email, unit_code)
);

ALTER TABLE training_unit_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_all ON training_unit_progress FOR ALL USING (auth.role() = 'service_role');
```

### 同步 pipeline（GitHub → Supabase）

1. `moyu-training-system` repo 的 `02_hrbp_series/*/input.md` 變更 → GitHub Actions trigger
2. Action 跑 `scripts/sync-to-supabase.js`：parse input.md + script.md + interactive.html → upsert `training_units`
3. 互動 html 上傳 Supabase Storage 或 Vercel 靜態檔，`interactive_html_url` 填 signed URL

### postMessage 升級

在 `moyu-academy` 新增 `/training/hrbp/[ep]/page.tsx`：

```tsx
// listen to iframe postMessage → fetch /api/training-progress POST
useEffect(() => {
  const handler = (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return;  // 🔒 改 origin 白名單
    if (e.data.type !== 'unit_complete') return;
    fetch('/api/training-progress', {
      method: 'POST',
      body: JSON.stringify(e.data),
    });
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}, []);
```

interactive.html 的 `postMessage(msg, '*')` → 改為 `postMessage(msg, window.location.origin)`（但 iframe 內拿不到 parent origin，需用 `parentOrigin` 作為 query param 注入）。

---

## 💡 建議的下一步行動

### 本週可做（P0，阻擋實作）
1. **修真實人名外洩**：EP2 script L15/L133/L136、EP4 script L14/L36/L94/L95/L98 — 10 分鐘可搞定
2. **申辦 HeyGen → 回填 Avatar ID**：阻擋所有影片產製
3. **跟 Page 決定**：`小美 / Ray` 保留或移除？（影響 HR-058+ 規劃）

### 本月可做（P1）
4. **合併 HR_MODULE_SPEC + UPDATED**：保持單一事實源
5. **產 HR-053 handbook.md**：薪資速查表 + 階級表
6. **補 Day 1 上午素材**：未來補 HR-051/052 時會需要
7. **開工 moyu-academy 新訓區域**：
   - 跑 `supabase-migration-training-units.sql`
   - 建 `/training` 路由群
   - 寫 GitHub Actions sync job

### 下一階段（P2）
8. **統一 postMessage 格式** + 加 origin 白名單
9. **建 CHANGELOG.md**
10. **HR-053~056 全部上平台 → beta 測試 3 位新人**
11. **HRBP 全系列上線後，再擴 BIZ / LEGAL 體系**

---

## 🚨 使用者原本沒注意到的風險（補充）

### 風險 1：HeyGen 額度試算

Creator 方案 $29/月，換算：
- Avatar III 不扣 credits，但 **voice rendering 時長**有限制（一般 Creator ≈ 15 min/月）
- EP1 avatar_script 12 段 × 平均 1 分鐘 = 12 分鐘
- 若產出要試錯（每段平均產 2 次）= 24 分鐘 / 月 → **第一個月極可能爆額度**
- 同時要產 EP2-4（各約 11-15 分鐘）→ 單 EP 單月產不完

**緩解**：
- 先只產 EP1（當 pilot），用慢但穩的節奏
- 或升級 Team plan（$89/月）拿 30 min
- 確認 HeyGen 目前的定價（官方頁會動，建議申辦時再對一次）

### 風險 2：真實人名除了 script，source materials 滿地都是

`04_source_materials/` 裡 Su / Harper / 育卉 / 芸蓁 / rita 出現 **超過 150 次**，是原始逐字稿本來就該有的。但這意味著：
- 如果未來 Claude Code 做 `/produce-unit HR-058`，很可能再度誤引用真名到產出
- **緩解**：在 `CLAUDE.md` 加一條「從 04_source_materials 萃取內容時，必須把所有真實姓名替換為通用稱呼」

### 風險 3：兩套系統的遷移成本沒估

如果 `moyu-academy` 現有 `hr_training_days` + `hr_training_tasks` 已經有資料在跑，新的 `training_units` 上線時要同時 backfill 既有資料，否則會有 gap。**建議**：`training_units` 設計時把既有 task_id 作為 `legacy_task_id` 可選欄位，容易對映。

### 風險 4：postMessage 接收端被劫持

目前 `postMessage(msg, '*')` 允許任何 origin 接收。如果 interactive.html 未來嵌在 iframe，有惡意頁可以竊聽測驗結果 → 員工個資（分數）外洩。**緩解**：實作時用 origin 白名單。

### 風險 5：HRBP 系列的「EP4 結尾 = 系列完結」，EP1-4 之後沒有 HR-057+ 的 pipeline

EP4 結尾用 `series_complete: true` postMessage 標示，但：
- HR_MODULE_SPEC_UPDATED 說 HR-057 已在待擴充清單，但沒 input.md 骨架
- 新 HRBP beta 看完 EP4 後要轉向什麼（實戰輔導？另一系列？）沒規劃
- **緩解**：EP4 後加「實戰輔導期」單元（可能是 HR-057 履歷判讀或面試對練），或在系列完結頁給明確下一步指引

---

## 📎 附錄 A：Checklist 勾選狀態

### 面向 1：Foundation 層

- [x] TRAINING_MASTER.md 存在且完整（🟡 Avatar ID 3 個空）
- [x] HR_MODULE_SPEC.md 存在（HR-001~043 + UPDATED HR-053~056，但未合併）
- [x] UNIT_INPUT_TEMPLATE.md 存在
- [x] CLAUDE.md 存在且清晰

### 面向 2：HRBP 系列

- [x] EP1-4 每集都有 input / README / script / interactive.html（16/16）
- [x] HRBP_CORE_METHODS.md 存在
- [x] HR_MODULE_SPEC_UPDATED.md 存在（但應合併到主 spec）
- [x] 4 集阿凱名字一致
- [x] 4 集配色一致（#1E3A5F / #F59E0B）
- [x] Vincent 時間碼全部對應得到 source（V-01~07 / V2-01~05 / V3-01~07 / V4-01~05）
- [x] postMessage 格式語意一致（style 有 drift）
- [x] EP1→EP2→EP3→EP4 預告鏈完整
- [ ] 🔴 EP2 / EP4 script 無真實人名 — **未通過**

### 面向 3：EP1 實作包

- [x] README / HeyGen 指南 / 角色書 / avatar_script / cards.html / 剪輯工作單 6 件齊
- [x] HeyGen 30 分鐘申辦流程清楚
- [x] Avatar 設定明確
- [x] 剪輯時間碼對應腳本

### 面向 4：原始素材

- [x] Day 1 下午（敘薪）
- [ ] 🟡 Day 1 上午 — **缺**
- [x] Day 2 上午前段（一面二面）
- [x] Day 2 上午後段（對練反饋）
- [x] LINE 群組 8 天紀錄
- [x] 腳本引用的 Vincent 金句都能在 source 找到
- [x] 時間碼準確

### 面向 5：Claude Code 工作流

- [x] SLASH_COMMANDS.md（13 個建議指令）
- [x] WORKFLOW_PATTERNS.md（8 個模式 SOP）
- [x] OUTPUT_RULES.md（視覺/文件/腳本/測驗四層規範）
- [x] 新人上手可直接開工

### 面向 6：擴充性

- [x] 新 HR-057 步驟清楚（/new-unit → fill input → /produce-unit）
- [x] BIZ / LEGAL module spec 有參考範本
- [x] 全系列風格改版影響範圍可評估（改 MASTER + /check-consistency）
- [x] 檔案有 Last Updated
- [ ] 🟡 無 changelog
- [ ] 🟡 無 backup 機制（未接 Git）

---

## 📎 附錄 B：整合到 moyu-academy 所需的具體檔案清單

1. **moyu-training-system/ 新 Git repo**（zip 內容 commit 進去）
2. **moyu-academy 新增**：
   - `supabase-migration-training-units.sql`（見本報告上方）
   - `src/app/training/layout.tsx`
   - `src/app/training/page.tsx`
   - `src/app/training/hrbp/page.tsx`
   - `src/app/training/hrbp/[ep]/page.tsx`
   - `src/app/training/methods/page.tsx`
   - `src/app/training/progress/page.tsx`
   - `src/app/api/training-units/route.ts`
   - `src/app/api/training-progress/route.ts`
3. **moyu-training-system/.github/workflows/sync-supabase.yml**（GitHub Actions）
4. **moyu-training-system/scripts/sync-to-supabase.js**

---

**Last Updated**：2026/04/23
**下一次評估建議時機**：EP1 成品產出後（驗證品牌一致性是否真的跑通），或 HR-057 新單元建立時（驗證擴充流程）
