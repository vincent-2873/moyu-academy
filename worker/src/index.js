// Moyu Worker — 統一 supervisor 啟動所有 background job
// 在 Zeabur 跑 Docker container，Playwright headless browser 跑 104 自動化

require('dotenv').config();

const jobs = [
  { name: '104-sender', path: './jobs/104-sender', enabled: true },
  { name: '104-poller', path: './jobs/104-poller', enabled: true },
  { name: '104-interview-sender', path: './jobs/104-interview-sender', enabled: true },
  { name: 'phone-call-sync', path: './jobs/phone-call-sync', enabled: true },
];

const TZ_OFFSET_MS = 8 * 3600 * 1000;

function tpNow() {
  return new Date(Date.now() + TZ_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 19);
}

function log(tag, msg) {
  console.log(`[${tpNow()}] [${tag}] ${msg}`);
}

async function runJob(job) {
  try {
    const mod = require(job.path);
    if (typeof mod.start === 'function') {
      log(job.name, 'starting...');
      await mod.start();
      log(job.name, 'started');
    } else {
      log(job.name, 'ERROR: no start() export');
    }
  } catch (err) {
    log(job.name, `FAILED: ${err.message}`);
    console.error(err);
  }
}

async function main() {
  log('supervisor', `Moyu Worker starting, node ${process.version}, TZ=${process.env.TZ}`);
  log('supervisor', `Enabled jobs: ${jobs.filter(j => j.enabled).map(j => j.name).join(', ')}`);

  // 檢查關鍵環境變數
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    log('supervisor', `FATAL: missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  // 啟動所有啟用的 job
  for (const job of jobs) {
    if (job.enabled) await runJob(job);
  }

  // 健康檢查 heartbeat
  setInterval(() => {
    log('supervisor', `heartbeat, uptime=${Math.floor(process.uptime())}s`);
  }, 5 * 60 * 1000);

  log('supervisor', 'all jobs started, entering idle loop');
}

// 優雅關閉
process.on('SIGTERM', () => {
  log('supervisor', 'SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  log('supervisor', `Unhandled rejection: ${reason}`);
  console.error(reason);
});

main().catch((err) => {
  log('supervisor', `FATAL: ${err.message}`);
  console.error(err);
  process.exit(1);
});
