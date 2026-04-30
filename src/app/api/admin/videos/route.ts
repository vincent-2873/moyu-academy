import { getSupabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminScope, enforceWriteAccess } from "@/lib/admin-scope";


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = getSupabaseAdmin().from('videos').select('*').order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ videos: data }, { status: 200 });
  } catch (err) {
    console.error('GET /admin/videos error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Vincent 2026-04-30 安全 #4: trainer/mentor read-only block
  const _scope = await getAdminScope(req);
  if (_scope) { const _ro = enforceWriteAccess(_scope, req.method); if (_ro) return _ro; }
  try {
    const body = await req.json();

    if (!body.title || (!body.drive_file_id && !body.url)) {
      return NextResponse.json(
        { error: 'title and drive_file_id are required' },
        { status: 400 }
      );
    }

    // Normalize: use drive_file_id, remove url (column doesn't exist)
    const insertData = {
      title: body.title,
      description: body.description || null,
      drive_file_id: body.drive_file_id || body.url,
      category: body.category || 'custom',
      brands: body.brands || [],
      related_days: body.related_days || [],
      status: body.status ?? 'pending',
    };

    const { data, error } = await getSupabaseAdmin()
      .from('videos')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ video: data }, { status: 201 });
  } catch (err) {
    console.error('POST /admin/videos error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  // Vincent 2026-04-30 安全 #4: trainer/mentor read-only block
  const _scope = await getAdminScope(req);
  if (_scope) { const _ro = enforceWriteAccess(_scope, req.method); if (_ro) return _ro; }
  try {
    const { id, ...updates } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Video id is required' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('videos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ video: data }, { status: 200 });
  } catch (err) {
    console.error('PATCH /admin/videos error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
