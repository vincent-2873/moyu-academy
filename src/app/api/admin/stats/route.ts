import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(_req: NextRequest) {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoISO = oneWeekAgo.toISOString();

    // Run all queries in parallel
    const [
      usersResult,
      sparringResult,
      avgScoreResult,
      activeUsersResult,
    ] = await Promise.all([
      // Total users grouped by brand
      supabaseAdmin
        .from('users')
        .select('brand')
        .order('brand'),

      // Total sparring records
      supabaseAdmin
        .from('sparring_records')
        .select('id', { count: 'exact', head: true }),

      // Average scores from sparring records
      supabaseAdmin
        .from('sparring_records')
        .select('score'),

      // Active users this week (users with sparring activity in last 7 days)
      supabaseAdmin
        .from('sparring_records')
        .select('user_id')
        .gte('created_at', oneWeekAgoISO),
    ]);

    // Aggregate users by brand
    const usersByBrand: Record<string, number> = {};
    if (usersResult.data) {
      for (const row of usersResult.data) {
        const brand = row.brand ?? 'unknown';
        usersByBrand[brand] = (usersByBrand[brand] ?? 0) + 1;
      }
    }

    // Total sparring records
    const totalSparringRecords = sparringResult.count ?? 0;

    // Average score
    let avgScore: number | null = null;
    if (avgScoreResult.data && avgScoreResult.data.length > 0) {
      const scores = avgScoreResult.data
        .map((r) => r.score)
        .filter((s) => typeof s === 'number');
      if (scores.length > 0) {
        avgScore = scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length;
        avgScore = Math.round(avgScore * 100) / 100;
      }
    }

    // Active users this week (unique user_ids)
    const activeUserIds = new Set(
      (activeUsersResult.data ?? []).map((r) => r.user_id).filter(Boolean)
    );
    const activeUsersThisWeek = activeUserIds.size;

    return NextResponse.json(
      {
        stats: {
          users_by_brand: usersByBrand,
          total_sparring_records: totalSparringRecords,
          avg_score: avgScore,
          active_users_this_week: activeUsersThisWeek,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('GET /admin/stats error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
