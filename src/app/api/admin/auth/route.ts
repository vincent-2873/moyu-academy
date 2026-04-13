import { getSupabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';


const ADMIN_PASSWORD = 'moyu2024admin';
// HQ roles (ceo/coo/cfo/director) can see ALL subsidiaries; brand-level roles only see their own.
const ALLOWED_ROLES = ['super_admin', 'ceo', 'coo', 'cfo', 'director', 'brand_manager', 'team_leader', 'trainer', 'recruiter', 'hr'];

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const { data: user, error } = await getSupabaseAdmin()
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json(
        { error: 'Access denied: insufficient role' },
        { status: 403 }
      );
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (err) {
    console.error('Admin auth error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
