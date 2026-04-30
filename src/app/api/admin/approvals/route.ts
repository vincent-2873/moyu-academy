import { getSupabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminScope, enforceWriteAccess } from "@/lib/admin-scope";


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? 'pending';

    const { data, error } = await getSupabaseAdmin()
      .from('approvals')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ approvals: data }, { status: 200 });
  } catch (err) {
    console.error('GET /admin/approvals error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Vincent 2026-04-30 安全 #4: trainer/mentor read-only block
  const _scope = await getAdminScope(req);
  if (_scope) { const _ro = enforceWriteAccess(_scope, req.method); if (_ro) return _ro; }
  try {
    const body = await req.json();

    if (!body.type || !body.reference_id || !body.submitted_by) {
      return NextResponse.json(
        { error: 'type, reference_id, and submitted_by are required' },
        { status: 400 }
      );
    }

    const { data, error } = await getSupabaseAdmin()
      .from('approvals')
      .insert([{ ...body, status: 'pending' }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ approval: data }, { status: 201 });
  } catch (err) {
    console.error('POST /admin/approvals error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  // Vincent 2026-04-30 安全 #4: trainer/mentor read-only block
  const _scope = await getAdminScope(req);
  if (_scope) { const _ro = enforceWriteAccess(_scope, req.method); if (_ro) return _ro; }
  try {
    const { id, status, reviewed_by, review_note } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Approval id is required' }, { status: 400 });
    }

    if (!status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be "approved" or "rejected"' },
        { status: 400 }
      );
    }

    if (!reviewed_by) {
      return NextResponse.json({ error: 'reviewed_by is required' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('approvals')
      .update({
        status,
        reviewed_by,
        review_note: review_note ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ approval: data }, { status: 200 });
  } catch (err) {
    console.error('PATCH /admin/approvals error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
