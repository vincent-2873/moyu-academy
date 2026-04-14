import { getSupabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';


const ADMIN_PASSWORD = 'moyu2024admin';
// HQ roles (ceo/coo/cfo/director) can see ALL subsidiaries; brand-level roles only see their own.
const ALLOWED_ROLES = ['super_admin', 'ceo', 'coo', 'cfo', 'director', 'brand_manager', 'team_leader', 'trainer', 'recruiter', 'hr'];

export async function POST(req: NextRequest) {
  try {
    const { email, password, forgotPassword, lineLogin } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // 三種登入方式：
    // 1. 密碼登入（預設）
    // 2. 忘記密碼（forgotPassword=true）— 只驗 email + role
    // 3. LINE 登入（lineLogin=true）— 只驗 email + role + line_user_id
    if (!forgotPassword && !lineLogin) {
      if (!password) {
        return NextResponse.json({ error: 'Password is required' }, { status: 400 });
      }
      if (password !== ADMIN_PASSWORD) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
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

    // LINE 登入需要已綁定 LINE
    if (lineLogin && !user.line_user_id) {
      return NextResponse.json(
        { error: '此帳號尚未綁定 LINE，請先用密碼登入再綁定' },
        { status: 403 }
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
