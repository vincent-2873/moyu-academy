// 面試派送 job — 每 30 秒掃 pending_104_actions 表
// 前台招聘員按下面試登記 → 這邊去 104 發面試邀請

const { getSession } = require('../lib/104-session');
const { getSupabase } = require('../lib/supabase');
const { linePushText } = require('../lib/line');

async function processOne(action) {
  const supabase = getSupabase();
  const session = getSession(action.account);

  await supabase
    .from('pending_104_actions')
    .update({ status: 'processing', attempts: action.attempts + 1 })
    .eq('id', action.id);

  try {
    // TODO: 實作 sendInterviewInvite (在 104 發面試訊息 + 下載履歷)
    console.log(`[104-interview] ${action.candidate_name} (${action.account}): not yet implemented`);

    await supabase
      .from('pending_104_actions')
      .update({ status: 'done', processed_at: new Date().toISOString() })
      .eq('id', action.id);
  } catch (err) {
    await supabase
      .from('pending_104_actions')
      .update({ status: 'failed', error_message: err.message })
      .eq('id', action.id);
    console.error(`[104-interview] ${action.id} failed:`, err.message);
  }
}

async function runOnce() {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('pending_104_actions')
    .select('*')
    .eq('status', 'pending')
    .eq('action_type', 'send_interview_invite')
    .lt('attempts', 3)
    .order('created_at', { ascending: true })
    .limit(5);

  if (!data || data.length === 0) return;

  for (const a of data) await processOne(a);
}

async function start() {
  setInterval(runOnce, 30 * 1000);
  setTimeout(runOnce, 15 * 1000);
}

module.exports = { start, runOnce };
