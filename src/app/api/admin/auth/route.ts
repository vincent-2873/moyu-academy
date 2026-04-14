import { getSupabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

// HQ roles 可看全部子公司；品牌層角色只看自己
const ALLOWED_ROLES = ['super_admin', 'ceo', 'coo', 'cfo', 'director', 'brand_manager', 'team_leader', 'trainer', 'recruiter', 'hr'];

export async function POST(req: NextRequest) {
  try {
    const { email, password, lineLogin } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const { data: user, error } = await getSupabaseAdmin()
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // LINE 一鍵登入：只驗有綁 LINE（cookie 帶過來）
    if (lineLogin) {
      if (!user.line_user_id) {
        return NextResponse.json({ error: '此帳號尚未綁定 LINE' }, { status: 403 });
      }
    } else {
      // 密碼登入
      if (!password) {
        return NextResponse.json({ error: '密碼必填' }, { status: 400 });
      }
      if (!user.password_hash) {
        return NextResponse.json({ error: '此帳號尚未設定密碼，請聯繫管理員' }, { status: 500 });
      }
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) {
        return NextResponse.json({ error: '密碼錯誤' }, { status: 401 });
      }
    }

    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '此帳號沒有後台權限' }, { status: 403 });
    }

    // 脫敏
    const { password_hash, ...safeUser } = user;
    void password_hash;

    return NextResponse.json({
      user: safeUser,
      mustChangePassword: password === '0000',
    }, { status: 200 });
  } catch (err) {
    console.error('Admin auth error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
