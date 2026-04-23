# 📐 產出規則與品質標準

> **給 Claude Code 用**：任何產出檔案都要符合這份規範。
> **給 Page 用**：檢查 Claude Code 產出品質的 checklist。

---

## 🎨 視覺設計規範

### 色彩系統（不可改）

```css
--navy: #1E3A5F;          /* 主色 · 深藍 */
--navy-deep: #152a44;     /* 主色深階 · Hover 狀態 */
--amber: #F59E0B;         /* 強調色 · 暖橘 */
--amber-soft: #FCD34D;    /* 強調色亮階 */
--amber-bright: #FBBF24;  /* 強調色動態 */
--ivory: #FDFBF7;         /* 淺色 · 金句卡底 */
--cream: #FAF7F0;         /* 淺色變體 */
--green: #10B981;         /* 功能色 · 成功/正確 */
--red: #EF4444;           /* 功能色 · 警告/錯誤 */
--gray-50: #F9FAFB;
--gray-100: #F3F4F6;
--gray-300: #D1D5DB;
--gray-500: #6B7280;
--gray-700: #374151;
--gray-900: #111827;
```

### 字體

- **主字體**：Noto Sans TC（繁中）
- **數字字體**：JetBrains Mono（統計數據、代碼用）
- **絕對不用**：Arial、Inter、Roboto、系統預設字體

### 間距

- **頁面 padding**：24px - 36px（桌機）/ 16-20px（手機）
- **卡片間距**：10-20px
- **段落間距**：16-24px

### 圓角

- **大容器**：16px（header/card）
- **按鈕與 option**：8-10px
- **小元件**：6px

---

## 📝 文件格式規範

### Markdown 檔案通用結構

```markdown
# 🎬 標題 · 子標題

> **說明段**：這份檔案的用途
> **時長/規格**：相關資訊

---

## 🎥 主要內容區

[正文]

---

## 視覺/樣式/技術說明

[需要時加上]

---

**Last Updated**：YYYY/MM/DD
**Version**：1.0
**對應單元**：HR-XXX · EP-X/N
```

### Emoji 使用

**允許使用**（有品牌辨識度）：
- 🎯 目標
- 📌 重點
- 📘 文件
- 🎬 影片
- ⚠️ 警告
- ✅ 已完成
- ❌ 錯誤示範
- 💡 提示
- 🎤 主講
- 🧠 心法

**避免使用**：
- 過度裝飾（🌈 🎉 🎊 etc.）
- 文化特定（只有某文化認得的）
- 曖昧不明的（👍 etc.）

---

## 🎤 影片腳本規範

### 必要區塊

每份 `script.md` 必須包含：

```markdown
# 🎬 {UNIT_NAME} · 影片腳本

**片長**：約 XX 分鐘
**格式**：混合版（阿凱主講 + Vincent 原聲 + 圖卡）
**系列**：HRBP 招募訓練 EP X/4

---

## 🎥 剪輯資源對照表

| 片段代號 | 原始時間 | 內容 | 用在腳本第幾段 |
|---------|---------|------|--------------|

---

## 第 X 段（時間範圍）標題

**[畫面]** 場景描述

**[阿凱]**
「講稿內容」

**[切 Vincent 原聲 V-XX]**
> *「Vincent 原話」*

**[字幕]** 💡 金句整理

**[圖卡]**
```
圖卡內容
```
---
```

### 段落標記符號

- `[場景]` - 視覺場景
- `[阿凱]` - 阿凱說話
- `[切 Vincent 原聲 V-XX]` - 插入 Vincent 原聲
- `[字幕]` - 字幕顯示
- `[圖卡]` - 圖卡顯示
- `[停頓]` - 停頓指示
- `[音效]` - 音效指示

---

## 🧪 互動測驗規範

### HTML 檔案結構

每份 `interactive.html` 必須：

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{UNIT_CODE} {UNIT_NAME} · 互動測驗</title>
<style>
  :root {
    /* 使用規範的 CSS variables */
  }
  /* 其他樣式 */
</style>
</head>
<body>

<div class="wrap">
  <div class="header">
    <div class="tag">HRBP 招募訓練 · EP X / 4</div>
    <div class="title">{UNIT_NAME} · 情境測驗</div>
    <div class="subtitle">X 題 · 答對 N 題以上通過</div>
  </div>
  <!-- ... -->
</div>

<script>
// 題庫
const quiz = [
  {
    num: "QX",
    text: "問題",
    scene: "情境:...",
    options: ["A", "B", "C", "D"],
    correct: N,  // 0-based index
    right: "正解說明",
    tip: "提示/心法口袋"
  }
];

// postMessage to parent
if (window.parent && window.parent !== window) {
  window.parent.postMessage({
    type: 'unit_complete',
    unit: '{UNIT_CODE}',
    score: rightCount,
    total: quiz.length,
    passed: passed
  }, '*');
}
</script>

</body>
</html>
```

### 題目設計原則

- **題數**：5-8 題（視內容複雜度）
- **通過門檻**：75% 以上（8 題→6 題 / 7 題→5 題）
- **必須有**：情境、選項、正解、解析（tip）
- **選項**：3-4 個，干擾項要合理
- **情境**：描述真實工作場景，「情境:你正在...」

### 禁用

- ❌ localStorage / sessionStorage（Claude.ai 環境會出錯）
- ❌ 外部依賴（所有邏輯內嵌）
- ❌ jQuery 或 framework（純 vanilla JS）

---

## 🧑‍🎨 圖卡 HTML 規範

### 檔案結構

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<!-- 同 interactive.html 的 meta -->
<style>
  /* 使用規範的 CSS variables */

  .card {
    width: 1920px;
    height: 1080px;
    /* 1080p 比例 */
  }
</style>
</head>
<body>

<!-- 每張卡用 .card-X class -->
<div class="card card-1">...</div>
<div class="card card-2">...</div>
...

</body>
</html>
```

### 圖卡尺寸

- **寬度**：1920px
- **高度**：1080px
- **比例**：16:9
- **截圖**：直接 Chrome F12 → Capture node screenshot

---

## 📋 input.md 規範

### 必要欄位

```markdown
# {UNIT_CODE} {UNIT_NAME}

## 📌 基本資訊
- **單元代號**:
- **單元名稱**:
- **所屬體系**:
- **受眾代號**:
- **優先級**: P0/P1/P2
- **預估總時長**:
- **前置單元**:
- **系列位置**: (如果是系列的一部分)

## 🎯 學習目標
1. ...
2. ...

## 🔑 關鍵知識點
- ...

## 🎬 情境素材
**情境 1**: ...

## 📋 核心素材（原話保留）
- 「原話」(來源檔案, 時間碼)

## 🎨 產出需求
- 主講角色:
- 風格:
- 時長:
- 互動:
- 文件手冊:

## ⚠️ 禁用 / 避免
- ...
```

---

## ✍️ 語言與語氣規範

### 主講角色阿凱

**語氣基調**：
- 像學姐跟學妹聊天
- 有耐心、不端架子
- 專業但不生硬
- 偶爾輕鬆幽默（不要過度）

**詞彙選擇**：
- ✅ 「你」「我們」「大家」
- ❌ 「您」「閣下」（太正式）
- ✅ 「這塊」「這段」「這件事」（口語連接詞）
- ✅ 偶爾「對」「嗯」「欸」（自然語氣詞）

### 技術用詞

**保留原文的**：
- HRBP、HR、IT 等業界通用縮寫
- Vincent、Lynn、Page 等人名（除非禁用）
- HeyGen、Midjourney 等產品名

**要翻中文的**：
- 「業績壓力」不是「performance pressure」
- 「教育訓練」不是「training」
- 「面試」不是「interview」

### 數字與量詞

**一律用阿拉伯數字**：
- ✅ 「4 萬到 5 萬」
- ❌ 「四萬到五萬」

**但聲音合成時要注意**：
- HeyGen 中文有時會把「3」念成 three
- 解決：投稿文字中把「3 萬」改成「三萬」
- 或使用拼音標記

---

## 🚫 禁用內容清單

### 人名類
- ❌ 真實員工姓名（Terry、Alan、Harper、育卉、Su、芸蓁）
- ✅ 通用化為「據點主管」「新人 A」「求職者」
- ✅ Vincent、Lynn、Page 可以出現（核心人物）

### 敏感資訊
- ❌ 具體客戶名稱
- ❌ 具體金額以外的機密數字
- ❌ 競爭對手名字攻擊性描述

### 內容風格
- ❌ 說教式（「你必須...」「不能...」）
- ❌ 恐嚇式（「不會就會被 fire」）
- ❌ 陽光過頭（「超級棒」「絕對讚」）
- ✅ 平實專業、有溫度

---

## 🎯 品質檢查通關條件

### 每份產出都要通過

- [ ] 檔案名稱符合命名規則
- [ ] 有 Last Updated 日期
- [ ] 有對應單元代號標註
- [ ] 引用 Vincent/Lynn 原話有標時間碼來源
- [ ] 沒有真實員工姓名
- [ ] 配色使用規範的 CSS variables
- [ ] 字體使用 Noto Sans TC
- [ ] 文件結構符合範本
- [ ] 語氣符合阿凱風格

### 互動測驗額外檢查

- [ ] 無 localStorage
- [ ] 無外部依賴
- [ ] 有 postMessage
- [ ] 題數符合規範
- [ ] 通過門檻合理

### 影片腳本額外檢查

- [ ] 有剪輯資源對照表
- [ ] Vincent 時間碼能在素材找到
- [ ] 阿凱段落有語氣建議
- [ ] 有前後單元連接（預告/回顧）

---

## 🔄 版本管理

### 檔案版本

每次重大更新後：
1. 更新 `Last Updated` 日期
2. 在檔案底部加 Version 號（1.0 → 1.1 → 2.0）
3. 重大破壞性更新 → 保留舊版本加 `.v1` 後綴

### Changelog（建議）

大型變動後建立 `CHANGELOG.md`：

```markdown
## [2.0.0] - 2026-04-23
### Changed
- EP1 改為混合版影片格式
- 配色從純深藍改為深藍+暖橘

## [1.5.0] - 2026-04-15
### Added
- HR-053 業務敘薪制度
- HRBP_CORE_METHODS 速查手冊
```

---

## 🛡️ 安全紅線

**絕不產出**：
- 🔴 真實客戶對話（隱私）
- 🔴 員工薪資數字以外的薪資細節（機密）
- 🔴 合約、法律文件（責任）
- 🔴 批評特定員工（人資禁忌）
- 🔴 涉及歧視或偏見的內容

**疑慮時**：不產，問 Page。

---

**Last Updated**：2026/04/23
