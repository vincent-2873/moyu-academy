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

async function sendInvite(candidate104Id, jobName, customMessage) {
  // TODO: 需要實測後端點擊 flow（點「邀約」→ 填訊息 → 送出）
  return { ok: false, error: 'sendInvite not implemented — needs click flow capture' };
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
  close,
  // backward-compat
  getSession: (key) => ({ ensureLoggedIn, switchCompany: () => switchCompany(key), searchCandidates, listRecentMessages, sendInvite, close }),
  closeAll: close,
  ACCOUNTS: COMPANIES,
};
