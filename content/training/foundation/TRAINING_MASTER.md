# 教育訓練體系總則(North Star v2)

> **本文件為訓練體系最高指導原則。所有模組、單元、內容產出都必須遵守。**
> **Claude Code 每次啟動任務前,必須先讀本檔與對應的 Module Spec。**
> **2026-05-01 v2 重寫**:HR 體系全砍,依 system-tree.md 走 BIZ + LEGAL 兩體系。

---

## 0. 文件層級

```
┌─────────────────────────────────────────┐
│  Layer 1: TRAINING_MASTER.md(本檔)     │  ← 最高原則,鎖住調性與架構
├─────────────────────────────────────────┤
│  Layer 2: BIZ_MODULE_SPEC.md(待建)     │  ← 業務體系規格書(Phase B 開動)
│           LEGAL_MODULE_SPEC.md(待建)   │  ← 法務體系規格書(BIZ 跑通後做)
├─────────────────────────────────────────┤
│  Layer 3: UNIT_INPUT_TEMPLATE.md         │  ← 每單元的輸入模板
└─────────────────────────────────────────┘
```

**讀取順序**:Layer 1 → Layer 2 → Layer 3,缺一不可。

---

## 1. 體系與優先順序

| # | 體系代號 | 中文 | 對象 | Source | 優先 |
|---|---|---|---|---|---|
| 1 | **BIZ** | 業務訓練 | 4 業務線員工(財經/職能/實體/未來) | nSchool 完整 Notion + XLAB AI 實驗室 | **先做** |
| 2 | **LEGAL** | 法務訓練 | 法務員 / 法務主管 | 待 Vincent 給 | 之後 |

**HR 體系不存在**(2026-05-01 Vincent 拍板,對齊 system-tree.md)。
招募流程走既有 `/recruit` daily driver(104 自動化 + Day 1-3 SOP),不走訓練系統。

---

## 2. 🔒 鐵則(2026-05-01 拍板,直到 Phase 6 完成不變)

> 做每個功能都要先去找 Vincent 提供的 source 延伸優化生成,不是從零 AI 生成。
> Vincent 的資料是有意義的。

### Source 完整位置

```
~/Downloads/訓練資料/_unzipped/nschool_part1/...   nSchool 完整 Notion(訓練中心 / 課程結構 / 銷售簡報 v4 / ...)
~/Downloads/訓練資料/_unzipped/XLAB/                XLAB AI 實驗室
~/Downloads/訓練資料/_unzipped/company_intro_part1/ 適所 HOWWORK(= 墨宇,公司介紹)
~/Downloads/訓練資料/_unzipped/block_*/            3 個超大 ExportBlock(.4GB / 2.5GB / 3.2GB,Vincent 確認後再用)
```

### 對照表(BIZ 體系)

| 功能 | 必看 source | 怎麼用 |
|---|---|---|
| 訓練 module 設計 | nSchool 訓練中心 → **8 步驟開發檢核**(破冰/信任建立/需求探索/介紹/補充/財經架構/產品引導/行動邀請)+ **4 本書**(GROW/黃金圈/OKR/SPIN) | 對齊 8+4 結構,不從零生 |
| 對練 Persona prompt | nSchool 業務開發 Call 8 個逐字稿 + 8 wav 錄音(NS_jobvexp/NS_stvexp 系列) | 對話風格參考 Vincent 真實素材 |
| 互動網頁產出 | nSchool 銷售簡報 v4 + 銷售工具 + 銷售方案 | 改內容不改架構 |
| RAG 業務 pillar 內容 | 整個 Notion ingest 進 knowledge_chunks | 業務員問答可引用真資料 |
| 課程結構 / 知識頁 | 課程結構(理財投資核心 + FI-基本面)+ 報價/金流/成交後流程 | 直接 RAG 化 |

### 教訓(2026-05-01 第五輪 Claude 違反鐵則)

v5 OpenAI 從零生 28 個 nschool BIZ stub(D0-D14 14 天養成),沒參考 nSchool source,結果:
- 跟 nSchool 真實「8 步驟 + 4 本書」結構完全不對齊
- module content jsonb 空殼
- 已 D19 SQL DELETE 清乾淨

**下個 Claude 動 Phase B 前,必須先讀完 ~/Downloads/訓練資料/_unzipped/ 整套**。

---

## 3. 內容形式規範

每個單元預設產出:

| 檔名 | 形式 | 必備? | 內容 |
|---|---|---|---|
| `script.md` | 影片腳本 | ✅ 必備 | 3-5 分鐘,分段式 `[場景]/[角色]/[畫面]/[字幕]` |
| `interactive.html` | 互動網頁 | ✅ 必備 | 單檔含 CSS/JS,3 題以上情境判斷 |
| `handbook.md` | 文件手冊 | 規章類必,軟實力選 | 標準 Markdown,可轉 PDF |
| `README.md` | 單元說明 | ✅ 必備 | 學習目標 ABCD + 受眾 + 時長 + 評量 |

**規則**:三種形式內容一致、調性一致,不可互相矛盾。
- 影片負責「感覺」
- 互動網頁負責「練習」
- 文件負責「查詢」

---

## 4. 品牌調性 / 用字規範

### 整體調性
- **專業但不死板**:像有經驗同事在帶,不是教科書
- **具體不抽象**:多用情境、案例、數字
- **簡潔不廢話**:一句能講完不用兩句

### 用字
- 稱呼員工:**「你」**(不用「您」)
- 稱呼公司:「公司」或公司名(不用「本公司」)
- 中英混用 OK,技術術語第一次出現附中文

### 禁用詞 / 禁用模式
- ❌「首先...其次...最後」教科書結構
- ❌ emoji 當項目符號(平台播放不一定支援)
- ❌ 真實員工姓名(只允許 Vincent / Lynn / Page,其他用通用稱呼)
- ❌「本課程結束」尾巴

---

## 5. 主講角色

**待 Vincent 拍板**(Phase B 開動時設定)。

舊角色「阿凱 KAI」是 HR 招募體系的虛擬人,2026-05-01 已隨 HR 體系砍除(角色設定書 + EP1-4 + 互動 quiz HTML 全砍)。

Phase B 開動前,Vincent 要決定:
- 用既有 nSchool 真實業務訓練官風格(對應 8 wav 錄音)?
- 新建虛擬人?
- 純文字旁白 + Vincent 原聲剪輯(對齊 nSchool 既有錄音)?

---

## 6. 視覺規範(訓練內容專用)

```css
/* 訓練內容用 — 跟後台 admin 視覺分流 */
--training-azure:    #1E3A5F;  /* 主色 — 深藍,專業感 */
--training-amber:    #F59E0B;  /* 輔色 — 暖橘,重點/CTA */
--training-jade:     #10B981;  /* 答對 */
--training-ruby:     #EF4444;  /* 答錯 */
--training-paper:    #FFFFFF;  /* 背景白 */
--training-mist:     #F9FAFB;  /* 背景淺灰 */
--training-radius:   8px;      /* 圓角 */
--training-shadow:   0 2px 8px rgba(0,0,0,0.08);

字體:`-apple-system, "Segoe UI", "Noto Sans TC", sans-serif`
```

(後台 admin 走墨宇侘寂朱紅老金,跟訓練內容視覺分流)

---

## 7. 檔案 / 命名規則

### 結構
```
content/training/
├── foundation/
│   ├── TRAINING_MASTER.md       (本檔)
│   ├── CLAUDE.md                (Claude Code 訓練守則)
│   └── UNIT_INPUT_TEMPLATE.md   (單元輸入模板)
├── specs/
│   ├── BIZ_MODULE_SPEC.md       (Phase B 建)
│   └── LEGAL_MODULE_SPEC.md     (BIZ 跑通後建)
├── units/
│   └── BIZ/
│       ├── BIZ-001-破冰/
│       ├── BIZ-002-信任建立/
│       └── ...
└── (其他 source 引用 ~/Downloads/訓練資料/_unzipped/)
```

### 命名
- 單元代號:`{體系}-{三位數}-{中文/英文關鍵字}`
- 檔名小寫、連字號分隔
- 大改版用 `-v2`、`-v3`

---

## 8. Claude Code 守則(防跑偏關鍵)

### 啟動流程
1. 讀本檔(TRAINING_MASTER.md)
2. 讀對應 SPEC(BIZ_MODULE_SPEC / LEGAL_MODULE_SPEC)
3. 讀單元 input.md
4. 衝突 → 上層為準(Master > Spec > Input)

### 不可自由發揮
- ❌ 新增 SPEC 未定義的單元主題
- ❌ 改變角色設定
- ❌ 改變檔案命名規則 / 資料夾結構
- ❌ 輸出禁用詞 / 禁用模式
- ❌ 產出 SPEC 未要求的檔案類型
- ❌ **從零生成內容(違反鐵則)**

### 可以自由發揮
- ✅ 情境案例細節(禁用詞前提下)
- ✅ 互動網頁視覺(品牌調性內)
- ✅ 腳本遣詞(調性內)
- ✅ 測驗題設計(SPEC Section 7 規範)

### 不確定時
1. **不自己決定**
2. 在輸出檔案最上方加 `## ⚠️ 需人工確認`
3. 列具體問題,繼續其他可執行部分

---

## 9. 版本紀錄

| 版本 | 日期 | 修改 |
|---|---|---|
| v1.0 | 2026-04-23 | 初版(Page 寫,3 體系 HR/BIZ/LEGAL,HR 先) |
| **v2.0** | **2026-05-01** | **HR 體系全砍 + 鐵則「基於 nSchool source 延伸」 + BIZ 先 LEGAL 後** |

---

## 10. 附註

本文件是活的。每次發現 Claude Code 跑偏或輸出品質不穩時,**優先修本文件**(而不是罵 AI)。規範越清楚,AI 產出越穩定。
