import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * /api/admin/health-overview — 系統健康度總覽
 *
 * 回:
 *   - sales_metrics 統計(rows / 日期範圍 / 人數 / 2026 撥打+營收)
 *   - knowledge_chunks 統計(總數 / with_embedding / sources)
 *   - training assignments 進度(active / completed / 卡關)
 *   - 8.B 資料新鮮度(每張表最後更新)
 *   - cron 健康度(過去 24h 跑了幾次, 失敗率)
 *   - env 設定狀態
 */

export async function GET() {
  const sb = getSupabaseAdmin();

  const [
    salesCount, salesAgg,
    knowledgeCount,
    knowledgeEmb,
    knowledgeSources,
    assignmentsAgg,
    stampsCount,
    cronLogAgg,
    freshness,
  ] = await Promise.all([
    sb.from("sales_metrics_daily").select("date, salesperson_id", { count: "exact", head: false }).limit(5000).then(r => r.data?.length || 0),
    Promise.resolve(null),
    sb.from("knowledge_chunks").select("id", { count: "exact", head: true }).then(r => r.count || 0),
    sb.from("knowledge_chunks").select("id", { count: "exact", head: true }).not("embedding", "is", null).then(r => r.count || 0),
    sb.from("knowledge_chunks").select("source_type"),
    sb.from("training_assignments").select("status"),
    sb.from("training_stamps").select("id", { count: "exact", head: true }).then(r => r.count || 0),
    sb.from("system_run_log").select("status, source").gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    sb.from("system_table_freshness").select("*").then(r => r, () => ({ data: [] as any[] })),
  ]);

  // sales aggregations
  const { data: salesData2026 } = await sb
    .from("sales_metrics_daily")
    .select("calls, net_revenue_daily")
    .gte("date", "2026-01-01");

  const sumCalls2026 = (salesData2026 || []).reduce((s: number, r: any) => s + (r.calls || 0), 0);
  const sumRevenue2026 = (salesData2026 || []).reduce((s: number, r: any) => s + Number(r.net_revenue_daily || 0), 0);

  // knowledge sources by type
  const sourcesByType: Record<string, number> = {};
  (knowledgeSources.data || []).forEach((k: any) => {
    sourcesByType[k.source_type] = (sourcesByType[k.source_type] || 0) + 1;
  });

  // assignments by status
  const assignmentsByStatus: Record<string, number> = {};
  (assignmentsAgg.data || []).forEach((a: any) => {
    assignmentsByStatus[a.status] = (assignmentsByStatus[a.status] || 0) + 1;
  });

  // cron pass rate
  const cronLogs = cronLogAgg.data || [];
  const cronTotal = cronLogs.length;
  const cronOk = cronLogs.filter((c: any) => c.status === "ok").length;
  const cronFail = cronLogs.filter((c: any) => c.status === "fail").length;
  const cronPassRate = cronTotal > 0 ? Math.round((cronOk / cronTotal) * 100) : null;

  return NextResponse.json({
    sales: {
      total_rows: salesCount,
      sum_calls_2026: sumCalls2026,
      sum_revenue_2026: sumRevenue2026,
    },
    knowledge: {
      total: knowledgeCount,
      with_embedding: knowledgeEmb,
      sources_by_type: sourcesByType,
    },
    training: {
      assignments_by_status: assignmentsByStatus,
      stamps_total: stampsCount,
    },
    cron: {
      runs_24h: cronTotal,
      ok: cronOk,
      fail: cronFail,
      pass_rate_pct: cronPassRate,
    },
    freshness: freshness.data || [],
    env: {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      GROQ_API_KEY: !!process.env.GROQ_API_KEY,
      NOTION_INTEGRATION_TOKEN: !!process.env.NOTION_INTEGRATION_TOKEN,
      LINE_CHANNEL_ACCESS_TOKEN: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
      DISCORD_OAUTH_CLIENT_SECRET: !!process.env.DISCORD_OAUTH_CLIENT_SECRET,
      GOOGLE_OAUTH_CLIENT_SECRET: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      CRON_SECRET: !!process.env.CRON_SECRET,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    timestamp: new Date().toISOString(),
  });
}
