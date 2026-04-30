# 給下個 Claude Code:30 秒接手指引

**產出**:2026-04-30(上一個 Claude 對話接近 context 滿,Vincent 要交接)
**讀我這份就接手 — 5 個必讀檔案順序在最下面**

---

## ⚡ 你接手的當下狀態

```
專案:      moyu-academy (墨宇戰情中樞 v5.0)
Prod URL:  https://moyusales.zeabur.app  (6/6 全 200 ✓)
本機路徑:  C:\Users\USER\OneDrive\桌面\Claude code\moyu-academy\
記憶 repo: C:\Users\USER\huance-copilot-memory\
Supabase:  nqegeidvsflkwllnfink (東京)
Vincent:   vincent@xuemi.co / 0000 (admin)
```

**今天累積 50+ commits,從 Phase A → D2 完整重構**:
- 17 個 admin tab × 5 group(全 master-detail CRUD)
- 7 個互動元件(InkCursor / InkLogo / BreathingNumber / StreakScroll / Stamp / Calendar / RecordingUploader)
- 前台 4 主場(/home /work /learn /account)全 framer-motion hero
- Schema D1-D10 全 applied
- Metabase 自動同步 GitHub Actions(2026-04 已 backfill 875 rows + 2025 全年)
- RAG 34 chunks ingested(等 OPENAI_API_KEY 才能 embed)
- LINE Bot 推送 endpoint + Whisper 轉錄 + Claude 三點評估

---

## 🎯 你第一個任務:做什麼

### A. Vincent 1-click 卡點(無法 server 自動,需要他動)
1. **OPENAI_API_KEY** 進 Zeabur env → 去 admin /knowledge tab 點「Embed pending」
2. **Notion token** 從 https://notion.so/profile/integrations/internal → 進 Zeabur env `NOTION_INTEGRATION_TOKEN`
3. **LINE callback URL** 改到 `https://moyusales.zeabur.app/api/line/oauth/callback`
4. **Discord secret rotate**

→ Vincent 進 https://moyusales.zeabur.app/admin → Setup 設定 tab 看 1-click 清單(每個有連結)

### B. 你可以繼續做的(從未做完的清單,Vincent 沒回 priority 你自己選):

**功能補**(可立刻動):
1. 印章規則 editor(從 training_modules.reward 統一抽出)
2. Quiz module UI(module_type='quiz' 答題 + 即時 grade)
3. 訓練影片 upload UI(接 Supabase Storage,< 1GB 免費)
4. Notion ingest 自動 cron(GitHub Actions 每天觸發)
5. 印章自動觸發整合(Whisper ≥ 60 自動蓋章 endpoint 已寫沒整合)

**Spec v1 還沒做的後台**:
6. 戰略指標(北極星 / OKR / LTV/CAC / 月燒錢 / 現金跑道)
7. 集團總覽(6 品牌橫向比 + 跨品牌人才流動 + 集團現金流瀑布)
8. Claude 預測建議(本月業績預測 / 下月招募缺口 / 風險預警 / 情境模擬)
9. 指揮台(一鍵全員推播 / 一鍵抽人問話 / 凍結帳號 / 拍板紀錄)

**視覺優化**:
10. /home /work /learn /account hero 加 InkLogo
11. **既有 7 admin tab 內容 wabi 化**(SystemHubTab / PeopleHubTab / CeoOverviewSection / V3PillarsBoard / SalesMetricsTab / LegalAdminTab / V3CommandsHub 還是 SaaS 紫青漸層 — 上一個 Claude 沒動)
12. Logo hover 更精緻
13. 滑鼠尾跡視覺強化

**整合修補**:
14. /me 舊 page 砍掉檔案(redirect 在 work 但 file 還在)
15. 訓練 video_url 實際填(Vincent 給 YouTube unlisted)
16. HRBP CALL audio_files 上傳 Supabase Storage
17. cron schedule 改 GitHub Actions yml(目前 toggle 只影響 DB,實際 schedule 沒改)
18. 53 真實員工 user account 從 sales_metrics 抽出建立(目前只 8 demo + vincent)

---

## 📚 必讀順序(按順序讀)

1. **C:\Users\USER\.claude\CLAUDE.md**(全域工作風格 + 紅線 1-4 + 三方協作)
2. **C:\Users\USER\OneDrive\桌面\Claude code\moyu-academy\CLAUDE.md**(專案聖經:架構/路由/env)
3. **C:\Users\USER\huance-copilot-memory\handoff\2026-04-30-FINAL-handoff.md**(這份 final 完整交接,**最重要**)
4. **C:\Users\USER\OneDrive\桌面\Claude code\moyu-academy\DESIGN-PLAN-V2-2026-04-30.md**(設計計畫 + Vincent reference 網站)
5. **C:\Users\USER\OneDrive\桌面\Claude code\moyu-academy\NEXT-CLAUDE-START-HERE.md**(這份)

讀完 4 份就能接手。Vincent 給的密碼 / 重要 ID / 環境設定都在 #2 #3。

---

## 🔧 環境快查(立刻可用)

```bash
# 進專案
cd "C:\Users\USER\OneDrive\桌面\Claude code\moyu-academy"

# 看 commit
git log --oneline -10

# 看 prod
curl -s "https://moyusales.zeabur.app"

# Apply SQL migration
gh workflow run "Apply Supabase Migration" --ref main -f sql_file=xxx.sql

# Trigger Metabase sync (date_start/end optional)
gh workflow run "Metabase Daily Sync" --ref main

# Trigger RAG bootstrap (ingest local + embed + Notion)
gh workflow run "RAG Bootstrap" --ref main

# 看 GitHub Actions latest
gh run list --limit 5
```

---

## 🚨 重要 Vincent 紀律(全部都遵守)

- **不准停**:Vincent「不准停 直到我回任何字才停」
- **不分段**:「全部一次執行完再跟我說 不要分段製作」
- **給錢買的水準**:設計參考 kzero / cuberto / kaizen makemepulse
- **不能讓使用者清 cache**:next.config headers 已 fix
- **紅線 1 v4**:secret 不主動 print 進 chat / 不 screenshot 顯示頁 / 不 body.innerText.slice
- **紅線 4**:願景模式不直接執行(Vincent 已主動聲明跨層授權,可動)
- **MEMORY 處理節奏 / 紅線處理邊界**

---

## 📊 本對話完整 commit log(50+ commits)

最重要的 commit:
- D1 墨宇生態 schema / D2 訓練 14+3 天 module seed / D5 訓練內容 rich
- D6 sales_alert_rules / D7 kpi_targets / D9 cron_config / D10 line_templates
- /home /work /learn /account v2 framer-motion
- 7 admin editor: TrainingEditor / AnnouncementsEditor / SalesRulesEditor / KpiTargetsEditor / UsersEditor / CronConfigEditor / KnowledgeEngineEditor / LineTemplatesEditor / SetupWizard / HealthDashboard / HealthStrip / SidebarSetupProgress
- Whisper / RAG bootstrap / LINE send / Cache fix

完整 detail 看 huance-copilot-memory/handoff/ 該 5 份 phase doc。

---

接手後第一件事:**讀 huance-copilot-memory/handoff/2026-04-30-FINAL-handoff.md**(最後一個 Claude 留的完整交接,我把這個 README 當 entry point,但細節在 final-handoff)

接手後第二件事:**curl prod 驗 6/6 還是 200**,確認 deploy 沒掉

接手後第三件事:**開始做下一波**(看 Vincent 講什麼,他「繼續」就持續,沒講就用 priority list 自己選)
