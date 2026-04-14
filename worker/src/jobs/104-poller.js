// 104 回覆輪詢 — 每 10 分鐘掃聯絡訊息
// 偵測面試同意/婉拒/到職同意等 → 寫 Supabase + 產 v3_commands + LINE push

const session = require('../lib/104-session');
const { getSupabase } = require('../lib/supabase');
const { linePushText } = require('../lib/line');

const COMPANIES_TO_POLL = ['mofan', 'ruifu'];

async function pollCompany(companyKey) {
  const s = getSupabase();
  try {
    await session.switchCompany(companyKey);
    const msgs = await session.listRecentMessages();
    console.log(`[poller] ${companyKey}: ${msgs.length} messages with status`);

    for (const m of msgs) {
      // 跟 outreach_log 比對去重（用姓名作 key — 初版簡化，之後改用 104 id）
      const nameMatch = m.text.match(/^([\u4e00-\u9fa5]{2,4})/);
      const name = nameMatch ? nameMatch[1] : null;
      if (!name) continue;

      // 檢查是否已記錄此回覆
      const { data: existing } = await s
        .from('outreach_log')
        .select('id, reply_status')
        .eq('candidate_name', name)
        .eq('account', companyKey)
        .maybeSingle();

      if (existing && existing.reply_status === m.status) continue;

      // 更新 outreach_log
      if (existing) {
        await s.from('outreach_log').update({
          reply_status: m.status,
          reply_received_at: new Date().toISOString(),
        }).eq('id', existing.id);
      } else {
        await s.from('outreach_log').insert({
          candidate_name: name,
          account: companyKey,
          platform: '104',
          reply_status: m.status,
          reply_received_at: new Date().toISOString(),
        });
      }

      // 產 v3_commands 給招聘員
      const severity = m.status === 'interview_accept' || m.status === 'onboard_accept' ? 'critical' : 'high';
      const title = m.status === 'interview_accept' ? `🎉 ${name} 同意面試 — 立即打電話`
                  : m.status === 'onboard_accept' ? `🎉 ${name} 同意到職 — 確認細節`
                  : m.status === 'rejected' ? `❌ ${name} 婉拒 — 關懷一下`
                  : `📩 ${name} 回覆 — 請看內容`;
      await s.from('v3_commands').insert({
        owner_email: companyKey === 'mofan' ? 'lynn@xplatform.world' : 'lynn@xplatform.world',
        pillar_id: 'recruit',
        title,
        detail: m.text.slice(0, 500),
        severity,
        status: 'pending',
        ai_generated: true,
        ai_reasoning: `104_reply_${m.status}`,
      });

      // LINE push
      await linePushText(`${title}\n${m.text.slice(0, 300)}`);
    }
  } catch (err) {
    console.error(`[poller] ${companyKey} error:`, err.message);
    await linePushText(`⚠️ 104 poller (${companyKey}): ${err.message}`);
  }
}

async function runOnce() {
  for (const c of COMPANIES_TO_POLL) await pollCompany(c);
}

async function start() {
  setInterval(runOnce, 10 * 60 * 1000);
  setTimeout(runOnce, 30 * 1000);
}

module.exports = { start, runOnce };
