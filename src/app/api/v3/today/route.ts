import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * GET /api/v3/today?email=X
 *
 * 統一回傳「今天這個用戶要做什麼」跨 3 支柱：
 *   sales  — v3_commands (pillar=sales)
 *   recruit — v3_commands (pillar=recruit) + 104 熱名單（要打電話的）
 *   legal  — v3_commands (pillar=legal) + 逾期案件 + 即將到期（7 天內）
 *
 * 附加：
 *   - 當事人若有 pillar_managers 對應，還會顯示「我的 pillar 下有幾個人有卡點」
 *   - 所有資料都附 today flag（是否今天必須處理）
 */

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const email = new URL(req.url).searchParams.get("email");
  if (!email) return Response.json({ ok: false, error: "email required" }, { status: 400 });

  const now = new Date();
  const tpToday = new Date(now.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const tpNextWeek = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();

  // 1. v3_commands（待辦）
  const { data: cmds } = await supabase
    .from("v3_commands")
    .select("*")
    .eq("owner_email", email)
    .in("status", ["pending", "acknowledged", "blocked"])
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  // 2. 判斷使用者是哪個 pillar 的 manager
  const { data: mgrRoles } = await supabase
    .from("pillar_managers").select("pillar_id, role, priority")
    .eq("email", email).eq("active", true);
  const managedPillars = (mgrRoles || []).map((r) => r.pillar_id);

  // 3. 法務：逾期 + 即將到期案件（只看自己承辦或主管 pillar 所有）
  const legalCases: { mine: unknown[]; overdue: unknown[]; due_this_week: unknown[] } = {
    mine: [], overdue: [], due_this_week: [],
  };
  if (managedPillars.includes("legal")) {
    const { data: all } = await supabase.from("legal_cases").select("*").eq("status", "open");
    legalCases.mine = (all || []).filter((c) => c.owner_email === email);
    legalCases.overdue = (all || []).filter((c) => c.response_deadline && c.response_deadline < tpToday);
    legalCases.due_this_week = (all || []).filter((c) => c.response_deadline && c.response_deadline >= tpToday && new Date(c.response_deadline) <= new Date(tpNextWeek));
  } else {
    const { data: mine } = await supabase.from("legal_cases").select("*").eq("owner_email", email).eq("status", "open");
    legalCases.mine = mine || [];
  }

  // 4. 招聘：104 熱名單（要打電話）— 只對 recruit pillar 或 Lynn
  let recruitHot: unknown[] = [];
  if (managedPillars.includes("recruit") || email.startsWith("lynn")) {
    const { data: hot } = await supabase
      .from("outreach_104_queue")
      .select("id, candidate_name, account, candidate_phone, last_reply_text, reply_received_at")
      .eq("reply_status", "interested")
      .is("phone_contacted_at", null)
      .order("reply_received_at", { ascending: false })
      .limit(20);
    recruitHot = hot || [];
  }

  // 5. 業務：今日待辦已經在 v3_commands 裡，額外提供「我團隊今天低於目標的成員數」
  //    暫時 skip sales team rollup，避免 sales_metrics 現況 bug 影響

  // 6. 計算統計 + 今日需處理
  const todayStr = tpToday;
  const todayCmds = (cmds || []).filter((c) => {
    if (c.severity === "critical") return true;
    if (c.deadline && c.deadline.slice(0, 10) <= todayStr) return true;
    if (c.created_at && c.created_at.slice(0, 10) === todayStr) return true;
    return false;
  });

  return Response.json({
    ok: true,
    date: tpToday,
    email,
    managed_pillars: managedPillars,
    commands: {
      total: cmds?.length || 0,
      today: todayCmds.length,
      critical: (cmds || []).filter((c) => c.severity === "critical").length,
      by_pillar: {
        sales: (cmds || []).filter((c) => c.pillar_id === "sales").length,
        legal: (cmds || []).filter((c) => c.pillar_id === "legal").length,
        recruit: (cmds || []).filter((c) => c.pillar_id === "recruit").length,
      },
      list: cmds || [],
      today_list: todayCmds,
    },
    legal: {
      mine: legalCases.mine,
      overdue: legalCases.overdue,
      due_this_week: legalCases.due_this_week,
      counts: {
        mine: legalCases.mine.length,
        overdue: legalCases.overdue.length,
        due_this_week: legalCases.due_this_week.length,
      },
    },
    recruit: {
      hot_to_call: recruitHot,
      hot_to_call_count: recruitHot.length,
    },
  });
}
