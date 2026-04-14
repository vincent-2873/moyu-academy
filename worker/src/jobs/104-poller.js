// 104 回覆輪詢 job — 每 10 分鐘掃聯絡訊息
// 偵測「我有興趣/婉拒/其他回覆」→ 寫 Supabase + 產任務 + LINE push

const { getSession } = require('../lib/104-session');
const { getSupabase } = require('../lib/supabase');
const { linePushText } = require('../lib/line');

async function pollAccount(accountKey) {
  const session = getSession(accountKey);
  const supabase = getSupabase();

  try {
    // TODO: 實作 listConversations 擷取最近 24h 新回覆
    // 過濾新的：跟 outreach_log.reply_received_at 比對
    // 有興趣 → stage=screening + v3_commands 緊急電話任務 + LINE push
    // 婉拒 → stage=rejected + 記 reject_reason
    console.log(`[104-poller] ${accountKey}: not yet implemented`);
  } catch (err) {
    console.error(`[104-poller] ${accountKey} error:`, err.message);
  }
}

async function runOnce() {
  try {
    await pollAccount('mofan');
    await pollAccount('ruifu');
  } catch (err) {
    console.error('[104-poller] fatal:', err.message);
    await linePushText(`⚠️ 104 poller fatal: ${err.message}`);
  }
}

async function start() {
  setInterval(runOnce, 10 * 60 * 1000); // 每 10 分鐘
  setTimeout(runOnce, 30 * 1000);       // 啟動 30 秒後試跑
}

module.exports = { start, runOnce };
