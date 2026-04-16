import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * GET /api/recruit/hot-list
 * 回傳今日招聘員要處理的熱名單：
 * - 有興趣回覆但還沒被電話聯絡的人（優先）
 * - 電話已聯絡但還沒安排面試的人
 * - 面試已安排（追蹤狀態）
 */
export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const url = new URL(req.url);
  const ownerEmail = url.searchParams.get("owner") || null;

  // 1. 熱名單：reply_status='interested' 且 phone_contacted_at IS NULL
  let q = supabase
    .from("outreach_104_queue")
    .select("*")
    .eq("reply_status", "interested")
    .is("phone_contacted_at", null)
    .order("reply_received_at", { ascending: false });
  if (ownerEmail) q = q.eq("owner_email", ownerEmail);
  const { data: hot } = await q;

  // 2. 已聯絡但未面試
  let q2 = supabase
    .from("outreach_104_queue")
    .select("*")
    .not("phone_contacted_at", "is", null)
    .is("interview_scheduled_at", null)
    .order("phone_contacted_at", { ascending: false });
  if (ownerEmail) q2 = q2.eq("owner_email", ownerEmail);
  const { data: contacted } = await q2;

  // 3. 今日安排的面試（以台北時間 00:00-23:59 為範圍）
  const now = new Date();
  const tpNow = new Date(now.getTime() + 8 * 3600 * 1000);
  const tpToday = tpNow.toISOString().slice(0, 10);
  // TPE 00:00 對應 UTC = 前一天 16:00；TPE 23:59:59 對應 UTC = 當天 15:59:59
  const tpe0 = new Date(`${tpToday}T00:00:00+08:00`);
  const tpe24 = new Date(`${tpToday}T23:59:59+08:00`);
  let q3 = supabase
    .from("outreach_104_queue")
    .select("*")
    .not("interview_scheduled_at", "is", null)
    .gte("interview_scheduled_at", tpe0.toISOString())
    .lte("interview_scheduled_at", tpe24.toISOString());
  if (ownerEmail) q3 = q3.eq("owner_email", ownerEmail);
  const { data: todayInterviews } = await q3;

  return Response.json({
    ok: true,
    date: tpToday,
    hot: hot || [],                      // 🔴 要打電話
    contacted: contacted || [],          // 🟡 已聯絡待排面試
    todayInterviews: todayInterviews || [], // 🟢 今日面試
    stats: {
      hot: hot?.length || 0,
      contacted: contacted?.length || 0,
      todayInterviews: todayInterviews?.length || 0,
    },
  });
}
