# UI Dashboard ROADMAP

> 2026-04-30 第四輪 Claude 寫,給 Vincent 跟下一個 Claude 看。
> 這是「我替 Vincent 做的判斷」+「待 Vincent 拍板再 implement」的文件。
> 5 件關鍵事 — 我給每件一個**建議答案**,Vincent 拍板後直接照這個 implement。

---

## 1️⃣ 業績用哪個欄位?

Metabase 提供 3 個業績欄位:

| 欄位 | 含義 | 適合場景 |
|---|---|---|
| `分潤承攬業績` (gross_revenue) | raw,含手續費前 | 看「業務刷的金額」原始量 |
| `按日期分潤淨承攬業績` (net_revenue_daily) | 扣手續費,以**業績發生日**算 | 業務員月薪 / 即時績效 |
| `按合約分潤淨承攬業績` (net_revenue_contract) | 扣手續費,以**合約起算日**算 | 對齊財報 / 高階主管看 |

**我的判斷:主業績用「分潤承攬業績」(gross_revenue)**

理由:
- 業務員自己看「我刷了多少」最直觀(他不關心手續費怎麼算)
- 連假/退費差異小於 10%(從 4/1-4/10 backfill 看,退費 row 都是 0)
- 兩個 net_revenue 欄位放展開細項,給主管看「真正進帳」用

**個人前台用 gross_revenue 顯示主業績,旁邊小字標 net 兩個欄位**(可點開看)。

---

## 2️⃣ 成交數用哪個欄位?

| 欄位 | 含義 |
|---|---|
| `分潤成交數` (closures) | raw,可能小數 0.3/0.7/1(0.3=開發 / 0.7=demo+結單 / 1=全包) |
| `按日期分潤淨成交數` (net_closures_daily) | 整數,扣退件 |
| `按合約分潤淨成交數` (net_closures_contract) | 整數,合約起算扣退件 |

**我的判斷:主成交用「分潤成交數」(closures, 含小數)**

理由:
- 0.3 / 0.7 / 1 反映業務員的**實際貢獻**(誰開發 vs 誰結單)
- 整數版本掩蓋了「我貢獻了 0.7 的功勞」,對業務員不公平
- 但**「成交件數」UI 顯示**用四捨五入到 1 位小數(`3.7 件` 比 `3.66666` 易讀)

**展開細項顯示**:
- 「淨成交數」整數版(對齊財報 / 退件率計算)
- 「按合約淨成交」(高階主管 KPI)

---

## 3️⃣ 個人前台 vs 主管後台 metric 一致嗎?

**我的判斷:核心 metric 一致,主管後台多看「該關注員工 alert」+ 群組對比**

### 個人前台(`/me` `/work` `/home`)

| widget | 顯示 |
|---|---|
| DailyFocus | 今日 calls / appts / closures / revenue + 對 baseline 達成率 |
| 個人雷達 | 7 天 + 30 天累計 vs target |
| 30 天逐日趨勢線 | 自己看自己節奏(新建議) |
| 個人轉換漏斗 | calls→appts→demos→closures + 各階段 % (新建議) |
| 同 brand 同 level 排名 | 「我在新人 nschool 排第 3」(新建議) |

### 主管後台(`/admin → CompanyDeepDive`)

| widget | 顯示 |
|---|---|
| 公司 KPI | 全公司本月 calls / appts / closures / revenue |
| per brand 業績比較 | 5 brand bar chart |
| Top10 / Bottom10 員工 | 篩選 brand / team / period (新建議) |
| 該關注員工 alert | 突然消失 / 量到質沒到 / 收網問題 (新建議) |
| 全公司轉換漏斗 + per brand 對比 | 看 brand 間落差 (新建議) |
| 連假 vs 工作日 | 加班員工 / 連假休息率 (新建議) |

**員工自己跟主管看員工的 KPI metric 一致**(calls / appts / closures / revenue / 達成率),只是主管多了「跨員工對比」+ alert 視角。

---

## 4️⃣ 連假天怎麼處理?

**我的判斷:選項 (b) — 連假 row 標記 + 不從日均剔除**

理由:
- (a) 連假跟工作日一樣顯示 → 看不出 4/3-4/6 為何只有 26 通,**誤判業務懶**
- (b) 連假 row 標記出來(灰色背景 + 小字「連假」)→ **直觀但仍計算進日均**
- (c) 從日均剔除 → 失真(部分業務員連假還是有 demo / 成交,這些會被忽略)

**選 (b) 折中**:
- UI 端 dashboard widget render 連假 row 用灰色背景 + 「連假/週六」小字標記
- 數字仍計入日均(因為 4/3 確實有 17 員工/26 通,這是事實)
- 提供切換「只看工作日」filter 給主管(剔除連假計算純工作日 baseline)

**台灣連假判斷**:hardcode 一個 holidays.ts 列出 2026 國定假日(清明 4/3-4/6 / 端午 / 中秋 / 過年 / 國慶 / 元旦)+ 自動算週六週日。

---

## 5️⃣ 「該關注員工」判斷規則

handoff Part 5 寫的 baseline:
- 突然消失:`active_days_7d ≤ 1 + week_calls > 0`
- 量到質沒到:`calls ≥ 210 + closures = 0`
- 收網問題:`appts > 5 + closures = 0`

**我的判斷:基本 OK,但 baseline 數字要可調(不要 hardcode)**

理由:
- 業務 target 因 brand 而異(nschool 財經電話量大、xlab 實體電話量小)
- 業務 level 也影響(新人 baseline 80 通/日 vs 老將 100+ 通/日)

### 改成讀 `sales_metrics_targets` table

既有 schema 已有這個 table:
```sql
CREATE TABLE sales_metrics_targets (
  brand TEXT,
  level TEXT DEFAULT 'default',  -- 新人 / 正式 / 老將 / default
  period TEXT,                   -- daily / weekly / monthly
  metric TEXT,                   -- calls / connected / raw_appointments / appointments_show / closures / net_revenue_daily
  target NUMERIC,
  PRIMARY KEY (brand, level, period, metric)
);
```

**「該關注員工」3 條規則改寫**:

| 規則 | 改寫條件 |
|---|---|
| 突然消失 | `active_days_7d ≤ 1` 且 `7天前還有 calls > 0` |
| 量到質沒到 | `7天 calls ≥ target("calls", "weekly", brand, level)` 且 `7天 closures = 0` |
| 收網問題 | `7天 appts > target("raw_appointments", "weekly") × 1.5` 且 `7天 closures = 0` |

**Vincent 要做的**:
- 進 `/admin → 設定` 補各 brand × level 的真實 target(替代 hardcode 數字)

我建議的 default(可調):

| brand | level | calls/week | appts/week | closures/week |
|---|---|---|---|---|
| nschool | 新人 | 400 | 8 | 0.7 |
| nschool | 正式 | 500 | 12 | 1.5 |
| sixdigital→ooschool | 新人 | 350 | 6 | 0.5 |
| sixdigital→ooschool | 正式 | 450 | 10 | 1.0 |
| aischool | 新人 | 200 | 5 | 0.5 |
| aischool | 正式 | 300 | 8 | 1.0 |
| xlab | 新人 | 200 | 5 | 0.5 |
| xlab | 正式 | 300 | 8 | 1.0 |
| xuemi | 新人 | 200 | 5 | 0.5 |
| xuemi | 正式 | 300 | 8 | 1.0 |

(Vincent 給真實值再覆蓋這個 default。)

---

## 🚦 給下個 Claude 的 implement 順序

```
[Phase 1] 個人前台升級 (~3 hours)
  - DailyFocus 加「對 target 達成率」
  - 新增 30 天逐日趨勢 widget(LineChart)
  - 新增個人轉換漏斗 widget(Funnel)
  - 同 brand 同 level 排名 widget

[Phase 2] 主管後台升級 (~5 hours)
  - CompanyDeepDive 加 Top10/Bottom10 切換
  - 加「該關注員工」alert 自動判斷(用 sales_metrics_targets)
  - 加全公司轉換漏斗(per brand 對比)
  - 連假標記(灰色 row + holidays.ts)

[Phase 3] 設定面板 (~2 hours)
  - /admin → 設定 → KPI Target 編輯 page(讀寫 sales_metrics_targets)
  - holidays.ts admin UI(列國定假日,可加減)

[Phase 4] LINE Notify 整合 (~1 hour)
  - 該關注員工 alert 每天 09:30 推 LINE 給主管
  - self-audit cron 異常推 LINE(已在 /api/cron/metabase-self-audit 實作)
```

預估總:**11 hours implement** + Vincent 驗收每 phase。

---

**Vincent 拍板後,下一個 Claude 直接照 Phase 1-4 implement。**
