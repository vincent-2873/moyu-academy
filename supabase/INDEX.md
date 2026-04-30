# Supabase Migration Index

> 55 個 `.sql` 檔案的順序、用途、狀態。
> Apply 方式:`gh workflow run "Apply Supabase Migration" --ref main -f sql_file=<filename>`
> 之後若想接 Supabase CLI,要 batch rename 加 `YYYYMMDDHHMMSS_` prefix 再放 `supabase/migrations/`。
>
> 生成時間:2026-04-30 (依 git log 第一次出現時序排)

---

## 🔴 必跑順序(初次部署 / 換 Supabase project)

下面這個順序是**從零部署**時應該跑的順序。已部署的 prod (nqegeidvsflkwllnfink) 全部都已 apply。

### Stage 0:Legacy 基礎結構
| # | File | 用途 |
|---|---|---|
| 01 | `supabase-migration.sql` | 最早期 schema 種子 |
| 02 | `supabase-migration-MASTER-moyu-legacy-integration.sql` | Vercel 時代結構整合 |
| 03 | `supabase-migration-INVENTORY.sql` | 盤點現有表 |

### Stage 1:領域骨架
| # | File | 用途 |
|---|---|---|
| 04 | `supabase-migration-claude.sql` | claude_tasks 表 |
| 05 | `supabase-migration-legal-v2.sql` | 法務案件結構 |
| 06 | `supabase-migration-line.sql` | LINE binding 基礎 |
| 07 | `supabase-migration-line-ask.sql` | LINE 問答記錄 |
| 08 | `supabase-migration-recruit-docs.sql` | 招聘文件 |
| 09 | `supabase-migration-recruit-ops.sql` | 招聘 ops |
| 10 | `supabase-migration-recruit-pipeline.sql` | 招聘漏斗 |
| 11 | `supabase-migration-reply-columns.sql` | 回覆 column |
| 12 | `supabase-migration-sales-metrics.sql` | sales_metrics_daily 表 |
| 13 | `supabase-migration-sales-alert-rules.sql` | 警報規則 stub |
| 14 | `supabase-migration-sales-brand-alias.sql` | brand alias |
| 15 | `supabase-migration-training-units.sql` | 舊版訓練單元 |

### Stage 2:104 自動化
| # | File | 用途 |
|---|---|---|
| 16 | `supabase-migration-104-automation.sql` | 104 自動發邀約 表 |
| 17 | `supabase-migration-104-rls.sql` | 104 RLS |

### Stage 3:V3 指揮中心
| # | File | 用途 |
|---|---|---|
| 18 | `supabase-migration-v3-erp.sql` | v3 ERP 表 |
| 19 | `supabase-migration-v3-pillars.sql` | v3 三支柱 / commands / projects |

### Stage 4:RLS 全開
| # | File | 用途 |
|---|---|---|
| 20 | `supabase-migration-rls-all-tables.sql` | 一鍵 ENABLE RLS 全 public 表(2026-04-23) |

### Stage 5:Phase 4 mock data
| # | File | 用途 |
|---|---|---|
| 21 | `supabase-mock-data-phase4.sql` | mock 種子(已可選跑 / 純 demo) |

### Stage 6:寰策 Sprint 1 結構修補(C 系列, 2026-04-29 ~ 30)
| # | File | 用途 |
|---|---|---|
| 22 | `supabase-migration-C1-capability-scope.sql` | users.capability_scope |
| 23 | `supabase-migration-C2-user-stages.sql` | user stages + history |
| 24 | `supabase-migration-C3-claude-audit.sql` | claude_conversations + audit |
| 25 | `supabase-migration-C4-system-instrument.sql` | system_run_log + freshness view |
| 26 | `supabase-migration-C5-training.sql` | training_paths/modules/progress/assignments/stamps |

### Stage 7:墨宇大改版(D 系列, 2026-04-30)
| # | File | 用途 |
|---|---|---|
| 27 | `supabase-migration-D1-moyu-architecture.sql` | 墨宇生態 / 業務線 / 據點 / 主管 |
| 28 | `supabase-migration-D2-training-content-seed.sql` | 業務 14 + 招聘 11 module seed |
| 29 | `supabase-migration-D3-rag-knowledge.sql` | knowledge_chunks + 向量 + HNSW + search() |
| 30 | `supabase-migration-D4-demo-users.sql` | 8 demo users seed (rookie/staff/manager × sales/hr/legal) |
| 31 | `supabase-migration-D5-training-content-rich.sql` | 訓練 module 內容 rich (8 步框架 / HRBP 6 階段) |
| 32 | `supabase-migration-D6-sales-rules.sql` | sales_alert_rules 4 預設規則 |
| 33 | `supabase-migration-D7-kpi-targets.sql` | kpi_targets 9 預設 |
| 34 | `supabase-migration-D8-video-placeholders.sql` | training video_url + audio_files placeholder |
| 35 | `supabase-migration-D9-cron-config.sql` | cron_config 17 toggle |
| 36 | `supabase-migration-D10-line-templates.sql` | line_templates 5 預設模板 |
| 37 | **`supabase-migration-D11-stamp-rules.sql`** | **stamp_rules + 10 條印章規則(2026-04-30 接手)** |
| 38 | **`supabase-migration-D12-storage-buckets.sql`** | **training-videos + training-audio buckets** |
| 39 | **`supabase-migration-D13-bulk-create-real-employees.sql`** | **24 真實員工 bulk create(過濾新訓-)** |

### Stage 8:Metabase backfill
| # | File | 用途 |
|---|---|---|
| 40 | `supabase-migration-metabase-backfill-202604.sql` | 2026-04 補資料 (legacy) |

---

## 🔧 FIX 補丁(出 bug 時跑一次)

| File | 修了什麼 |
|---|---|
| `supabase-migration-FIX-automation-columns.sql` | 104 自動化欄位 |
| `supabase-migration-FIX-grants.sql` | service_role 權限 |
| `supabase-migration-FIX-metabase-sources.sql` | metabase 資料來源 |
| `supabase-migration-FIX-oauth-columns.sql` | OAuth 欄位 |
| `supabase-migration-FIX-sales-metrics-unique.sql` | sales_metrics_daily 唯一鍵 |
| `supabase-migration-FIX-seed-mock.sql` | 種子 mock 資料 |
| `supabase-migration-FIX-stub-columns.sql` | stub 欄位 |
| `supabase-migration-FIX-stub-tables.sql` | stub 表 |
| `supabase-migration-FIX-users-columns.sql` | users 欄位 |

---

## 🔍 CHECK / VERIFY (read-only,診斷用)

| File | 看什麼 |
|---|---|
| `supabase-migration-CHECK-metabase-session.sql` | metabase session |
| `supabase-migration-CHECK-system-secrets.sql` | system_secrets 表 |
| `supabase-migration-VERIFY-cols.sql` | 欄位 verify |
| `supabase-migration-VERIFY-metabase.sql` | Metabase 同步 verify |
| `supabase-verify-metabase-sync.sql` | sales_metrics_daily by brand 統計 |
| `supabase-verify-stats-overview.sql` | 全方位 stats 單 SELECT |

---

## ✅ 已 apply 確認(prod nqegeidvsflkwllnfink)

最後一次完整 apply:2026-04-30 接手後 D11/D12/D13 自動跑進去:
- `stamp_rules`:10 條印章規則 ✓
- `storage.buckets`:training-videos + training-audio ✓
- `users` 表:17 → **41 人**(+24 真實員工 inserted, 23 個「新訓-」過濾) ✓

verify SQL 跑出來的真實數據:
```json
{
  "total_rows": 2122,
  "distinct_emails": 52,
  "max_date": "2026-04-29",
  "min_date": "2025-01-01",
  "xunlian_distinct": 23,
  "users_total": 41,
  "users_active": 41,
  "stamp_rules_count": 10,
  "storage_buckets": "training-videos,training-audio"
}
```

---

## ⏭ 未來 — 要接 Supabase CLI 嗎?

如果要接,步驟:
1. 全 sql 改名加 `YYYYMMDDHHMMSS_` prefix
2. 移到 `supabase/migrations/`
3. `supabase db push` 自動執行新 migration
4. 廢掉 `apply-migration.yml` workflow

**目前狀況**:還是用 `apply-migration.yml` workflow + manual sql_file 比較簡單。換 project / restore 才會痛。
