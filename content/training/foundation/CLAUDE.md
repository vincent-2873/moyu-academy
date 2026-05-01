# CLAUDE.md — 訓練系統 Claude Code 執行守則(v2)

> **⚠️ 這份檔案是給 Claude Code 看的,每次啟動必讀。**
> **2026-05-01 v2 重寫**:HR 體系已砍,聚焦 BIZ + LEGAL。

---

## 🎯 你是誰、你在做什麼

你正在製作墨宇集團**業務訓練 + 法務訓練**內容。

**體系優先順序**:
1. **BIZ**(業務訓練)— 先做,對應 nSchool 真實業務訓練(訓練中心 + 課程結構 + 銷售簡報)
2. **LEGAL**(法務訓練)— BIZ 跑通後做,等 Vincent 給 spec

**HR 體系不存在**(2026-05-01 Vincent 拍板砍除)。招募流程走既有 `/recruit` daily driver,不走訓練系統。

---

## 📖 每次任務啟動必做

```
1. TRAINING_MASTER.md             最高指導原則
2. specs/{BIZ|LEGAL}_MODULE_SPEC  體系規格
3. units/{體系}/{單元代號}/input.md  當前單元輸入
4. ~/Downloads/訓練資料/_unzipped/   Vincent 既有 source(對齊鐵則)
```

**衝突 → 上層為準(Master > Spec > Input)**
**input.md 缺必填欄位 → 停下問 Vincent,不腦補**

---

## 🔒 鐵則(2026-05-01 拍板,Phase 6 前不變)

> 做每個功能都要先去找 Vincent 既有 source(`~/Downloads/訓練資料/_unzipped/`)延伸優化,不是從零 AI 生成。

### v5 違反鐵則的教訓
v5 OpenAI 從零生 28 個 nschool BIZ stub(D0-D14 14 天養成),沒參考 nSchool source → module content jsonb 空殼,跟 nSchool 真實「8 步驟開發檢核 + 4 本書 + 8 逐字」完全不對齊。已 D19 SQL DELETE 清除。

### Source 對照(BIZ 體系)

| 功能 | 必看 source | 怎麼用 |
|---|---|---|
| 訓練 module 設計 | nSchool 訓練中心 → 8 步驟開發檢核 + 4 本書(GROW/黃金圈/OKR/SPIN) | 對齊 8+4 結構,不從零生 |
| 對練 Persona | nSchool 業務開發 Call 8 個逐字稿 + 8 wav 錄音 | Vincent 真實素材對話風格 |
| 互動網頁 | nSchool 銷售簡報 v4 + 銷售工具 | 改內容不改架構 |
| 課程知識頁 | 課程結構(理財投資核心 + FI-基本面)+ 報價/金流/成交後 | 直接 RAG 化 |

---

## 🚫 絕對不可做

1. ❌ 新增 SPEC 未定義的單元主題
2. ❌ 改變角色設定(Vincent 拍板才能改)
3. ❌ 改變資料夾結構 / 檔案命名規則
4. ❌ 輸出禁用詞(見 Master Section 4)
5. ❌ 產出 SPEC 未要求的檔案類型(例如擅自做 PowerPoint)
6. ❌ 使用真實員工姓名(只允許 Vincent / Lynn / Page)
7. ❌ 猜測公司內部規章細節(input.md 沒提供就標 ⚠️ 需人工確認)
8. ❌ **從零生成內容**(違反鐵則,必須對齊 nSchool source)
9. ❌ **重蹈 HR 覆轍**:hrbp_series / HR_MODULE_SPEC / 阿凱角色設定書 / EP1-4 / public/training-quiz/HR-* 已砍,不要重建

---

## ✅ 可以自由發揮

1. ✅ 情境案例細節(禁用詞前提)
2. ✅ 互動網頁視覺(品牌調性內 — 深藍 #1E3A5F + 暖橘 #F59E0B)
3. ✅ 腳本遣詞(調性內)
4. ✅ 測驗題設計(SPEC Section 7 規範)

---

## 📦 標準產出結構

```
units/{體系}/{單元代號}/
├── input.md              (Vincent / Page 填好的輸入)
├── README.md             (學習目標 ABCD + 受眾 + 時長 + 評量)
├── script.md             (影片腳本,3-5 min 分段)
├── interactive.html      (單檔含 CSS/JS,3 題以上)
├── handbook.md           (如 SPEC 要求)
└── assets/               (素材)
```

---

## 📝 各檔規範

### `script.md` 影片腳本
- 單元基本資訊(代號 / 時長 / 角色)
- 開場 15 秒抓注意力
- 分段式:`[場景]` `[角色]` `[旁白/對白]` `[畫面建議]` `[字幕]`
- 結尾呼應或下一行動

### `interactive.html` 互動網頁
- **單檔**(CSS/JS 內嵌,不依賴 CDN)
- **無 localStorage / sessionStorage**(平台可能封鎖)
- **響應式**(手機 + 電腦)
- **無障礙**:鍵盤可操作 / 對比度足
- **3 題以上**互動(SPEC Section 7 題型)
- **結尾「完成學習」訊號**(平台追蹤)

### `handbook.md` 文件手冊
- 標準 Markdown(可轉 PDF)
- 含目錄(H2 自動)
- 規章用表格 / blockquote
- 結尾 FAQ

### `README.md` 單元說明
固定結構:
```markdown
# {單元代號} {單元名稱}

## 學習目標
- ...(ABCD 原則)

## 受眾
- ...

## 時長
- 影片 / 互動 / 文件

## 前置單元
- ...

## 評量通過標準
- 互動網頁答對 X/Y 題
```

---

## ⚠️ 不確定時

**不要自己決定。** 在輸出檔案最上方加:

```markdown
## ⚠️ 需人工確認

1. [問題 1 具體描述]
2. [問題 2 具體描述]

以下為可先完成的部分:
---
(繼續產出其他可執行內容)
```

不要因一個小問題停下整個任務。

---

## 🎨 視覺規範

```
主色   #1E3A5F  深藍
輔色   #F59E0B  暖橘
答對   #10B981
答錯   #EF4444
背景   #FFFFFF or #F9FAFB
字體   -apple-system, "Segoe UI", "Noto Sans TC", sans-serif
圓角   border-radius: 8px
陰影   box-shadow: 0 2px 8px rgba(0,0,0,0.08)
```

---

## 📋 任務完成自查清單

- [ ] 讀過 TRAINING_MASTER.md?
- [ ] 讀過對應 SPEC?
- [ ] **讀過 ~/Downloads/訓練資料/_unzipped/ 對應 source?**(鐵則)
- [ ] input.md 必填欄位齊?
- [ ] 內容是「對齊 source 延伸」還是「憑空生成」?(後者 = 違反鐵則)
- [ ] 用字違反禁用詞?
- [ ] 檔案命名符合規則?
- [ ] 學習目標符合 ABCD?
- [ ] 測驗題在 SPEC 允許題型內?

全 ✅ 才能交付。

---

## 🙋 還有問題

守則沒涵蓋的情境 → **先問 Vincent**。不要自己創先例,那會讓未來輸出失控。

---

## 版本

v2.0(2026-05-01)— HR 體系砍 + 鐵則化 + 對齊 nSchool source。
