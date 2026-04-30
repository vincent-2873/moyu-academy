import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { linePush } from "@/lib/line-notify";

/**
 * Cron: /api/cron/cron-failure-alert
 *
 * N7 (2026-04-30 第三輪):cron 連續 fail 推 LINE 給 Vincent
 *
 * 邏輯:
 *   1. 撈過去 1 小時 system_run_log
 *   2. groupBy source,計算 fail / total
 *   3. 任一 source: fail >= 3 OR fail_rate > 50%(且 total >= 2)→ 列入 alert
 *   4. 用 alert_state(metadata)dedup — 同 source 1 小時內已推過就 skip
 *   5. 呼叫 linePush 推 LINE_ADMIN_USER_ID
 *
 * 觸發:每小時 :15
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CronStat {
  source: string;
  total: number;
  fail: number;
  fail_rate: number;
  last_error: string | null;
}

const ALERT_DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 小時內同 source 不重複推

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startTs = Date.now();
  const sb = getSupabaseAdmin();

  try {
    // 1. 撈過去 1 小時 log
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: logs } = await sb
      .from("system_run_log")
      .select("source, status, error_message, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (!logs || logs.length === 0) {
      await sb.from("system_run_log").insert({
        source: "cron:cron-failure-alert",
        status: "noop",
        duration_ms: Date.now() - startTs,
        metadata: { reason: "no logs in last hour" },
      });
      return NextResponse.json({ ok: true, alerts: 0, scanned: 0 });
    }

    // 2. group by source
    const stats: Record<string, CronStat> = {};
    for (const l of logs) {
      const s = (l as any).source as string;
      if (!stats[s]) stats[s] = { source: s, total: 0, fail: 0, fail_rate: 0, last_error: null };
      stats[s].total++;
      if ((l as any).status === "fail") {
        stats[s].fail++;
        if (!stats[s].last_error) stats[s].last_error = ((l as any).error_message || "").slice(0, 200);
      }
    }
    Object.values(stats).forEach((s) => { s.fail_rate = s.total > 0 ? s.fail / s.total : 0; });

    // 3. filter 違反 SLA 的 source
    const offenders = Object.values(stats).filter((s) =>
      s.fail >= 3 || (s.fail_rate > 0.5 && s.total >= 2)
    );

    if (offenders.length === 0) {
      await sb.from("system_run_log").insert({
        source: "cron:cron-failure-alert",
        status: "ok",
        rows_in: logs.length,
        rows_out: 0,
        duration_ms: Date.now() - startTs,
        metadata: { sources_scanned: Object.keys(stats).length },
      });
      return NextResponse.json({ ok: true, alerts: 0, scanned: logs.length, sources: Object.keys(stats).length });
    }

    // 4. dedup — 1 小時內同 source 推過就 skip
    const dedupSince = new Date(Date.now() - ALERT_DEDUP_WINDOW_MS).toISOString();
    const { data: pastAlerts } = await sb
      .from("system_run_log")
      .select("metadata")
      .eq("source", "cron:cron-failure-alert")
      .eq("status", "ok")
      .gte("created_at", dedupSince)
      .limit(20);

    const alreadyAlerted = new Set<string>();
    (pastAlerts || []).forEach((p: any) => {
      const arr = p.metadata?.alerted_sources || [];
      arr.forEach((s: string) => alreadyAlerted.add(s));
    });

    const fresh = offenders.filter((o) => !alreadyAlerted.has(o.source));
    if (fresh.length === 0) {
      await sb.from("system_run_log").insert({
        source: "cron:cron-failure-alert",
        status: "noop",
        rows_in: logs.length,
        rows_out: 0,
        duration_ms: Date.now() - startTs,
        metadata: { reason: "all offenders already alerted in last hour" },
      });
      return NextResponse.json({ ok: true, alerts: 0, suppressed: offenders.length });
    }

    // 5. push LINE
    const lines = fresh.map((o) =>
      `❌ ${o.source}\n  ${o.fail}/${o.total} fail (${(o.fail_rate * 100).toFixed(0)}%)\n  ${o.last_error ? `→ ${o.last_error.slice(0, 80)}` : ""}`
    ).join("\n\n");

    const pushRes = await linePush({
      title: `🚨 Cron 異常 (${fresh.length} 個)`,
      body: `過去 1 小時內以下 cron 連續失敗:\n\n${lines}\n\n→ 進 /admin → 系統健康度 / 排程管理`,
      priority: "high",
      reason: "cron_alert",
      link: "https://moyusales.zeabur.app/admin",
    });

    await sb.from("system_run_log").insert({
      source: "cron:cron-failure-alert",
      status: pushRes.ok ? "ok" : "partial",
      rows_in: logs.length,
      rows_out: fresh.length,
      duration_ms: Date.now() - startTs,
      metadata: {
        alerted_sources: fresh.map((o) => o.source),
        push_mode: pushRes.mode,
        push_error: pushRes.error || null,
      },
    });

    return NextResponse.json({
      ok: true,
      alerts: fresh.length,
      offenders: fresh,
      suppressed: offenders.length - fresh.length,
      push_mode: pushRes.mode,
      duration_ms: Date.now() - startTs,
    });
  } catch (err: any) {
    await sb.from("system_run_log").insert({
      source: "cron:cron-failure-alert",
      status: "fail",
      duration_ms: Date.now() - startTs,
      error_message: String(err?.message || err).slice(0, 500),
    });
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: "cron-failure-alert",
    method: "POST",
    note: "送 POST 配 Authorization: Bearer $CRON_SECRET",
  });
}
