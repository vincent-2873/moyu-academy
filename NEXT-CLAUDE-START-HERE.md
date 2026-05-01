# 給下個 Claude:30 秒接手指引(v6,Phase A 清理完)

**產出**:2026-05-01 第六輪 Phase A 末
**讀我這份 → 然後讀完整 HANDOFF v6 → 接手**

---

## ⚡ 你接手的當下狀態

```
專案:      moyu-academy (墨宇戰情中樞)
Prod URL:  https://moyusales.zeabur.app
本機路徑:  C:\Users\USER\OneDrive\桌面\Claude code\moyu-academy\
Supabase:  nqegeidvsflkwllnfink (東京;⚠️ 不要動 Zeabur env)
Vincent:   vincent@xuemi.co / 0000 (admin)
Git HEAD:  50dc421 (Phase A 末)

Phase A 5 顆 commit 已 push:HR 全砍 + 架構外舊頁砍 + 訓練規範改 BIZ+LEGAL + RAG pillar 改 + 修死連結
Phase B 待啟動:基於 nSchool 真實 source 重做 /sales/* 前台 + admin 17 tab 重組成 8 區
```

---

## 📚 必讀順序(20 分鐘上手)

```
1. ~/.claude/CLAUDE.md                                          全域風格 + 紅線 1-4
2. ~/.claude/projects/.../memory/MEMORY.md                      個人偏好 + 部署棧
3. moyu-academy/CLAUDE.md (v6)                                  專案守則(已對齊 Phase A)
4. moyu-academy/PHASE-ROADMAP.md                                Vincent 拍板樹狀圖(真理)
5. **HANDOFF-2026-05-01-v6.md** (專案上一層 root)               完整脈絡(Phase A 做了什麼 + Phase B 規劃)
6. moyu-academy/content/training/foundation/{TRAINING_MASTER,CLAUDE}.md   訓練守則 v2(BIZ+LEGAL)
```

---

## 🎯 接手第一動

```bash
# 1. 驗 prod 還活
for url in "/" "/admin" "/legal/cases" "/recruit"; do
  curl -s -o /dev/null -w "%{http_code}  ${url}\n" "https://moyusales.zeabur.app${url}"
done
# 預期 / + /admin = 200, /legal/cases /recruit 也 200

# 2. git 對齊
cd "C:\Users\USER\OneDrive\桌面\Claude code\moyu-academy"
git pull --ff-only
git log --oneline -10
# 預期 HEAD = 50dc421(或更新)

# 3. 跟 Vincent 說「接走了,Phase A 完成,等指示是否啟動 Phase B」
```

---

## 🔒 鐵則(2026-05-01 拍板,Phase 6 前不變)

**做每個功能要先看 Vincent 既有 source 延伸,不從零生成。**

Source 在 `~/Downloads/訓練資料/_unzipped/`(nSchool 完整 Notion + XLAB + 適所 + 3 個 ExportBlock)。

詳見 HANDOFF v6 §2。

---

## 🚨 待 Vincent 動的事(才能 Phase B 啟動)

1. 🔴 **Apply D19 SQL** — `supabase-migration-D19-cleanup-v5-stub.sql`(透過 GitHub Actions 或 Supabase SQL editor)
2. 🔴 **OPENAI_API_KEY Zeabur env paste** — Phase B RAG ingest 啟動唯一卡點

詳見 HANDOFF v6 §4。

---

## 🛡️ 紅線(永遠守)

- 紅線 1:secret 不進 chat / 不 screenshot 顯示頁
- 紅線 2:可以說「不確定」
- 紅線 3:不可逆破壞性操作要先停(rm / DELETE / force push)
- 紅線 4:願景模式不直接執行

---

## ⚠️ 過時 doc(別讀,可能誤導)

- `HANDOFF-2026-05-01-v5.md`(過時)
- `HANDOFF-2026-04-30-v3/v4.md`(歷史)
- `WORK-LOG-2026-04-30-v4.md`(歷史)
- `moyu-academy/{SYSTEM-OVERVIEW, UI-UX-STATUS-2026-04-29, DESIGN-PLAN-V2-2026-04-30, SAAS-READINESS, UI-DASHBOARD-ROADMAP, AGENTS}.md`(過時或可砍)

---

**v6 接手包結束**。讀完 HANDOFF v6 → 跟 Vincent 確認 Phase B 啟動。
