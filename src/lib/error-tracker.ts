/**
 * N5 (2026-04-30 第三輪):輕量 error tracking
 *
 * 設計取捨:
 *   - 不裝 @sentry/nextjs(避免 build size 暴漲 + Next.js 16 兼容風險)
 *   - 直接用 Sentry Store HTTP API (envelope endpoint)
 *   - 沒 SENTRY_DSN env → 全部 noop(本機開發 / Vincent 還沒申請 free tier 也不會破)
 *   - 同時寫 system_run_log 留一份 DB 紀錄(不 depend on Sentry)
 *
 * 申請 Sentry:
 *   1. https://sentry.io/signup/ 開 free tier(5k events/month)
 *   2. 建 project 選 "Next.js"
 *   3. 拿 DSN(format: https://{key}@{host}/{project_id})
 *   4. Zeabur env 設 SENTRY_DSN
 *
 * 用法:
 *   import { captureException, captureMessage } from '@/lib/error-tracker';
 *   try { ... } catch (err) {
 *     await captureException(err, { tags: { route: '/api/...' }, extra: { ... } });
 *   }
 */

import { getSupabaseAdmin } from "./supabase";

interface ParsedDsn {
  protocol: string;
  publicKey: string;
  host: string;
  projectId: string;
}

let cachedDsn: ParsedDsn | null | undefined = undefined;

function getDsn(): ParsedDsn | null {
  if (cachedDsn !== undefined) return cachedDsn;
  const raw = process.env.SENTRY_DSN;
  if (!raw) {
    cachedDsn = null;
    return null;
  }
  try {
    const m = raw.match(/^(https?):\/\/([^@]+)@([^/]+)\/(.+)$/);
    if (!m) {
      cachedDsn = null;
      return null;
    }
    cachedDsn = { protocol: m[1], publicKey: m[2], host: m[3], projectId: m[4] };
    return cachedDsn;
  } catch {
    cachedDsn = null;
    return null;
  }
}

function generateEventId(): string {
  // UUID v4 32 hex chars(Sentry 要 hex, 不帶 dash)
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  // fallback
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

interface CaptureOpts {
  level?: "fatal" | "error" | "warning" | "info" | "debug";
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  user?: { id?: string; email?: string };
  fingerprint?: string[];
}

async function postToSentry(event: Record<string, unknown>): Promise<boolean> {
  const dsn = getDsn();
  if (!dsn) return false;
  try {
    const url = `${dsn.protocol}://${dsn.host}/api/${dsn.projectId}/store/`;
    const auth = [
      "Sentry sentry_version=7",
      `sentry_client=moyu-academy/1.0`,
      `sentry_key=${dsn.publicKey}`,
    ].join(",");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": auth,
      },
      body: JSON.stringify(event),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function logToDb(level: string, message: string, extra: Record<string, unknown>): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    await sb.from("system_run_log").insert({
      source: "error-tracker",
      status: level === "info" ? "ok" : "fail",
      error_message: message.slice(0, 500),
      metadata: { level, ...extra },
    });
  } catch {
    // best effort
  }
}

export async function captureException(err: unknown, opts: CaptureOpts = {}): Promise<void> {
  const errObj = err instanceof Error ? err : new Error(String(err));
  const event = {
    event_id: generateEventId(),
    timestamp: Math.floor(Date.now() / 1000),
    platform: "javascript",
    level: opts.level || "error",
    server_name: "moyu-academy",
    environment: process.env.NODE_ENV || "production",
    tags: opts.tags || {},
    extra: opts.extra || {},
    user: opts.user || undefined,
    fingerprint: opts.fingerprint,
    exception: {
      values: [
        {
          type: errObj.name || "Error",
          value: errObj.message || String(err),
          stacktrace: errObj.stack ? parseStack(errObj.stack) : undefined,
        },
      ],
    },
  };

  // Always log to console(server side)
  console.error("[error-tracker]", errObj.message, opts.extra);

  // Best-effort:Sentry + DB(parallel)
  await Promise.allSettled([
    postToSentry(event),
    logToDb("error", errObj.message, { ...opts.extra, stack: errObj.stack?.slice(0, 1000) }),
  ]);
}

export async function captureMessage(message: string, opts: CaptureOpts = {}): Promise<void> {
  const event = {
    event_id: generateEventId(),
    timestamp: Math.floor(Date.now() / 1000),
    platform: "javascript",
    level: opts.level || "info",
    server_name: "moyu-academy",
    environment: process.env.NODE_ENV || "production",
    tags: opts.tags || {},
    extra: opts.extra || {},
    user: opts.user || undefined,
    message: { formatted: message },
  };

  if (opts.level !== "info" && opts.level !== "debug") {
    console.warn("[error-tracker]", message, opts.extra);
  }

  await Promise.allSettled([
    postToSentry(event),
    logToDb(opts.level || "info", message, opts.extra || {}),
  ]);
}

function parseStack(stack: string): { frames: Array<{ filename: string; function: string; lineno?: number; colno?: number }> } {
  const lines = stack.split("\n").slice(1, 30);
  const frames = lines.map((l) => {
    const m = l.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/) || l.match(/at\s+(.+?):(\d+):(\d+)/);
    if (!m) return { filename: l.trim(), function: "<unknown>" };
    if (m.length === 5) {
      return { function: m[1], filename: m[2], lineno: Number(m[3]), colno: Number(m[4]) };
    }
    return { function: "<anonymous>", filename: m[1], lineno: Number(m[2]), colno: Number(m[3]) };
  });
  return { frames: frames.reverse() };
}

export function isSentryEnabled(): boolean {
  return getDsn() !== null;
}
