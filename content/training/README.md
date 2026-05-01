# content/training/

> 墨宇訓練系統素材根目錄
> **2026-05-01 v2 重寫**:HR 體系全砍,依 system-tree.md 走 BIZ + LEGAL 兩體系。

---

## 結構

```
content/training/
├── foundation/
│   ├── TRAINING_MASTER.md       訓練體系最高原則(必讀)
│   ├── CLAUDE.md                Claude Code 訓練系統守則(必讀)
│   └── UNIT_INPUT_TEMPLATE.md   單元輸入模板
└── (BIZ / LEGAL 體系內容待 Phase B 對齊 nSchool source 後生)
```

## 體系優先順序

1. **BIZ**(業務訓練)— 對齊 `~/Downloads/訓練資料/_unzipped/nschool_part1/...` 真實 source(8 步驟開發檢核 + 4 本書 + 8 逐字 + 課程結構 + 銷售簡報 v4)
2. **LEGAL**(法務訓練)— 待 Vincent 給 spec

**HR 體系 2026-05-01 全砍**(Vincent 拍板),招募流程走 `/recruit` 既有 daily driver,不走訓練系統。

## 🔒 鐵則(2026-05-01,Phase 6 前不變)

做每個功能要先看 `~/Downloads/訓練資料/_unzipped/` 既有 nSchool source 延伸,不從零生成。

詳見 `foundation/TRAINING_MASTER.md` Section 2 + `foundation/CLAUDE.md`。

## 歷史

| 版本 | 日期 | 修改 |
|---|---|---|
| v1.0 | 2026-04-23 | Page 建初版(HR / BIZ / LEGAL 三體系,HR 先,4 個 HR EP 完成) |
| **v2.0** | **2026-05-01** | **HR 體系全砍**(EP1-4 / hrbp_series / source_materials / ep1_production / workflow / public/training-quiz/HR-* / src/app/training/* / api/hr-training/* 全砍,D19 SQL DELETE v5 28 stub)。**BIZ 先 LEGAL 後 + 鐵則化** |
