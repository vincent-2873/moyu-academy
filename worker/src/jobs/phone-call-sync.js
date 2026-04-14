// 電話系統（智慧客服 122.147.213.44:8080）通話紀錄同步
// 每 10 分鐘從 PBX 拉最新通話 → upsert phone_call_log
//
// 登入 API: POST /auth/local
// 通話紀錄 UI: /ui_callcenter/#/agent/agent-history
// 欄位: 客戶名稱 / 客戶號碼 / 坐席 / 佇列 / 呼叫類型 / 應答方式 / 通話長度 / 等待長度 / 開始時間
//
// 招聘分機：
//   502 = 劉芸蓁
//   503 = 蘇育卉

const { getSupabase } = require('../lib/supabase');
const { chromium } = require('playwright');
const { linePushText } = require('../lib/line');

const PBX_URL = process.env.PBX_URL || 'https://122.147.213.44:8080';
const PBX_USER = process.env.PBX_USER;
const PBX_PASSWORD = process.env.PBX_PASSWORD;

const EXTENSION_TO_AGENT = {
  '502': '劉芸蓁',
  '503': '蘇育卉',
  '599': '組長(Vincent)',
};

let browser = null;
let page = null;
let loggedInAt = 0;
const SESSION_TTL = 20 * 60 * 1000;

async function ensureLogin() {
  if (page && Date.now() - loggedInAt < SESSION_TTL) return page;
  if (browser) { try { await browser.close(); } catch {} browser = null; }
  if (!PBX_USER || !PBX_PASSWORD) throw new Error('PBX_USER + PBX_PASSWORD not set');

  browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  page = await ctx.newPage();

  await page.goto(`${PBX_URL}/ui_callcenter/#/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // 用 UI 填表登入
  await page.fill('input[placeholder*="坐席"], input[type="text"]:first-of-type', PBX_USER).catch(() => {});
  await page.fill('input[type="password"]', PBX_PASSWORD).catch(() => {});
  await page.click('button:has-text("登錄"), button:has-text("登入")').catch(() => {});
  await page.waitForTimeout(4000);

  loggedInAt = Date.now();
  console.log('[phone-sync] logged in');
  return page;
}

async function fetchCallLogs() {
  const p = await ensureLogin();
  await p.goto(`${PBX_URL}/ui_callcenter/#/agent/agent-history`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await p.waitForTimeout(3000);

  // 點「搜索」（日期預設今天）
  await p.click('button:has-text("搜索"), button:has-text("搜尋")').catch(() => {});
  await p.waitForTimeout(3000);

  return await p.evaluate(() => {
    const result = [];
    const tbody = document.querySelector('table tbody');
    if (!tbody) return result;
    for (const tr of tbody.querySelectorAll('tr')) {
      const cells = [...tr.querySelectorAll('td')].map(td => td.innerText.trim());
      if (cells.length < 9) continue;
      result.push({
        customerName: cells[0],
        peerNumber: cells[1],
        extension: (cells[2] || '').split('[')[0].trim(),
        queue: cells[3],
        callDirection: cells[4],
        answerStatus: cells[5],
        durationSeconds: parseInt(cells[6]) || 0,
        ringSeconds: parseInt(cells[7]) || 0,
        startTime: cells[8],
      });
    }
    return result;
  });
}

async function runOnce() {
  const s = getSupabase();
  try {
    const rows = await fetchCallLogs();
    console.log(`[phone-sync] fetched ${rows.length} call logs`);
    let inserted = 0;
    for (const r of rows) {
      if (!r.peerNumber || !r.extension) continue;
      const pbxCallId = `${r.extension}_${r.peerNumber}_${r.startTime}`;
      const { error } = await s.from('phone_call_log').upsert({
        pbx_call_id: pbxCallId,
        extension: r.extension,
        agent_name: EXTENSION_TO_AGENT[r.extension] || null,
        peer_number: r.peerNumber,
        call_direction: r.callDirection,
        status: r.answerStatus === '接聽' ? 'answered' : 'missed',
        duration_seconds: r.durationSeconds,
        ring_seconds: r.ringSeconds,
        start_time: new Date(r.startTime).toISOString(),
        raw_payload: r,
      }, { onConflict: 'pbx_call_id' });
      if (!error) inserted++;
    }
    console.log(`[phone-sync] upserted ${inserted} rows`);
  } catch (err) {
    console.error('[phone-sync] error:', err.message);
    if (!err.message.includes('PBX_USER')) {
      await linePushText(`⚠️ phone-sync: ${err.message}`);
    }
  }
}

async function start() {
  setInterval(runOnce, 10 * 60 * 1000);
  setTimeout(runOnce, 60 * 1000);
}

module.exports = { start, runOnce };
