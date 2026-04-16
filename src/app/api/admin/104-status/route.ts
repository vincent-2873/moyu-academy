import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * GET /api/admin/104-status
 *
 * 回傳 104 自動化當日狀態：
 * - 今日發信數（墨凡/睿富）
 * - 今日新回覆數
 * - pending 104 actions 佇列
 * - 最近 100 筆 claude_actions log
 * - 今日電話紀錄數（by extension）
 */
export async function GET(_req: NextRequest) {
  const supabase = getSupabaseAdmin();

  const today = new Date();
  const tpToday = new Date(today.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const dayStart = tpToday + "T00:00:00Z";

  // 今日發信數（讀 outreach_104_queue 因為 api-send.js 寫這個表）
  const { count: sentMofan } = await supabase
    .from("outreach_104_queue")
    .select("id", { count: "exact", head: true })
    .eq("account", "mofan")
    .gte("sent_at", dayStart);
  const { count: sentRuifu } = await supabase
    .from("outreach_104_queue")
    .select("id", { count: "exact", head: true })
    .eq("account", "ruifu")
    .gte("sent_at", dayStart);

  // 今日回覆數
  const { count: repliesMofan } = await supabase
    .from("outreach_104_queue")
    .select("id", { count: "exact", head: true })
    .eq("account", "mofan")
    .gte("reply_received_at", dayStart);
  const { count: repliesRuifu } = await supabase
    .from("outreach_104_queue")
    .select("id", { count: "exact", head: true })
    .eq("account", "ruifu")
    .gte("reply_received_at", dayStart);

  // 配額
  const { data: criteria } = await supabase.from("recruit_criteria").select("*");
  const quotaMap = Object.fromEntries(
    (criteria || []).map((c) => [c.account, c.daily_quota])
  );

  // 今日新回覆總數（兩家加起來）
  const newRepliesToday = (repliesMofan || 0) + (repliesRuifu || 0);

  // pending 104 actions
  const { data: pendingActions } = await supabase
    .from("pending_104_actions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  // 最近的 104 相關 log
  const { data: recentLogs } = await supabase
    .from("claude_actions")
    .select("action_type, target, summary, result, created_at")
    .or("action_type.eq.recruit_auto_outreach,action_type.eq.104_sender,action_type.eq.104_poller,action_type.eq.104_interview_sender")
    .order("created_at", { ascending: false })
    .limit(30);

  // 今日電話紀錄 by 分機
  const { data: phoneRows } = await supabase
    .from("phone_call_log")
    .select("extension, agent_name, duration_seconds, status")
    .gte("start_time", dayStart);

  const phoneStatsByExt: Record<string, { agent: string; calls: number; totalSec: number; answered: number }> = {};
  for (const r of phoneRows || []) {
    const key = r.extension;
    if (!phoneStatsByExt[key]) phoneStatsByExt[key] = { agent: r.agent_name || "-", calls: 0, totalSec: 0, answered: 0 };
    phoneStatsByExt[key].calls++;
    phoneStatsByExt[key].totalSec += r.duration_seconds || 0;
    if (r.status === "answered" || (r.duration_seconds || 0) > 0) phoneStatsByExt[key].answered++;
  }

  return Response.json({
    ok: true,
    date: tpToday,
    sending: {
      mofan: { sent: sentMofan || 0, quota: quotaMap.mofan || 200 },
      ruifu: { sent: sentRuifu || 0, quota: quotaMap.ruifu || 300 },
    },
    newRepliesToday: newRepliesToday,
    replies: {
      mofan: repliesMofan || 0,
      ruifu: repliesRuifu || 0,
    },
    pendingActions: pendingActions || [],
    recentLogs: recentLogs || [],
    phoneStatsByExt,
  });
}
