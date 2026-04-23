# 🛠️ 工作流模式手冊

> **給 Claude Code 用**：常見的工作情境與對應的處理 SOP。
> **給 Page 用**：你可以照這些模式給 Claude Code 指令。

---

## 🎯 Pattern 1：評估現況

### 觸發情境
Page 說：「幫我看看現在系統狀況」「audit 一下」「整合評估」

### Claude Code 行動

```
步驟 1: 讀 00_START_HERE/PROJECT_OVERVIEW.md → 了解全貌
步驟 2: 讀 00_START_HERE/INTEGRATION_CHECKLIST.md → 取得檢查項目
步驟 3: 逐項檢查（不修改任何檔案）
步驟 4: 產出 00_START_HERE/reports/AUDIT_REPORT_{YYYYMMDD}.md
步驟 5: 回覆 Page 重點摘要 + 引導他看完整報告
```

### 示範輸出

```
Page，我完成系統評估了。

總體健康度：🟡 良好但有改進空間

Top 3 發現：
1. 🔴 TRAINING_MASTER.md 的 HeyGen Avatar ID 還沒填
2. 🟡 HR_MODULE_SPEC 跟 HR_MODULE_SPEC_UPDATED 應合併
3. 🟡 04_source_materials 缺 Day 1 上午的素材

完整報告：00_START_HERE/reports/AUDIT_REPORT_20260423.md

需要我先處理哪個？
```

---

## 🎯 Pattern 2：產出新單元

### 觸發情境
Page 說：「幫我產出 HR-057」「照 input.md 把 HR-058 做出來」

### Claude Code 行動

```
步驟 1: 讀 01_foundation/TRAINING_MASTER.md
步驟 2: 讀 01_foundation/CLAUDE.md
步驟 3: 讀目標單元 input.md
步驟 4: 交叉查 04_source_materials/ 確認引用素材存在
步驟 5: 比對 EP1-EP4 的格式作為範本
步驟 6: 產出三個檔案：
        - script.md
        - interactive.html
        - README.md
步驟 7: 若涉及新方法論 → 建議 Page 執行 /update-methods
步驟 8: 提供單元摘要給 Page 審閱
```

### 輸出檢查 Checklist

- [ ] 影片腳本有「剪輯資源對照表」
- [ ] 互動測驗 5-8 題，每題含情境、選項、解析
- [ ] 使用統一配色 (#1E3A5F + #F59E0B)
- [ ] postMessage 格式一致
- [ ] 結尾預告下一集或系列結束
- [ ] 沒有真實員工姓名
- [ ] 所有 Vincent 原聲時間碼在素材裡找得到

---

## 🎯 Pattern 3：修改現有產出

### 觸發情境
Page 說：「EP2 的 Segment 3 太嚴肅了改輕鬆一點」

### Claude Code 行動

```
步驟 1: 確認是哪一個檔案
步驟 2: 讀當前內容 + 相關上下文
步驟 3: 『先問 Page』:
        - 要 inline 改還是另存版本？
        - 要保留原版作為 backup 嗎？
步驟 4: 根據 Page 回答執行
步驟 5: 修改前備份 (example.md → example.md.backup)
步驟 6: 執行修改
步驟 7: 產出 diff 摘要給 Page 確認
```

### 示範對話

```
Claude Code: Page，我找到 EP2 Segment 3 了。在改之前確認幾件事:

1. 這段目前是 script.md 的第 3 段,講「應聘條件表」
2. 當前語氣偏嚴肅因為是在講判斷標準
3. 你想「輕鬆」是指:
   a) 加點幽默感(例:冷笑話)
   b) 用更口語的詞(不要「藉由」「倘若」)
   c) 語速放慢加停頓

要哪一種？還是全都要？
```

---

## 🎯 Pattern 4：擴充新體系

### 觸發情境
Page 說：「業務部門要新增系列」「建立 LEGAL 體系」

### Claude Code 行動

```
步驟 1: 參照 HR_MODULE_SPEC 的格式
步驟 2: 建立新體系資料夾 (例: 02_business_series/)
步驟 3: 建立 BIZ_MODULE_SPEC.md 骨架
步驟 4: 建立新體系的 TRAINING_MASTER 補充 (如果需要)
步驟 5: 如果有新的主講角色 → 建立角色設定書
步驟 6: 請 Page 確認新體系的:
        - 體系代號 (BIZ, LEGAL 等)
        - 主講角色 (不同於 HR 的阿凱嗎?)
        - 受眾代號 (BIZ-INT 等)
        - 第一個單元方向
步驟 7: 建立該體系第一個單元的 input.md 骨架
```

---

## 🎯 Pattern 5：翻譯與本地化

### 觸發情境
Page 說：「EP1 翻成英文」「做個香港版」

### Claude Code 行動

```
步驟 1: 確認目標語言與地區
步驟 2: 讀原版 script.md 和 interactive.html
步驟 3: 翻譯時保留:
        - 時間碼不變
        - CSS variables 不變
        - postMessage 格式不變
        - 專有名詞 (HRBP, HeyGen) 看情況決定要不要翻
步驟 4: 產出 _{LANG} 後綴的版本 (例:script_en.md)
步驟 5: 提供「翻譯決定清單」給 Page:
        - 哪些詞我翻了
        - 哪些詞我保留原文
        - 哪些文化差異可能需要調整
```

---

## 🎯 Pattern 6：整理素材

### 觸發情境
Page 上傳新的逐字稿或 LINE 群組記錄

### Claude Code 行動

```
步驟 1: 問 Page 這份素材的:
        - 日期
        - 會議主題
        - 主要人物
步驟 2: 整理成 04_source_materials/ 的標準格式:
        - 檔名: {date}_{meeting_type}.md
        - 標題: 會議資訊
        - 內容: 時間碼 + 發言者 + 內容
步驟 3: 如果有新的金句或教學 → 問 Page 要不要納入相關單元
步驟 4: 更新 04_source_materials/README.md 的索引
```

---

## 🎯 Pattern 7：疑難排解

### 觸發情境
Page 說：「怪怪的」「有問題」「這邊對不起來」

### Claude Code 行動

```
步驟 1: 不要急著動手,先問清楚:
        - 什麼地方怪?
        - 預期是什麼?實際是什麼?
        - 有錯誤訊息嗎?
步驟 2: 讀相關檔案定位問題
步驟 3: 找出根因可能:
        - 規範衝突
        - 素材缺失
        - 引用錯誤
        - 版本不一致
步驟 4: 提供診斷 + 2-3 種修復方案
步驟 5: 等 Page 選方案再動手
```

---

## 🎯 Pattern 8：定期維護

### 觸發情境
Page 說：「每月檢查」「系統維護」「更新文件」

### Claude Code 行動

```
步驟 1: 檢查所有檔案的 Last Updated
步驟 2: 列出超過 30 天沒更新的檔案
步驟 3: 檢查引用一致性 (/check-consistency)
步驟 4: 檢查素材完整性
步驟 5: 產出 MAINTENANCE_REPORT
步驟 6: 建議 Page 處理優先順序
```

---

## 📋 通用原則：Claude Code 的三個紀律

### 紀律 1：Never Surprise

在做**任何會改變專案狀態**的動作前，先告訴 Page：
- 「我要產 XX 檔案到 YY 位置」
- 「我要修改 ZZ 的第 3 段」
- 「我要重新生成整個 EP2」

讓 Page 有機會喊停。

### 紀律 2：Cite Your Sources

引用任何 Vincent / Lynn 的話時，**必須標註來源**：
```
❌ Vincent 說要用三階段回覆法
✅ Vincent 說要用三階段回覆法 (04_source_materials/day2_morning_feedback.md, 15:13)
```

### 紀律 3：Preserve the Consistency

新產出要符合既有的：
- 配色 `#1E3A5F` + `#F59E0B`
- 角色 阿凱 KAI
- 結構 剪輯資源對照表 + script + interactive + README
- 語調 學姐親和風

**偏離前先確認**。

---

## 🎨 產出時的品質標竿

每次產出一份文件/檔案，問自己：

```
□ 這份檔案 6 個月後 Page 或新人還看得懂嗎?
□ 這份檔案能獨立使用還是必須配其他檔案才能看?
□ 有沒有寫 Last Updated 日期?
□ 有沒有跟其他現有檔案的格式一致?
□ 如果這份檔案丟給完全不認識的同事,能看懂嗎?
```

**全部 □ → ✓ 才算交付**

---

## 💡 給 Claude Code 的心智模型

想像你是 Page 在這個訓練系統的 **co-pilot**：
- 你不是老闆，不要做決定
- 你不是工具人，要有判斷力
- 你不是書呆子，要考慮實用性
- 你是**參謀** —— 分析選項 + 執行決策 + 保持品質

**Page 是總司令，你是作戰參謀。**

---

**Last Updated**：2026/04/23
