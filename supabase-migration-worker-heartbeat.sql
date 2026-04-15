-- moyu-worker heartbeat 表：讓 moyu-academy 能遠端驗證 worker 是否存活
CREATE TABLE IF NOT EXISTS worker_heartbeat (
  service TEXT PRIMARY KEY,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uptime_seconds BIGINT,
  meta JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_heartbeat_last_seen ON worker_heartbeat (last_seen DESC);
