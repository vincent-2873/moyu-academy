// 104 企業後台 Playwright session manager
//
// 認證：104 用 SSO（pro.104.com.tw），登入後 cookie 帶著可呼叫：
//   - https://vip.104.com.tw/search/searchResult (HTML page + DOM scrape)
//   - https://auth.vip.104.com.tw/api/search/searchResult (REST JSON API)
//   - https://vip.104.com.tw/message/msgList (聯絡訊息 DOM scrape)
//
// 切換公司：右上角選單 → 切換公司 → 墨凡/睿富/龍盈/學溢/無限學/適才科技/飛躍學
//
// ⚠️ 每個 104 帳號每天查履歷上限 300 筆（含進詳情頁）

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 同一個 104 帳號登入後可切換 6 家公司
const COMPANIES = {
  mofan: '墨凡股份有限公司',
  ruifu: '睿富文化股份有限公司',
  longying: '龍盈股份有限公司',
  xueyi: '學溢股份有限公司',
  wuxian: '無限學股份有限公司',
  shicai: '適才科技股份有限公司',
  feiyue: '飛躍學股份有限公司',
};

const LOGIN_URL = 'https://pro.104.com.tw/psc/login';
const VIP_HOME_URL = 'https://vip.104.com.tw/rms/index';
const MSG_LIST_URL = 'https://vip.104.com.tw/message/msgList';
const SEARCH_URL = 'https://vip.104.com.tw/search/listSearch';
const STATE_TTL_MS = 25 * 60 * 1000;

const INVITE_TEMPLATE = fs.existsSync(path.join(__dirname, '../../templates/104-invite.txt'))
  ? fs.readFileSync(path.join(__dirname, '../../templates/104-invite.txt'), 'utf8')
  : '';

let sharedBrowser = null;
let sharedContext = null;
let sharedPage = null;
let loggedInAt = 0;
let currentCompany = null;

async function ensureLoggedIn() {
  const user = process.env.VINCENT_104_ACCOUNT || process.env.MOFAN_104_ACCOUNT;
  const pwd = process.env.VINCENT_104_PASSWORD || process.env.MOFAN_104_PASSWORD;
  if (!user || !pwd) throw new Error('104 credentials missing (VINCENT_104_ACCOUNT + _PASSWORD)');

  const fresh = Date.now() - loggedInAt < STATE_TTL_MS;
  if (sharedPage && fresh) return sharedPage;

  if (sharedBrowser) { try { await sharedBrowser.close(); } catch {} sharedBrowser = null; }

  console.log('[104] launching chromium...');
  sharedBrowser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  sharedContext = await sharedBrowser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
  });
  sharedPage = await sharedContext.newPage();

  console.log('[104] logging in...');
  await sharedPage.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sharedPage.waitForTimeout(1500);
  await sharedPage.fill('input[type="email"], input[name="username"], input[name="account"]', user).catch(() => {});
  await sharedPage.fill('input[type="password"], input[name="password"]', pwd).catch(() => {});
  await sharedPage.keyboard.press('Enter').catch(() => {});
  try {
    await sharedPage.waitForURL(/pro\.104|vip\.104|hrsystem/, { timeout: 15000 });
  } catch {
    throw new Error('104 login failed (page did not redirect)');
  }
  loggedInAt = Date.now();
  console.log('[104] logged in');
  return sharedPage;
}

async function switchCompany(companyKey) {
  const targetName = COMPANIES[companyKey];
  if (!targetName) throw new Error(`unknown company: ${companyKey}`);
  if (currentCompany === companyKey) return;

  const page = await ensureLoggedIn();
  console.log(`[104] switching to ${targetName}...`);
  if (!page.url().includes('vip.104.com.tw')) {
    await page.goto(VIP_HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
  }

  try {
    await page.getByText(/切換公司/).first().click({ timeout: 5000 });
  } catch {
    await page.click('header [class*="user"], [class*="userName"]', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.getByText(/切換公司/).first().click({ timeout: 5000 });
  }
  await page.waitForTimeout(500);
  // 可能需點「查看全部公司」
  try { await page.getByText(/查看全部公司/).first().click({ timeout: 2000 }); } catch {}
  await page.getByText(targetName).first().click({ timeout: 5000 });
  await page.waitForTimeout(2000);
  await page.waitForSelector(`text=${targetName}`, { timeout: 10000 });
  currentCompany = companyKey;
  console.log(`[104] now in ${targetName}`);
}

// 搜尋人才 — 透過 auth.vip.104.com.tw REST API
async function searchCandidates(opts = {}) {
  const page = await ensureLoggedIn();
  const params = new URLSearchParams({
    ec: opts.jobCategory || '106',
    plastActionDateType: '1',
    workExpTimeType: 'all',
    sex: '2',
    empStatus: '0',
    updateDateType: '1',
    contactPrivacy: '0',
    sortType: 'PLASTACTIONDATE',
    page: String(opts.page || 1),
  });
  const url = `https://auth.vip.104.com.tw/api/search/searchResult?${params}`;
  return await page.evaluate(async (u) => {
    const r = await fetch(u, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    return r.json();
  }, url);
}

// 擷取聯絡訊息頁（DOM scrape）回傳新回覆
async function listRecentMessages() {
  const page = await ensureLoggedIn();
  await page.goto(MSG_LIST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  return await page.evaluate(() => {
    const items = [];
    const trs = document.querySelectorAll('table tr, [class*="msg-item"], [class*="message-row"]');
    for (const tr of trs) {
      const text = (tr.innerText || '').trim();
      let status = null;
      if (/面試同意/.test(text)) status = 'interview_accept';
      else if (/面試未同意|未同意/.test(text)) status = 'interview_reject';
      else if (/到職同意/.test(text)) status = 'onboard_accept';
      else if (/無意願|婉拒/.test(text)) status = 'rejected';
      else if (/收到/.test(text)) status = 'other_reply';
      if (!status) continue;
      items.push({ status, text: text.slice(0, 500) });
    }
    return items;
  });
}

/**
 * 發送「詢問意願」邀約訊息
 *
 * 流程（實測擷取）：
 *  1. 進搜尋結果頁或求職者詳情頁
 *  2. 點「邀約」→ 跳「聯絡」modal（3 選項：詢問意願 / 邀約面試 / 到職日期提醒）
 *  3. 點「詢問意願」→ 跳編寫訊息頁
 *  4. 填標題 + 內容
 *  5. 點「送出」
 *
 * 參數：
 *   candidate104Id — 從搜尋 API 回傳的 pid（必要）
 *   jobName — 替換 #jname# 佔位符的職缺名
 *   customMessage — 客製化訊息，不填則用 template
 */
async function sendInvite(candidate104Id, jobName, customMessage) {
  if (!candidate104Id) return { ok: false, error: 'candidate104Id required' };

  const page = await ensureLoggedIn();
  const message = (customMessage || INVITE_TEMPLATE).replace(/#jname#/g, jobName || '業務');

  try {
    // 直接進求職者頁面
    await page.goto(`https://vip.104.com.tw/search/masterInfo?pid=${candidate104Id}`, {
      waitUntil: 'domcontentloaded', timeout: 30000,
    });
    await page.waitForTimeout(1500);

    // 點「邀約」按鈕（藍色 primary button）
    await page.locator('button.btn-primary:has-text("邀約")').first().click({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 點 modal 裡的「詢問意願」
    await page.locator('text=詢問意願').first().click({ timeout: 10000 });
    await page.waitForTimeout(2500);

    // 填訊息內容（編輯區通常是 textarea 或 contenteditable）
    const textareaSelector = 'textarea[name*="content"], textarea[placeholder*="訊息"], [contenteditable="true"]';
    try {
      await page.locator(textareaSelector).first().fill(message, { timeout: 5000 });
    } catch {
      // fallback: 聚焦到訊息框後用 keyboard
      await page.locator('textarea').first().click();
      await page.keyboard.press('Control+a');
      await page.keyboard.press('Delete');
      await page.keyboard.type(message, { delay: 20 });
    }
    await page.waitForTimeout(1000);

    // 點「送出」
    await page.locator('button:has-text("送出"), button:has-text("傳送"), button:has-text("確認送出")').first().click({ timeout: 10000 });
    await page.waitForTimeout(3000);

    // 驗證成功：URL 應該跳到 message 頁，或出現成功訊息
    const url = page.url();
    if (url.includes('/message/') || url.includes('success')) {
      return { ok: true, url };
    }
    // 檢查頁面文字
    const bodyText = await page.locator('body').innerText({ timeout: 2000 }).catch(() => '');
    if (/已送出|傳送成功|sent/i.test(bodyText)) return { ok: true };

    return { ok: true, note: 'sent (no explicit confirmation)' };
  } catch (err) {
    // 截圖 debug
    try {
      const ts = Date.now();
      await page.screenshot({ path: `/tmp/104_invite_error_${candidate104Id}_${ts}.png` });
    } catch {}
    return { ok: false, error: err.message };
  }
}

/**
 * 發送「邀約面試」訊息（第二階段，求職者已表達意願後）
 *
 * 參數：
 *   candidate104Id — 104 pid
 *   interviewDateTime — ISO 字串，例如 "2026-04-17T14:00:00+08:00"
 *   location — 面試地點或視訊連結
 *   message — 可選，客製化訊息
 */
async function sendInterviewInvite(candidate104Id, interviewDateTime, location, message) {
  if (!candidate104Id) return { ok: false, error: 'candidate104Id required' };

  const page = await ensureLoggedIn();
  try {
    await page.goto(`https://vip.104.com.tw/search/masterInfo?pid=${candidate104Id}`, {
      waitUntil: 'domcontentloaded', timeout: 30000,
    });
    await page.waitForTimeout(1500);
    await page.locator('button.btn-primary:has-text("邀約")').first().click({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.locator('text=邀約面試').first().click({ timeout: 10000 });
    await page.waitForTimeout(2500);

    // 填面試時間（datetime input / date picker）
    const d = new Date(interviewDateTime);
    const dateStr = d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Taipei' }).replace(/\//g, '-');
    const timeStr = d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' });

    try { await page.locator('input[type="date"]').first().fill(dateStr); } catch {}
    try { await page.locator('input[type="time"]').first().fill(timeStr); } catch {}

    // 填地點
    if (location) {
      try {
        await page.locator('input[name*="location"], input[placeholder*="地點"]').first().fill(location);
      } catch {}
    }

    // 填訊息
    if (message) {
      try {
        await page.locator('textarea').first().fill(message);
      } catch {}
    }

    await page.waitForTimeout(800);
    await page.locator('button:has-text("送出"), button:has-text("傳送")').first().click({ timeout: 10000 });
    await page.waitForTimeout(3000);

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function close() {
  if (sharedBrowser) { try { await sharedBrowser.close(); } catch {} }
  sharedBrowser = sharedContext = sharedPage = null;
}

module.exports = {
  COMPANIES,
  ensureLoggedIn,
  switchCompany,
  searchCandidates,
  listRecentMessages,
  sendInvite,
  sendInterviewInvite,
  close,
  getSession: (key) => ({
    ensureLoggedIn,
    switchCompany: () => switchCompany(key),
    searchCandidates, listRecentMessages, sendInvite, sendInterviewInvite, close,
  }),
  closeAll: close,
  ACCOUNTS: COMPANIES,
};
