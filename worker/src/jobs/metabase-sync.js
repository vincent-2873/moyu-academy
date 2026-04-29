// Metabase 業務即時數據同步 — Question 1381
//
// 架構:Vincent 永不關機 + Chrome 永開,worker 連 his Chrome via CDP 用他 session
// 啟動方式:
//   1. Vincent 啟動 Chrome 加 flag(只啟動一次設定):
//      "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
//   2. Vincent 在那 Chrome 登入 Google → 自動 SSO 通 mb.kolable.com
//   3. worker(Node.js)pm2 啟動,connectOverCDP localhost:9222,sharing Vincent session
//
// 跑模式:
//   node metabase-sync.js                    # 跑 today
//   node metabase-sync.js backfill            # 從 2025-01-01 跑到 today(自動 resume from last sync)
//   node metabase-sync.js backfill 2025-06-01 # 從指定日期
//
// 從不下檔:fetch → normalise → upsert sales_metrics_daily(server-side service_role key)
// pm2 cron(15 min)+ on-demand backfill 共用同一個 fn

const { chromium } = require('playwright');
const { getSupabase } = require('../lib/supabase');

const QUESTION_ID = parseInt(process.env.METABASE_QUESTION_ID || '1381', 10);
const METABASE_HOST = process.env.METABASE_HOST || 'https://mb.kolable.com';
const CDP_URL = process.env.CHROME_CDP_URL || 'http://localhost:9222';

const COL_MAP = {
  salesperson_id: 'salesperson_id', app_id: 'app_id', email: 'email', name: 'name',
  '機構': 'org', '組別': 'team', '等級': 'level', '通次': 'calls', '通時': 'call_minutes',
  '接通數': 'connected', '原始邀約數': 'raw_appointments', '邀約出席數': 'appointments_show',
  '原始未出席數': 'raw_no_show', '原始DEMO數': 'raw_demos', 'DEMO失敗數': 'demo_failed', '成交數': 'closures',
};
const BRAND_ALIASES = { sixdigital: 'ooschool', xlab: 'aischool' };

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') { const c = v.replace(/,/g, '').trim(); return c === '' ? 0 : (Number.isFinite(Number(c)) ? Number(c) : 0); }
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}
function numInt(v) { return Math.round(num(v)); }
function str(v) { if (v == null) return null; const s = String(v).trim(); return s.length ? s : null; }
function tpToday() { return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10); }
function addDays(s, n) { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

let _ctx = null;
async function getMetabaseContext() {
  if (_ctx) return _ctx;
  console.log(`[mb-sync] connecting to Vincent Chrome via CDP ${CDP_URL}...`);
  const browser = await chromium.connectOverCDP(CDP_URL);
  const contexts = browser.contexts();
  if (contexts.length === 0) throw new Error('No browser context found - Vincent Chrome 未開或 --remote-debugging-port=9222 未啟用');
  _ctx = contexts[0]; // share Vincent's logged-in context
  console.log('[mb-sync] connected, using Vincent existing session');
  return _ctx;
}

async function fetchDay(date) {
  const ctx = await getMetabaseContext();
  const body = {
    parameters: [
      { type: 'date/single', target: ['variable', ['template-tag', 'startDate']], value: date },
      { type: 'date/single', target: ['variable', ['template-tag', 'endDate']], value: date },
    ],
    ignore_cache: true,
  };
  // Use the context's request API — uses Vincent cookies automatically
  const res = await ctx.request.post(`${METABASE_HOST}/api/card/${QUESTION_ID}/query`, {
    headers: { 'Content-Type': 'application/json' },
    data: body,
  });
  if (!res.ok()) throw new Error(`Metabase ${res.status()} for ${date}`);
  const json = await res.json();
  if (json.error) throw new Error(`Metabase err: ${json.error}`);
  return {
    cols: (json.data?.cols || []).map(c => c.display_name || c.name),
    rows: json.data?.rows || [],
  };
}

function normaliseRow(cols, row, date) {
  const dbFields = cols.map(c => COL_MAP[c] || c);
  const idx = (f) => dbFields.indexOf(f);
  const get = (f) => { const i = idx(f); return i >= 0 ? row[i] : null; };

  const sp_id = str(get('salesperson_id'));
  if (!sp_id) return null;

  const app_id = str(get('app_id')) || 'xuemi';
  const brand = BRAND_ALIASES[app_id] || app_id;

  const rawObj = {};
  cols.forEach((c, i) => (rawObj[c] = row[i]));

  return {
    date, salesperson_id: sp_id, brand,
    team: str(get('team')), org: str(get('org')), name: str(get('name')),
    email: str(get('email')), level: str(get('level')),
    calls: numInt(get('calls')), call_minutes: numInt(get('call_minutes')),
    connected: numInt(get('connected')),
    raw_appointments: numInt(get('raw_appointments')), appointments_show: numInt(get('appointments_show')),
    raw_no_show: numInt(get('raw_no_show')), raw_demos: numInt(get('raw_demos')), demo_failed: numInt(get('demo_failed')),
    closures: numInt(get('closures')),
    raw: rawObj,
    last_synced_at: new Date().toISOString(),
  };
}

async function syncDay(date) {
  const supabase = getSupabase();
  console.log(`[mb-sync] ${date}...`);
  const { cols, rows } = await fetchDay(date);
  const normalised = rows.map(r => normaliseRow(cols, r, date)).filter(Boolean);
  if (normalised.length === 0) {
    console.log(`[mb-sync] ${date}: 0 rows`);
    return { date, rows: 0 };
  }
  const { error } = await supabase
    .from('sales_metrics_daily')
    .upsert(normalised, { onConflict: 'date,salesperson_id,brand' });
  if (error) {
    console.error(`[mb-sync] ${date} upsert error:`, error.message);
    return { date, rows: 0, error: error.message };
  }
  console.log(`[mb-sync] ${date}: ${normalised.length} rows synced`);
  return { date, rows: normalised.length };
}

async function backfill(from, to) {
  const start = from || '2025-01-01';
  const end = to || tpToday();
  console.log(`[mb-sync] backfill ${start} → ${end}`);
  let cur = start;
  let totalRows = 0, failed = 0, days = 0;
  while (cur <= end) {
    try {
      const r = await syncDay(cur);
      totalRows += r.rows || 0;
      if (r.error) failed++;
      days++;
    } catch (e) {
      console.error(`[mb-sync] ${cur} failed:`, e.message);
      failed++;
    }
    cur = addDays(cur, 1);
    await new Promise(r => setTimeout(r, 300));
  }
  console.log(`[mb-sync] backfill done. days=${days} total_rows=${totalRows} failed=${failed}`);
}

async function main() {
  const mode = process.argv[2] || 'today';
  if (mode === 'backfill') {
    await backfill(process.argv[3], process.argv[4]);
  } else {
    await syncDay(tpToday());
  }
  process.exit(0);
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { syncDay, backfill };
