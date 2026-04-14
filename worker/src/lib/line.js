// Minimal LINE push helper for worker alerts to Vincent

async function linePushText(text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const toUserId = process.env.LINE_ALERT_USER_ID; // Vincent's LINE user id for alerts
  if (!token || !toUserId) return { ok: false, error: 'LINE not configured' };
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: toUserId, messages: [{ type: 'text', text: text.slice(0, 4500) }] }),
    });
    return { ok: r.ok, status: r.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { linePushText };
