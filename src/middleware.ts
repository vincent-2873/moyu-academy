import { NextRequest, NextResponse } from 'next/server';

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
  matcher: ['/api/admin/:path*'],
};
