# 給下個 Claude Code:30 秒接手指引(2026-04-30 CONTINUATION 版)

**產出**:2026-04-30(這是 第二輪 接手交接,Vincent 通知 context 快滿)
**讀我這份 → 然後讀完整 handoff → 接手**

---

## ⚡ 你接手的當下狀態

```
專案:      moyu-academy (墨宇戰情中樞 v5.0)
Prod URL:  https://moyusales.zeabur.app  (6/6 全 200 ✓)
本機路徑:  C:\Users\USER\OneDrive\桌面\Claude code\moyu-academy\
記憶 repo: C:\Users\USER\huance-copilot-memory\
Supabase:  nqegeidvsflkwllnfink (東京)
Vincent:   vincent@xuemi.co / 0000 (admin)
Git:       0 behind / 0 ahead, 最新 cc8f9d1
```

---

## 📚 必讀順序(嚴格,讀完才動)

```
1. ~/.claude/CLAUDE.md                          (3 分鐘 — 全域工作風格 + 紅線)
2. ~/.claude/projects/.../memory/MEMORY.md      (1 分鐘 — 個人偏好 + 部署棧 + project 路徑)
3. moyu-academy/CLAUDE.md                       (5 分鐘 — 架構/路由/env)
4. ~/huance-copilot-memory/handoff/2026-04-30-CONTINUATION-handoff.md  ← **核心**(8 分鐘)
5. ~/.claude/projects/.../memory/project_moyu_data_quality_issues.md   ← Vincent 4 件 待處理(2 分鐘)
```

讀完 5 份大約 20 分鐘。Vincent 給的密碼 / channel ID / commit log / 還沒做的事都在 #4。

---

## 🎯 你第一件事:`curl prod 6/6 verify deploy`

```bash
for url in "/" "/home" "/work" "/learn" "/account" "/admin"; do
  curl -s -o /dev/null -w "%{http_code}  ${url}\n" "https://moyusales.zeabur.app${url}"
done
```

預期 6/6 全 200。如果有 5xx → check Zeabur dashboard 看 build 是否 fail。

---

## 🎯 你第二件事:跟 Vincent 講「**讀完了 / 接手**」

簡短一句,等他下指令。

---

## 🎯 第三件事(他給指令前):看 priority 自己選

### 高優先(等 Vincent explicit 才動):

| # | 任務 | 入口 |
|---|---|---|
| A | **Vincent 4 件 Metabase / 視覺反饋** | memory file `project_moyu_data_quality_issues.md` 有完整 6 條 plan |
| B | **LINE Login Channel Secret 二次 reset**(LINE 後台 generate slow,>15 分鐘還沒生)| navigate https://developers.line.biz/console/channel/2009936857/basics → JS check secret 是否變了(對比 OLD = `7a540e07a4822edbb261fab881d6a0c9`) → triple_click + Ctrl+C → Zeabur LINE_LOGIN_CHANNEL_SECRET 二次 update |
| C | **OpenAI embedding 是否 work** verify | 寫 SQL `SELECT COUNT(*) FROM knowledge_chunks WHERE embedding IS NOT NULL` → 如 0 → Vincent 自己加 credit |
| D | **gh CLI auth 失效** | `gh auth login -h github.com` (web flow) — Vincent 自己跑 |

### 中優先(下一波):
- 既有 7 admin tab inline code 細節 wabi 化(globals.css 已蓋大半)
- 51 sql migration 整理進 supabase/migrations/(技術債)
- Logo hover 細節 / 滑鼠尾跡顏色反應

---

## 🚨 重要 Vincent 紀律(沿用全部)

- **不准停**:Vincent「不准停 直到我回任何字才停」
- **不分段**:「全部一次執行完再跟我說」
- **給錢買的水準**:設計參考 kzero / cuberto / kaizen makemepulse
- **紅線 1 v4**:secret 不主動 print 進 chat / 不 screenshot 顯示頁 / 不 `body.innerText.slice` / 不 read_page / find 對 secret 顯示頁(a11y tree 會 leak value)
- **紅線 4**:願景模式不直接執行(Vincent 已主動聲明跨層授權,可動)
- **MEMORY 處理節奏 / 紅線處理邊界** — 紅線優先

---

## 📦 環境快查(立即可用)

```bash
# 進專案
cd "C:\Users\USER\OneDrive\桌面\Claude code\moyu-academy"

# 看 commit
git log --oneline -10

# 看 prod
for url in "/" "/home" "/work" "/learn" "/account" "/admin"; do
  curl -s -o /dev/null -w "%{http_code}  ${url}\n" "https://moyusales.zeabur.app${url}"
done

# Apply SQL (gh auth 失效時,改用 Chrome MCP GitHub Actions UI trigger)
gh workflow run "Apply Supabase Migration" --ref main -f sql_file=xxx.sql

# Trigger Metabase sync
gh workflow run "Metabase Daily Sync" --ref main

# Trigger RAG bootstrap
gh workflow run "RAG Bootstrap" --ref main

# 看 latest workflow runs
gh run list --limit 5
```

---

## 🔑 secret 操作 SOP(踩過 5 次 incident,固化下來)

1. **不要 read_page / find 對 secret 顯示頁**(a11y tree dump value)
2. **不要 screenshot Zeabur edit modal**(value 不 mask)
3. **不要 screenshot LINE Basic settings**(channel secret plaintext)
4. **改用 JS targeted query**:`document.querySelector(...)` + 用 strict comparison(`===`)避免 dump value
5. **改用站方內建「複製」button + Chrome MCP 真實 click**(trusted gesture 觸發 navigator.clipboard.writeText → 系統剪貼簿,不經 chat)
6. **Zeabur paste**:click input → Ctrl+V → JS verify length / pattern(不 dump value)→ click 儲存
7. **儲存後 JS check defaultValue 是否更新**(modal 可能 stuck open 但實際 saved)

---

## ✅ 這份 handoff 確認 checklist

- [x] 5 commits 全 push (acb9adc → ef175fb → 0faad1f → 6268a4c → 6fcb795 → cc8f9d1)
- [x] D11/D12/D13 SQL 全 apply
- [x] Phase E 4 件 secret/key 全 paste 進 Zeabur
- [x] LINE 新 channel + callback URL set
- [x] Memory file 寫 Vincent 4 件反饋
- [x] supabase/INDEX.md 寫 55 SQL 索引
- [x] handoff doc 寫完整(這份 + ~/huance-copilot-memory/handoff/2026-04-30-CONTINUATION-handoff.md)
- [ ] LINE 2nd reset 等 LINE 生新 secret(待下個 Claude)
- [ ] OpenAI embedding 是否 work verify(待下個 Claude)
