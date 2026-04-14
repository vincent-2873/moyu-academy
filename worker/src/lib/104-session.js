// 104 企業後台 Playwright session manager
// 兩個帳號：mofan (墨凡) / ruifu (睿富)
// 維持長時 session，避免頻繁登入被風控

const { chromium } = require('playwright');

const ACCOUNTS = {
  mofan: {
    username: process.env.MOFAN_104_ACCOUNT,
    password: process.env.MOFAN_104_PASSWORD,
    label: '墨凡',
  },
  ruifu: {
    username: process.env.RUIFU_104_ACCOUNT,
    password: process.env.RUIFU_104_PASSWORD,
    label: '睿富',
  },
};

const LOGIN_URL = 'https://pro.104.com.tw/psc/login';
const STATE_TTL_MS = 25 * 60 * 1000; // 25 分鐘重登

class Session104 {
  constructor(accountKey) {
    this.accountKey = accountKey;
    this.config = ACCOUNTS[accountKey];
    this.browser = null;
    this.context = null;
    this.page = null;
    this.loggedInAt = 0;
  }

  isExpired() {
    return Date.now() - this.loggedInAt > STATE_TTL_MS;
  }

  async ensureLoggedIn() {
    if (this.page && !this.isExpired()) return this.page;

    if (this.browser) {
      try { await this.browser.close(); } catch {}
      this.browser = null;
    }

    if (!this.config.username || !this.config.password) {
      throw new Error(`${this.accountKey} 104 credentials missing in env`);
    }

    console.log(`[104-${this.accountKey}] launching browser...`);
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
      ],
    });

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
      locale: 'zh-TW',
      timezoneId: 'Asia/Taipei',
    });

    this.page = await this.context.newPage();
    await this.login();
    this.loggedInAt = Date.now();
    return this.page;
  }

  async login() {
    const page = this.page;
    console.log(`[104-${this.accountKey}] logging in...`);
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // 104 登入頁 selector 需實測確認
    // Placeholder selectors — 第一次跑時要實際登入確認 DOM
    await page.waitForTimeout(1500);
    // TODO: 填入正確 selector
    // await page.fill('input[name="username"]', this.config.username);
    // await page.fill('input[name="password"]', this.config.password);
    // await page.click('button[type="submit"]');
    // await page.waitForURL(/dashboard|home/, { timeout: 15000 });
    console.log(`[104-${this.accountKey}] logged in`);
  }

  async searchCandidates(criteria) {
    await this.ensureLoggedIn();
    // TODO: 實作搜尋 + 翻頁 + 擷取
    throw new Error('not implemented');
  }

  async sendMessage(candidateId, message) {
    await this.ensureLoggedIn();
    // TODO: 實作訊息發送
    throw new Error('not implemented');
  }

  async listConversations(sinceMs) {
    await this.ensureLoggedIn();
    // TODO: 列聯絡訊息
    throw new Error('not implemented');
  }

  async downloadResume(candidateId) {
    await this.ensureLoggedIn();
    // TODO: 下載履歷 PDF
    throw new Error('not implemented');
  }

  async close() {
    if (this.browser) {
      try { await this.browser.close(); } catch {}
      this.browser = null;
      this.page = null;
    }
  }
}

// Session pool：每帳號一個長期存活的 Session
const pool = {};

function getSession(accountKey) {
  if (!ACCOUNTS[accountKey]) throw new Error(`unknown 104 account: ${accountKey}`);
  if (!pool[accountKey]) pool[accountKey] = new Session104(accountKey);
  return pool[accountKey];
}

async function closeAll() {
  for (const s of Object.values(pool)) await s.close();
}

module.exports = { getSession, closeAll, ACCOUNTS };
