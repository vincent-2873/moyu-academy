# LEGAL_MODULE_SPEC.md — 法務訓練體系規範(placeholder)

> Phase B-5 — 2026-05-01 placeholder
> ⚠️ **等 Vincent 給法務 source 後實做**
> 對齊鐵則「以過往資料延伸,不從零生」

---

## ⚠️ 需 Vincent 提供的輸入

LEGAL 體系尚未動工,因為 Vincent 的法務 source 還沒提供。等到提供後,本文件會比照 [BIZ_MODULE_SPEC.md](BIZ_MODULE_SPEC.md) 結構填滿。

需要的 source(若有請放 `~/Downloads/訓練資料/_unzipped/legal_*` 或類似目錄):

- [ ] 法務 N 天養成路徑(類似 nSchool 8 步驟)
- [ ] 法律邏輯推論真實案例 / 逐字
- [ ] 過去判例(各類型 — 答辯 / 回函 / 律師函 範本)
- [ ] 標準 SOP / 規章
- [ ] 法務 Notion DB(若有,接 RAG legal pillar)

---

## 預期 LEGAL 訓練體系結構(待 Vincent 拍板)

| 階段 | 預期內容 | 待輸入 |
|---|---|---|
| 0 | 法律基礎 / 公司產業背景 | Vincent 給天數 + 內容 |
| 1 | 案件類型認識(訴訟 / 非訟 / 商務) | Vincent 給類型 |
| 2 | 答辯狀 / 回函 / 律師函 起草 | Vincent 給範本 |
| 3 | 跟 Claude 對練法律推論(檢方 vs 辯方)| persona 待建 |
| 4 | 過去判例研讀 | RAG legal pillar 建好 |

---

## 對應路由(已建,placeholder)

- `/legal/training` — 前台法務訓練(目前 placeholder)
- `/legal/draft` — Claude 起草助手(目前 placeholder)
- `/legal/knowledge` — 法務 RAG 對話(走戰情官)
- `/legal/cases` — 案件中心(已實做,接 legal_cases table)

---

## 對應 RAG 知識庫

`knowledge_chunks pillar='legal'` — 目前 0 chunk(待 Vincent 開 Notion legal DB 或上傳檔案)。

**啟用條件**:
1. Vincent 開 Notion legal DB
2. 設 NOTION_LEGAL_DB_ID(rag_notion_config table)
3. 跑 `/api/admin/rag/ingest-notion?pillar=legal`

---

## 鐵則確認(每次新功能必驗)

跟 BIZ 一樣的 5 點檢查(複製 [BIZ_MODULE_SPEC.md](BIZ_MODULE_SPEC.md) §12)。

---

**v0.1 placeholder 結束**(2026-05-01)。等 Vincent 提供 source 後改寫成 v1。
