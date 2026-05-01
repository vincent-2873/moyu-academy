# BIZ_MODULE_SPEC.md — 業務訓練體系規範

> Phase B-5 — 2026-05-01 初版
> 基於 Vincent 既有 nSchool source 抽出(對齊鐵則「以過往資料延伸,不從零生」)
> Source 主目錄:`content/training/sales/nschool/.../nSchool 財經學院-v 2/`

---

## 🔒 鐵則

> **每一個 BIZ module 都從 nSchool source 既有內容延伸,不從零 AI 生成。**
> Vincent 拍板(2026-05-01),Phase 6 完成前不變。

---

## 1. 體系定位

**業務訓練體系(BIZ)** = nSchool 財經學院 + 4 本書方法論 + 8 通業務開發 Call 逐字稿

對齊:
- D2 SQL seed:`business_default` path + 21 個 D2 既有 module
- D20 SQL applied:UPDATE 21 個 sparring framework 對齊 nSchool 真實 8 步驟,INSERT 4 本書 reading module(共 **25 個 BIZ module**)
- system-tree v2:後台 `/admin/training-ops`(教材管理)+ 前台 `/sales/training`(我的訓練)

---

## 2. 訓練週期

| 階段 | 天數 | 描述 | 對應 D2 module |
|---|---|---|---|
| D0 報到 | Day 0 | 合約 / 集團 / 業務制度 / 聽 5 份開發 Call / 兩兩對練(20:00+) | `report` / `intro` / 8 audio source_refs |
| D1-2 顧問式開發 | Day 1-2 | nSchool 8 步驟逐字稿對練 ≥ 3 次 + 4 本書方法論 | sparring framework(D20 改成 nSchool 真實)+ 4 本書 reading module |
| D3-4 邀約嘗試 | Day 3-4 | Pass 給學長帶 | demo 邀約對練 |
| D5 Demo 教學 | Day 5 | 看 Demo 流程示範 | demo video |
| D6 第一單 | Day 6 | 進入實戰 | first_close |
| D7 一週驗收 | Day 7 | KPI 漏斗檢核 | week_review |
| D8-13 量質提升 | Day 8-13 | 單量提升 + 質感優化 | optimization |
| D14 出師驗收 | Day 14 | KPI 漏斗目標達標 + 質感檢驗 | graduation |

---

## 3. nSchool 真實 8 步驟(D1-D2 sparring framework 對齊)

**Source path**:`content/training/sales/nschool/.../Categories/訓練中心/開發檢核/`

**D20 SQL applied 後 sparring framework**(對齊 prod DB):
```json
["破冰","信任建立","需求探索","介紹nSchool","補充資訊","財經架構","產品引導與價值說明","行動邀請"]
```

每步驟對應 source(訓練生點 module 詳細頁會看到):

### 步驟 1:破冰
- **Source**:[破冰.md](../sales/nschool/私人和共用/nSchool%20財經學院-v%202/Categories/訓練中心/開發檢核/破冰%202b5b581c6726813191bbce3cb03ea37a.md)
- **目標**:快速建立信任,讓客戶感覺親切且有興趣繼續對話
- **核心話術**:「您好!我是XXX,看到您我們IG財富密碼看到你想了解台股基本面、技術面、籌碼面、ETF和基金,你是對哪個領域有興趣阿?」
- **行為心理**:破冰/開發 → 認同/附和 → 引入相關性建立共鳴 → 開放性問題

### 步驟 2:信任建立
- **Source**:[信任建立.md](../sales/nschool/私人和共用/nSchool%20財經學院-v%202/Categories/訓練中心/開發檢核/信任建立%202b5b581c672681878f0befaeeff728b9.md)
- **目標**:用數據、案例、同理心消除課程抗拒
- **核心**:第三人視角(你/我/他)+ 複利效應(10萬投30年到174萬)
- **應注意**:用「我學員」「我朋友」「我家人」第三方說詞,避免主觀

### 步驟 3:需求探索
- **Source**:[需求探索.md](../sales/nschool/私人和共用/nSchool%20財經學院-v%202/Categories/訓練中心/開發檢核/需求探索%202b5b581c6726811b9553e6e1789a8643.md)
- **目標**:了解客戶投資狀況 + 痛點挖掘
- **三面向**:基本面(毛利率/ROE/營收)/ 技術面(K線/均線/RSI)/ 籌碼面(法人/主力)
- **痛點問句**:「有沒有遇到過買進後股價下跌但不知道原因?」「有沒有買高後被套?」

### 步驟 4:介紹nSchool
- **Source**:[介紹nSchool.md](../sales/nschool/私人和共用/nSchool%20財經學院-v%202/Categories/訓練中心/開發檢核/介紹nSchool%202b5b581c672681018e29f2793e980d2d.md)
- **目標**:介紹差異化優勢
- **核心**:「凱衛資訊上市櫃股票代碼 5201 + nStock/Cmoney 同集團 + 20-30 年金融軟硬體 + 教育社會責任」
- **轉折**:不是門外漢 → 痛點放大(網路報明牌詐騙)→ 差異化優勢(分析師團隊 + APP 實戰)

### 步驟 5:補充資訊
- **Source**:[補充資訊.md](../sales/nschool/私人和共用/nSchool%20財經學院-v%202/Categories/訓練中心/開發檢核/補充資訊%202b5b581c6726810e8243e2854379db2e.md)
- **目標**:新人開發必蒐集 2 重點(需求 + 預算)
- **應注意**:別太早介紹「我是誰」,先建立信任
- **架構**:起承轉合(起=破冰 / 承=蒐集信任 / 轉=介紹自己 / 合=收斂回投資學習邀約)

### 步驟 6:財經架構
- **Source**:[財經架構.md](../sales/nschool/私人和共用/nSchool%20財經學院-v%202/Categories/訓練中心/開發檢核/財經架構%202b5b581c672681c8b582f50e2e0207f0.md)
- **目標**:迷你財商課教學
- **三段教學**:
  1. 盈虧不對稱(賺10賠10的時間成本)
  2. 時間複利演算滾雪球
  3. 基本/技術/籌碼面分析切入
- **流程**(mermaid):通話開始 → 開場 → 需求背景 → 教學 → 公司背書 → 行動呼籲 → 鎖時段 → 加 LINE → 會前作業

### 步驟 7:產品引導與價值說明
- **Source**:[產品引導與價值說明.md](../sales/nschool/私人和共用/nSchool%20財經學院-v%202/Categories/訓練中心/開發檢核/產品引導與價值說明%202b5b581c672681e68479d891d2285a9e.md)
- **目標**:闡述課程價值,降低費用抗拒
- **三大論述**:
  1. **客製化** vs HAHOW / 知識衛星 整包(我們只給你需要的)
  2. **財經教練團隊** — 凱衛 4-5 位分析師即時解惑
  3. **學習成本論** — 投資資金的 5%-10%(投 5 萬,投 5 千學習)

### 步驟 8:行動邀請
- **Source**:[行動邀請.md](../sales/nschool/私人和共用/nSchool%20財經學院-v%202/Categories/訓練中心/開發檢核/行動邀請%202b5b581c67268187907cdc441b84f121.md)
- **目標**:邀約 30 分鐘免費試聽
- **2 選 1 漏斗**:明天 / 後天 → 早 / 中 / 下午 / 晚 → 具體時段
- **加 LINE SOP**:搜尋 `@5201nschool`,傳貼圖確認
- **CTA 結尾**:「我等等會先傳些資訊給你,你可以幫我在看一下,那我們就 XX/XX XX:XX 見囉!」

---

## 4. 4 本書 reading module(D20 INSERT)

D20 SQL apply 後,Day 1-2 加 4 個 reading module:

| Day | seq | Book | 對應 nSchool 應用 |
|---|---|---|---|
| 1 | 10 | **GROW** 模型 | 步驟 3 需求探索的目標設定(Goal/Reality/Options/Will)|
| 1 | 11 | **黃金圈** | 步驟 4 介紹 nSchool 的 Why(社會責任)→ How(20-30 年經驗)→ What(課程 + 教練)|
| 2 | 10 | **OKR** | KPI 漏斗拆解(撥通 → 通次 → 邀約 → 出席 → 成交)|
| 2 | 11 | **SPIN** | 步驟 3 需求探索 4 階段提問(Situation / Problem / Implication / Need-Payoff)|

---

## 5. 8 個業務開發 Call 逐字稿(persona / 評估 source)

**用途**:
- AI 對練 persona(`/sales/practice`)— 基於真實逐字稿建 persona
- Whisper 評估 — 三點(順暢 / 邏輯 / 語氣)+ 8 步驟架構命中率

**Source**:`content/training/sales/nschool/.../成交開發Demo 錄音 影檔.md`(audio_source_refs 對應 8 個 wav)

**訓練官 Yu 三點評估準則**:
1. 順暢性 — 對話流暢度、卡頓、停頓
2. 邏輯性 — 是否依架構順序走(別跳步)
3. 語氣語調 — 不生硬、不急躁、邊講邊笑

**KPI 漏斗**(Yu 反覆強調):
撥多少通 → 通次 → 通時 → 邀約 → 出席 → 成交

---

## 6. 視覺氛圍

對齊 system-tree v2 §視覺氛圍對照:

| 工作區 | 氛圍 | 顏色 |
|---|---|---|
| 前台 `/sales/*` | 熱血競技 HUD | 深炭+米白(主) |
| 訓練內容(`/sales/training` `/sales/module/[id]`) | 訓練營有溫度 | **深藍 #1E3A5F + 暖橘 #F59E0B**(對齊 TRAINING_MASTER v2) |
| 後台 `/admin/training-ops` | 教育平台 | 米白+暖光 |

---

## 7. Speaker 主講設定

❌ 已砍:阿凱 KAI(原 HR 系列主講,Phase A 補刀砍除)
🟡 BIZ 體系主講:**待 Vincent 拍板**(預期沿用 Vincent / Yu / 訓練官 / 阿凱 之中一位)

當 Vincent 拍板後,寫進此文件 + 對應到 `roleplay_personas` table。

---

## 8. 對應 admin/training-ops 教材管理

`/admin/training-ops/materials` 後台介面:
- **Path 完整度**:business_default 預期 25 個 module,目前實際 25 個 ✅
- **缺哪個 module(Claude 偵測)**:對齊 nSchool 8 步驟必備 + 4 本書,缺的列出
- **Claude 自動生成草稿**:`/api/admin/training/generate-draft` 必須引用 nSchool source(從 RAG knowledge_chunks pillar='sales' 撈相關 chunk 帶進 prompt)
- **一鍵採用** → INSERT 進 training_modules

---

## 9. 對應 prod 路由

| 路徑 | 對應規範 |
|---|---|
| `/sales/training` | 列 D2 25 個 module(group by day_offset) |
| `/sales/module/[id]` | 顯示 module 詳細(framework / source_refs / book / audio_source_refs) |
| `/sales/practice` | 對練 persona(基於 8 個逐字稿建 persona) |
| `/sales/knowledge` | 戰情官引用 nSchool RAG pillar='sales' |
| `/admin/training-ops/students` | 訓練生戰況板(D0-D14 進度分布) |
| `/admin/training-ops/attention` | 緊急介入清單 |
| `/admin/training-ops/materials` | 教材管理(business_default path 完整度) |
| `/admin/training-ops/report` | 成效報告 |

---

## 10. RAG 知識庫(business pillar)

**knowledge_chunks pillar='sales'**:
- nSchool 60 .md 已 ingest(RAG Bootstrap #9,54 chunks)
- XLAB AI 實驗室 61 .md 已 ingest(RAG Bootstrap #11,~62 chunks)
- 適所 HOWWORK 1 .md 已 ingest

**戰情官 prompt(`src/app/api/claude-panel/chat/route.ts`)** — Phase B-4 已對齊:
- nSchool 真實 8 步驟(取代 X-LAB 8 步)
- 4 本書方法論(GROW / SPIN / 黃金圈 / OKR)
- Vincent 8 句口頭禪(從 LINE 群抽)

---

## 11. 後續迭代

| 項目 | 待動作 | 屬於 |
|---|---|---|
| Speaker 拍板 | Vincent 給 | Phase B-5 |
| 8 個逐字稿建 persona | 用 OpenAI 從逐字抽 persona,INSERT roleplay_personas | Phase B-6 |
| LEGAL_MODULE_SPEC.md | 等 Vincent 給法務 source | Phase B-5 後續 |
| 跨域對練(8 個逐字 → 互動劇本)| 自動產 sparring 互動 HTML | Phase 5 |
| Module 影片 video_url | 上 YouTube unlisted + 填 DB | 等 Vincent 上片 |

---

## 12. 鐵則確認(每次新功能必驗)

- [ ] 該功能對應到 nSchool / XLAB / 適所 source path 嗎?
- [ ] 從 source 抽精華 / 改寫,**沒從零 AI 腦補**?
- [ ] 對應 D2 / D20 schema(business_default path)?
- [ ] 視覺對齊深藍+暖橘?
- [ ] RAG ingest 已涵蓋(pillar='sales')?

---

**v1 結束**(2026-05-01)。基於 nSchool 60 .md 真實 source 整理。下次更新時機:Vincent 拍板 Speaker / 補新 source / Phase B-6 之後。
