// 104 自動發信 job
// 每天 07:00 TW 啟動 → 依節奏發完當日額度 → 22:00 停止
// 額度：墨凡 200 封、睿富 300 封

const { getSession } = require('../lib/104-session');
const { getSupabase } = require('../lib/supabase');
const { linePushText } = require('../lib/line');
const fs = require('fs');
const path = require('path');

const TEMPLATE = fs.readFileSync(path.join(__dirname, '../../templates/104-invite.txt'), 'utf8');

function nowInTW() {
  return new Date(Date.now() + 8 * 3600 * 1000);
}

function todayDateStr() {
  return nowInTW().toISOString().slice(0, 10);
}

function hourTW() {
  return nowInTW().getUTCHours();
}

async function processAccount(accountKey) {
  const s = getSupabase();
  const session = getSession(accountKey);

  // 讀招募條件
  const { data: criteria } = await s
    .from('recruit_criteria')
    .select('*')
    .eq('account', accountKey)
    .eq('enabled', true)
    .single();

  if (!criteria) {
    console.log(`[104-sender] ${accountKey}: no criteria, skip`);
    return;
  }

  const quota = criteria.daily_quota;

  // 今天已發多少
  const today = todayDateStr();
  const { count: sentToday } = await s
    .from('outreach_log')
    .select('id', { count: 'exact', head: true })
    .eq('account', accountKey)
    .gte('sent_at', today + 'T00:00:00Z');

  const remaining = Math.max(0, quota - (sentToday || 0));
  console.log(`[104-sender] ${accountKey}: quota=${quota} sent=${sentToday} remaining=${remaining}`);

  if (remaining === 0) return;

  // TODO: 搜尋 + 發信迴圈
  // 為了先讓 worker 能啟動，這裡先跳過實際執行
  console.log(`[104-sender] ${accountKey}: search+send not yet implemented, waiting for 104 selector mapping`);
}

async function runOnce() {
  const hour = hourTW();
  if (hour < 7 || hour >= 22) {
    console.log(`[104-sender] outside working hours (${hour}), skip`);
    return;
  }

  try {
    await processAccount('mofan');
    await processAccount('ruifu');
  } catch (err) {
    console.error('[104-sender] error:', err.message);
    await linePushText(`⚠️ 104 sender error: ${err.message}`);
  }
}

async function start() {
  // 每 30 分鐘跑一次（內部有節奏控制）
  setInterval(runOnce, 30 * 60 * 1000);
  // 啟動時先試跑一次
  setTimeout(runOnce, 10 * 1000);
}

module.exports = { start, runOnce };
