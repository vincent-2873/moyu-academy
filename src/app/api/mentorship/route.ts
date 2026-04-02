import { getSupabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// GET - fetch mentor-trainee pairs
// Supports query params: ?user_id=, ?brand=, ?status=, ?role= (trainee/mentor/manager)
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json([]);
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const userEmail = searchParams.get('user_email');
    const brand = searchParams.get('brand');
    const status = searchParams.get('status');
    const role = searchParams.get('role');

    // If user_email is provided, resolve it to user_id first
    let resolvedUserId = userId;
    if (!resolvedUserId && userEmail) {
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('email', userEmail)
        .maybeSingle();
      if (userRow) resolvedUserId = userRow.id;
    }

    let query = supabase.from('mentor_pairs').select('*');

    // Filter by user_id - check across trainee, mentor, and manager columns
    if (resolvedUserId) {
      if (role === 'trainee') {
        query = query.eq('trainee_id', resolvedUserId);
      } else if (role === 'mentor') {
        query = query.eq('mentor_id', resolvedUserId);
      } else if (role === 'manager') {
        query = query.eq('manager_id', resolvedUserId);
      } else {
        query = query.or(
          `trainee_id.eq.${resolvedUserId},mentor_id.eq.${resolvedUserId},manager_id.eq.${resolvedUserId}`
        );
      }
    }

    if (brand) {
      query = query.eq('brand', brand);
    }

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false });

    const { data: pairs, error } = await query;

    if (error) {
      console.error('Error fetching mentor pairs:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!pairs || pairs.length === 0) {
      return NextResponse.json({ pair: null, pairs: [] });
    }

    // Collect all unique user IDs from pairs to batch-query names
    const userIdSet = new Set<string>();
    for (const pair of pairs) {
      if (pair.trainee_id) userIdSet.add(pair.trainee_id);
      if (pair.mentor_id) userIdSet.add(pair.mentor_id);
      if (pair.manager_id) userIdSet.add(pair.manager_id);
    }

    const userIds = Array.from(userIdSet);

    // Batch fetch user details (name, email, role, brand)
    const userMap: Record<string, { name: string; email: string; role: string; brand: string }> = {};
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, role, brand')
        .in('id', userIds);

      if (!usersError && users) {
        for (const user of users) {
          userMap[user.id] = { name: user.name, email: user.email, role: user.role, brand: user.brand };
        }
      }
    }

    // Enrich pairs with full user info for frontend
    const enrichedPairs = pairs.map((pair) => {
      const days = Math.ceil((Date.now() - new Date(pair.start_date).getTime()) / (1000 * 60 * 60 * 24));
      const week = Math.min(4, Math.ceil(Math.max(1, days) / 7));
      const traineeInfo = userMap[pair.trainee_id];
      const mentorInfo = userMap[pair.mentor_id];
      const managerInfo = pair.manager_id ? userMap[pair.manager_id] : null;

      return {
        id: pair.id,
        trainee: traineeInfo ? { name: traineeInfo.name, email: traineeInfo.email, role: traineeInfo.role, brand: traineeInfo.brand } : { name: '未知', email: '', role: '', brand: '' },
        mentor: mentorInfo ? { name: mentorInfo.name, email: mentorInfo.email, role: mentorInfo.role, brand: mentorInfo.brand } : { name: '未知', email: '', role: '', brand: '' },
        manager: managerInfo ? { name: managerInfo.name, email: managerInfo.email, role: managerInfo.role, brand: managerInfo.brand } : null,
        start_date: pair.start_date,
        current_day: days,
        current_week: week,
        current_mode: week <= 1 ? 'Coach 示範' : week <= 2 ? '陪跑輔助' : week <= 3 ? '放手觀察' : '驗收結業',
        feedback_count: 0,
        completion_rate: Math.min(100, Math.round((days / 28) * 100)),
        milestones: pair.milestones || [],
        status: pair.status,
        ceremony_completed: pair.ceremony_completed,
      };
    });

    // Find the active pair for the requesting user (for single-user view)
    const activePair = enrichedPairs.find(p => p.status === 'active') || enrichedPairs[0] || null;

    return NextResponse.json({ pair: activePair, pairs: enrichedPairs });
  } catch (error) {
    console.error('Mentorship GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - create a new mentor-trainee pair
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { trainee_id, mentor_id, manager_id, brand, start_date } = body;

    if (!trainee_id || !mentor_id || !brand) {
      return NextResponse.json(
        { error: 'trainee_id, mentor_id, and brand are required' },
        { status: 400 }
      );
    }

    const newPair = {
      trainee_id,
      mentor_id,
      manager_id: manager_id || null,
      brand,
      start_date: start_date || new Date().toISOString().split('T')[0],
      status: 'active',
      ceremony_completed: false,
      milestones: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('mentor_pairs')
      .insert(newPair)
      .select()
      .single();

    if (error) {
      console.error('Error creating mentor pair:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Mentorship POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - update an existing mentor-trainee pair
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    // Only allow specific fields to be updated
    const allowedFields = [
      'status',
      'manager_id',
      'latest_mentor_message',
      'ceremony_completed',
      'ceremony_date',
      'actual_end_date',
      'milestones',
    ];

    const sanitizedUpdates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updates) {
        sanitizedUpdates[key] = updates[key];
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Auto-set timestamp fields
    sanitizedUpdates.updated_at = new Date().toISOString();

    if ('latest_mentor_message' in sanitizedUpdates) {
      sanitizedUpdates.latest_mentor_message_at = new Date().toISOString();
    }

    if (sanitizedUpdates.ceremony_completed === true && !sanitizedUpdates.ceremony_date) {
      sanitizedUpdates.ceremony_date = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('mentor_pairs')
      .update(sanitizedUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating mentor pair:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Pair not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Mentorship PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
