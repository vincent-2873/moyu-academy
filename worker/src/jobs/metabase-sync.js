// Metabase 業務即時數據同步 — Question 1381
//
// Vincent 規格:
//   每 15 分鐘從 mb.kolable.com Question 1381 拉資料
//   第一次回測 2025-01-01 → today
//   後續每 15 min 跑當日 sync
//
// Metabase 認證:
//   Metabase 透過 Google SSO,沒 user/pass。改用 session cookie。
//   Vincent 從 Chrome DevTools(已登入 mb.kolable.com)取 cookie:
//     Application → Cookies → mb.kolable.com → metabase.SESSION → 複製 value
//   貼到 worker .env 的 METABASE_SESSION=xxx (14 day 有效)
//   過期 → worker 推 LINE 提醒 Vincent 重新貼。
//
// Mode:
//   node src/jobs/metabase-sync.js                  # 跑 today
//   node src/jobs/metabase-sync.js backfill         # 從 2025-01-01 跑到 today
//   node src/jobs/metabase-sync.js backfill 2026-04-01  # 從指定日期跑

const { getSupabase } = require('../lib/supabase');

const METABASE_HOST = process.env.METABASE_HOST || 'https://mb.kolable.com';
const METABASE_SESSION = process.env.METABASE_SESSION;
const QUESTION_ID = parseInt(process.env.METABASE_QUESTION_ID || '1381', 10);

function tpToday() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function queryCard(date) {
  if (!METABASE_SESSION) throw new Error('METABASE_SESSION not set (set worker .env)');

  const body = {
    parameters: [
      { type: 'date/single', target: ['variable', ['template-tag', 'startDate']], value: date },
      { type: 'date/single', target: ['variable', ['template-tag', 'endDate']], value: date },
    ],
    ignore_cache: true,
  };

  const res = await fetch(`${METABASE_HOST}/api/card/${QUESTION_ID}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Metabase-Session': METABASE_SESSION,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(`METABASE_SESSION_EXPIRED: HTTP ${res.status}. Vincent 從 Chrome DevTools 重新撈 metabase.SESSION cookie 貼進 worker .env`);
  }
  if (!res.ok) throw new Error(`Metabase query failed: HTTP ${res.status}`);

  const json = await res.json();
  if (json.error) throw new Error(`Metabase error: ${json.error}`);

  const cols = (json.data?.cols || []).map(c => c.display_name || c.name);
  const rows = json.data?.rows || [];
  return { cols, rows };
}

const BRAND_ALIASES = { sixdigital: 'ooschool', xlab: 'aischool' };

function num(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const cleaned = v.replace(/,/g, '').trim();
    return cleaned === '' ? 0 : (Number.isFinite(Number(cleaned)) ? Number(cleaned) : 0);
  }
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}
function numInt(v) { return Math.round(num(v)); }
function str(v) { if (v == null) return null; const s = String(v).trim(); return s.length ? s : null; }

function normaliseRow(cols, row, defaultBrand, date) {
  const idx = (name) => cols.indexOf(name);
  const get = (name) => { const i = idx(name); return i >= 0 ? row[i] : null; };

  const salesperson_id = str(get('salesperson_id'));
  if (!salesperson_id) return null;

  const rawObj = {};
  cols.forEach((c, i) => (rawObj[c] = row[i]));

  const app_id = str(get('app_id'));
  const rawBrand = app_id || defaultBrand;
  const brand = BRAND_ALIASES[rawBrand] || rawBrand;

  return {
    date,
    salesperson_id,
    brand,
    team: str(get('team')),
    org: str(get('org')),
    name: str(get('name')),
    email: str(get('email')),
    level: str(get('level')),
    calls: numInt(get('calls')),
    call_minutes: numInt(get('call_minutes')),
    connected: numInt(get('connected')),
    raw_appointments: numInt(get('raw_appointments')),
    appointments_show: numInt(get('appointments_show')),
    raw_no_show: numInt(get('raw_no_show')),
    raw_demos: numInt(get('raw_demos')),
    demo_failed: numInt(get('demo_failed')),
    closures: numInt(get('closures')),
    net_closures_daily: num(get('net_closures_daily')),
    net_closures_contract: num(get('net_closures_contract')),
    gross_revenue: num(get('gross_revenue')),
    net_revenue_daily: num(get('net_revenue_daily')),
    net_revenue_contract: num(get('net_revenue_contract')),
    raw: rawObj,
    last_synced_at: new Date().toISOString(),
  };
}

async function syncDay(date) {
  const supabase = getSupabase();
  console.log(`[metabase] syncing ${date}...`);
  const { cols, rows } = await queryCard(date);
  if (rows.length === 0) {
    console.log(`[metabase] ${date}: 0 rows`);
    return { date, rows: 0 };
  }
  const normalised = rows
    .map(r => normaliseRow(cols, r, 'xuemi', date))
    .filter(Boolean);
  if (normalised.length === 0) return { date, rows: 0 };

  const { error } = await supabase
    .from('sales_metrics_daily')
    .upsert(normalised, { onConflict: 'date,salesperson_id,brand' });

  if (error) {
    console.error(`[metabase] upsert error for ${date}:`, error.message);
    return { date, rows: 0, error: error.message };
  }

  console.log(`[metabase] ${date}: ${normalised.length} rows synced`);
  return { date, rows: normalised.length };
}

async function main() {
  const mode = process.argv[2] || 'today';
  if (mode === 'backfill') {
    const fromArg = process.argv[3] || '2025-01-01';
    const today = tpToday();
    let cur = fromArg;
    let totalRows = 0;
    let failed = 0;
    while (cur <= today) {
      try {
        const r = await syncDay(cur);
        totalRows += r.rows || 0;
        if (r.error) failed++;
      } catch (e) {
        console.error(`[metabase] ${cur} failed:`, e.message);
        failed++;
        if (e.message.includes('METABASE_SESSION_EXPIRED')) {
          console.error('[metabase] session expired, stopping backfill');
          break;
        }
      }
      cur = addDays(cur, 1);
      await new Promise(r => setTimeout(r, 300));
    }
    console.log(`[metabase] backfill done. total_rows=${totalRows} failed=${failed}`);
  } else {
    await syncDay(tpToday());
  }
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { syncDay, queryCard };
