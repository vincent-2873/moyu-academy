import { NextRequest, NextResponse } from 'next/server';

async function verifyAdminSession(cookie: string): Promise<boolean> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!secret) return false;

  const parts = cookie.split('|');
  if (parts.length !== 3) return false;

  const [email, expiry, signature] = parts;
  if (!email || !expiry || !signature) return false;
  if (Date.now() > Number(expiry)) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${email}|${expiry}`)
  );
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return signature === expected;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect all /api/admin/* except the auth login endpoint
  if (
    pathname.startsWith('/api/admin/') &&
    pathname !== '/api/admin/auth'
  ) {
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
