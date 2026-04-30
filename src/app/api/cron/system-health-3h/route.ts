import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { linePush } from "@/lib/line-notify";

/**
 * /api/cron/system-health-3h
 * 每 3 小時全系統健康檢查
 *
 * 檢查項目：
 *  1. Worker daemon heartbeat (system_secrets)
 *  2. 104 Poller 最後成功時間 (claude_actions)
 *  3. Auto-iterate 最後執行時間
 *  4. Supabase 關鍵表 row count
 *  5. Zeabur 部署 — fetch homepage 檢查 200
 *  6. outreach_104_queue 完整性 — interested > 72h 沒打電話
 *  7. v3_commands stale — pending > 48h
 *
 * 有 critical issue → LINE push Vincent
 * 全部寫 claude_actions log
 */


interface CheckResult {
  name: string;
  status: "ok" | "warning" | "critical";
  detail: string;
}

export async function GET() {
  const start = Date.now();
  const supabase = getSupabaseAdmin();
  const checks: CheckResult[] = [];
  const criticals: string[] = [];

  // ====== 1. Daemon heartbeat ======
  try {
    const { data } = await supabase
      .from("system_secrets")
      .select("value, updated_at")
      .eq("key", "worker_heartbeat:moyu-worker")
      .maybeSingle();

    if (!data) {
      checks.push({ name: "daemon_heartbeat", status: "critical", detail: "no heartbeat record found" });
      criticals.push("Daemon heartbeat: no record");
    } else {
      const updatedAt = new Date(data.updated_at).getTime();
      const ageMin = Math.floor((Date.now() - updatedAt) / 60000);
      if (ageMin > 30) {
        checks.push({ name: "daemon_heartbeat", status: "critical", detail: `last seen ${ageMin}min ago` });
        criticals.push(`Daemon heartbeat: ${ageMin}min ago (> 30min)`);
      } else {
        checks.push({ name: "daemon_heartbeat", status: "ok", detail: `${ageMin}min ago` });
      }
    }
  } catch (e: unknown) {
    checks.push({ name: "daemon_heartbeat", status: "critical", detail: String(e) });
    criticals.push("Daemon heartbeat: query error");
  }

  // ====== 2. 104 Poller last success ======
  try {
    const { data } = await supabase
      .from("claude_actions")
      .select("created_at")
      .eq("action_type", "104_poller")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      checks.push({ name: "poller_last_run", status: "warning", detail: "no successful poller record" });
    } else {
      const ageMin = Math.floor((Date.now() - new Date(data.created_at).getTime()) / 60000);
      const status = ageMin > 60 ? "warning" : "ok";
      checks.push({ name: "poller_last_run", status, detail: `${ageMin}min ago` });
      if (ageMin > 120) {
        criticals.push(`104 Poller: last success ${ageMin}min ago`);
      }
    }
  } catch {
    checks.push({ name: "poller_last_run", status: "warning", detail: "query error" });
  }

  // ====== 3. Auto-iterate last run ======
  try {
    const { data } = await supabase
      .from("claude_actions")
      .select("created_at")
      .eq("action_type", "auto_iterate")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      checks.push({ name: "auto_iterate", status: "warning", detail: "no record" });
    } else {
      const ageMin = Math.floor((Date.now() - new Date(data.created_at).getTime()) / 60000);
      checks.push({
        name: "auto_iterate",
        status: ageMin > 120 ? "warning" : "ok",
        detail: `${ageMin}min ago`,
      });
    }
  } catch {
    checks.push({ name: "auto_iterate", status: "warning", detail: "query error" });
  }

  // ====== 4. Supabase key table row counts ======
  const keyTables = [
    "outreach_104_queue",
    "v3_commands",
    "claude_actions",
    "users",
  ];
  for (const table of keyTables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true });
      if (error) {
        checks.push({ name: `table_${table}`, status: "warning", detail: error.message });
      } else {
        checks.push({ name: `table_${table}`, status: "ok", detail: `${count} rows` });
      }
    } catch {
      checks.push({ name: `table_${table}`, status: "warning", detail: "query error" });
    }
  }

  // ====== 5. Zeabur deployment health ======
  try {
    const homepageUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://moyusales.zeabur.app";
    const res = await fetch(homepageUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      checks.push({ name: "zeabur_deploy", status: "ok", detail: `HTTP ${res.status}` });
    } else {
      checks.push({ name: "zeabur_deploy", status: "critical", detail: `HTTP ${res.status}` });
      criticals.push(`Zeabur deploy: HTTP ${res.status}`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    checks.push({ name: "zeabur_deploy", status: "critical", detail: msg });
    criticals.push(`Zeabur deploy: ${msg}`);
  }

  // ====== 6. outreach_104_queue integrity ======
  try {
    const threshold72h = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("outreach_104_queue")
      .select("id, candidate_name, updated_at")
      .eq("reply_status", "interested")
      .is("phone_contacted_at", null)
      .lt("updated_at", threshold72h)
      .limit(10);

    if (error) {
      checks.push({ name: "queue_integrity", status: "warning", detail: error.message });
    } else if (data && data.length > 0) {
      const names = data.map((r: { candidate_name: string }) => r.candidate_name).join(", ");
      checks.push({
        name: "queue_integrity",
        status: "critical",
        detail: `${data.length} interested > 72h without contact: ${names}`,
      });
      criticals.push(`${data.length} interested candidates > 72h without phone contact: ${names}`);
    } else {
      checks.push({ name: "queue_integrity", status: "ok", detail: "all contacted within 72h" });
    }
  } catch {
    checks.push({ name: "queue_integrity", status: "warning", detail: "query error" });
  }

  // ====== 7. v3_commands stale check ======
  try {
    const threshold48h = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("v3_commands")
      .select("id, title, owner_email, created_at")
      .eq("status", "pending")
      .lt("created_at", threshold48h)
      .limit(10);

    if (error) {
      checks.push({ name: "stale_commands", status: "warning", detail: error.message });
    } else if (data && data.length > 0) {
      checks.push({
        name: "stale_commands",
        status: "warning",
        detail: `${data.length} pending commands > 48h`,
      });
    } else {
      checks.push({ name: "stale_commands", status: "ok", detail: "no stale commands" });
    }
  } catch {
    checks.push({ name: "stale_commands", status: "warning", detail: "query error" });
  }

  // ====== Summary ======
  const okCount = checks.filter((c) => c.status === "ok").length;
  const warnCount = checks.filter((c) => c.status === "warning").length;
  const critCount = checks.filter((c) => c.status === "critical").length;
  const ms = Date.now() - start;

  // If critical issues found, push LINE to Vincent
  if (criticals.length > 0) {
    try {
      // Create v3_commands for tracking
      await supabase.from("v3_commands").insert({
        owner_email: "vincent@moyuholding.com",
        pillar_id: "recruit",
        title: `[系統警報] ${criticals.length} 個 critical issue`,
        detail: criticals.join("\n"),
        severity: "critical",
        status: "pending",
        ai_generated: true,
        ai_reasoning: `system-health-3h:${new Date().toISOString().slice(0, 13)}`,
      });

      // Push LINE notification
      await linePush({
        title: "[系統健康] Critical Alert",
        body: `系統健康檢查發現 ${criticals.length} 個嚴重問題:\n\n${criticals.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nOK: ${okCount} | Warn: ${warnCount} | Critical: ${critCount}`,
        priority: "critical",
        reason: "system_health",
      });
    } catch (lineErr: unknown) {
      console.error("[system-health] LINE push error:", lineErr);
    }
  }

  // Log to claude_actions
  try {
    await supabase
      .from("claude_actions")
      .insert({
        action_type: "system_health_check",
        detail: JSON.stringify({
          checks,
          summary: { ok: okCount, warning: warnCount, critical: critCount },
          criticals,
          ms,
        }),
        status: critCount > 0 ? "alert" : "completed",
      });
  } catch {
    // non-critical logging, ignore
  }

  return NextResponse.json({
    ok: critCount === 0,
    summary: { ok: okCount, warning: warnCount, critical: critCount },
    checks,
    criticals,
    ms,
  });
}
