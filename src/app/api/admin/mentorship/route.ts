import { getSupabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const brand = searchParams.get('brand');
    const status = searchParams.get('status');

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('mentor_pairs')
      .select('*')
      .order('created_at', { ascending: false });

    if (brand) {
      query = query.eq('brand', brand);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: pairs, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Collect all unique user IDs to resolve names
    const userIds = new Set<string>();
    for (const pair of pairs || []) {
      if (pair.trainee_id) userIds.add(pair.trainee_id);
      if (pair.mentor_id) userIds.add(pair.mentor_id);
      if (pair.manager_id) userIds.add(pair.manager_id);
    }

    // Fetch user names and emails in one query
    const userMap: Record<string, { name: string; email: string }> = {};
    if (userIds.size > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', Array.from(userIds));

      if (usersError) {
        return NextResponse.json({ error: usersError.message }, { status: 500 });
      }

      for (const user of users || []) {
        userMap[user.id] = { name: user.name, email: user.email };
      }
    }

    // Enrich pairs with user names and emails
    const pairsWithNames = (pairs || []).map((pair) => ({
      ...pair,
      trainee_name: userMap[pair.trainee_id]?.name || null,
      trainee_email: userMap[pair.trainee_id]?.email || null,
      mentor_name: userMap[pair.mentor_id]?.name || null,
      mentor_email: userMap[pair.mentor_id]?.email || null,
      manager_name: pair.manager_id ? userMap[pair.manager_id]?.name || null : null,
      manager_email: pair.manager_id ? userMap[pair.manager_id]?.email || null : null,
    }));

    return NextResponse.json({ pairs: pairsWithNames }, { status: 200 });
  } catch (err) {
    console.error('GET /admin/mentorship error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


export async function POST(req: NextRequest) {
  try {
    const { trainee_id, mentor_id, manager_id, brand, start_date } = await req.json();

    if (!trainee_id || !mentor_id) {
      return NextResponse.json(
        { error: 'trainee_id and mentor_id are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Check trainee doesn't already have an active pair
    const { data: existing, error: checkError } = await supabase
      .from('mentor_pairs')
      .select('id')
      .eq('trainee_id', trainee_id)
      .eq('status', 'active')
      .maybeSingle();

    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json(
        { error: 'Trainee already has an active mentorship pair' },
        { status: 409 }
      );
    }

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('mentor_pairs')
      .insert([{
        trainee_id,
        mentor_id,
        manager_id: manager_id || null,
        brand,
        start_date: start_date || today,
        status: 'active',
      }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-upgrade mentor's role to 'mentor' if they are currently sales_rep
    const { data: mentorUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', mentor_id)
      .single();

    if (mentorUser && mentorUser.role === 'sales_rep') {
      await supabase
        .from('users')
        .update({ role: 'mentor' })
        .eq('id', mentor_id);
    }

    return NextResponse.json({ pair: data }, { status: 201 });
  } catch (err) {
    console.error('POST /admin/mentorship error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


export async function PATCH(req: NextRequest) {
  try {
    const { id, ...body } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Pair id is required' }, { status: 400 });
    }

    // Only allow specific fields to be updated
    const allowedFields = ['status', 'manager_id', 'actual_end_date', 'ceremony_completed'];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    // If status changes to 'graduated', auto-set actual_end_date to today
    if (updates.status === 'graduated' && !updates.actual_end_date) {
      updates.actual_end_date = new Date().toISOString().split('T')[0];
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await getSupabaseAdmin()
      .from('mentor_pairs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ pair: data }, { status: 200 });
  } catch (err) {
    console.error('PATCH /admin/mentorship error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Pair id is required' }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin()
      .from('mentor_pairs')
      .update({ status: 'dissolved', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('DELETE /admin/mentorship error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
