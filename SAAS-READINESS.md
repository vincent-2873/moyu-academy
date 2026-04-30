# SaaS Readiness Roadmap

> 2026-04-30 第三輪 末尾規劃
> Vincent 反饋:此系統未來 SaaS 化,別人公司會用 → 必須準備 multi-tenant
> 第三輪已做 D17 第一步(organizations table + users / knowledge_chunks / audit_log organization_id)

---

## 階段 A — 已完成 ✅(D17 SQL applied)

- `organizations` table(每家公司一筆,plan/quota/status/billing)
- 預設 tenant `moyu` 包整個現有資料
- `users.organization_id` default `moyu`
- `knowledge_chunks.organization_id` default `moyu`
- `audit_log.organization_id`
- `search_knowledge()` RPC 加 `filter_organization_id` filter(預設 moyu)

---

## 階段 B — 程式邏輯 wire up(下個 sprint, P1)

每個 admin / me / RAG endpoint 進去都要拿 caller 的 `organization_id`,然後:
- query 加 `WHERE organization_id = caller_org`
- INSERT 自動 `organization_id = caller_org`

要改的關鍵點:
1. **`lib/admin-scope.ts`** `AdminScope` 介面加 `organizationId`,`getAdminScope()` 從 user 撈
2. **`lib/supabase.ts`** 加 helper `applyTenantFilter(query, scope)`
3. **`/api/rag/search`** + **`/api/claude-panel/chat`**:傳 `filter_organization_id`
4. **`/api/admin/*`** 全 30+ endpoint:加 tenant scope filter
5. **`/api/me/*`** 12 endpoint:同上

工作量:5-8 hr,影響面大但有 default fallback(`moyu`)所以漸進可做。

---

## 階段 C — 把更多 table 加 organization_id(P2,等需要時)

目前只加 4 個 table。SaaS 上線前要加:
- `kpi_targets`
- `kpi_entries`
- `sales_metrics_daily`
- `claude_conversations`
- `recruits` / `outreach_log` / `phone_call_log`
- `legal_*`
- `v3_*`
- 50+ 其他

策略:**寫一個 batch SQL `D18-tenant-rollout.sql`** ALTER 全部 + 加 index + 加 default = 'moyu'。

---

## 階段 D — Auth + Onboarding(P1 SaaS 上線前必須)

### 1. Tenant signup flow
- 路徑:`/signup`
- form:company_name + admin_email + plan(free trial)
- backend 創 organization + super_admin user + 寄歡迎信
- onboarding wizard 引導:加員工 / 上傳第一份知識 / 接 LINE Bot

### 2. Tenant subdomain / custom domain
- 預設:`<tenant>.moyu-saas.com` (subdomain routing)
- Pro plan:custom domain (`acme.com`)
- middleware.ts 解析 host → tenant_id → inject 到 request

### 3. Auth:tenant-aware
- 同一 email 可在多 tenant(罕見但要支援)
- `users` PRIMARY KEY 改 `(organization_id, email)` 或新增 surrogate `id` UUID(已有)
- session cookie 帶 tenant_id

---

## 階段 E — 配額 + Billing(P2)

### 1. Quota enforcement
- 每 endpoint 進去 check `organization.max_users` / `max_chunks` / `max_monthly_cron_runs`
- 超限回 402(Payment Required)+ upgrade prompt
- middleware.ts 加 quota gate

### 2. Billing 接入
- Stripe(SaaS standard)
- subscription `starter (free)` / `pro ($X/mo)` / `enterprise (custom)`
- 自助升級降級 + 暫停 / 重新啟動
- 過期 → status='suspended' → middleware 擋

### 3. Usage metering
- `monthly_usage` table 紀錄每 tenant 的 cron / LLM call / chunks
- monthly billing report

---

## 階段 F — 客戶料隔離 + RLS(P0 上線前必須)

**現在所有 query 都用 `service_role` bypass RLS。SaaS 上線前必須改。**

### 1. RLS policy 真正啟用
每個 table 加:
```sql
CREATE POLICY tenant_isolation ON knowledge_chunks
  FOR ALL TO authenticated
  USING (organization_id = current_setting('app.current_org')::text);
```

### 2. 不再用 service_role bypass
- 改用 `anon key` + JWT(內含 `organization_id` claim)
- backend `getSupabaseClient(req)` 從 cookie 解 JWT,set `app.current_org`
- 留 `getSupabaseAdmin()` 但只給 cron / signup 用

### 3. Audit log 同源
所有寫操作走 audit log(已建)+ organization_id

---

## 階段 G — 數據匯出 / 刪除權(P1 法律合規)

### 1. GDPR / 個資法 compliance
- `/admin/data-export`:tenant admin 可下載全部資料 ZIP
- `/admin/data-delete`:撤銷帳號 → 全部資料 30 天後清除(soft delete)

### 2. 員工資料外帶
員工 `/me/export-data`:下載自己的對話 / KPI / 上傳

---

## 階段 H — 客製化(P2 差異化)

### 1. 各 tenant 自訂 prompt
- `claude_coach` system prompt 加 `organization.settings.coach_prompt`
- 戰情官口頭禪 / 文化 用客戶自己的

### 2. 各 tenant 自己 brand 分類
現在 `brand` 是 enum(nschool/xuemi/...);未來改成 free-text 由 tenant 自訂

### 3. 各 tenant logo / 主題色
`organization.brand_color` / `logo_url` → admin 頁面動態 inject

---

## 階段 I — 外部整合差異化(P2)

每 tenant 自己:
- LINE Channel(每家自己 token)
- Notion workspace(每家自己 token)
- Metabase host(每家自己)
- Discord OAuth client(每家自己)

→ `organization.integrations` jsonb 存 per-tenant credential
→ 取代 process.env.* 的 global credential

---

## 階段 J — Multi-region / Performance(P3)

- Supabase 各 region 部署(目前東京)
- CDN(Cloudflare 已支援)
- pgvector 量大後分 partition by organization_id
- read replica 給 dashboard query

---

## 上線 checklist(MVP SaaS launch)

- [ ] 階段 A ✅(D17 已 apply)
- [ ] 階段 B(全 endpoint tenant filter) — **下個 sprint**
- [ ] 階段 C(其他 50+ table 加 organization_id)
- [ ] 階段 D-1(signup flow + onboarding)
- [ ] 階段 D-2(subdomain routing)
- [ ] 階段 E-2(Stripe 接入)
- [ ] 階段 F(RLS policy)
- [ ] 階段 G(資料匯出 / 刪除)
- [ ] 至少 1 家試營運 tenant(beta)

---

## 預估工程量

| 階段 | Effort | 阻擋上線? |
|---|---|---|
| A | ✅ done | — |
| B | 5-8 hr | **是** |
| C | 3-5 hr | 部分(看用哪些 endpoint) |
| D-1 signup | 1-2 day | **是** |
| D-2 subdomain | 1 day | **是** |
| E billing | 2-3 day | **是**(沒收費 = 沒商業) |
| F RLS | 2 day | **是**(資料隔離) |
| G data export | 1 day | **是**(法律) |

**MVP launch 估:1-2 個月** 全職工程(Vincent 不寫 code,Claude agent 排隊跑)

---

## 風險提醒

🔴 **資料隔離是 P0 紅線**:RLS 沒做就上線 = 客戶資料互看 = 死刑
🔴 **Stripe 整合不能用測試 key 上 prod**:會收不到錢
🟡 **多 tenant 後 Supabase 單 instance 撐不了**:需要 Pro plan 或 self-host
🟡 **Anthropic / OpenAI 用量會爆**:需要 per-tenant quota + LLM call rate limit

---

## 下一步具體建議

1. **Vincent 確認**:這個 roadmap 對嗎?有沒有遺漏?
2. 如果方向 OK → 我下個 sprint 做階段 B(程式邏輯 wire up tenant filter)
3. 同步開始找:Stripe 帳號 / SaaS 行銷 landing page / pricing 設計
4. 法律:multi-tenant SaaS 在台灣 / 東南亞需要什麼合規(資料中心 / 個資 / GDPR)

---

> **底線:現在這版 D17 不影響現有功能(default 'moyu' 涵蓋全部),
> 但已經為未來打地基,不需要把 schema 重砍一次。**
