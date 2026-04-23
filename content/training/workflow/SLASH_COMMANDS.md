# 🔌 建議的 Slash Commands

> **用途**：Page 可以在 Claude Code 設定以下 slash commands，快速叫用常見任務。
> **位置**：Claude Code 的 slash commands 設定位置通常在 `.claude/commands/` 或個人設定檔

---

## 🎯 快速上手

Claude Code 的 slash command 設計邏輯：
- 把常用指令封裝成快捷鍵
- 每個 command 對應一個 `.md` 檔案
- 呼叫時 Claude Code 會讀取該 md 作為任務指令

---

## 🏆 核心 Slash Commands（強烈建議建立）

### `/audit` - 整合評估

```markdown
# /audit - 整合評估訓練系統

你是訓練系統的品質守護者。當 Page 執行 /audit 時：

1. 閱讀 `00_START_HERE/INTEGRATION_CHECKLIST.md`
2. 逐項檢查清單上的每個項目
3. 產出 `00_START_HERE/reports/AUDIT_REPORT_{YYYYMMDD}.md`
4. 報告格式照 INTEGRATION_CHECKLIST.md 的範本
5. 完成後告訴 Page 找到幾個 🔴 / 🟡 / 🟢 項目,並列出最 critical 的 3 個改進點

不要直接修改任何檔案,只產出報告。
```

### `/produce-unit {UNIT_CODE}` - 產出單元

```markdown
# /produce-unit - 根據 input.md 產出單元內容

使用方式:/produce-unit HR-057

執行流程:
1. 讀 `01_foundation/TRAINING_MASTER.md` (全局規範)
2. 讀 `01_foundation/CLAUDE.md` (執行規則)
3. 讀目標單元的 input.md
4. 檢查 04_source_materials/ 有沒有相關素材
5. 按照 EP1-EP4 的範本格式產出:
   - script.md (含剪輯時間碼對照表)
   - interactive.html (含 postMessage 格式)
   - README.md (單元說明)
6. 產出後提供 Page 審閱摘要

產出檔案放在 `02_hrbp_series/{EP_CODE}/` 資料夾
```

### `/new-unit {SYSTEM} {TOPIC}` - 建立新單元

```markdown
# /new-unit - 建立新單元的 input.md 骨架

使用方式:/new-unit HR 履歷判讀技巧

執行流程:
1. 根據 SYSTEM (HR/BIZ/LEGAL) 找到對應 MODULE_SPEC.md
2. 決定新單元代號 (例:找最大的 HR-0XX 往下加)
3. 複製 `01_foundation/UNIT_INPUT_TEMPLATE.md`
4. 填入基本資訊 (代號、名稱、建議時長等)
5. 留空 Page 需要填的欄位 (學習目標、素材等)
6. 存到 `02_{SYSTEM}_series/{EP_CODE}/input.md`
7. 更新對應的 MODULE_SPEC.md 加入新單元清單
8. 告訴 Page 請他填完 input.md 後再執行 /produce-unit
```

### `/buddy` - 日常陪練夥伴

```markdown
# /buddy - 切換到陪練模式

你是 Page 的訓練系統夥伴。切換到此模式時:

1. 個性:友善、專業、不囉嗦
2. 稱呼 Page 為「Page」
3. 每次回應前先判斷:這是評估、實作、還是討論?
4. 對新功能想法不要馬上執行,先跟 Page 討論
5. 用繁體中文回應,技術詞彙可混英文
6. 產出檔案前告知 Page 檔名與位置

最重要:保持訓練系統的 consistency,不要自己擴充規範。
```

---

## 🔧 實用 Slash Commands（建議建立）

### `/check-consistency` - 檢查一致性

```markdown
# /check-consistency - 檢查跨單元一致性

檢查項目:
- 阿凱角色描述是否跨集一致
- 配色 #1E3A5F / #F59E0B 是否所有 HTML 一致
- 字體 Noto Sans TC 是否統一
- Vincent 原聲時間碼是否都能在 04_source_materials 找到
- 各集的 interactive.html postMessage 格式是否一致

產出 `CONSISTENCY_CHECK_{YYYYMMDD}.md`
```

### `/translate {EP_CODE} {LANG}` - 翻譯單元

```markdown
# /translate - 翻譯單元內容

使用方式:/translate EP1 en

執行流程:
1. 讀該單元 script.md 和 interactive.html
2. 翻譯成目標語言
3. 保留時間碼、CSS variables 不變
4. 產出 `_{LANG}` 後綴的新檔案
5. 告知 Page 哪些專有名詞沒翻 (如 HRBP)
```

### `/update-methods` - 更新核心方法論手冊

```markdown
# /update-methods - 根據最新 EP 內容更新速查手冊

當任何 EP script.md 有重大更新時執行:
1. 讀所有 EP1-EP4 的 script.md
2. 提取所有金句、心法、話術
3. 更新 `02_hrbp_series/HRBP_CORE_METHODS.md`
4. 保持原有結構不變,只更新內容
5. 新版本加上 Last Updated 日期
```

### `/export-package {TYPE}` - 打包輸出

```markdown
# /export-package - 整理輸出包

使用方式:
  /export-package all          # 全系列
  /export-package ep1          # 單集 EP1
  /export-package methods      # 只打包速查手冊
  /export-package for-trainer  # 給訓練師用的版本

執行流程:
1. 根據 TYPE 複製相關檔案
2. 整理成獨立 folder
3. 產生該包的 README.md
4. 告知 Page 檔案路徑
```

---

## 🎨 進階 Slash Commands（選擇性建立）

### `/generate-cards {EP_CODE}` - 產圖卡

```markdown
# /generate-cards - 為指定 EP 產出品牌圖卡 HTML

執行流程:
1. 讀該 EP 的 script.md
2. 找出所有 [圖卡] 標記
3. 照 EP1_cards.html 的格式產出對應的 cards.html
4. 使用全系列一致的 CSS variables
5. 存到 `03_{EP}_production/` 底下
```

### `/avatar-script {EP_CODE}` - 產 HeyGen 投稿稿

```markdown
# /avatar-script - 為指定 EP 產出 HeyGen 可直接貼的講稿

執行流程:
1. 讀該 EP 的 script.md
2. 抽出所有阿凱主講段落
3. 按 Segment 分段,標註時長建議
4. 加上語速、停頓提示
5. 產出 `{EP}_avatar_script.md` 在對應 production 資料夾
```

### `/cutting-sheet {EP_CODE}` - 產剪輯工作單

```markdown
# /cutting-sheet - 產出剪輯師工作單

執行流程:
1. 讀該 EP 的 script.md 和 avatar_script
2. 列出所有需要的素材清單
3. 產出逐分鐘 Timeline
4. 加上視覺、配樂、字幕規範
5. 產出 `{EP}_剪輯工作單.md`
```

---

## 🚀 Slash Command 設定方法

### Claude Code Slash Command 檔案結構

在專案根目錄建立：
```
.claude/
└── commands/
    ├── audit.md
    ├── produce-unit.md
    ├── new-unit.md
    ├── buddy.md
    ├── check-consistency.md
    └── ...
```

### 檔案內容範本

```markdown
---
name: audit
description: 整合評估訓練系統完整性
---

[把上面對應的 markdown 內容貼在這]
```

### 使用方式

```bash
# 在 Claude Code terminal 中
/audit
/produce-unit HR-057
/new-unit HR 履歷判讀
/translate EP1 en
```

---

## 📝 客製化指令建議

根據 Page 的習慣,你可以建立更多 slash commands:

### 你常做的事,建個 command
- 「每週一早上我都會檢查一次系統」→ `/monday-check`
- 「新 EP 完成後我會拿 HRBP_CORE_METHODS 更新」→ `/update-methods`
- 「我常需要輸出給主管看」→ `/report-to-boss`

### 風格:動詞 + 受詞
- `/audit` ✓
- `/produce` ✓
- `/translate` ✓
- `/export` ✓

### 避免太長
- `/check-system` ✓
- `/do-the-integration-evaluation` ✗

---

## 🎯 給 Page 的第一批建議 Slash Commands

**必建**:
1. `/audit` - 整合評估
2. `/produce-unit` - 產單元
3. `/buddy` - 日常夥伴

**推薦建**:
4. `/new-unit` - 新單元
5. `/check-consistency` - 一致性檢查
6. `/update-methods` - 更新手冊

**進階**:
7. `/generate-cards` - 產圖卡
8. `/avatar-script` - 產投稿稿
9. `/translate` - 翻譯

---

**Last Updated**:2026/04/23
