import { getSupabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// GET - fetch messages for a mentor-trainee pair
// Supports query param: ?pair_id=
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json([]);
    }

    const { searchParams } = new URL(request.url);
    const pairId = searchParams.get('pair_id');

    if (!pairId) {
      return NextResponse.json(
        { error: 'pair_id is required' },
        { status: 400 }
      );
    }

    const { data: messages, error } = await supabase
      .from('mentor_messages')
      .select('*')
      .eq('pair_id', pairId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching mentor messages:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(messages || []);
  } catch (error) {
    console.error('Mentor messages GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - create a new mentor message
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
    const { pair_id, sender_id, message, message_type } = body;

    if (!pair_id || !sender_id || !message || !message_type) {
      return NextResponse.json(
        { error: 'pair_id, sender_id, message, and message_type are required' },
        { status: 400 }
      );
    }

    const validTypes = ['daily', 'encouragement', 'milestone', 'ceremony'];
    if (!validTypes.includes(message_type)) {
      return NextResponse.json(
        { error: `message_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const newMessage = {
      pair_id,
      sender_id,
      message,
      message_type,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('mentor_messages')
      .insert(newMessage)
      .select()
      .single();

    if (error) {
      console.error('Error creating mentor message:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also update the pair's latest_mentor_message
    await supabase
      .from('mentor_pairs')
      .update({
        latest_mentor_message: message,
        latest_mentor_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', pair_id);

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Mentor messages POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
