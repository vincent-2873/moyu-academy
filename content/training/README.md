# 📦 墨凡訓練系統 · Claude Code 整合專案包

> **專案名稱**：墨凡新人訓練系統（MOYU_TRAINING_V1）
> **目前狀態**：Foundation + HRBP 系列完成，EP1 實作中
> **下一階段**：EP1 HeyGen 產製 → 完成四集全系列 → 擴充業務/法務部門
> **Maintainer**：Page · HR @ 墨凡/X Platform

---

## 🚀 給 Claude Code 的第一眼

如果你是第一次接觸這個專案，**請先讀**：

```
1️⃣  00_START_HERE/CLAUDE_CODE_INSTRUCTIONS.md     ← 從這裡開始
2️⃣  00_START_HERE/PROJECT_OVERVIEW.md             ← 專案全貌
3️⃣  01_foundation/CLAUDE.md                       ← 你的 SOP
```

讀完這三份你就知道要做什麼了。

---

## 📂 完整資料夾結構

```
moyu_training_system/
│
├── 🚀 00_START_HERE/                  (Claude Code 起點)
│   ├── CLAUDE_CODE_INSTRUCTIONS.md
│   ├── PROJECT_OVERVIEW.md
│   ├── INTEGRATION_CHECKLIST.md
│   └── NEXT_STEPS.md
│
├── 📘 01_foundation/                  (Layer 1-2 北極星)
│   ├── TRAINING_MASTER.md             (全局規範)
│   ├── HR_MODULE_SPEC.md              (HR 單元地圖)
│   ├── UNIT_INPUT_TEMPLATE.md         (單元模板)
│   └── CLAUDE.md                      (執行規則)
│
├── 📗 02_hrbp_series/                 (完成的 HRBP 系列)
│   ├── README.md
│   ├── HRBP_CORE_METHODS.md           (速查手冊)
│   ├── HR_MODULE_SPEC_UPDATED.md
│   ├── EP1_HR-053/                    (業務敘薪制度)
│   │   ├── input.md
│   │   ├── README.md
│   │   ├── script.md
│   │   └── interactive.html
│   ├── EP2_HR-054/                    (一面 vs 二面)
│   ├── EP3_HR-055/                    (三階段回覆法)
│   └── EP4_HR-056/                    (致命提問應對)
│
├── 📕 03_ep1_production/              (EP1 實作工具)
│   ├── README.md
│   ├── HeyGen_申辦指南.md
│   ├── 阿凱角色設定書.md
│   ├── EP1_avatar_script.md
│   ├── EP1_cards.html
│   └── EP1_剪輯工作單.md
│
├── 📚 04_source_materials/            (原始素材·聖經)
│   ├── README.md
│   ├── day1_afternoon_salary.md
│   ├── day2_morning_interview.md
│   ├── day2_morning_feedback.md
│   └── line_group_log.md
│
└── 🛠️ 05_claude_code_workflow/        (Claude Code 工作流)
    ├── SLASH_COMMANDS.md              (建議 slash commands)
    ├── WORKFLOW_PATTERNS.md           (工作模式)
    └── OUTPUT_RULES.md                (產出規則)
```

---

## 🎯 給 Page 的快速上手

### 把這包丟給 Claude Code 後，你可以說：

**第一次互動**：
```
請讀 00_START_HERE/CLAUDE_CODE_INSTRUCTIONS.md 然後告訴我你理解了什麼
```

**整合評估**：
```
請執行整合評估，照 00_START_HERE/INTEGRATION_CHECKLIST.md 的項目檢查
```

**開始執行 EP1**：
```
我已經申辦好 HeyGen，幫我看看 03_ep1_production/ 然後告訴我下一步怎麼做
```

**擴充新單元**：
```
根據 04_source_materials/line_group_log.md 裡 Day 3 的內容，
幫我建立 HR-057 的 input.md 骨架
```

---

## 🧭 資料夾用途對照表

| 如果你想... | 去這裡 |
|-------------|--------|
| 看整體狀況 | `00_START_HERE/` |
| 改系統規範 | `01_foundation/` |
| 看現有產出 | `02_hrbp_series/` |
| 做 EP1 影片 | `03_ep1_production/` |
| 查 Vincent 原話 | `04_source_materials/` |
| 學 Claude Code 怎麼用 | `05_claude_code_workflow/` |

---

## 📊 完成度快照

```
整體進度：████████░░ 70%

├── Foundation (Layer 1-2)  ████████████ 100% ✅
├── HRBP 系列產出            ████████████ 100% ✅
│   ├── 腳本                  ████████████ 100% ✅
│   ├── 互動測驗              ████████████ 100% ✅
│   └── 影片實作              ████░░░░░░░░  30% 🟡 (EP1 進行中)
├── EP1 實作工具包            ████████████ 100% ✅
├── 原始素材建檔             ██████████░░  85% 🟡 (Day 1 需補完整版)
├── Claude Code 工作流       ████████████ 100% ✅
└── 擴充（業務/法務）         ░░░░░░░░░░░░   0% ⬜
```

---

## 🎬 建議第一個動作（給 Claude Code）

把這包丟給 Claude Code 後，建議 Page 這樣開場：

```
Page: 這是我的訓練系統專案包。你先做整合評估,
      照 00_START_HERE/INTEGRATION_CHECKLIST.md 檢查一遍,
      然後告訴我:
      1. 系統目前哪裡最完整、哪裡最需要補強
      2. 我下一步應該做什麼
      3. 有沒有什麼風險我沒注意到

      評估完再做其他事,不要自己先動手改。
```

這個開場會讓 Claude Code：
- ✅ 先了解全貌再行動（符合紀律）
- ✅ 產出具體報告（而不是空泛回答）
- ✅ 給你掌控權（讓你決定優先級）

---

## 🔑 核心設計哲學

這套系統遵循三個原則：

### 1. Spec-Driven, Not Ad-Hoc
所有產出都來自明確的規格檔，不是靈光一閃。**規格變 → 產出重跑**，可控可重複。

### 2. Atomic Units, Coherent Series
每個單元獨立可用，但組成系列有連貫性。**壞一個不影響其他**。

### 3. Human in the Loop, AI as Accelerator
Claude Code 是 Page 的**參謀**，不是自動駕駛。關鍵決策 Page 來，執行細節 AI 來。

---

## 📞 需要協助？

**文件已涵蓋的問題**：看對應資料夾的 README.md

**文件沒涵蓋的問題**：叫 Claude Code 幫你查 + 建議解法

**專案長期維護**：定期執行 `/audit` 檢查完整性

---

## 📝 授權與版本

- **專案授權**：公司內部使用
- **原始素材**：僅供內部訓練，不對外公開
- **產出影片**：可用於員工訓練、招募說明等用途
- **AI 生成內容**：阿凱（KAI）虛擬人是公司內部訓練角色

---

**Last Updated**：2026/04/23
**Version**：1.0（初始完整包）
**Next Milestone**：EP1 影片上線 → v1.1
