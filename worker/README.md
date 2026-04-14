# Moyu Worker — 招聘自動化背景服務

部署到 Zeabur 作為 Docker 長駐服務（另一個 service，不是 moyusales.zeabur.app）。

## 負責工作

1. **104 自動發信**（`104-sender.js`）— 每天 07:00-22:00，墨凡 200 封/天、睿富 300 封/天
2. **104 回覆輪詢**（`104-poller.js`）— 每 10 分鐘掃聯絡訊息偵測新回覆
3. **104 面試邀請派送**（`104-interview-sender.js`）— 每 30 秒掃 `pending_104_actions` 表
4. **電話系統同步**（`phone-call-sync.js`）— 每 10 分鐘從 PBX (122.147.213.44) 拉通話紀錄寫 Supabase

## 環境變數（Zeabur 注入）

```
# Supabase
SUPABASE_URL=https://luynflhuzbcbajycvuet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# 104 帳號
MOFAN_104_ACCOUNT=...
MOFAN_104_PASSWORD=...
RUIFU_104_ACCOUNT=...
RUIFU_104_PASSWORD=...

# 電話系統 PBX
PBX_URL=https://122.147.213.44:8080
PBX_USER=...
PBX_PASSWORD=...

# LINE 警報
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_ALERT_USER_ID=Vincent的LINE userId

# 時區
TZ=Asia/Taipei
```

## 本地測試

```bash
npm install
npx playwright install chromium
cp .env.example .env   # 填入實際值
npm start
```

## 部署

推到 GitHub → Zeabur 偵測 Dockerfile 自動 build。
