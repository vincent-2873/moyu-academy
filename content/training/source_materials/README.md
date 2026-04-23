# 📚 原始素材庫

> **這裡是什麼**：所有訓練系統內容的原始出處。Vincent & Lynn 的真實教學、LINE 群組討論、公司文件全部在這。
> **重要性**：這是整個系統的「聖經」。要驗證任何引用真偽、重新萃取新內容都回來這裡。

---

## 📂 檔案索引

| 檔名 | 內容 | 日期 | 用在哪 |
|------|------|------|-------|
| `day1_afternoon_salary.md` | Vincent 講敘薪制度（三星制度 / 階級 / 晉升） | 2026/04/13 下午 | EP1 HR-053 |
| `day2_morning_interview.md` | Vincent 講一面 vs 二面判斷 + MicroSIP 設定 | 2026/04/14 上午前段 | EP2 HR-054 |
| `day2_morning_feedback.md` | Vincent + Lynn 對練反饋 + 三階段回覆法 + 業績壓力應對 | 2026/04/14 上午後段 | EP3 HR-055 · EP4 HR-056 |
| `line_group_log.md` | 8 天 HRBP 招募訓練的 LINE 群組討論 | 2026/04/13 - 04/21 | 跨 EP 參考 |

---

## 🔑 重要人物識別

**核心教學者**：
- **Vincent**：主管/訓練長，大部分教學由他主講
- **Lynn**：招募資深主管，補充技巧與回饋

**學員（訓練期新人）**：
- **Harper**（劉芸蓁）：新進 HRBP
- **Su** / **rita**（蘇育卉）：新進 HRBP

**系統維護**：
- **Page**（HR）：訓練系統建置者、本專案 owner

---

## 🎯 這些素材是怎麼用的？

### 模式 1：影片腳本的 Vincent 原聲片段

EP1-EP4 的 `script.md` 都有「剪輯資源對照表」，對照表的時間碼都指向這些素材檔。例如：

```
EP1 script.md 第 3 段
→ [切 Vincent 原聲 V-03，06:27-07:04]
→ 對應 day1_afternoon_salary.md 的 06:27 時間標記
```

### 模式 2：方法論萃取

`HRBP_CORE_METHODS.md` 的心法都是從這些素材萃取。例如：

```
三階段回覆法（標準→延伸→反問）
→ 來源：day2_morning_feedback.md, 15:13
→ 原話：「我們有時候可以做一些鋪陳,有三階段的回覆...」
```

### 模式 3：情境題設計

互動測驗的情境都是從真實對話改編。例如：

```
EP4 Q1:「這會有業績壓力嗎?」
→ 來源：day2_morning_feedback.md, 22:36
→ 育卉當時的錯誤回答作為反面教材
```

---

## ⚠️ 使用守則

### 可以做
- ✅ 引用作為教學內容
- ✅ 從中萃取新方法論
- ✅ 參考當作情境題素材
- ✅ 補充新逐字稿到這個資料夾

### 不要做
- ❌ 直接公開原檔（涉及學員個人對話）
- ❌ 引用真實員工姓名到對外產出
- ❌ 自行編造「Vincent 說」的內容（只能用檔案裡真的有的）
- ❌ 修改原檔內容（要修就另存新版）

---

## 📝 如何新增素材

當有新的訓練內容錄製或文字記錄時：

1. **命名規範**：`{YYYYMMDD}_{topic}.md`（例：`20260501_onboarding_day3.md`）
2. **格式**：見下方標準格式
3. **更新此 README** 的索引表
4. **告訴 Claude Code** 哪些現有單元可能受影響

### 標準格式範本

```markdown
# {會議主題逐字稿}

**日期**：YYYY/MM/DD
**時段**：上午 / 下午
**主講**：Vincent / Lynn / 其他
**參與**：訓練對象名單
**時長**：XX 分鐘

---

## 📑 章節目錄

1. 章節標題 1 (00:00 - 05:00)
2. 章節標題 2 (05:00 - 12:00)
...

---

## 逐字稿

### 一、章節標題 1 (00:00 - 05:00)

**00:15 Vincent**:
「...」

**01:03 Vincent**:
「...」

### 二、章節標題 2 (05:00 - 12:00)

...

---

## 🔑 關鍵金句提取

- 「...」(時間碼)
- 「...」(時間碼)

---

**建檔日期**：YYYY/MM/DD
**建檔者**：Page / Claude
```

---

## 🔍 快速檢索索引

### 按主題找素材

| 想找什麼主題 | 看哪個檔案 |
|-------------|-----------|
| 薪資制度 / 三星 / 階級 | day1_afternoon_salary.md |
| 一面 vs 二面判斷 | day2_morning_interview.md |
| 三階段回覆法 | day2_morning_feedback.md |
| 業績壓力應對 | day2_morning_feedback.md |
| 團隊氛圍話術 | day2_morning_feedback.md |
| MicroSIP / AnyDesk 操作 | day2_morning_interview.md |
| 電訪對練回饋 | day2_morning_feedback.md |
| 訓練流程整體時間軸 | line_group_log.md |

### 按金句找素材

| 金句 | 來源 |
|------|------|
| 「有比較就會有傷害」 | day2_morning_feedback.md, 17:06 |
| 「曖昧不清的氛圍沒人會喜歡」 | day2_morning_feedback.md, 24:32 |
| 「使用者是人」 | day2_morning_feedback.md, 19:40 |
| 「知道→做到→做好→精通」 | 跨多個檔案 |
| 「業務就是有業績壓力才叫業務」 | day2_morning_feedback.md, 26:27 |
| 「給 range 跟實拿金額」 | day1_afternoon_salary.md, 08:33 |

---

**Last Updated**：2026/04/23
