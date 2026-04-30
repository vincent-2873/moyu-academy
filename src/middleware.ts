import { NextRequest, NextResponse } from 'next/server';

/**
 * N1 (2026-04-30 第三輪):in-memory rate limit
 *
 * 設計:
 *   - login / register 路徑:每 IP 5 min 內 max 10 次
 *   - admin auth:每 IP 5 min 內 max 20 次
 *   - 其他 sensitive endpoint 視需要套用
 *
 * 用 Map<key, [timestamps]> in-memory(每個 Next.js instance 獨立計數)
 * Edge runtime 重啟會清空 = 限速器是 best-effort 第一道防線,不取代 WAF
 */
type RateLimitConfig = { windowMs: number; max: number };

const RATE_LIMIT_RULES: Array<{ pattern: RegExp; cfg: RateLimitConfig }> = [
  { pattern: /^\/api\/login$/, cfg: { windowMs: 5 * 60_000, max: 10 } },
  { pattern: /^\/api\/register$/, cfg: { windowMs: 5 * 60_000, max: 5 } },
  { pattern: /^\/api\/admin\/auth$/, cfg: { windowMs: 5 * 60_000, max: 20 } },
  { pattern: /^\/api\/admin\/reset-password$/, cfg: { windowMs: 5 * 60_000, max: 10 } },
];

const rateLimitStore = new Map<string, number[]>();

function getClientKey(req: NextRequest, prefix: string): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  const ip = xff.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  return `${prefix}:${ip}`;
}

function checkRateLimit(key: string, cfg: RateLimitConfig): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const cutoff = now - cfg.windowMs;
  const list = rateLimitStore.get(key) || [];
  // 過濾過期 timestamp
  const fresh = list.filter((t) => t > cutoff);
  if (fresh.length >= cfg.max) {
    rateLimitStore.set(key, fresh);  // 清掉舊資料但不加新的
    return { allowed: false, remaining: 0 };
  }
  fresh.push(now);
  rateLimitStore.set(key, fresh);
  // 簡易 GC:Map 大小爆炸時抽掉最舊一批
  if (rateLimitStore.size > 5000) {
    const keys = Array.from(rateLimitStore.keys()).slice(0, 1000);
    keys.forEach((k) => rateLimitStore.delete(k));
  }
  return { allowed: true, remaining: cfg.max - fresh.length };
}

function applyRateLimit(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  for (const rule of RATE_LIMIT_RULES) {
    if (rule.pattern.test(pathname)) {
      const key = getClientKey(req, pathname);
      const { allowed, remaining } = checkRateLimit(key, rule.cfg);
      if (!allowed) {
        return NextResponse.json(
          {
            error: 'rate_limited',
            message: `太多次嘗試,請稍後再試(每 ${rule.cfg.windowMs / 60000} 分鐘 ${rule.cfg.max} 次)`,
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil(rule.cfg.windowMs / 1000)),
              'X-RateLimit-Limit': String(rule.cfg.max),
              'X-RateLimit-Remaining': '0',
            },
          },
        );
      }
      // allowed — 透過 response header 回報剩餘配額
      const ok = NextResponse.next();
      ok.headers.set('X-RateLimit-Limit', String(rule.cfg.max));
      ok.headers.set('X-RateLimit-Remaining', String(remaining));
      return ok;
    }
  }
  return null;
}

function hexToBytes(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer as ArrayBuffer;
}

async function verifyAdminSession(cookie: string): Promise<boolean> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!secret) return false;

  const parts = cookie.split('|');
  if (parts.length !== 3) return false;

  const [email, expiry, signature] = parts;
  if (!email || !expiry || !signature) return false;
  if (Date.now() > Number(expiry)) return false;
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  return crypto.subtle.verify(
    'HMAC',
    key,
    hexToBytes(signature),
    new TextEncoder().encode(`${email}|${expiry}`)
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // N1: rate limit(在 admin 驗證前先擋,避免暴力嘗試耗 DB)
  const rateLimited = applyRateLimit(req);
  if (rateLimited && rateLimited.status === 429) return rateLimited;

  // Protect all /api/admin/* except the auth login endpoint
  if (
    pathname.startsWith('/api/admin/') &&
    pathname !== '/api/admin/auth'
  ) {
    // CRON_SECRET bypass for RAG / setup endpoints (GitHub Actions / internal cron)
    const auth = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && auth === `Bearer ${cronSecret}`) {
      return NextResponse.next();
    }

    const sessionCookie = req.cookies.get('moyu_admin_session')?.value;
    if (!sessionCookie || !(await verifyAdminSession(sessionCookie))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/admin/:path*',
    '/api/login',
    '/api/register',
  ],
};
