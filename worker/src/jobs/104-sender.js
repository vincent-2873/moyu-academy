// 104 自動發邀約 job
//
// 用戶定義的發信時間：**每天早上 07:00-09:00**
// 每 10 分鐘發一批，直到當日配額滿或時間過。
//
// 配額（recruit_criteria 表）：墨凡 200/日 / 睿富 300/日
// 風控：每封間隔 5-15 秒隨機 + 每發 10 封休息 60 秒

const session = require('../lib/104-session');
const { getSupabase } = require('../lib/supabase');
const { linePushText } = require('../lib/line');

const WINDOW_START_HOUR = 7;
const WINDOW_END_HOUR = 9;
const COMPANIES = ['mofan', 'ruifu'];

function tpNow() {
  return new Date(Date.now() + 8 * 3600 * 1000);
}

function todayDateStr() {
  return tpNow().toISOString().slice(0, 10);
}

function hourTW() {
  return tpNow().getUTCHours();
}

function isInWindow() {
  const h = hourTW();
  return h >= WINDOW_START_HOUR && h < WINDOW_END_HOUR;
}

function randomDelay(minMs, maxMs) {
  return new Promise((r) => setTimeout(r, Math.floor(minMs + Math.random() * (maxMs - minMs))));
}

async function processCompany(companyKey) {
  const s = getSupabase();

  const { data: criteria } = await s
    .from('recruit_criteria')
    .select('*')
    .eq('account', companyKey)
    .eq('enabled', true)
    .maybeSingle();
  if (!criteria) {
    console.log(`[sender] ${companyKey}: no criteria, skip`);
    return;
  }

  const today = todayDateStr();
  const { count: sentToday } = await s
    .from('outreach_log')
    .select('id', { count: 'exact', head: true })
    .eq('account', companyKey)
    .gte('sent_at', today + 'T00:00:00Z');

  const remaining = Math.max(0, criteria.daily_quota - (sentToday || 0));
  const batchSize = Math.min(remaining, 20); // 每次跑最多 20 封，分散在 10 分鐘間
  console.log(`[sender] ${companyKey}: quota=${criteria.daily_quota} sent=${sentToday} remaining=${remaining} batch=${batchSize}`);

  if (batchSize === 0) return;

  try {
    await session.switchCompany(companyKey);

    // 搜尋候選人
    const searchResult = await session.searchCandidates({
      jobCategory: '106',
      keywords: criteria.job_keywords || ['業務', '電銷'],
    });

    const candidates = searchResult?.data?.list || searchResult?.list || [];
    if (candidates.length === 0) {
      console.log(`[sender] ${companyKey}: no candidates found`);
      return;
    }

    let sent = 0;
    for (const c of candidates.slice(0, batchSize)) {
      const pid = c.pid || c.id || c.pKey;
      const name = c.name || c.displayName;
      if (!pid) continue;

      // 跟 outreach_log 去重
      const { data: exist } = await s
        .from('outreach_log')
        .select('id')
        .eq('candidate_104_id', String(pid))
        .eq('account', companyKey)
        .maybeSingle();
      if (exist) continue;

      const result = await session.sendInvite(pid, '課程行銷顧問');
      if (result.ok) {
        await s.from('outreach_log').insert({
          candidate_name: name,
          candidate_104_id: String(pid),
          account: companyKey,
          platform: '104',
          sent_at: new Date().toISOString(),
        });
        sent++;
        console.log(`[sender] ${companyKey}: sent to ${name} (${pid})`);
        // 每發一封隨機延遲 5-15 秒
        await randomDelay(5000, 15000);
        // 每 10 封休息 60 秒
        if (sent % 10 === 0) await randomDelay(60000, 90000);
      } else {
        console.warn(`[sender] ${companyKey}: failed ${name}: ${result.error}`);
        // 連續失敗 3 次 → 停止本批
        await randomDelay(3000, 5000);
      }
    }

    console.log(`[sender] ${companyKey}: batch done, sent=${sent}`);
    if (sent > 0) {
      await linePushText(`📤 104 ${companyKey === 'mofan' ? '墨凡' : '睿富'} 發信 ${sent} 封 (今日累計 ${(sentToday || 0) + sent} / ${criteria.daily_quota})`);
    }
  } catch (err) {
    console.error(`[sender] ${companyKey} error:`, err.message);
    await linePushText(`⚠️ 104 sender (${companyKey}): ${err.message}`);
  }
}

async function runOnce() {
  if (!isInWindow()) {
    const h = hourTW();
    console.log(`[sender] outside window (${h}h, target ${WINDOW_START_HOUR}-${WINDOW_END_HOUR}), skip`);
    return;
  }
  for (const c of COMPANIES) {
    await processCompany(c);
  }
}

async function start() {
  // 每 10 分鐘跑一次
  setInterval(runOnce, 10 * 60 * 1000);
  // 啟動後 60 秒試跑一次（如在 window 內會發）
  setTimeout(runOnce, 60 * 1000);
}

module.exports = { start, runOnce };
