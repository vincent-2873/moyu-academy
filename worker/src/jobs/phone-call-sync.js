// 電話系統（智慧客服 122.147.213.44:8080）通話紀錄同步
// 每 10 分鐘從 PBX 拉最新通話 → 寫 phone_call_log
//
// 招聘分機：
//   503 = 蘇育卉
//   502 = 劉芸蓁

const { getSupabase } = require('../lib/supabase');
const { chromium } = require('playwright');
const { linePushText } = require('../lib/line');

const PBX_URL = process.env.PBX_URL || 'https://122.147.213.44:8080';
const PBX_USER = process.env.PBX_USER;
const PBX_PASSWORD = process.env.PBX_PASSWORD;

const EXTENSION_TO_AGENT = {
  '502': '劉芸蓁',
  '503': '蘇育卉',
};

let browser = null;
let page = null;
let loggedInAt = 0;

async function ensureLogin() {
  if (page && Date.now() - loggedInAt < 20 * 60 * 1000) return page;
  if (browser) { try { await browser.close(); } catch {} browser = null; }
  if (!PBX_USER || !PBX_PASSWORD) throw new Error('PBX_USER + PBX_PASSWORD not set');

  browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  page = await ctx.newPage();
  await page.goto(PBX_URL + '/ui_callcenter/#/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  // TODO: 正確 selector（第一次跑時擷取 DOM 確認）
  console.log('[phone-sync] logged in (placeholder)');
  loggedInAt = Date.now();
  return page;
}

async function runOnce() {
  const s = getSupabase();
  try {
    await ensureLogin();
    // TODO: 擷取通話紀錄 → upsert 進 phone_call_log (依 pbx_call_id 去重)
    console.log('[phone-sync] not yet implemented');
  } catch (err) {
    console.error('[phone-sync] error:', err.message);
    if (err.message.includes('PBX_USER')) return; // 環境變數沒設就靜默
    await linePushText(`⚠️ phone-sync: ${err.message}`);
  }
}

async function start() {
  setInterval(runOnce, 10 * 60 * 1000);
  setTimeout(runOnce, 60 * 1000);
}

module.exports = { start, runOnce };
