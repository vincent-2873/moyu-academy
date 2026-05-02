import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { linePush } from "@/lib/line-notify";

/**
 * /api/cron/auto-iterate-30min
 * 每 30 分鐘 — 跨 2 支柱的「主動監測 + 產命令 + 通知主管」
 * 2026-05-02 Wave 8 cleanup:HR/招募 砍 scanRecruit 整段
 *
 *  Scan:
 *    sales   — 今日無撥打 / 低成交 / 團隊沒人出席的主管 push
 *    legal   — 逾期案件 / 本週到期 / 超過 3 天沒動作的案件 → 承辦 + 主管
 *
 *  Actions:
 *    1. 產 v3_commands（severity 依狀況）
 *    2. 依 pillar 找 pillar_managers → LINE 推通知（排程/ priority 首位）
 *    3. 寫 v3_ai_insights 學習（下次迭代會參考）
 *    4. 寫 claude_actions log
 *
 *  設計原則：同一問題不重複產命令 — 用 ai_reasoning + owner 作去重 key（pending 未解決時不再新增）
 */


interface GeneratedCmd {
  owner_email: string;
  pillar_id: "sales" | "legal";
  title: string;
  detail: string;
  severity: "normal" | "high" | "critical";
  ai_reasoning: string; // 當去重 key，重複不寫
  deadline?: string | null;
}

async function dedupedInsert(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  cmd: GeneratedCmd
) {
  // Skip if there's already an unresolved (pending) command with the same reasoning.
  // Also skip if the same command was created in the last hour (catches non-pending duplicates).
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: existingPending } = await supabase
    .from("v3_commands")
    .select("id")
    .eq("owner_email", cmd.owner_email)
    .eq("ai_reasoning", cmd.ai_reasoning)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (existingPending) return { created: false, reason: "deduped-pending" };

  const { data: existingRecent } = await supabase
    .from("v3_commands")
    .select("id")
    .eq("owner_email", cmd.owner_email)
    .eq("ai_reasoning", cmd.ai_reasoning)
    .gte("created_at", oneHourAgo)
    .limit(1)
    .maybeSingle();
  if (existingRecent) return { created: false, reason: "deduped" };

  const { data, error } = await supabase.from("v3_commands").insert({
    owner_email: cmd.owner_email,
    pillar_id: cmd.pillar_id,
    title: cmd.title,
    detail: cmd.detail,
    severity: cmd.severity,
    status: "pending",
    deadline: cmd.deadline || null,
    ai_generated: true,
    ai_reasoning: cmd.ai_reasoning,
  }).select().single();
  if (error) return { created: false, error: error.message };
  return { created: true, id: data.id };
}

async function pushToPillarManagers(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  pillar: string,
  text: string
) {
  const { data: mgrs } = await supabase
    .from("pillar_managers")
    .select("email, line_user_id, priority, display_name")
    .eq("pillar_id", pillar)
    .eq("active", true)
    .order("priority", { ascending: true });
  const results: unknown[] = [];
  for (const m of mgrs || []) {
    try {
      const r = await linePush({
        userEmail: m.email,
        lineUserId: m.line_user_id || undefined,
        body: text,
        priority: "high",
        reason: "auto_iterate_30min",
      });
      results.push({ email: m.email, ok: r.ok });
    } catch (e) {
      results.push({ email: m.email, err: String(e) });
    }
  }
  return results;
}

async function scanLegal(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const generated: GeneratedCmd[] = [];
  const tpToday = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const in3Days = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  // 1. 逾期案件
  const { data: overdue } = await supabase
    .from("legal_cases").select("*")
    .eq("status", "open").lt("response_deadline", tpToday);
  for (const c of overdue || []) {
    const owner = c.owner_email || "vincent@xplatform.world";
    generated.push({
      owner_email: owner,
      pillar_id: "legal",
      title: `🚨 法務逾期：${c.title}`,
      detail: `案件 ${c.case_no_internal || c.case_no_external || "-"}\n期限 ${c.response_deadline} 已過 ${daysBetween(c.response_deadline, tpToday)} 天\n品牌 ${c.brand_code || "-"} · 類型 ${c.kind}`,
      severity: "critical",
      ai_reasoning: `legal_overdue_${c.id}`,
    });
  }
  // 2. 3 天內到期
  const { data: dueSoon } = await supabase
    .from("legal_cases").select("*")
    .eq("status", "open").gte("response_deadline", tpToday).lte("response_deadline", in3Days);
  for (const c of dueSoon || []) {
    const owner = c.owner_email || "vincent@xplatform.world";
    generated.push({
      owner_email: owner,
      pillar_id: "legal",
      title: `⏰ 法務 3 天內到期：${c.title}`,
      detail: `期限 ${c.response_deadline}（剩 ${daysBetween(tpToday, c.response_deadline)} 天）`,
      severity: "high",
      ai_reasoning: `legal_due_${c.id}`,
    });
  }
  // 3. 超過 3 天沒動作
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const { data: stale } = await supabase
    .from("legal_cases").select("id, title, owner_email, updated_at, case_no_internal")
    .eq("status", "open").lt("updated_at", threeDaysAgo);
  for (const c of (stale || []).slice(0, 5)) {
    const owner = c.owner_email || "vincent@xplatform.world";
    generated.push({
      owner_email: owner,
      pillar_id: "legal",
      title: `💤 法務停滯：${c.title}`,
      detail: `${c.case_no_internal || ""} 超過 3 天未更新 → 進度如何？`,
      severity: "normal",
      ai_reasoning: `legal_stale_${c.id}`,
    });
  }
  return { generated, counts: { overdue: overdue?.length || 0, due_soon: dueSoon?.length || 0, stale: stale?.length || 0 } };
}

async function scanSales(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const generated: GeneratedCmd[] = [];
  const tpToday = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

  // 今日撥打次數 0 但本月有撥打紀錄的人 → 異常靜默
  const { data: recent } = await supabase
    .from("sales_metrics_daily").select("*").eq("date", tpToday).not("is_monthly_rollup", "is", true);
  const todayReps = new Set((recent || []).map((r) => r.salesperson_id));
  // 本月有撥但今天零撥
  const monthStart = tpToday.slice(0, 8) + "01";
  const { data: thisMonth } = await supabase
    .from("sales_metrics_daily").select("salesperson_id, email, name").gte("date", monthStart).gt("calls", 0).not("is_monthly_rollup", "is", true);
  const monthReps: Map<string, { email: string; name: string }> = new Map();
  for (const r of thisMonth || []) {
    if (!monthReps.has(r.salesperson_id) && r.email) {
      monthReps.set(r.salesperson_id, { email: r.email, name: r.name || r.email });
    }
  }
  const silentToday: string[] = [];
  for (const [id, v] of monthReps) {
    if (!todayReps.has(id)) silentToday.push(v.name);
  }
  if (silentToday.length >= 3) {
    generated.push({
      owner_email: "vincent@xplatform.world",
      pillar_id: "sales",
      title: `💰 業務異常：今日 ${silentToday.length} 位無撥打`,
      detail: silentToday.slice(0, 10).join("、"),
      severity: silentToday.length >= 10 ? "critical" : "high",
      ai_reasoning: `sales_silent_mass_${tpToday}`,
    });
  }
  return { generated, counts: { silent_today: silentToday.length, today_active: todayReps.size } };
}

function daysBetween(a: string, b: string) {
  const d = Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
  return Math.abs(d);
}

export async function GET(req: Request) {
  // vercel cron protection
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (expected && auth !== expected) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const startedAt = Date.now();

  const [legal, sales] = await Promise.all([
    scanLegal(supabase).catch((e) => ({ error: String(e), generated: [], counts: {} })),
    scanSales(supabase).catch((e) => ({ error: String(e), generated: [], counts: {} })),
  ]);
  const allGenerated: GeneratedCmd[] = [
    ...("generated" in legal ? legal.generated : []),
    ...("generated" in sales ? sales.generated : []),
  ];

  let created = 0;
  const pushes: Record<string, number> = { sales: 0, legal: 0 };
  for (const cmd of allGenerated) {
    const r = await dedupedInsert(supabase, cmd);
    if (r.created) {
      created++;
      // 立即 LINE push 給主管（只 critical/high）
      if (cmd.severity === "critical" || cmd.severity === "high") {
        pushes[cmd.pillar_id] += 1;
      }
    }
  }

  // 按 pillar 合併推 LINE（避免每件一推）
  const msg: string[] = [];
  if (pushes.legal > 0) {
    const legalCounts = "counts" in legal ? legal.counts as Record<string, number> : {};
    msg.push(`⚖️ 法務：逾期 ${legalCounts.overdue || 0} / 3 日到期 ${legalCounts.due_soon || 0} / 停滯 ${legalCounts.stale || 0}`);
    await pushToPillarManagers(supabase, "legal", msg.join("\n"));
  }
  if (pushes.sales > 0) {
    const salesCounts = "counts" in sales ? sales.counts as Record<string, number> : {};
    await pushToPillarManagers(supabase, "sales", `💰 業務：今日 ${salesCounts.silent_today || 0} 位無撥打`);
  }

  // 寫 log
  await supabase.from("claude_actions").insert({
    action_type: "auto_iterate_30min",
    target: "system",
    summary: `掃描完成：產 ${created} 條新命令（legal ${pushes.legal} + sales ${pushes.sales} push）`,
    details: {
      legal: "counts" in legal ? legal.counts : {},
      sales: "counts" in sales ? sales.counts : {},
      ms: Date.now() - startedAt,
    },
    result: "success",
  });

  return NextResponse.json({
    ok: true,
    ms: Date.now() - startedAt,
    scanned: {
      legal: "counts" in legal ? legal.counts : null,
      sales: "counts" in sales ? sales.counts : null,
    },
    commands_created: created,
    line_pushes: pushes,
  });
}
