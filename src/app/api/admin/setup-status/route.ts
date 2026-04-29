import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const sb = getSupabaseAdmin();

  // Metabase 資料統計
  const { data: metabaseStats } = await sb
    .from("sales_metrics_daily")
    .select("date,salesperson_id", { count: "exact", head: false })
    .limit(10000);

  const distinctDates = new Set((metabaseStats || []).map((r: any) => r.date)).size;
  const distinctPeople = new Set((metabaseStats || []).map((r: any) => r.salesperson_id)).size;

  return NextResponse.json({
    metabase_rows: metabaseStats?.length || 0,
    metabase_distinct_dates: distinctDates,
    metabase_distinct_people: distinctPeople,
    has_notion_token: !!process.env.NOTION_INTEGRATION_TOKEN,
    has_google_secret: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    has_discord_secret: !!process.env.DISCORD_OAUTH_CLIENT_SECRET,
    line_callback_correct: !!process.env.LINE_LOGIN_CHANNEL_ID, // 簡易判斷,完整檢查需實際 OAuth flow
    timestamp: new Date().toISOString(),
  });
}
